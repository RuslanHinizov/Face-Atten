# -*- coding: UTF-8 -*-
"""Потокобезопасные буферы и поток захвата видео."""
import os
import cv2
import time
import threading
from collections import deque


class FrameBuffer:
    """Потокобезопасный буфер для кадров."""

    def __init__(self):
        self.frame = None
        self.lock = threading.Lock()

    def update(self, frame):
        with self.lock:
            self.frame = frame.copy()

    def get(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None


class CaptureThread(threading.Thread):
    """Поток захвата видео."""

    def __init__(self, source, frame_buffer, target_fps=30):
        super().__init__(daemon=True)
        self.source = source
        self.frame_buffer = frame_buffer
        self.target_fps = target_fps
        self.running = True
        self.fps = 0

    def run(self):
        # TCP транспорт + увеличенный буфер для стабильного RTSP
        is_rtsp = isinstance(self.source, str) and self.source.startswith('rtsp')
        if is_rtsp:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                "rtsp_transport;tcp|"
                "buffer_size;65536|"          # Минимальный TCP буфер
                "max_delay;0|"                # Без задержки
                "analyzeduration;1000000|"    # 1s анализ
                "probesize;1000000"           # 1MB проба
            )
            cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        else:
            cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            print(f"[Capture] Error: Cannot open {self.source}")
            return

        # Для файлов — ограничиваем FPS; для RTSP — читаем максимально быстро
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        if not is_rtsp and actual_fps > 0:
            frame_time = 1.0 / min(self.target_fps, actual_fps)
        else:
            frame_time = 0  # RTSP: без пауз, дренируем буфер

        mode = 'RTSP drain' if is_rtsp else 'file'
        print(f"[Capture] Opened: {self.source} ({mode})")
        fps_counter = deque(maxlen=30)

        while self.running:
            start = time.time()

            if is_rtsp:
                # Дренируем буфер: grab() быстрый, retrieve() только для последнего
                grabbed = cap.grab()
                if not grabbed:
                    print("[Capture] Reconnecting...")
                    cap.release()
                    time.sleep(1)
                    cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    continue
                ret, frame = cap.retrieve()
                if not ret:
                    continue
            else:
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue

            self.frame_buffer.update(frame)

            # FPS
            elapsed = time.time() - start
            if elapsed > 0:
                fps_counter.append(elapsed)
            self.fps = len(fps_counter) / max(sum(fps_counter), 0.001)

            # Ограничение FPS только для файлов (RTSP — без пауз)
            if frame_time > 0:
                elapsed = time.time() - start
                if elapsed < frame_time:
                    time.sleep(frame_time - elapsed)

        cap.release()

    def stop(self):
        self.running = False
