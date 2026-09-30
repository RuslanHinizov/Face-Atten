# -*- coding: UTF-8 -*-
"""
Извлечение лиц студентов с DeepSORT трекингом.

Процесс:
1. YOLO детекция лиц + ArcFace эмбеддинги
2. DeepSORT трекинг (appearance + motion matching)
3. Для каждого track_id собираем разные ракурсы
4. В конце объединяем треки одного человека по эмбеддингам

Использование:
    python scripts/extract_students.py data/videos/video.mp4
    python scripts/extract_students.py data/videos/video.mp4 --align
"""
import os
import sys
import warnings
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

os.environ['ONNXRUNTIME_LOG_LEVEL'] = '3'  # Suppress ONNX Runtime logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore')

import argparse
import cv2
import numpy as np
import csv
import torch
import shutil
from pathlib import Path
from tqdm import tqdm

# Config
import config as cfg

# YOLO imports
from models.experimental import attempt_load
from utils.general import check_img_size, non_max_suppression_face, non_max_suppression, scale_coords
from utils.datasets import letterbox

# ArcFace для эмбеддингов
import onnxruntime
onnxruntime.set_default_logger_severity(3)  # ERROR only
from insightface.app import FaceAnalysis


# =============================================================================
# УТИЛИТЫ
# =============================================================================

import sys
import io
from contextlib import contextmanager

@contextmanager
def suppress_stdout():
    """Подавляет вывод в stdout."""
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        yield
    finally:
        sys.stdout = old_stdout


def align_face(img, landmarks, output_size=None):
    """Выравнивает лицо по 5 ключевым точкам."""
    if output_size is None:
        output_size = cfg.ARCFACE_INPUT_SIZE
    if isinstance(landmarks, (list, tuple)):
        landmarks = np.array(landmarks)

    if landmarks.size == 10:
        src_pts = landmarks.reshape(5, 2).astype(np.float32)
    else:
        src_pts = landmarks.astype(np.float32)

    M, _ = cv2.estimateAffinePartial2D(src_pts, cfg.ARCFACE_DST, method=cv2.LMEDS)
    if M is None:
        return None

    return cv2.warpAffine(img, M, output_size, borderValue=0.0)


def scale_coords_landmarks(img1_shape, coords, img0_shape):
    """Масштабирует landmarks к оригинальному размеру."""
    gain = min(img1_shape[0] / img0_shape[0], img1_shape[1] / img0_shape[1])
    pad = (img1_shape[1] - img0_shape[1] * gain) / 2, (img1_shape[0] - img0_shape[0] * gain) / 2
    coords[:, [0, 2, 4, 6, 8]] -= pad[0]
    coords[:, [1, 3, 5, 7, 9]] -= pad[1]
    coords[:, :10] /= gain
    return coords


def iou(box1, box2):
    """Intersection over Union."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])

    return inter / (area1 + area2 - inter + 1e-6)


def are_landmarks_valid(landmarks, bbox):
    """Проверяет валидность ключевых точек."""
    if landmarks is None or len(landmarks) < 10:
        return False

    x1, y1, x2, y2 = bbox
    margin = 10
    for i in range(5):
        px, py = landmarks[i*2], landmarks[i*2+1]
        if not (x1 - margin < px < x2 + margin and y1 - margin < py < y2 + margin):
            return False
    return True


# =============================================================================
# ТРЕКИНГ (DeepSORT)
# =============================================================================

from trackers import DeepSORT, DeepSORTTrack


# =============================================================================
# ДЕТЕКТОР
# =============================================================================

class FaceDetector:
    """YOLO Face + ArcFace детектор."""

    def __init__(self, device='cuda'):
        self.device = device

        # Load YOLO Face
        print("[Detector] Loading YOLO Face...")
        self.yolo = attempt_load(cfg.YOLO_WEIGHTS, map_location=device)
        self.yolo.eval()
        self.stride = int(self.yolo.stride.max())
        self.img_size = cfg.YOLO_IMG_SIZE

        # Load ArcFace
        print("[Detector] Loading ArcFace...")
        with suppress_stdout():
            app = FaceAnalysis(
                name=cfg.ARCFACE_MODEL,
                root=cfg.INSIGHTFACE_ROOT,
                providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
            )
            app.prepare(ctx_id=0, det_size=cfg.ARCFACE_DET_SIZE)

        self.rec_model = None
        for name, model in app.models.items():
            if 'recognition' in name or 'w600k' in name or 'rec' in name:
                self.rec_model = model
                break

        print("[Detector] Ready!")

    def detect(self, frame):
        """Детекция лиц с landmarks."""
        img = letterbox(frame, new_shape=self.img_size)[0]
        img = img.transpose(2, 0, 1).copy()
        img = torch.from_numpy(img).to(self.device).float() / 255.0
        if img.ndimension() == 3:
            img = img.unsqueeze(0)

        with torch.no_grad():
            pred = self.yolo(img)[0]

        pred = non_max_suppression_face(pred, cfg.YOLO_CONF_THRES, cfg.YOLO_IOU_THRES)

        faces = []
        for det in pred:
            if len(det):
                det[:, :4] = scale_coords(img.shape[2:], det[:, :4], frame.shape).round()
                det[:, 5:15] = scale_coords_landmarks(img.shape[2:], det[:, 5:15], frame.shape).round()

                for j in range(det.size()[0]):
                    xyxy = det[j, :4].cpu().numpy().astype(int)
                    conf = det[j, 4].cpu().numpy().item()
                    landmarks = det[j, 5:15].cpu().numpy()

                    w, h = xyxy[2] - xyxy[0], xyxy[3] - xyxy[1]
                    if min(w, h) >= cfg.MIN_FACE_SIZE:
                        faces.append({
                            'bbox': xyxy.tolist(),
                            'landmarks': landmarks,
                            'confidence': conf
                        })

        return faces

    def get_embedding(self, frame, bbox, landmarks=None):
        """Извлекает эмбеддинг."""
        # Выравнивание по landmarks
        if cfg.USE_ALIGNMENT and landmarks is not None:
            if are_landmarks_valid(landmarks, bbox):
                aligned = align_face(frame, landmarks)
                if aligned is not None:
                    try:
                        emb = self.rec_model.get_feat(aligned)
                        emb = emb.flatten()
                        return emb / np.linalg.norm(emb)
                    except:
                        pass

        # Fallback
        x1, y1, x2, y2 = [int(v) for v in bbox]
        pad = 15
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2, y2 = min(frame.shape[1], x2 + pad), min(frame.shape[0], y2 + pad)
        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0 or face_crop.shape[0] < 20 or face_crop.shape[1] < 20:
            return None

        face_resized = cv2.resize(face_crop, (112, 112))

        try:
            emb = self.rec_model.get_feat(face_resized)
            emb = emb.flatten()
            return emb / np.linalg.norm(emb)
        except:
            return None


# =============================================================================
# СОХРАНЕНИЕ
# =============================================================================

def save_face(output_dir, track_id, frame, bbox, landmarks, photo_num, use_alignment=True):
    """Сохраняет лицо в папку track_id."""
    track_dir = output_dir / f"track_{track_id}"
    track_dir.mkdir(exist_ok=True)

    # Высококачественный кроп лица с отступом
    x1, y1, x2, y2 = [int(v) for v in bbox]
    fw, fh = x2 - x1, y2 - y1
    pad = int(max(fw, fh) * 0.4)  # 40% отступ вокруг лица
    x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
    x2, y2 = min(frame.shape[1], x2 + pad), min(frame.shape[0], y2 + pad)
    face_crop = frame[y1:y2, x1:x2]

    if face_crop.size == 0:
        return False

    # Сохраняем полноразмерный кроп в PNG (без потерь)
    face_path = track_dir / f"{photo_num:03d}.png"
    cv2.imwrite(str(face_path), face_crop)

    # Дополнительно сохраняем aligned 112x112 для эмбеддингов
    if use_alignment and landmarks is not None and are_landmarks_valid(landmarks, bbox):
        aligned = align_face(frame, landmarks)
        if aligned is not None:
            aligned_path = track_dir / f"{photo_num:03d}_aligned.jpg"
            cv2.imwrite(str(aligned_path), aligned)

    return True


class UnionFind:
    """Union-Find (Disjoint Set) для connected components."""

    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return
        # union by rank
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1


def is_high_quality_track(track, min_face_size=35, min_avg_conf=0.6, min_photos=3):
    """Проверяет, является ли трек высококачественным для создания связей."""
    # Много фото = качественный (даже если лица мелкие)
    if len(track.embeddings) >= 10:
        return True

    # Мало фото - проверяем качество
    if len(track.embeddings) < min_photos:
        return False

    # Проверяем медианный размер лица
    if track.face_sizes:
        median_size = np.median(track.face_sizes)
        if median_size < min_face_size:
            return False

    # Проверяем среднюю уверенность детекции
    if track.confidences:
        avg_conf = np.mean(track.confidences)
        if avg_conf < min_avg_conf:
            return False

    return True


def merge_tracks(tracks, threshold=0.60, start_id=1):
    """
    Объединяет треки с учетом временных ограничений и средней схожести.

    Ключевая идея: если треки пересекаются по времени - это разные люди!
    """
    if not tracks:
        return {}

    valid_tracks = []
    track_embeddings = []
    track_intervals = []

    # 1. Предварительная обработка и фильтрация
    for track in tracks:
        embs = [e for e in getattr(track, 'embeddings', []) if e is not None]
        if len(embs) > 0:
            # Нормализуем эмбеддинги
            embs_array = np.array(embs)
            norms = np.linalg.norm(embs_array, axis=1, keepdims=True)
            embs_array = embs_array / (norms + 1e-6)

            valid_tracks.append(track)
            track_embeddings.append(embs_array)
            # Сохраняем [start_frame, end_frame] для проверки на пересечение
            start_frame = getattr(track, 'start_frame', 0)
            end_frame = getattr(track, 'end_frame', float('inf'))
            track_intervals.append((start_frame, end_frame))

    n_tracks = len(valid_tracks)
    if n_tracks == 0:
        return {}

    total_embs = sum(len(e) for e in track_embeddings)
    print(f"  Tracks: {n_tracks}, Embeddings: {total_embs}")

    uf = UnionFind(n_tracks)

    # 2. Сравнение пар треков
    temporal_skipped = 0
    merged_pairs = 0

    for i in range(n_tracks):
        for j in range(i + 1, n_tracks):

            # А. ПРОВЕРКА ПО ВРЕМЕНИ (Temporal Constraint)
            # Если интервалы пересекаются — это разные люди, пропускаем
            start_i, end_i = track_intervals[i]
            start_j, end_j = track_intervals[j]
            if not (end_i < start_j or end_j < start_i):
                temporal_skipped += 1
                continue

            # Б. РАСЧЕТ СРЕДНЕЙ СХОЖЕСТИ
            sim_matrix = np.dot(track_embeddings[i], track_embeddings[j].T)
            avg_sim = np.mean(sim_matrix)

            # В. ПРОВЕРКА ПОРОГА
            if avg_sim >= threshold:
                uf.union(i, j)
                merged_pairs += 1

    print(f"  Temporal skipped: {temporal_skipped}, Merged pairs: {merged_pairs}")

    # 3. Группировка результатов
    components = {}
    for i in range(n_tracks):
        root = uf.find(i)
        if root not in components:
            components[root] = []
        components[root].append(valid_tracks[i].id)

    # 4. Формирование финального словаря студентов
    students = {}
    student_id = start_id
    for track_ids in components.values():
        students[student_id] = track_ids
        student_id += 1

    print(f"  Clusters: {len(students)}")
    return students


def reorganize_folders(output_dir, student_tracks, max_photos=None):
    """
    Переименовывает папки track_* в student_*.
    Объединяет папки если несколько треков = один студент.
    Студенты с малым кол-вом фото → _unknown.
    Лимитирует фото на студента.
    """
    if max_photos is None:
        max_photos = cfg.MAX_PHOTOS_PER_STUDENT

    unknown_dir = output_dir / "_unknown"
    unknown_count = 0

    for student_id, track_ids in student_tracks.items():
        # Сначала собираем все фото трека во временную папку
        student_dir = output_dir / str(student_id)
        student_dir.mkdir(exist_ok=True)

        photo_num = 1
        for track_id in track_ids:
            track_dir = output_dir / f"track_{track_id}"
            if track_dir.exists():
                # Берём только основные кропы (png), пропускаем _aligned
                photos = sorted([p for p in track_dir.glob("*.png") if '_aligned' not in p.stem])
                for photo in photos:
                    # Лимит фото на студента
                    if photo_num > max_photos:
                        photo.unlink()
                        continue
                    new_path = student_dir / f"{photo_num:03d}.png"
                    shutil.move(str(photo), str(new_path))
                    photo_num += 1
                # Удаляем пустую папку трека
                try:
                    track_dir.rmdir()
                except OSError:
                    # Папка не пустая - удаляем оставшиеся файлы
                    shutil.rmtree(track_dir, ignore_errors=True)

        # Проверяем минимум фото
        photo_count = min(photo_num - 1, max_photos)
        if photo_count < cfg.MIN_PHOTOS_FOR_STUDENT:
            # Перемещаем в _unknown
            unknown_dir.mkdir(exist_ok=True)
            unknown_count += 1
            unknown_subdir = unknown_dir / f"u{unknown_count}"
            shutil.move(str(student_dir), str(unknown_subdir))

    if unknown_count > 0:
        print(f"Moved {unknown_count} low-photo clusters to _unknown/")

    # Orphan треки - удаляем (это фрагменты без эмбеддингов)
    orphan_tracks = list(output_dir.glob("track_*"))
    orphan_count = 0
    for track_dir in orphan_tracks:
        if track_dir.is_dir():
            shutil.rmtree(track_dir, ignore_errors=True)
            orphan_count += 1
    if orphan_count > 0:
        print(f"Deleted {orphan_count} orphan tracks (no embeddings)")

    # Перенумеровать папки чтобы не было дырок (1, 2, 3... вместо 1, 3, 7...)
    existing_dirs = sorted([d for d in output_dir.iterdir() if d.is_dir() and d.name.isdigit()],
                           key=lambda x: int(x.name))
    for new_id, old_dir in enumerate(existing_dirs, start=1):
        if int(old_dir.name) != new_id:
            new_dir = output_dir / str(new_id)
            shutil.move(str(old_dir), str(new_dir))


def save_csv(output_dir, student_tracks=None, tracks=None, append=False):
    """Сохраняет CSV с информацией о студентах (по реальным папкам)."""
    csv_path = output_dir / "students.csv"

    # Находим все папки студентов
    student_dirs = sorted([d for d in output_dir.iterdir() if d.is_dir() and d.name.isdigit()],
                          key=lambda x: int(x.name))

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'photos', 'tracks', 'name'])
        writer.writeheader()

        for student_dir in student_dirs:
            student_id = int(student_dir.name)
            photo_count = len(list(student_dir.glob("*.png"))) + len(list(student_dir.glob("*.jpg")))

            writer.writerow({
                'id': student_id,
                'photos': photo_count,
                'tracks': 1,
                'name': ''
            })

    print(f"CSV saved: {csv_path}")


# =============================================================================
# MAIN
# =============================================================================

def get_max_student_id(directory):
    """Находит максимальный ID студента в папке."""
    max_id = 0
    for item in Path(directory).iterdir():
        if item.is_dir() and item.name.isdigit():
            max_id = max(max_id, int(item.name))
    return max_id


def main():
    parser = argparse.ArgumentParser(description='Extract students with tracking')
    parser.add_argument('video', nargs='?', default=cfg.VIDEO_PATH, help='Video file')
    parser.add_argument('--output', '-o', default=None, help='Output directory')
    parser.add_argument('--append', '-a', default=None, help='Append to existing exp (e.g., exp26)')
    parser.add_argument('--frame-skip', type=int, default=cfg.FRAME_SKIP, help='Process every N frames')
    parser.add_argument('--max-photos', type=int, default=cfg.MAX_PHOTOS_PER_STUDENT, help='Max photos per student')
    parser.add_argument('--align', action='store_true', default=cfg.USE_ALIGNMENT, help='Use face alignment')
    parser.add_argument('--preview', '-p', action='store_true', help='Show preview window')
    parser.add_argument('--threshold', '-t', type=float, default=cfg.CLUSTERING_THRESHOLD, help='Clustering threshold')
    args = parser.parse_args()

    # RTSP URL не нужно проверять как файл
    is_rtsp = args.video.startswith('rtsp://') or args.video.startswith('rtsp:\\')
    if is_rtsp:
        video_path = args.video
    else:
        video_path = Path(args.video)
        if not video_path.exists():
            print(f"Error: Video not found: {video_path}")
            return

    # Output directory
    start_student_id = 1  # По умолчанию начинаем с 1

    if args.append:
        # Добавляем к существующей папке
        append_dir = Path(args.append)
        if not append_dir.exists():
            append_dir = Path(cfg.STUDENTS_DIR) / args.append
        if not append_dir.exists():
            print(f"Error: Directory not found: {args.append}")
            return
        output_dir = append_dir
        start_student_id = get_max_student_id(output_dir) + 1
        print(f"Appending to: {output_dir}")
        print(f"Starting from student ID: {start_student_id}")
    elif args.output:
        output_dir = Path(args.output)
    else:
        # Auto folder with threshold in name
        base_dir = Path(cfg.STUDENTS_DIR)
        base_dir.mkdir(exist_ok=True)
        threshold_str = f"{args.threshold:.2f}".replace(".", "")
        exp_num = 1
        while (base_dir / f"t{threshold_str}_{exp_num}").exists():
            exp_num += 1
        output_dir = base_dir / f"t{threshold_str}_{exp_num}"

    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Output: {output_dir}")

    # Initialize
    device = cfg.DEVICE
    print(f"Device: {device}")
    cfg.print_config()

    detector = FaceDetector(device)

    # DeepSORT tracker
    tracker = DeepSORT(
        max_age=cfg.DEEPSORT_MAX_AGE,
        n_init=cfg.DEEPSORT_N_INIT,
        max_cosine_dist=cfg.DEEPSORT_MAX_COSINE_DIST,
        iou_threshold=cfg.DEEPSORT_IOU_THRESHOLD
    )
    print("[Tracker] Using DeepSORT (appearance + motion)")

    # Video
    if is_rtsp:
        # TCP транспорт для стабильного RTSP + HEVC поддержка
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
        cap = cv2.VideoCapture(str(video_path), cv2.CAP_FFMPEG)
    else:
        cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error: Cannot open {video_path}")
        return

    # Проверяем что кадры реально читаются
    if is_rtsp:
        ret, test_frame = cap.read()
        if not ret or test_frame is None:
            print("Error: RTSP connected but cannot read frames!")
            print("Try sub-stream: stream2 instead of stream1")
            cap.release()
            return
        print(f"RTSP OK: frame {test_frame.shape[1]}x{test_frame.shape[0]}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

    video_name = video_path if is_rtsp else video_path.name
    print(f"\nVideo: {video_name}")
    if is_rtsp:
        print(f"RTSP stream (live), FPS: {fps:.1f}")
    else:
        print(f"Frames: {total_frames}, FPS: {fps:.1f}")
    print(f"Processing every {args.frame_skip} frames")
    print(f"Max photos per track: {args.max_photos}")
    if args.preview:
        print("Preview: ON (press Q to quit, SPACE to pause)")

    # Stats
    stats = {
        'faces_detected': 0,
        'duplicates_skipped': 0,
        'photos_saved': 0,
        'frames_processed': 0,
        'no_embedding': 0,
        'max_photos_reached': 0,
        'low_confidence': 0
    }

    # Preview window
    if args.preview:
        cv2.namedWindow("Extract Preview", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Extract Preview", 1920, 1080)

    # Process
    pbar_total = (total_frames // args.frame_skip) if total_frames > 0 else None
    pbar = tqdm(total=pbar_total, desc="Processing", disable=args.preview)
    frame_idx = 0
    paused = False

    while True:
        if not paused:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % args.frame_skip != 0:
                continue
        elif not args.preview:
            break

        # Detect faces
        face_detections = detector.detect(frame)
        stats['faces_detected'] += len(face_detections)

        # For preview
        face_statuses = []  # [(bbox, track_id, status, info)]

        # DeepSORT: get embeddings first, then track with appearance matching
        embeddings = []
        for det in face_detections:
            bbox = det['bbox']
            landmarks = det.get('landmarks')
            embedding = detector.get_embedding(frame, bbox, landmarks)
            embeddings.append(embedding)

        # Update tracker with detections + embeddings
        active_tracks = tracker.update(face_detections, embeddings, frame_idx=frame_idx)

        # Process confirmed tracks
        for track in active_tracks:
            bbox = track.bbox
            landmarks = track.landmarks_history[-1] if track.landmarks_history else None
            confidence = track.confidence_history[-1] if track.confidence_history else 1.0

            if confidence < cfg.MIN_DETECTION_CONF:
                stats['low_confidence'] += 1
                face_statuses.append((bbox, track.track_id, 'low_conf', f'T{track.track_id}: conf={confidence:.2f}'))
                continue

            if not hasattr(track, 'photo_count'):
                track.photo_count = 0

            if track.photo_count >= args.max_photos:
                stats['max_photos_reached'] += 1
                face_statuses.append((bbox, track.track_id, 'max_photos', f'T{track.track_id}: {track.photo_count}/{args.max_photos}'))
                continue

            # Get latest embedding (already stored in track)
            embedding = track.embeddings[-1] if track.embeddings else None
            if embedding is None:
                stats['no_embedding'] += 1
                face_statuses.append((bbox, track.track_id, 'no_emb', f'T{track.track_id}: No embedding'))
                continue

            if track.is_duplicate(embedding, cfg.DUPLICATE_THRESHOLD):
                stats['duplicates_skipped'] += 1
                face_statuses.append((bbox, track.track_id, 'duplicate', f'T{track.track_id}: Duplicate'))
                continue

            track.photo_count += 1
            x1, y1, x2, y2 = bbox
            face_size = max(x2 - x1, y2 - y1)

            if save_face(output_dir, track.track_id, frame, bbox, landmarks, track.photo_count, args.align):
                stats['photos_saved'] += 1
                track.mark_saved(embedding, face_size, confidence)
                face_statuses.append((bbox, track.track_id, 'saved', f'T{track.track_id}: SAVED #{track.photo_count}'))
            else:
                face_statuses.append((bbox, track.track_id, 'save_fail', f'T{track.track_id}: Save failed'))

        # Preview visualization
        if args.preview:
            preview_frame = frame.copy()

            # Scale factors for high-res video (base on 1080p)
            h, w = frame.shape[:2]
            scale = max(1.0, h / 1080)
            font_scale = 0.6 * scale
            thickness = max(2, int(2 * scale))
            label_height = int(25 * scale)

            # Draw each face with status
            for bbox, track_id, status, info in face_statuses:
                x1, y1, x2, y2 = [int(c) for c in bbox]

                # Color by status
                if status == 'saved':
                    color = (0, 255, 0)     # Green - saved
                elif status == 'duplicate':
                    color = (0, 255, 255)   # Yellow - duplicate
                elif status == 'max_photos':
                    color = (255, 165, 0)   # Orange - max photos
                elif status == 'low_conf':
                    color = (255, 0, 255)   # Magenta - low confidence
                elif status == 'no_emb':
                    color = (0, 0, 255)     # Red - no embedding
                else:
                    color = (128, 128, 128) # Gray - other

                # Draw face bbox
                cv2.rectangle(preview_frame, (x1, y1), (x2, y2), color, thickness)

                # Draw label background
                (text_w, text_h), _ = cv2.getTextSize(info, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
                cv2.rectangle(preview_frame, (x1, y1 - label_height), (x1 + text_w + 10, y1), color, -1)

                # Draw label
                cv2.putText(preview_frame, info, (x1 + 5, y1 - int(8*scale)),
                           cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness)

            # Stats overlay
            info_text = [
                f"Frame: {frame_idx}/{total_frames}",
                f"Tracker: DeepSORT",
                f"Tracks: {len(tracker.tracks)}",
                f"Photos: {stats['photos_saved']}",
                f"Duplicates: {stats['duplicates_skipped']}",
                f"Low conf: {stats['low_confidence']}",
                "",
                "GREEN = Saved",
                "YELLOW = Dup",
                "MAGENTA = Low",
                "RED = No emb"
            ]
            overlay_w = int(220 * scale)
            overlay_h = int(280 * scale)
            line_h = int(22 * scale)
            cv2.rectangle(preview_frame, (5, 5), (overlay_w, overlay_h), (0, 0, 0), -1)
            for i, text in enumerate(info_text):
                cv2.putText(preview_frame, text, (10, int(28 * scale) + i * line_h),
                           cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.9, (255, 255, 255), max(1, thickness - 1))

            # Resize for display if frame is too large
            display_h = min(h, 900)
            if h > 900:
                display_w = int(w * display_h / h)
                preview_frame = cv2.resize(preview_frame, (display_w, display_h))

            cv2.imshow("Extract Preview", preview_frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord(' '):
                paused = not paused

        if not paused:
            stats['frames_processed'] += 1
            pbar.set_postfix({
                'tracks': len(tracker.tracks),
                'photos': stats['photos_saved']
            })
            pbar.update(1)

    pbar.close()
    cap.release()
    if args.preview:
        cv2.destroyAllWindows()

    # Finalize tracker
    tracker.finalize()
    all_tracks = tracker.get_all_tracks()

    # Фильтруем треки: только те, у которых есть реальные фото на диске
    tracks_with_photos = []
    for track in all_tracks:
        track_dir = output_dir / f"track_{track.id}"
        if track_dir.exists():
            photo_count = len(list(track_dir.glob("*.jpg")))
            if photo_count > 0:
                tracks_with_photos.append(track)

    # Считаем эмбеддинги для треков с фото
    embeddings_count = sum(len(t.embeddings) for t in tracks_with_photos if hasattr(t, 'embeddings'))

    print(f"\n{'='*50}")
    print("TRACKING COMPLETE")
    print(f"{'='*50}")
    print(f"Total tracks: {len(all_tracks)}")
    print(f"Tracks with photos: {len(tracks_with_photos)}")
    print(f"Embeddings (tracks with photos): {embeddings_count}")
    print(f"Faces detected: {stats['faces_detected']}")
    print(f"Low confidence skipped: {stats['low_confidence']}")
    print(f"Duplicates skipped: {stats['duplicates_skipped']}")
    print(f"Photos saved: {stats['photos_saved']}")

    # Merge tracks by embedding similarity (только треки с фото)
    print(f"\nMerging tracks by similarity (threshold={args.threshold})...")
    student_tracks = merge_tracks(tracks_with_photos, threshold=args.threshold, start_id=start_student_id)
    print(f"Students found: {len(student_tracks)}")

    # Reorganize folders
    print("Reorganizing folders...")
    reorganize_folders(output_dir, student_tracks)

    # Save CSV
    save_csv(output_dir, student_tracks, tracks_with_photos, append=(args.append is not None))

    print(f"\n{'='*50}")
    print(f"RESULTS")
    print(f"{'='*50}")
    print(f"Students: {len(student_tracks)}")
    print(f"Photos: {stats['photos_saved']}")
    print(f"Duplicates filtered: {stats['duplicates_skipped']}")
    print(f"{'='*50}")
    print(f"\nResults saved to: {output_dir}")
    print("Run 'python verify_students.py' to review")


if __name__ == "__main__":
    main()
