# -*- coding: UTF-8 -*-
"""Поток инференса: детекция + трекинг + распознавание."""
import os
import cv2
import time
import threading
import numpy as np
import torch
from collections import deque

import config as cfg
from core.utils import suppress_stdout, align_face, load_name_mapping

# ArcFace (ONNX)
import onnxruntime
onnxruntime.set_default_logger_severity(3)
from insightface.app import FaceAnalysis


class InferenceThread(threading.Thread):
    """Поток инференса: детекция + трекинг + распознавание."""

    def __init__(self, frame_buffer, tracker, database_path=None, csv_path=None, debug=False):
        super().__init__(daemon=True)
        self.frame_buffer = frame_buffer
        self.tracker = tracker
        self.database_path = database_path or cfg.DATABASE_PATH
        self.csv_path = csv_path
        self.running = True
        self.fps = 0
        self.threshold = cfg.RECOGNITION_THRESHOLD
        self.lock = threading.Lock()
        self.debug = debug
        self.use_yolo26 = (cfg.DETECTOR_MODE == 'yolo26_insightface')
        self.yolo26_detector = None

    def run(self):
        device = cfg.DEVICE
        print(f"[Inference] Device: {device}")
        cfg.print_config()

        # Load database
        print("[Inference] Loading database...")
        data = torch.load(self.database_path, map_location='cpu', weights_only=False)

        if 'zs' in data:
            zs = data['zs']
            idxs = data['idxs']
            embeddings = zs.cpu().numpy() if isinstance(zs, torch.Tensor) else zs
            idxs_np = idxs.cpu().numpy() if isinstance(idxs, torch.Tensor) else idxs

            # Сначала пробуем имена из базы
            name_mapping = data.get('names', {})
            if name_mapping:
                print(f"[Inference] Found {len(name_mapping)} names in database")

            # Если в базе нет имён или указан CSV - загружаем из CSV
            if not name_mapping or self.csv_path:
                csv_names = load_name_mapping(self.database_path, self.csv_path)
                if csv_names:
                    name_mapping = csv_names

            # Проверяем формат базы: multi (с id_list) или single
            id_list = data.get('id_list')
            if id_list:
                names = []
                for idx in idxs_np:
                    str_id = id_list[idx]
                    names.append(name_mapping.get(str_id, str_id))
            else:
                names = []
                for idx in idxs_np:
                    student_id = str(idx + 1)
                    names.append(name_mapping.get(student_id, student_id))

            self.db = {'embeddings': embeddings, 'names': names}
        else:
            self.db = data

        print(f"[Inference] {len(self.db['names'])} embeddings loaded")

        # Load detector(s) based on DETECTOR_MODE
        self.device = device

        if self.use_yolo26:
            # ---- YOLO26 + InsightFace mode ----
            from core.yolo26_detector import YOLO26FaceDetector
            self.yolo26_detector = YOLO26FaceDetector()
            self.rec_model = self.yolo26_detector.rec_model
            print("[Inference] Ready! (YOLO26 + InsightFace)")
        else:
            # ---- YOLOv8-face (TRT) + TRT ArcFace mode ----
            from ultralytics import YOLO as UltralyticsYOLO

            yolov8_engine = os.path.join(cfg.BASE_DIR, 'weights', 'yolov8n-face.engine')
            yolov8_pt = os.path.join(cfg.BASE_DIR, 'weights', 'yolov8n-face.pt')
            if os.path.exists(yolov8_engine):
                print(f"[Inference] Loading YOLOv8-face TRT: {yolov8_engine}")
                self.yolov8_face = UltralyticsYOLO(yolov8_engine, task='pose')
            else:
                print(f"[Inference] Loading YOLOv8-face PT: {yolov8_pt}")
                self.yolov8_face = UltralyticsYOLO(yolov8_pt, task='pose')
            print("[Inference] YOLOv8-face loaded!")

            # TRT ArcFace (batch) — reuse from yolo26_detector
            from core.yolo26_detector import YOLO26FaceDetector
            self._trt_rec_ok = False
            trt_dir = os.path.join(cfg.BASE_DIR, "models", "insightface",
                                   "models", "buffalo_l")
            rec_engine_path = os.path.join(trt_dir, "w600k_r50_fp16.engine")

            if os.path.exists(rec_engine_path):
                import tensorrt as trt_lib
                print(f"[Inference] Loading TRT ArcFace: {rec_engine_path}")
                trt_logger = trt_lib.Logger(trt_lib.Logger.WARNING)
                trt_runtime = trt_lib.Runtime(trt_logger)
                with open(rec_engine_path, "rb") as f:
                    self._rec_engine = trt_runtime.deserialize_cuda_engine(f.read())
                self._rec_context = self._rec_engine.create_execution_context()
                self._trt_rec_ok = True
                self._trt_stream = torch.cuda.Stream()
                # Borrow _trt_infer and _trt_batch_rec from YOLO26FaceDetector
                self._trt_infer = YOLO26FaceDetector._trt_infer.__get__(self)
                self._trt_batch_rec = YOLO26FaceDetector._trt_batch_rec.__get__(self)
                print("[Inference] TRT ArcFace loaded!")
            else:
                print("[Inference] TRT ArcFace not found, loading ONNX fallback...")
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
                        print(f"[Inference] Recognition model: {name}")
                        break

            rec_mode = "TRT" if self._trt_rec_ok else "ONNX"
            print(f"[Inference] Ready! (det: YOLOv8-face, rec: {rec_mode})")

        fps_counter = deque(maxlen=30)
        frame_count = 0
        # Тайминг inference pipeline
        _inf_timings = {
            'detect': deque(maxlen=50),
            'embed': deque(maxlen=50),
            'track': deque(maxlen=50),
            'recog': deque(maxlen=50),
            'total': deque(maxlen=50),
        }
        _inf_log_every = 20

        while self.running:
            start = time.time()

            # Берём последний кадр — все промежуточные дропаются автоматически
            frame = self.frame_buffer.get()
            if frame is None:
                time.sleep(0.01)
                continue

            frame_count += 1

            # Каждый кадр = реальная детекция
            if True:
                # --- DETECT ---
                t0 = time.perf_counter()
                detections = self._detect_faces(frame)
                t_detect = (time.perf_counter() - t0) * 1000

                # --- EMBED (batch) ---
                t0 = time.perf_counter()
                embeddings = [None] * len(detections)

                # Собрать aligned crops для батча
                crops_112 = []
                crop_indices = []
                for i, det in enumerate(detections):
                    if det['confidence'] < cfg.MIN_DETECTION_CONF:
                        continue
                    if det.get('_embedding') is not None:
                        emb = det['_embedding'].flatten()
                        norm = np.linalg.norm(emb)
                        if norm > 0:
                            emb = emb / norm
                        embeddings[i] = emb
                        continue

                    crop_112 = None
                    lm = det.get('landmarks')
                    if cfg.USE_ALIGNMENT and lm is not None:
                        crop_112 = align_face(frame, lm)
                    if crop_112 is None:
                        x1, y1, x2, y2 = [int(v) for v in det['bbox']]
                        pad = 15
                        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
                        x2 = min(frame.shape[1], x2 + pad)
                        y2 = min(frame.shape[0], y2 + pad)
                        fc = frame[y1:y2, x1:x2]
                        if fc.size > 0 and fc.shape[0] >= 20 and fc.shape[1] >= 20:
                            crop_112 = cv2.resize(fc, (112, 112))

                    if crop_112 is not None:
                        crops_112.append(crop_112)
                        crop_indices.append(i)

                if crops_112:
                    if not self.use_yolo26 and self._trt_rec_ok:
                        batch_embs = self._trt_batch_rec(crops_112)
                    elif self.use_yolo26 and hasattr(self.yolo26_detector, '_trt_batch_rec') and self.yolo26_detector._trt_rec_ok:
                        batch_embs = self.yolo26_detector._trt_batch_rec(crops_112)
                    else:
                        batch_embs = []
                        for c in crops_112:
                            try:
                                e = self.rec_model.get_feat(c).flatten()
                                e = e / np.linalg.norm(e)
                                batch_embs.append(e)
                            except Exception:
                                batch_embs.append(None)
                        batch_embs = batch_embs  # list

                    for j, idx in enumerate(crop_indices):
                        emb = batch_embs[j] if not isinstance(batch_embs, np.ndarray) else batch_embs[j]
                        if emb is not None:
                            emb = emb.flatten()
                            norm = np.linalg.norm(emb)
                            if norm > 0:
                                emb = emb / norm
                        embeddings[idx] = emb

                t_embed = (time.perf_counter() - t0) * 1000

                # --- TRACKER UPDATE ---
                t0 = time.perf_counter()
                with self.lock:
                    self.tracker.update(detections, embeddings, frame_idx=frame_count)
                t_track = (time.perf_counter() - t0) * 1000

                # --- RECOGNITION ---
                t0 = time.perf_counter()
                with self.lock:
                    unrecognized = self._get_unrecognized_tracks()

                for track in unrecognized:
                    if not hasattr(track, 'recognition_attempts'):
                        track.recognition_attempts = 0
                    track.recognition_attempts += 1

                    emb = track.embeddings[-1] if track.embeddings else None

                    if emb is not None:
                        name, score = self._recognize(emb)
                        if self.debug and track.recognition_attempts <= 3:
                            print(f"  [REC] track:{track.track_id} name={name} score={score:.3f} att={track.recognition_attempts}")
                        with self.lock:
                            self._set_track_identity(track, name, score)
                t_recog = (time.perf_counter() - t0) * 1000

                # --- LOG ---
                t_total = (time.time() - start) * 1000
                _inf_timings['detect'].append(t_detect)
                _inf_timings['embed'].append(t_embed)
                _inf_timings['track'].append(t_track)
                _inf_timings['recog'].append(t_recog)
                _inf_timings['total'].append(t_total)

                if frame_count % _inf_log_every == 0:
                    avg = {k: np.mean(v) if v else 0 for k, v in _inf_timings.items()}
                    fps_now = 1000.0 / avg['total'] if avg['total'] > 0 else 0
                    n_faces = len(detections)
                    print(
                        f"[INF] detect:{avg['detect']:5.1f}ms | "
                        f"embed:{avg['embed']:4.1f}ms | "
                        f"track:{avg['track']:4.1f}ms | "
                        f"recog:{avg['recog']:4.1f}ms | "
                        f"TOTAL:{avg['total']:5.1f}ms = {fps_now:.1f}fps | "
                        f"faces:{n_faces}"
                    )

            # FPS
            elapsed = time.time() - start
            if elapsed > 0:
                fps_counter.append(elapsed)
            self.fps = len(fps_counter) / max(sum(fps_counter), 0.001)

    def _detect_faces(self, frame):
        """Детекция лиц: YOLO26+InsightFace или YOLOv8-face."""
        if self.use_yolo26:
            return self.yolo26_detector.detect(frame)

        # --- YOLOv8-face (pose task: bbox + 5 keypoints) ---
        results = self.yolov8_face.predict(
            frame,
            imgsz=640,
            conf=cfg.YOLO_CONF_THRES,
            verbose=False,
            half=(cfg.DEVICE == 'cuda'),
        )

        faces = []
        for r in results:
            if r.boxes is None:
                continue
            boxes = r.boxes
            kps_all = r.keypoints  # (N, 5, 3) — x, y, conf per keypoint

            for i in range(len(boxes)):
                xyxy = boxes.xyxy[i].cpu().numpy().astype(int)
                conf = float(boxes.conf[i].cpu().numpy())

                w, h = xyxy[2] - xyxy[0], xyxy[3] - xyxy[1]
                if min(w, h) < cfg.MIN_FACE_SIZE:
                    continue

                landmarks = None
                if kps_all is not None and kps_all.xy is not None:
                    kp = kps_all.xy[i].cpu().numpy()  # (5, 2)
                    if kp.shape[0] == 5:
                        landmarks = kp.flatten().astype(np.float32)  # (10,)

                faces.append({
                    'bbox': xyxy.tolist(),
                    'landmarks': landmarks,
                    'confidence': conf,
                })

        return faces

    def _get_embedding(self, frame, bbox, landmarks=None, cached_embedding=None):
        """ArcFace эмбеддинг: TRT batch или ONNX fallback."""
        if self.use_yolo26:
            return self.yolo26_detector.get_embedding(
                frame, bbox, landmarks, cached_embedding
            )

        if cached_embedding is not None:
            emb = cached_embedding.flatten()
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            return emb

        # Выравнивание по landmarks
        if cfg.USE_ALIGNMENT and landmarks is not None:
            aligned = align_face(frame, landmarks)
            if aligned is not None:
                if self._trt_rec_ok:
                    return self._trt_batch_rec([aligned])[0]
                elif self.rec_model is not None:
                    try:
                        emb = self.rec_model.get_feat(aligned).flatten()
                        return emb / np.linalg.norm(emb)
                    except Exception:
                        pass

        # Fallback: простое обрезание
        x1, y1, x2, y2 = [int(v) for v in bbox]
        pad = 15
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2, y2 = min(frame.shape[1], x2 + pad), min(frame.shape[0], y2 + pad)
        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0 or face_crop.shape[0] < 20 or face_crop.shape[1] < 20:
            return None

        face_resized = cv2.resize(face_crop, (112, 112))

        if self._trt_rec_ok:
            return self._trt_batch_rec([face_resized])[0]

        if self.rec_model is None:
            return None
        try:
            emb = self.rec_model.get_feat(face_resized).flatten()
            return emb / np.linalg.norm(emb)
        except Exception:
            return None

    def _recognize(self, embedding):
        """Поиск в базе по косинусному сходству."""
        if embedding is None:
            return None, 0

        scores = np.dot(self.db['embeddings'], embedding)
        best_idx = np.argmax(scores)
        best_score = float(scores[best_idx])

        if best_score >= self.threshold:
            return self.db['names'][best_idx], best_score
        return None, best_score

    def _get_unrecognized_tracks(self):
        """Получить треки для распознавания (DeepSORT)."""
        result = []
        for t in self.tracker.tracks:
            if not t.is_confirmed():
                continue

            if not hasattr(t, 'name'):
                t.name = None
                t.score = 0
                t.recognized = False
                t.recognition_attempts = 0

            if cfg.SKIP_RECOGNIZED and t.recognized and t.score >= cfg.SKIP_CONFIDENCE:
                continue

            if t.recognition_attempts >= cfg.MAX_RECOGNITION_ATTEMPTS:
                continue

            if not t.embeddings:
                continue

            result.append(t)
        return result

    def _set_track_identity(self, track, name, score):
        """Устанавливает личность трека с усреднением скоров."""
        if not hasattr(track, 'scores_history'):
            track.scores_history = []

        track.scores_history.append(score)
        if len(track.scores_history) > 5:
            track.scores_history.pop(0)

        avg_score = np.mean(track.scores_history)

        if avg_score > track.score:
            if name and avg_score >= 0.50:
                track.name = name
            else:
                track.name = 'Танымадым'
            track.score = avg_score
            track.recognized = True

    def get_tracks(self):
        """Получить текущие треки (потокобезопасно)."""
        with self.lock:
            if False:
                pass
            else:
                # DeepSORT format: face only
                result = []
                for t in self.tracker.tracks:
                    if t.time_since_update > 3 or not t.is_confirmed():
                        continue

                    name = getattr(t, 'name', None)
                    score = getattr(t, 'score', 0)
                    recognized = getattr(t, 'recognized', False)

                    result.append({
                        'track_id': t.track_id,
                        'bbox': list(t.bbox),
                        'body_bbox': None,
                        'face_bbox': list(t.bbox),
                        'name': name,
                        'confidence': score,
                        'recognized': recognized,
                        'state': 'recognized' if recognized else 'tracking',
                        'id': t.track_id
                    })
                return result

    def stop(self):
        self.running = False
