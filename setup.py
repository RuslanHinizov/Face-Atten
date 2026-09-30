# -*- coding: UTF-8 -*-
"""
Setup script - creates necessary directories and downloads models.

Usage:
    python setup.py
"""
import os
import sys
from pathlib import Path

def create_directories():
    """Create necessary directories."""
    dirs = [
        'weights',
        'models/insightface/models/buffalo_l',
        'students',
        'recordings',
    ]

    for d in dirs:
        Path(d).mkdir(parents=True, exist_ok=True)
        print(f"  [OK] {d}/")

def download_yolo_weights():
    """Download YOLO face weights."""
    weights_url = "https://github.com/deepcam-cn/yolov5-face/releases/download/v0.0.1/yolov5s-face.pt"
    weights_path = Path("weights/yolov5s-face.pt")

    if weights_path.exists():
        print(f"  [SKIP] {weights_path} already exists")
        return

    print(f"  Downloading YOLO weights...")
    try:
        import urllib.request
        urllib.request.urlretrieve(weights_url, weights_path)
        print(f"  [OK] {weights_path}")
    except Exception as e:
        print(f"  [ERROR] Failed to download: {e}")
        print(f"  Download manually: {weights_url}")

def download_insightface():
    """Download InsightFace buffalo_l model."""
    model_dir = Path("models/insightface/models/buffalo_l")

    if (model_dir / "w600k_r50.onnx").exists():
        print(f"  [SKIP] InsightFace models already exist")
        return

    print("  Downloading InsightFace buffalo_l...")
    try:
        from insightface.app import FaceAnalysis
        app = FaceAnalysis(
            name='buffalo_l',
            root='models/insightface',
            providers=['CPUExecutionProvider']
        )
        app.prepare(ctx_id=-1, det_size=(640, 640))
        print(f"  [OK] InsightFace buffalo_l")
    except Exception as e:
        print(f"  [ERROR] {e}")
        print("  Install: pip install insightface onnxruntime-gpu")

def check_requirements():
    """Check required packages."""
    required = ['torch', 'cv2', 'numpy', 'insightface', 'onnxruntime']
    missing = []

    for pkg in required:
        try:
            if pkg == 'cv2':
                import cv2
            else:
                __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"\n  [WARNING] Missing packages: {', '.join(missing)}")
        print("  Run: pip install -r requirements.txt")
    else:
        print("  [OK] All required packages installed")

def main():
    print("=" * 50)
    print("YOLOV5-FACE SETUP")
    print("=" * 50)

    print("\n[1/4] Creating directories...")
    create_directories()

    print("\n[2/4] Checking requirements...")
    check_requirements()

    print("\n[3/4] Downloading YOLO weights...")
    download_yolo_weights()

    print("\n[4/4] Downloading InsightFace models...")
    download_insightface()

    print("\n" + "=" * 50)
    print("SETUP COMPLETE")
    print("=" * 50)
    print("""
Structure:
  yolov5-face/
  ├── config.py                    # Configuration
  ├── core/
  │   ├── video_recognition.py     # Entry point: main(), run_recognition()
  │   ├── inference.py             # InferenceThread (detect + track + recognize)
  │   ├── capture.py               # FrameBuffer, CaptureThread
  │   ├── drawing.py               # draw_frame(), draw_styled_corner()
  │   ├── utils.py                 # align_face, iou, load_name_mapping, etc.
  │   ├── trt_inference.py         # TensorRT inference (legacy pycuda)
  │   └── yolo26_detector.py       # YOLO26 + InsightFace detector
  ├── trackers/
  │   └── deep_sort.py             # DeepSORT tracker (cosine+IoU matching)
  ├── weights/
  │   ├── yolov8n-face.engine      # YOLOv8-face TRT FP16
  │   └── yolov5s-face.pt          # YOLOv5-face (legacy)
  ├── models/
  │   └── insightface/
  │       └── models/
  │           └── buffalo_l/       # ArcFace ONNX + TRT engines
  ├── data/
  │   └── databases/               # Face embeddings databases (.pkl)
  └── students/                    # Extracted student photos

Usage:
  1. Extract students: python scripts/extract_students.py video.mp4
  2. Build database:   python scripts/build_enrollment_db.py
  3. Recognition:      python -m core.video_recognition
     Options:          --yolo26    Use YOLO26s + InsightFace pipeline
                       --fast      Fast crop mode (skip face detection)
                       --debug     Verbose recognition log
                       -r          Record output video
                       --db X.pkl  Use specific database

API Server (for Frontend):
  1. Install API deps: pip install fastapi uvicorn python-multipart websockets
  2. Start backend:    python -m uvicorn api_server:app --reload --port 8000
  3. Or use:           START_SERVER.bat

  API Docs:            http://localhost:8000/docs
  Frontend connects:   http://localhost:5173 -> proxy -> :8000
""")

if __name__ == "__main__":
    main()
