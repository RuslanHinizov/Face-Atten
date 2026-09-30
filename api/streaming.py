# -*- coding: UTF-8 -*-
"""MJPEG streaming with CaptureWorker thread + WebSocket broadcasting."""
import asyncio
import logging
import os
import threading
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import cv2

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from config import STREAM_HEIGHT, STREAM_QUALITY, DETECTION_INTERVAL, STREAM_FPS
from .database import db
from .engine import engine
from .detection import run_detection_async, reset_detection_flag

logger = logging.getLogger(__name__)

# ============== GSTREAMER CONFIG ==============
GSTREAMER_PATH = r"C:\gstreamer\1.0\msvc_x86_64"
if os.path.exists(GSTREAMER_PATH):
    os.environ["GST_PLUGIN_PATH"] = os.path.join(GSTREAMER_PATH, "lib", "gstreamer-1.0")
    os.environ["PATH"] = os.path.join(GSTREAMER_PATH, "bin") + ";" + os.environ.get("PATH", "")

GSTREAMER_AVAILABLE = False
try:
    test_cap = cv2.VideoCapture("videotestsrc ! videoconvert ! appsink", cv2.CAP_GSTREAMER)
    GSTREAMER_AVAILABLE = test_cap.isOpened()
    test_cap.release()
except:
    pass

NVDEC_AVAILABLE = False
if GSTREAMER_AVAILABLE:
    try:
        test_cap = cv2.VideoCapture(
            "videotestsrc ! video/x-raw,width=64,height=64 ! nvh264enc ! h264parse ! nvh264dec ! videoconvert ! appsink",
            cv2.CAP_GSTREAMER
        )
        NVDEC_AVAILABLE = test_cap.isOpened()
        test_cap.release()
    except:
        pass

logger.info(f"Video backends: GStreamer={GSTREAMER_AVAILABLE}, NVDEC={NVDEC_AVAILABLE}")


# ============== WEBSOCKET STATE ==============
face_subscribers: Dict[str, List[WebSocket]] = {}
latest_faces: Dict[str, List[dict]] = {}

# Active capture workers (camera_id -> CaptureWorker)
_capture_workers: Dict[str, 'CaptureWorker'] = {}


# ============== VIDEO CAPTURE ==============

def create_gstreamer_pipeline(source: str, use_nvdec: bool = True) -> str:
    if source.startswith('rtsp://'):
        if use_nvdec and NVDEC_AVAILABLE:
            return (
                f'rtspsrc location="{source}" latency=100 buffer-mode=auto ! '
                f'rtph264depay ! h264parse ! nvh264dec ! '
                f'videoconvert ! video/x-raw,format=BGR ! appsink drop=1'
            )
        return (
            f'rtspsrc location="{source}" latency=100 ! '
            f'rtph264depay ! h264parse ! avdec_h264 ! '
            f'videoconvert ! video/x-raw,format=BGR ! appsink drop=1'
        )
    else:
        file_path = source.replace('\\', '/')
        if use_nvdec and NVDEC_AVAILABLE:
            return (
                f'filesrc location="{file_path}" ! '
                f'qtdemux ! h264parse ! nvh264dec ! '
                f'videoconvert ! video/x-raw,format=BGR ! appsink'
            )
        return (
            f'filesrc location="{file_path}" ! '
            f'decodebin ! videoconvert ! video/x-raw,format=BGR ! appsink'
        )


def open_video_capture(source: str) -> Tuple[cv2.VideoCapture, str]:
    if GSTREAMER_AVAILABLE and NVDEC_AVAILABLE:
        pipeline = create_gstreamer_pipeline(source, use_nvdec=True)
        cap = cv2.VideoCapture(pipeline, cv2.CAP_GSTREAMER)
        if cap.isOpened():
            return cap, "GStreamer+NVDEC"
        cap.release()

    if GSTREAMER_AVAILABLE:
        pipeline = create_gstreamer_pipeline(source, use_nvdec=False)
        cap = cv2.VideoCapture(pipeline, cv2.CAP_GSTREAMER)
        if cap.isOpened():
            return cap, "GStreamer"
        cap.release()

    cap = cv2.VideoCapture(source)
    if cap.isOpened():
        return cap, "FFmpeg"

    return cap, "Failed"


# ============== FRAME BUFFER ==============

class FrameBuffer:
    """Thread-safe single-slot buffer: always holds the latest frame."""

    def __init__(self):
        self._lock = threading.Lock()
        self._frame = None
        self._frame_count = 0

    def put(self, frame):
        with self._lock:
            self._frame = frame
            self._frame_count += 1

    def get(self) -> Tuple[Optional[object], int]:
        with self._lock:
            return self._frame, self._frame_count


# ============== CAPTURE WORKER ==============

class CaptureWorker(threading.Thread):
    """
    Background thread that reads video frames as fast as possible
    and stores the latest one in FrameBuffer.
    The MJPEG generator reads from the buffer — never blocks on cap.read().
    """

    def __init__(self, source: str, frame_buffer: FrameBuffer, is_file: bool):
        super().__init__(daemon=True, name=f"capture-{Path(source).name[-20:]}")
        self.source = source
        self.frame_buffer = frame_buffer
        self.is_file = is_file
        self.capture_fps: int = 0
        self._running = True

    def run(self):
        cap, backend = open_video_capture(self.source)
        logger.info(f"CaptureWorker [{backend}] started: {self.source}")

        # Get video native FPS for pacing (files only)
        video_fps = cap.get(cv2.CAP_PROP_FPS)
        if video_fps <= 0 or video_fps > 120:
            video_fps = STREAM_FPS
        frame_interval = 1.0 / video_fps if self.is_file else 0.0
        logger.info(f"CaptureWorker: video_fps={video_fps:.1f}, interval={frame_interval*1000:.1f}ms")

        fps_count = 0
        last_fps_time = time.time()
        next_frame_time = time.time()

        while self._running:
            frame_start = time.time()
            ret, frame = cap.read()
            if not ret:
                if self.is_file:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    next_frame_time = time.time()
                    time.sleep(0.01)
                    continue
                else:
                    logger.warning("CaptureWorker: RTSP stream lost, reconnecting...")
                    cap.release()
                    time.sleep(2.0)
                    cap, backend = open_video_capture(self.source)
                    video_fps = cap.get(cv2.CAP_PROP_FPS)
                    if video_fps <= 0 or video_fps > 120:
                        video_fps = STREAM_FPS
                    frame_interval = 0.0
                    next_frame_time = time.time()
                    continue

            self.frame_buffer.put(frame)

            fps_count += 1
            now = time.time()
            elapsed = now - last_fps_time
            if elapsed >= 1.0:
                self.capture_fps = int(fps_count / elapsed)
                fps_count = 0
                last_fps_time = now

            # Pace to video native FPS (for files)
            if self.is_file and frame_interval > 0:
                next_frame_time += frame_interval
                sleep_time = next_frame_time - time.time()
                if sleep_time > 0:
                    time.sleep(sleep_time)
                elif sleep_time < -frame_interval * 5:
                    # Far behind — reset anchor
                    next_frame_time = time.time()

        cap.release()
        logger.info("CaptureWorker stopped")

    def stop(self):
        self._running = False


# ============== MJPEG STREAMING ==============

async def generate_mjpeg(camera_id: str):
    """
    Async MJPEG generator.
    - CaptureWorker thread reads frames into FrameBuffer (never blocks event loop)
    - This generator reads from buffer and encodes at stable STREAM_FPS
    - Face detection spawned as asyncio task every DETECTION_INTERVAL frames
    """
    camera = db.cameras.get(camera_id)
    if not camera or not camera.get('source'):
        return

    source = camera['source']
    if not source.startswith('rtsp') and not Path(source).exists():
        logger.error(f"Video file not found: {source}")
        return

    engine.initialize()

    is_file = not source.startswith('rtsp')
    frame_buffer = FrameBuffer()

    capture_worker = CaptureWorker(source, frame_buffer, is_file)
    capture_worker.start()
    _capture_workers[camera_id] = capture_worker

    logger.info(f"MJPEG stream started for {camera_id} at {STREAM_FPS} FPS")

    loop = asyncio.get_event_loop()
    frame_count = 0
    last_detection_buf_count = -DETECTION_INTERVAL  # trigger detection on first frame

    frame_interval = 1.0 / STREAM_FPS
    next_frame_time = loop.time()

    try:
        while True:
            # Non-blocking: just read from buffer (cap.read is in the thread)
            frame, buf_count = frame_buffer.get()

            if frame is None:
                await asyncio.sleep(0.05)
                continue

            frame_count += 1

            # Resize to STREAM_HEIGHT
            h, w = frame.shape[:2]
            if h > STREAM_HEIGHT:
                scale = STREAM_HEIGHT / h
                frame = cv2.resize(frame, (int(w * scale), STREAM_HEIGHT))
                h, w = frame.shape[:2]

            # Trigger face detection every DETECTION_INTERVAL buffer frames
            if (buf_count - last_detection_buf_count >= DETECTION_INTERVAL
                    and engine.arcface_model):
                last_detection_buf_count = buf_count
                frame_copy = frame.copy()
                asyncio.create_task(
                    run_detection_async(
                        camera_id, frame_copy, frame_count, h, w,
                        capture_worker.capture_fps,
                        broadcast_callback=broadcast_faces
                    )
                )

            # JPEG encode
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, STREAM_QUALITY])
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

            # Stable frame pacing
            next_frame_time += frame_interval
            sleep_time = next_frame_time - loop.time()
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
            elif sleep_time < -frame_interval * 3:
                # Far behind — reset pacing anchor
                next_frame_time = loop.time()

    except asyncio.CancelledError:
        logger.info(f"MJPEG stream cancelled for {camera_id}")
    finally:
        capture_worker.stop()
        _capture_workers.pop(camera_id, None)
        reset_detection_flag(camera_id)
        logger.info(f"MJPEG stream ended for {camera_id}")


# ============== WEBSOCKET BROADCASTING ==============

async def broadcast_faces(
    camera_id: str,
    faces: List[dict],
    fps: int = 0,
    resolution: tuple = (0, 0),
    frame_id: int = 0
):
    """Broadcast face detection results to all WebSocket subscribers."""
    latest_faces[camera_id] = faces

    subscribers = face_subscribers.get(camera_id, [])
    if not subscribers:
        return

    # Include capture FPS from CaptureWorker
    worker = _capture_workers.get(camera_id)
    capture_fps = worker.capture_fps if worker else 0

    dead_sockets = []
    message = {
        "type": "faces",
        "camera_id": camera_id,
        "frame_id": frame_id,
        "faces": faces,
        "fps": fps,
        "capture_fps": capture_fps,
        "resolution": {"width": resolution[0], "height": resolution[1]},
        "timestamp": datetime.now().isoformat()
    }

    for ws in subscribers:
        if ws.client_state != WebSocketState.CONNECTED:
            dead_sockets.append(ws)
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead_sockets.append(ws)

    for ws in dead_sockets:
        if ws in subscribers:
            subscribers.remove(ws)


def subscribe(camera_id: str, websocket: WebSocket):
    if camera_id not in face_subscribers:
        face_subscribers[camera_id] = []
    face_subscribers[camera_id].append(websocket)


def unsubscribe(camera_id: str, websocket: WebSocket):
    if camera_id in face_subscribers:
        subs = face_subscribers[camera_id]
        if websocket in subs:
            subs.remove(websocket)


def get_latest_faces(camera_id: str) -> List[dict]:
    return latest_faces.get(camera_id, [])


def get_backend_info() -> dict:
    return {
        "gstreamer": GSTREAMER_AVAILABLE,
        "nvdec": NVDEC_AVAILABLE,
        "ffmpeg": True,
    }
