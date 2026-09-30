# -*- coding: UTF-8 -*-
"""
Универсальное распознавание лиц на видео.

Функции:
- Многопоточность (захват + инференс + GUI)
- SORT трекинг (Kalman Filter + Hungarian Algorithm)
- Выравнивание лиц по landmarks
- Поддержка кириллицы
- Работа с файлами и RTSP

Использование:
    cd yolov5-face && python -m core.video_recognition
    or: python core/video_recognition.py video.mp4
    python core/video_recognition.py --db data/databases/database.pkl
    python core/video_recognition.py rtsp://ip/stream
    python core/video_recognition.py -r                   # с записью
    python core/video_recognition.py --list-db            # показать доступные базы
"""
import os
import warnings
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

os.environ['ONNXRUNTIME_LOG_LEVEL'] = '3'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore')

import argparse
import cv2
import time
from datetime import datetime

import config as cfg
from core.capture import FrameBuffer, CaptureThread
from core.inference import InferenceThread
from core.drawing import draw_frame

# Tracker imports
from trackers import DeepSORT
if cfg.USE_BYTETRACK:
    from trackers import BodyFaceTracker


def list_databases():
    """Показывает доступные базы данных."""
    print("\nДоступные базы данных:")
    print("-" * 40)

    pkl_files = list(Path(".").glob("*.pkl"))
    if not pkl_files:
        print("  (нет .pkl файлов)")
        return []

    for i, f in enumerate(pkl_files, 1):
        size = f.stat().st_size / 1024
        current = " <- текущая" if f.name == cfg.DATABASE_PATH else ""
        print(f"  {i}. {f.name} ({size:.1f} KB){current}")

    print("-" * 40)
    return pkl_files


def run_recognition(video_source, database_path, csv_path=None, record=False, debug=False):
    """Запускает распознавание на одном источнике."""

    # Настройка записи
    output_path = None
    if record:
        recordings_dir = Path("recordings")
        recordings_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_name = Path(video_source).stem if not video_source.startswith("rtsp") else "rtsp"
        output_path = recordings_dir / f"{source_name}_{timestamp}.mp4"

    print(f"\n{'='*60}")
    print(f"Video Recognition")
    print(f"{'='*60}")
    print(f"Source: {video_source}")
    print(f"Database: {database_path}")
    if csv_path:
        print(f"Names CSV: {csv_path}")
    print(f"Recognition threshold: {cfg.RECOGNITION_THRESHOLD}")
    print(f"Min detection conf: {cfg.MIN_DETECTION_CONF}")
    print(f"Debug: {debug}")
    if record:
        print(f"Recording to: {output_path}")
    print(f"{'='*60}\n")

    # Инициализация
    frame_buffer = FrameBuffer()

    # Выбор трекера
    if cfg.USE_BYTETRACK:
        tracker = BodyFaceTracker(
            track_thresh=cfg.BYTETRACK_TRACK_THRESH,
            low_thresh=cfg.BYTETRACK_LOW_THRESH,
            match_thresh=cfg.BYTETRACK_MATCH_THRESH,
            track_buffer=cfg.BYTETRACK_TRACK_BUFFER,
            frame_rate=30,
            face_body_iou_thresh=cfg.FACE_BODY_IOU_THRESH,
            max_frames_without_face=cfg.MAX_FRAMES_WITHOUT_FACE,
            use_virtual_bodies=cfg.USE_VIRTUAL_BODIES
        )
    else:
        # DeepSORT: face-only tracking with appearance matching
        tracker = DeepSORT(
            max_age=cfg.DEEPSORT_MAX_AGE,
            n_init=cfg.DEEPSORT_N_INIT,
            max_cosine_dist=cfg.DEEPSORT_MAX_COSINE_DIST,
            iou_threshold=cfg.DEEPSORT_IOU_THRESHOLD
        )

    # Запуск потоков
    capture_thread = CaptureThread(video_source, frame_buffer, target_fps=30)
    inference_thread = InferenceThread(frame_buffer, tracker, database_path, csv_path, debug=debug)

    capture_thread.start()
    inference_thread.start()

    # Ждём инициализации моделей
    print("Initializing models...")
    time.sleep(3)

    print("\n" + "="*60)
    print("Controls: Q - quit, SPACE - pause, N - next video")
    print("="*60 + "\n")

    cv2.namedWindow("Face Recognition", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Face Recognition", cfg.DISPLAY_WIDTH, cfg.DISPLAY_HEIGHT)

    # VideoWriter (только если включена запись)
    video_writer = None
    frames_written = 0
    if record:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')

    paused = False
    last_frame = None
    next_video = False
    display_interval = 1.0 / 30  # 30 FPS display

    while True:
        display_start = time.time()

        if not paused:
            frame = frame_buffer.get()
            if frame is None:
                time.sleep(0.01)
                continue
            last_frame = frame
        else:
            frame = last_frame
            if frame is None:
                time.sleep(0.01)
                continue

        # Получаем треки и рисуем (треки обновляются по мере готовности инференса)
        tracks = inference_thread.get_tracks()
        frame_with_overlay = draw_frame(frame.copy(), tracks, capture_thread.fps, inference_thread.fps)

        # Запись видео (если включена)
        if record:
            if video_writer is None:
                h, w = frame_with_overlay.shape[:2]
                video_writer = cv2.VideoWriter(str(output_path), fourcc, 25.0, (w, h))
                print(f"[Recording] Started: {w}x{h} @ 25fps")

            if not paused:
                video_writer.write(frame_with_overlay)
                frames_written += 1

        cv2.imshow("Face Recognition", frame_with_overlay)

        # Display 30fps: ждём остаток до следующего кадра
        elapsed = time.time() - display_start
        wait_ms = max(1, int((display_interval - elapsed) * 1000))
        key = cv2.waitKey(wait_ms) & 0xFF
        if key == ord('q'):
            break
        elif key == ord(' '):
            paused = not paused
            print(f"{'PAUSED' if paused else 'RESUMED'}")
        elif key == ord('n'):
            next_video = True
            break

    # Остановка
    print("\nShutting down...")
    capture_thread.stop()
    inference_thread.stop()

    if video_writer is not None:
        video_writer.release()
        duration = frames_written / 25.0
        print(f"[Recording] Saved: {output_path}")
        print(f"[Recording] Frames: {frames_written}, Duration: {duration:.1f}s")

    cv2.destroyAllWindows()

    return next_video  # True если нажали N для следующего видео


def main():
    parser = argparse.ArgumentParser(
        description='Распознавание лиц на видео',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры:
  python video_recognition.py                     # видео и база из config
  python video_recognition.py video.mp4           # указать видео
  python video_recognition.py --db database.pkl   # указать базу
  python video_recognition.py rtsp://192.168.1.100:554/stream  # RTSP
  python video_recognition.py -r video.mp4        # с записью
  python video_recognition.py --list-db           # показать базы
  python video_recognition.py v1.mp4 v2.mp4       # несколько видео
        """
    )

    parser.add_argument('sources', nargs='*', default=[],
                        help='Видео файлы или RTSP потоки')
    parser.add_argument('--db', '-d', type=str, default=None,
                        help='База данных (.pkl)')
    parser.add_argument('--csv', '-c', type=str, default=None,
                        help='CSV файл с именами студентов')
    parser.add_argument('--record', '-r', action='store_true',
                        help='Записывать видео')
    parser.add_argument('--list-db', action='store_true',
                        help='Показать доступные базы данных')
    parser.add_argument('--debug', action='store_true',
                        help='Показать подробный лог распознавания')
    parser.add_argument('--yolo26', action='store_true',
                        help='Use YOLO26s + InsightFace instead of YOLOv5-Face')
    parser.add_argument('--fast', action='store_true',
                        help='Fast crop mode: skip InsightFace detection, direct crop→ArcFace')

    args = parser.parse_args()

    # Apply --yolo26 flag
    if args.yolo26:
        cfg.DETECTOR_MODE = 'yolo26_insightface'
    if args.fast:
        cfg.YOLO26_FAST_CROP = True

    # Показать список баз
    if args.list_db:
        list_databases()
        return

    # Определяем базу данных
    database_path = args.db if args.db else cfg.DATABASE_PATH

    # Проверяем существование базы
    if not Path(database_path).exists():
        print(f"Ошибка: База данных не найдена: {database_path}")
        print("\nДоступные базы:")
        list_databases()
        return

    # Определяем источники видео
    sources = args.sources if args.sources else [cfg.VIDEO_PATH]

    # Запускаем на каждом источнике
    print(f"\nВсего источников: {len(sources)}")

    for i, source in enumerate(sources, 1):
        if len(sources) > 1:
            print(f"\n[{i}/{len(sources)}] {source}")

        # Проверяем файл (если не RTSP)
        if not source.startswith("rtsp://") and not Path(source).exists():
            print(f"Ошибка: Файл не найден: {source}")
            continue

        next_requested = run_recognition(source, database_path, args.csv, args.record, args.debug)

        if not next_requested and len(sources) > 1:
            # Пользователь нажал Q - выходим полностью
            print("Выход (Q)")
            break

    print("\nГотово.")


if __name__ == "__main__":
    main()
