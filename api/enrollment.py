# -*- coding: UTF-8 -*-
"""Enrollment module: webcam-based face capture with head pose estimation."""
import os
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from config import (
    ENROLLMENT_YAW_THRESHOLD,
    ENROLLMENT_PITCH_THRESHOLD,
    ENROLLMENT_ANGLE_TOLERANCE,
    ENROLLMENT_MIN_FACE_SIZE,
    ENROLLMENT_FACE_QUALITY_BLUR,
    ENROLLMENT_PHOTOS_PER_STAGE,
    ENROLLMENT_POOL_SIZE,
    ENROLLMENT_PHOTOS_DIR,
)
from .engine import engine
from .database import db

logger = logging.getLogger(__name__)

# Stage definitions
STAGES = [
    ('straight', 0, 0),
    ('left', -30, 0),
    ('right', 30, 0),
    ('up', 0, -20),
    ('down', 0, 20),
]

STAGE_LABELS = {
    'straight': 'Смотрите прямо в камеру',
    'left': 'Поверните голову влево',
    'right': 'Поверните голову вправо',
    'up': 'Поднимите голову вверх',
    'down': 'Опустите голову вниз',
}


# ====== Frame pool entry ======
class PoolEntry:
    __slots__ = ('frame', 'yaw', 'pitch', 'blur', 'center_score')

    def __init__(self, frame: np.ndarray, yaw: float, pitch: float,
                 blur: float, center_score: float):
        self.frame = frame
        self.yaw = yaw
        self.pitch = pitch
        self.blur = blur
        self.center_score = center_score


# ====== Enrollment Session ======
class EnrollmentSession:
    def __init__(self, session_id: str, person_name: str, person_role: str):
        self.session_id = session_id
        self.person_name = person_name
        self.person_role = person_role
        self.stages = [s[0] for s in STAGES]
        self.current_stage = 0
        # Each entry: (stage_name, frame) — multiple per stage
        self.captured_photos: List[Tuple[str, np.ndarray]] = []
        self.created_at = datetime.now()
        self.status = 'in_progress'
        # Pool for current stage
        self.frame_pool: List[PoolEntry] = []

    @property
    def current_stage_name(self) -> str:
        if self.current_stage < len(self.stages):
            return self.stages[self.current_stage]
        return 'done'

    @property
    def is_complete(self) -> bool:
        return self.current_stage >= len(self.stages)

    def to_dict(self) -> dict:
        stages_done = []
        seen = set()
        for name, _ in self.captured_photos:
            if name not in seen:
                stages_done.append(name)
                seen.add(name)
        return {
            'session_id': self.session_id,
            'person_name': self.person_name,
            'current_stage': self.current_stage,
            'total_stages': len(self.stages),
            'stages_completed': stages_done,
            'status': self.status,
        }


# Active sessions storage
sessions: Dict[str, EnrollmentSession] = {}


def create_session(name: str, role: str) -> EnrollmentSession:
    session_id = str(uuid.uuid4())[:8]
    session = EnrollmentSession(session_id, name, role)
    sessions[session_id] = session
    logger.info(f"Enrollment session {session_id} created for '{name}'")
    return session


def get_session(session_id: str) -> Optional[EnrollmentSession]:
    return sessions.get(session_id)


def cancel_session(session_id: str) -> bool:
    session = sessions.pop(session_id, None)
    if session:
        session.status = 'cancelled'
        logger.info(f"Enrollment session {session_id} cancelled")
        return True
    return False


# ====== Head Pose Estimation (roll-invariant) ======

def estimate_head_pose(landmarks_5pt: np.ndarray, frame_shape: Tuple[int, int]) -> Tuple[float, float, float]:
    """Estimate yaw/pitch/roll from 5 landmarks using roll-invariant geometry.

    Landmarks: [left_eye, right_eye, nose, left_mouth, right_mouth]
    Returns (yaw, pitch, roll) in degrees.
    """
    le, re, nose, lm, rm = landmarks_5pt

    # Roll
    eye_vec = re - le
    roll_rad = np.arctan2(eye_vec[1], eye_vec[0])
    roll_deg = float(np.degrees(roll_rad))

    d_eyes = np.linalg.norm(eye_vec)
    if d_eyes < 1e-6:
        return 0.0, 0.0, 0.0

    # Undo roll: rotate so eye-line is horizontal
    cos_r, sin_r = np.cos(-roll_rad), np.sin(-roll_rad)
    rot = np.array([[cos_r, -sin_r], [sin_r, cos_r]])

    eyes_mid = (le + re) / 2.0
    nose_r = rot @ (nose - eyes_mid)
    mouth_mid = (lm + rm) / 2.0
    mouth_r = rot @ (mouth_mid - eyes_mid)

    # Yaw: horizontal displacement of nose normalized by half inter-eye distance
    yaw_deg = float(nose_r[0] / (d_eyes / 2.0) * 45.0)

    # Pitch: vertical position of nose between eyes and mouth
    face_height = mouth_r[1]
    if abs(face_height) < 1e-6:
        return yaw_deg, 0.0, roll_deg

    nose_ratio = nose_r[1] / face_height  # 0=eyes, 1=mouth
    pitch_deg = float((nose_ratio - 0.57) * 120.0)

    return yaw_deg, pitch_deg, roll_deg


# ====== Quality Functions ======

def _laplacian_score(face_region: np.ndarray) -> float:
    """Laplacian variance — higher = sharper."""
    gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _centering_score(bbox: list, frame_shape: tuple) -> float:
    """1.0 = face perfectly centered, 0.0 = at edge."""
    x1, y1, x2, y2 = bbox
    fh, fw = frame_shape[:2]
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    dx = abs(cx - fw / 2.0) / (fw / 2.0)
    dy = abs(cy - fh / 2.0) / (fh / 2.0)
    return 1.0 - (dx + dy) / 2.0


def _check_stage_match(yaw: float, pitch: float, stage_name: str) -> bool:
    """Check if head pose matches the target stage."""
    if stage_name == 'straight':
        return (abs(yaw) <= ENROLLMENT_ANGLE_TOLERANCE and
                abs(pitch) <= ENROLLMENT_ANGLE_TOLERANCE)
    elif stage_name == 'left':
        return yaw < -ENROLLMENT_YAW_THRESHOLD
    elif stage_name == 'right':
        return yaw > ENROLLMENT_YAW_THRESHOLD
    elif stage_name == 'up':
        return abs(yaw) <= ENROLLMENT_YAW_THRESHOLD and pitch < -ENROLLMENT_PITCH_THRESHOLD
    elif stage_name == 'down':
        return abs(yaw) <= ENROLLMENT_YAW_THRESHOLD and pitch > ENROLLMENT_PITCH_THRESHOLD
    return False


# ====== Best Frame Selection (разброс + качество) ======

def select_best_frames(pool: List[PoolEntry], n: int = ENROLLMENT_PHOTOS_PER_STAGE) -> List[PoolEntry]:
    """Select N frames from pool maximizing angle diversity + sharpness.

    Algorithm:
    1. Sort pool by primary pose axis (yaw for left/right, pitch for up/down)
    2. Split into N equal bins (zones)
    3. From each bin pick the sharpest frame
    """
    if len(pool) <= n:
        return pool

    # Determine primary axis: use the one with more spread
    yaws = [e.yaw for e in pool]
    pitches = [e.pitch for e in pool]
    yaw_spread = max(yaws) - min(yaws)
    pitch_spread = max(pitches) - min(pitches)

    if yaw_spread >= pitch_spread:
        # Sort by yaw
        sorted_pool = sorted(pool, key=lambda e: e.yaw)
    else:
        # Sort by pitch
        sorted_pool = sorted(pool, key=lambda e: e.pitch)

    # Split into N bins
    bin_size = len(sorted_pool) / n
    selected = []
    for i in range(n):
        start = int(i * bin_size)
        end = int((i + 1) * bin_size)
        bin_entries = sorted_pool[start:end]
        if bin_entries:
            # Pick sharpest from this bin
            best = max(bin_entries, key=lambda e: e.blur)
            selected.append(best)

    return selected


# ====== Main Frame Processing ======

def process_enrollment_frame(session: EnrollmentSession, frame: np.ndarray) -> dict:
    """Process a single frame for enrollment.

    Detects face, estimates pose, if pose matches — adds to pool.
    When pool is full → select best 3 frames → advance to next stage.
    """
    if session.is_complete:
        return {
            'face_detected': False,
            'stage': session.current_stage,
            'stage_name': 'done',
            'captured': False,
            'completed': True,
            'progress': session.current_stage,
            'total': len(session.stages),
            'message': 'Все ракурсы собраны',
        }

    engine.initialize()
    stage_name = session.current_stage_name
    pool_count = len(session.frame_pool)

    result = {
        'face_detected': False,
        'bbox': None,
        'landmarks': None,
        'yaw': 0.0,
        'pitch': 0.0,
        'roll': 0.0,
        'stage': session.current_stage,
        'stage_name': stage_name,
        'stage_label': STAGE_LABELS.get(stage_name, ''),
        'captured': False,
        'completed': False,
        'progress': session.current_stage,
        'total': len(session.stages),
        'message': STAGE_LABELS.get(stage_name, ''),
        'stable': pool_count,
        'stable_required': ENROLLMENT_POOL_SIZE,
    }

    # --- Face Detection ---
    try:
        faces = engine.arcface_model.get(frame)
    except Exception as e:
        logger.error(f"Face detection error: {e}")
        result['message'] = 'Ошибка детекции'
        return result

    if not faces:
        logger.debug(f"[{session.session_id}] stage={stage_name} | no face")
        result['message'] = 'Лицо не обнаружено'
        return result

    # Filter small faces
    big_faces = [f for f in faces
                 if (f.bbox[2] - f.bbox[0]) >= ENROLLMENT_MIN_FACE_SIZE
                 and (f.bbox[3] - f.bbox[1]) >= ENROLLMENT_MIN_FACE_SIZE]

    if not big_faces:
        sizes = [f"{int(f.bbox[2]-f.bbox[0])}x{int(f.bbox[3]-f.bbox[1])}" for f in faces]
        logger.debug(f"[{session.session_id}] stage={stage_name} | too small: {sizes}")
        result['message'] = f'Подойдите ближе (мин. {ENROLLMENT_MIN_FACE_SIZE}px)'
        return result

    # Pick largest
    face = max(big_faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    bbox = face.bbox.astype(int).tolist()
    face_w, face_h = bbox[2] - bbox[0], bbox[3] - bbox[1]

    result['face_detected'] = True
    result['bbox'] = bbox

    # --- Landmarks ---
    landmarks = face.kps
    if landmarks is None or len(landmarks) < 5:
        result['message'] = 'Ключевые точки не определены'
        return result

    result['landmarks'] = landmarks.tolist()

    # --- Head Pose ---
    yaw, pitch, roll = estimate_head_pose(landmarks, frame.shape)
    result['yaw'] = round(yaw, 1)
    result['pitch'] = round(pitch, 1)
    result['roll'] = round(roll, 1)

    # --- Blur Check ---
    x1, y1, x2, y2 = max(0, bbox[0]), max(0, bbox[1]), min(frame.shape[1], bbox[2]), min(frame.shape[0], bbox[3])
    face_region = frame[y1:y2, x1:x2]
    blur = _laplacian_score(face_region) if face_region.size > 0 else 0.0

    if blur < ENROLLMENT_FACE_QUALITY_BLUR:
        logger.debug(f"[{session.session_id}] stage={stage_name} | blur={blur:.0f} < {ENROLLMENT_FACE_QUALITY_BLUR}")
        result['message'] = f'Размыто ({blur:.0f}). Не двигайтесь'
        result['debug'] = {'blur': round(blur, 1), 'blur_threshold': ENROLLMENT_FACE_QUALITY_BLUR}
        return result

    # --- Stage Match ---
    matched = _check_stage_match(yaw, pitch, stage_name)

    result['debug'] = {
        'yaw': round(yaw, 1),
        'pitch': round(pitch, 1),
        'roll': round(roll, 1),
        'face_size': f'{face_w}x{face_h}',
        'blur': round(blur, 1),
        'stage': stage_name,
        'matched': matched,
        'pool': f'{pool_count}/{ENROLLMENT_POOL_SIZE}',
    }
    logger.info(
        f"[{session.session_id}] stage={stage_name} | yaw={yaw:.1f} pitch={pitch:.1f} "
        f"blur={blur:.0f} match={matched} pool={pool_count}/{ENROLLMENT_POOL_SIZE}"
    )

    if matched:
        # Add to pool
        center = _centering_score(bbox, frame.shape)
        entry = PoolEntry(frame.copy(), yaw, pitch, blur, center)
        session.frame_pool.append(entry)
        pool_count = len(session.frame_pool)

        result['stable'] = pool_count
        result['stable_required'] = ENROLLMENT_POOL_SIZE
        result['message'] = f'{STAGE_LABELS.get(stage_name, "")} — держите... ({pool_count}/{ENROLLMENT_POOL_SIZE})'

        # Pool full → select best frames → next stage
        if pool_count >= ENROLLMENT_POOL_SIZE:
            best = select_best_frames(session.frame_pool, ENROLLMENT_PHOTOS_PER_STAGE)
            for entry in best:
                session.captured_photos.append((stage_name, entry.frame))

            angles = [(e.yaw, e.pitch, e.blur) for e in best]
            logger.info(
                f"[{session.session_id}] stage={stage_name} captured {len(best)} frames: "
                f"{['yaw={:.1f} pitch={:.1f} blur={:.0f}'.format(*a) for a in angles]}"
            )

            session.frame_pool.clear()
            session.current_stage += 1
            result['captured'] = True
            result['progress'] = session.current_stage

            if session.is_complete:
                result['completed'] = True
                result['stage_name'] = 'done'
                result['message'] = 'Все ракурсы собраны!'
            else:
                next_name = session.current_stage_name
                result['stage'] = session.current_stage
                result['stage_name'] = next_name
                result['stage_label'] = STAGE_LABELS.get(next_name, '')
                result['message'] = f'Отлично! Теперь: {STAGE_LABELS.get(next_name, "")}'
    else:
        # Pose lost — reset pool
        if session.frame_pool:
            logger.debug(f"[{session.session_id}] stage={stage_name} | pose lost, pool reset ({pool_count} frames)")
        session.frame_pool.clear()
        result['stable'] = 0
        result['stable_required'] = ENROLLMENT_POOL_SIZE
        result['message'] = STAGE_LABELS.get(stage_name, '')

    return result


# ====== Complete Enrollment ======

def complete_enrollment(session: EnrollmentSession) -> dict:
    """Finalize: generate embeddings from all captured photos, save to DB."""
    if not session.captured_photos:
        return {'success': False, 'message': 'Нет захваченных фото'}

    engine.initialize()

    person_id = str(uuid.uuid4())[:8]
    person = {
        'id': person_id,
        'name': session.person_name,
        'role': session.person_role,
        'photo_url': None,
        'has_face_encoding': False,
        'registered_at': datetime.now().isoformat(),
    }

    # Save photos & extract embeddings
    os.makedirs(ENROLLMENT_PHOTOS_DIR, exist_ok=True)
    person_dir = os.path.join(ENROLLMENT_PHOTOS_DIR, person_id)
    os.makedirs(person_dir, exist_ok=True)

    embeddings = []
    stage_counts: Dict[str, int] = {}
    for stage_name, frame in session.captured_photos:
        idx = stage_counts.get(stage_name, 0)
        stage_counts[stage_name] = idx + 1
        # Save: straight_0.jpg, straight_1.jpg, straight_2.jpg, left_0.jpg, ...
        photo_path = os.path.join(person_dir, f'{stage_name}_{idx}.jpg')
        cv2.imwrite(photo_path, frame)

        embedding = engine.get_embedding(frame)
        if embedding is not None:
            embeddings.append(embedding)

    if not embeddings:
        return {'success': False, 'message': 'Не удалось извлечь эмбеддинги'}

    # Save to database
    db.persons[person_id] = person
    db.face_database[person_id] = np.array(embeddings)
    db.persons[person_id]['has_face_encoding'] = True
    db.save_face_database()

    # Avatar
    avatar_path = os.path.join(person_dir, 'straight_0.jpg')
    if os.path.exists(avatar_path):
        db.persons[person_id]['photo_url'] = f'/data/enrollment/{person_id}/straight_0.jpg'

    session.status = 'completed'
    sessions.pop(session.session_id, None)

    total_photos = len(session.captured_photos)
    logger.info(
        f"Enrollment complete: '{session.person_name}' id={person_id}, "
        f"{total_photos} photos, {len(embeddings)} embeddings"
    )

    return {
        'success': True,
        'person_id': person_id,
        'name': session.person_name,
        'photos_count': total_photos,
        'embeddings_count': len(embeddings),
        'message': f'Успешно! {total_photos} фото, {len(embeddings)} эмбеддингов',
    }
