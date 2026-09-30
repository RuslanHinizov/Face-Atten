# -*- coding: UTF-8 -*-
"""Face detection and recognition."""
import asyncio
import logging
from datetime import datetime
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor
import uuid

from .database import db
from .engine import engine
from .tracking import (
    match_tracks, get_track, update_track, active_tracks,
    RECOGNITION_REFRESH_INTERVAL
)

logger = logging.getLogger(__name__)

# Thread pool for face detection (non-blocking)
detection_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="face_detect")

# Track if detection is already running per camera (prevent concurrent detections)
detection_inflight: Dict[str, bool] = {}


async def run_detection_async(
    camera_id: str,
    frame,
    frame_count: int,
    h: int,
    w: int,
    fps: int,
    broadcast_callback
):
    """Run face detection in background without blocking MJPEG stream"""
    # Skip if detection already in progress for this camera
    if detection_inflight.get(camera_id, False):
        return

    detection_inflight[camera_id] = True
    try:
        loop = asyncio.get_event_loop()
        faces_data = await loop.run_in_executor(
            detection_executor,
            detect_faces_sync,
            frame, frame_count, h, w, camera_id
        )

        if faces_data:
            logger.info(f"[{camera_id}] Detected {len(faces_data)} faces")

        # Broadcast results
        await broadcast_callback(camera_id, faces_data, fps, (w, h), frame_count)
    finally:
        detection_inflight[camera_id] = False


def detect_faces_sync(frame, frame_count: int, h: int, w: int, camera_id: str) -> List[dict]:
    """Synchronous face detection with tracking - runs in thread pool"""
    if not engine.arcface_model:
        return []

    try:
        faces = engine.arcface_model.get(frame)
        if not faces:
            return []

        # Extract bboxes for tracking
        bboxes = [[int(f.bbox[0]), int(f.bbox[1]), int(f.bbox[2]), int(f.bbox[3])] for f in faces]

        # Match to existing tracks
        track_ids = match_tracks(camera_id, bboxes)

        now = datetime.now().timestamp()
        faces_data = []
        recognitions_run = 0

        for idx, (face, bbox, track_id) in enumerate(zip(faces, bboxes, track_ids)):
            track = get_track(camera_id, track_id)
            need_recognition = False

            if track is None:
                # New track - need recognition
                need_recognition = True
            elif now - track.get('last_recognition_time', 0) > RECOGNITION_REFRESH_INTERVAL:
                # Stale recognition - refresh
                need_recognition = True

            if need_recognition:
                # Run recognition
                embedding = face.embedding
                person_id, confidence = engine.recognize_face(embedding)
                recognitions_run += 1

                # If confidence < 50%, treat as unknown
                if confidence < 0.5:
                    display_name = "Белгісіз"
                    display_role = "unknown"
                    valid_person = False
                else:
                    display_name = db.persons[person_id]['name'] if person_id else "Белгісіз"
                    display_role = db.persons[person_id]['role'] if person_id else "unknown"
                    valid_person = person_id is not None

                # Update/create track
                track_data = {
                    'bbox': bbox,
                    'person_id': person_id if valid_person else None,
                    'confidence': confidence,
                    'name': display_name,
                    'role': display_role,
                    'last_recognition_time': now,
                    'last_seen': now
                }
                update_track(camera_id, track_id, track_data)

                # Record attendance (only if confidence >= 50%)
                if valid_person and person_id not in db.attendance:
                    _record_attendance(person_id, confidence, camera_id)
            else:
                # Use cached recognition - just update bbox and last_seen
                track['bbox'] = bbox
                track['last_seen'] = now

            # Build face data from track
            track = get_track(camera_id, track_id)
            face_data = {
                "id": f"{track_id}",
                "trackId": track_id,
                "personId": track['person_id'] or "unknown",
                "personName": track['name'],
                "role": track['role'],
                "bbox": bbox,
                "confidence": float(track['confidence']),
                "status": "on_time"
            }
            faces_data.append(face_data)

        if recognitions_run > 0:
            logger.info(f"[{camera_id}] Recognition: {recognitions_run}/{len(faces)} (cache hit: {len(faces) - recognitions_run})")

        return faces_data
    except Exception as e:
        logger.error(f"Face detection error: {e}")
        return []


def _get_group_from_id(person_id: str) -> str:
    """Derive group from person_id prefix (e.g. '418_1' -> '418')"""
    if person_id.startswith('418_'):
        return '418'
    elif person_id.startswith('428_'):
        return '428'
    return 'unknown'


def _record_attendance(person_id: str, confidence: float, camera_id: str = ''):
    """Record attendance for recognized person"""
    person = db.persons.get(person_id)
    if not person:
        return

    group = _get_group_from_id(person_id)
    db.attendance[person_id] = {
        'id': str(uuid.uuid4())[:8],
        'person_id': person_id,
        'name': person['name'],
        'role': person['role'],
        'status': 'present',
        'timestamp': datetime.now().isoformat(),
        'confidence': confidence,
        'camera_id': camera_id,
        'group': group
    }
    db.events.append({
        'id': str(uuid.uuid4())[:8],
        'type': 'attendance',
        'person_id': person_id,
        'name': person['name'],
        'camera_id': camera_id,
        'group': group,
        'timestamp': datetime.now().isoformat()
    })


def reset_detection_flag(camera_id: str):
    """Reset detection inflight flag"""
    detection_inflight[camera_id] = False
