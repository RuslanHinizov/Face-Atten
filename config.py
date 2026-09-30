# -*- coding: UTF-8 -*-
"""
РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ РґР»СЏ РґРµС‚РµРєС†РёРё Рё СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ Р»РёС†.
Р’СЃРµ СЃРєСЂРёРїС‚С‹ РёРјРїРѕСЂС‚РёСЂСѓСЋС‚ РЅР°СЃС‚СЂРѕР№РєРё РѕС‚СЃСЋРґР°.
"""
import os
import torch
import numpy as np

# ============== BASE PATH ==============
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ============== DEVICE ==============
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'

# ============== DETECTOR MODE ==============
# 'yolov5face'          вЂ” YOLOv5-Face (default, face bbox + 5 landmarks)
# 'yolo26_insightface'  вЂ” YOLO26s person detection в†’ head crop в†’ InsightFace
DETECTOR_MODE = 'yolov5face'

# ============== YOLO FACE DETECTION ==============
YOLO_WEIGHTS = os.path.join(BASE_DIR, 'weights/yolov5s-face.pt')
YOLO_ENGINE = None            # TensorRT engine (None = РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ .pt)
YOLO_IMG_SIZE = 1536          # Р Р°Р·РјРµСЂ РІС…РѕРґР° YOLO (Р±РѕР»СЊС€Рµ = Р»СѓС‡С€Рµ РґРµС‚РµРєС†РёСЏ, РјРµРґР»РµРЅРЅРµРµ)
YOLO_CONF_THRES = 0.40        # РњРёРЅРёРјР°Р»СЊРЅР°СЏ СѓРІРµСЂРµРЅРЅРѕСЃС‚СЊ РґРµС‚РµРєС†РёРё
YOLO_IOU_THRES = 0.5          # РџРѕСЂРѕРі NMS
MIN_FACE_SIZE = 15            # РњРёРЅРёРјР°Р»СЊРЅС‹Р№ СЂР°Р·РјРµСЂ Р»РёС†Р° РІ РїРёРєСЃРµР»СЏС…
YOLO_FP16 = True              # РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ FP16 РґР»СЏ YOLO (Р±С‹СЃС‚СЂРµРµ РЅР° GPU)

# ============== YOLO26 DETECTION ==============
YOLO26_WEIGHTS = 'yolo26s.engine'        # TensorRT FP16 engine (fallback: yolo26s.pt)
YOLO26_CONF_THRES = 0.40                 # Person detection confidence
YOLO26_IMG_SIZE = 320                    # Input size for YOLO26 (320 РґР»СЏ РїРѕС‚РѕРєР° 640p)
YOLO26_PERSON_CLASS = 0                  # COCO class 0 = person
YOLO26_HEAD_RATIO = 0.45                 # Head = top 45% of person bbox
YOLO26_HEAD_PAD = 0.15                   # 15% padding around head crop
YOLO26_FAST_CROP = False                 # True = РїСЂРѕРїСѓСЃС‚РёС‚СЊ InsightFace, РїСЂСЏРјРѕР№ cropв†’ArcFace (~2ms/Р»РёС†Рѕ РІРјРµСЃС‚Рѕ ~11ms)

# ============== ARCFACE RECOGNITION ==============
ARCFACE_MODEL = 'buffalo_l'   # РњРѕРґРµР»СЊ InsightFace
ARCFACE_DET_SIZE = (640, 640) # Р Р°Р·РјРµСЂ РґРµС‚РµРєС†РёРё InsightFace
ARCFACE_INPUT_SIZE = (112, 112)  # Р Р°Р·РјРµСЂ РІС…РѕРґР° ArcFace (РќР• РњР•РќРЇРўР¬)
USE_ALIGNMENT = True          # РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РІС‹СЂР°РІРЅРёРІР°РЅРёРµ Р»РёС†

# РЎС‚Р°РЅРґР°СЂС‚РЅС‹Рµ РїРѕР·РёС†РёРё РєР»СЋС‡РµРІС‹С… С‚РѕС‡РµРє РґР»СЏ РІС‹СЂР°РІРЅРёРІР°РЅРёСЏ 112x112
ARCFACE_DST = np.array([
    [38.2946, 51.6963],   # Р»РµРІС‹Р№ РіР»Р°Р·
    [73.5318, 51.5014],   # РїСЂР°РІС‹Р№ РіР»Р°Р·
    [56.0252, 71.7366],   # РЅРѕСЃ
    [41.5493, 92.3655],   # Р»РµРІС‹Р№ СѓРіРѕР» СЂС‚Р°
    [70.7299, 92.2041]    # РїСЂР°РІС‹Р№ СѓРіРѕР» СЂС‚Р°
], dtype=np.float32)

# ============== TRACKER ==============
USE_BYTETRACK = False         # True = ByteTrack (body+face), False = DeepSORT (face only)

# DeepSORT РїР°СЂР°РјРµС‚СЂС‹ (face-only tracking)
DEEPSORT_MAX_AGE = 30         # РљР°РґСЂРѕРІ Р±РµР· РґРµС‚РµРєС†РёРё РґРѕ СѓРґР°Р»РµРЅРёСЏ С‚СЂРµРєР°
DEEPSORT_N_INIT = 1           # РљР°РґСЂРѕРІ РґРѕ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ С‚СЂРµРєР° (1 = СЃСЂР°Р·Сѓ)
DEEPSORT_MAX_COSINE_DIST = 0.5  # РњР°РєСЃ РєРѕСЃРёРЅСѓСЃРЅРѕРµ СЂР°СЃСЃС‚РѕСЏРЅРёРµ РґР»СЏ РјР°С‚С‡РёРЅРіР°
DEEPSORT_IOU_THRESHOLD = 0.3  # IoU РїРѕСЂРѕРі РґР»СЏ fallback РјР°С‚С‡РёРЅРіР°

# ByteTrack РїР°СЂР°РјРµС‚СЂС‹ (body+face tracking)
BYTETRACK_TRACK_THRESH = 0.5  # РџРѕСЂРѕРі РґР»СЏ РІС‹СЃРѕРєРѕРєР°С‡РµСЃС‚РІРµРЅРЅС‹С… РґРµС‚РµРєС†РёР№
BYTETRACK_LOW_THRESH = 0.1    # РџРѕСЂРѕРі РґР»СЏ РЅРёР·РєРѕРєР°С‡РµСЃС‚РІРµРЅРЅС‹С… РґРµС‚РµРєС†РёР№
BYTETRACK_MATCH_THRESH = 0.8  # РџРѕСЂРѕРі IoU РґР»СЏ РјР°С‚С‡РёРЅРіР°
BYTETRACK_TRACK_BUFFER = 30   # Р‘СѓС„РµСЂ РєР°РґСЂРѕРІ РґР»СЏ С‚СЂРµРєР°

# Body detection (РґР»СЏ ByteTrack)
BODY_WEIGHTS = os.path.join(BASE_DIR, 'weights/yolov5s.pt')
BODY_IMG_SIZE = 640
BODY_CONF_THRES = 0.5
BODY_IOU_THRES = 0.5
BODY_CLASSES = [0]            # РўРѕР»СЊРєРѕ РєР»Р°СЃСЃ person

# ByteTrack face-body association
FACE_BODY_IOU_THRESH = 0.3    # IoU РґР»СЏ СЃРІСЏР·Рё Р»РёС†Р° СЃ С‚РµР»РѕРј
MAX_FRAMES_WITHOUT_FACE = 30  # РљР°РґСЂРѕРІ Р±РµР· Р»РёС†Р° РґРѕ РїРѕС‚РµСЂРё С‚СЂРµРєР°
USE_VIRTUAL_BODIES = True     # РЎРѕР·РґР°РІР°С‚СЊ РІРёСЂС‚СѓР°Р»СЊРЅС‹Рµ body РґР»СЏ РѕРґРёРЅРѕРєРёС… Р»РёС†

# ============== THRESHOLDS ==============
# Р”Р»СЏ video_recognition.py (СЂР°СЃРїРѕР·РЅР°РІР°РЅРёРµ)
RECOGNITION_THRESHOLD = 0.20  # РџРѕСЂРѕРі СЃС…РѕР¶РµСЃС‚Рё РґР»СЏ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ
MIN_DETECTION_CONF = 0.40     # РњРёРЅРёРјР°Р»СЊРЅС‹Р№ confidence РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё
SKIP_RECOGNIZED = True        # РџСЂРѕРїСѓСЃРєР°С‚СЊ СѓР¶Рµ СЂР°СЃРїРѕР·РЅР°РЅРЅС‹Рµ Р»РёС†Р°
SKIP_CONFIDENCE = 0.65        # РџРѕСЂРѕРі СѓРІРµСЂРµРЅРЅРѕСЃС‚Рё РґР»СЏ РїСЂРѕРїСѓСЃРєР°
MAX_RECOGNITION_ATTEMPTS = 30 # РњР°РєСЃРёРјСѓРј РїРѕРїС‹С‚РѕРє СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ РЅР° С‚СЂРµРє

# Р”Р»СЏ extract_students.py (РёР·РІР»РµС‡РµРЅРёРµ)
CLUSTERING_THRESHOLD = 0.52   # РџРѕСЂРѕРі СЃС…РѕР¶РµСЃС‚Рё РґР»СЏ РѕР±СЉРµРґРёРЅРµРЅРёСЏ С‚СЂРµРєРѕРІ
DUPLICATE_THRESHOLD = 0.90    # РџРѕСЂРѕРі РґСѓР±Р»РёРєР°С‚Р° (РїСЂРѕРїСѓСЃРєР°РµРј СЃР»РёС€РєРѕРј РїРѕС…РѕР¶РёРµ)
MIN_PHOTOS_FOR_STUDENT = 15   # РњРёРЅРёРјСѓРј С„РѕС‚Рѕ РґР»СЏ СЃС‚СѓРґРµРЅС‚Р°
MAX_PHOTOS_PER_STUDENT = 75   # РњР°РєСЃРёРјСѓРј С„РѕС‚Рѕ РЅР° СЃС‚СѓРґРµРЅС‚Р°

# ============== PATHS ==============
DATABASE_PATH = os.path.join(BASE_DIR, 'data/databases/students.pkl')
STUDENTS_DIR = os.path.join(BASE_DIR, 'students')
VIDEO_PATH = os.path.join(BASE_DIR, 'data/videos/test.mp4')
INSIGHTFACE_ROOT = os.path.join(BASE_DIR, 'models/insightface')
RECORDINGS_DIR = os.path.join(BASE_DIR, 'recordings')

# ============== VIDEO PROCESSING ==============
FRAME_SKIP = 5                # РћР±СЂР°Р±Р°С‚С‹РІР°С‚СЊ РєР°Р¶РґС‹Р№ N-Р№ РєР°РґСЂ
DISPLAY_WIDTH = 1920
DISPLAY_HEIGHT = 1080

# ============== STREAMING ==============
STREAM_HEIGHT = 720           # Р’С‹СЃРѕС‚Р° MJPEG СЃС‚СЂРёРјР° (720p)
STREAM_QUALITY = 70           # JPEG РєР°С‡РµСЃС‚РІРѕ (1-100)
STREAM_FPS = 25               # Р¦РµР»РµРІРѕР№ FPS СЃС‚СЂРёРјР° (РїРѕ РІРёРґРµРѕ)
DETECTION_INTERVAL = 10       # Р”РµС‚РµРєС†РёСЏ РєР°Р¶РґС‹Рµ N РєР°РґСЂРѕРІ

# ============== RTSP CAMERAS ==============
# РЈРєР°Р¶РёС‚Рµ Р·РґРµСЃСЊ РІР°С€Рё RTSP URL РєР°РјРµСЂ
# Р¤РѕСЂРјР°С‚: rtsp://user:password@ip:port/stream
def _resolve_video_source(group_tag: str, fallback_name: str) -> str:
    """Pick the most recent local video that contains the given group tag."""
    videos_dir = os.path.join(BASE_DIR, 'data', 'videos')
    fallback_path = os.path.join(videos_dir, fallback_name)

    if not os.path.isdir(videos_dir):
        return fallback_path

    candidates = []
    for filename in os.listdir(videos_dir):
        if filename.lower().endswith('.mp4') and group_tag in filename:
            full_path = os.path.join(videos_dir, filename)
            try:
                mtime = os.path.getmtime(full_path)
            except OSError:
                continue
            candidates.append((mtime, full_path))

    if not candidates:
        return fallback_path

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


RTSP_CAMERAS = {
    'camera-1': {
        'name': 'Auditorium 418',
        'url': _resolve_video_source('418', 'video_418.mp4'),
    },
    'camera-2': {
        'name': 'Auditorium 428',
        'url': _resolve_video_source('428', 'video_428.mp4'),
    },
}


# ============== ENROLLMENT ==============
ENROLLMENT_CAPTURE_COUNT = 5          # РљРѕР»РёС‡РµСЃС‚РІРѕ СѓРіР»РѕРІ РґР»СЏ Р·Р°С…РІР°С‚Р°
ENROLLMENT_YAW_THRESHOLD = 15        # Р“СЂР°РґСѓСЃС‹ РґР»СЏ РїРѕРІРѕСЂРѕС‚Р° РІР»РµРІРѕ/РІРїСЂР°РІРѕ
ENROLLMENT_PITCH_THRESHOLD = 10      # Р“СЂР°РґСѓСЃС‹ РґР»СЏ РЅР°РєР»РѕРЅР° РІРІРµСЂС…/РІРЅРёР·
ENROLLMENT_ANGLE_TOLERANCE = 8       # В± РґРѕРїСѓСЃРє РґР»СЏ СЃРѕРІРїР°РґРµРЅРёСЏ РїРѕР·С‹ (straight)
ENROLLMENT_MIN_FACE_SIZE = 80        # РњРёРЅРёРјР°Р»СЊРЅС‹Р№ СЂР°Р·РјРµСЂ Р»РёС†Р° (80px РґР»СЏ С‚РµР»РµС„РѕРЅР°, 160px РґР»СЏ РЅРѕСѓС‚Р±СѓРєР°)
ENROLLMENT_FACE_QUALITY_BLUR = 50    # РџРѕСЂРѕРі Р›Р°РїР»Р°СЃРёР°РЅР° (СЃРЅРёР·СЊС‚Рµ РµСЃР»Рё РєР°РјРµСЂР° РїР»РѕС…Р°СЏ, СЃС‚Р°РЅРґР°СЂС‚ ~100)
ENROLLMENT_PHOTOS_PER_STAGE = 3      # РЎРєРѕР»СЊРєРѕ С„РѕС‚Рѕ СЃРѕС…СЂР°РЅСЏС‚СЊ РЅР° РєР°Р¶РґС‹Р№ СЌС‚Р°Рї
ENROLLMENT_POOL_SIZE = 12            # РЎРєРѕР»СЊРєРѕ РєР°РґСЂРѕРІ СЃРѕР±СЂР°С‚СЊ РїРµСЂРµРґ РІС‹Р±РѕСЂРѕРј Р»СѓС‡С€РёС…
ENROLLMENT_PHOTOS_DIR = os.path.join(BASE_DIR, 'data/enrollment')


def print_config():
    """Р’С‹РІРѕРґРёС‚ С‚РµРєСѓС‰СѓСЋ РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ."""
    print("=" * 50)
    print("CONFIGURATION")
    print("=" * 50)
    print(f"Device: {DEVICE}")
    print(f"Detector: {DETECTOR_MODE}")
    tracker_name = "ByteTrack (body+face)" if USE_BYTETRACK else "DeepSORT (face-only)"
    print(f"Tracker: {tracker_name}")
    if DETECTOR_MODE == 'yolo26_insightface':
        print(f"YOLO26 weights: {YOLO26_WEIGHTS}")
        print(f"YOLO26 conf_thres: {YOLO26_CONF_THRES}")
        print(f"YOLO26 head_ratio: {YOLO26_HEAD_RATIO}")
    else:
        print(f"YOLO img_size: {YOLO_IMG_SIZE}")
        print(f"YOLO conf_thres: {YOLO_CONF_THRES}")
    print(f"Min face size: {MIN_FACE_SIZE}px")
    print(f"Min detection conf: {MIN_DETECTION_CONF}")
    print(f"Recognition threshold: {RECOGNITION_THRESHOLD}")
    print(f"Alignment: {USE_ALIGNMENT}")
    print(f"Database: {DATABASE_PATH}")
    print("=" * 50)
