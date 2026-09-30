# -*- coding: UTF-8 -*-
"""
YOLO26 + InsightFace детектор лиц.

Pipeline:
  1. YOLO26s детектирует persons (COCO class 0)
  2. Для каждого person вырезается верхняя часть (голова)
  3. InsightFace (ONNX) детектирует лица в кропах (ThreadPoolExecutor)
  4. TRT w600k_r50 батчевый ArcFace для эмбеддингов (fallback: ONNX get_feat)
  5. Координаты маппятся обратно на оригинальный кадр
"""
import os
import sys
import io
import time
import numpy as np
import cv2
import torch
import tensorrt as trt
from contextlib import contextmanager
from collections import deque
from concurrent.futures import ThreadPoolExecutor

import config as cfg

_NP_TO_TORCH = {
    np.dtype('float32'): torch.float32,
    np.dtype('float16'): torch.float16,
    np.dtype('int32'):   torch.int32,
    np.dtype('int8'):    torch.int8,
}


@contextmanager
def _suppress_stdout():
    old = sys.stdout
    sys.stdout = io.StringIO()
    try:
        yield
    finally:
        sys.stdout = old


class YOLO26FaceDetector:
    """Person detection (YOLO26) → head crop → face detection + recognition."""

    def __init__(self):
        from ultralytics import YOLO
        from insightface.app import FaceAnalysis

        # --- YOLO26 person detector ---
        print("[YOLO26] Loading person detector...")
        self.yolo = YOLO(cfg.YOLO26_WEIGHTS)
        print(f"[YOLO26] Model loaded: {cfg.YOLO26_WEIGHTS}")

        # --- InsightFace (ONNX — детекция лиц) ---
        print("[YOLO26] Loading InsightFace...")
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        with _suppress_stdout():
            self.face_app = FaceAnalysis(
                name=cfg.ARCFACE_MODEL,
                root=cfg.INSIGHTFACE_ROOT,
                providers=providers,
            )
            self.face_app.prepare(ctx_id=0, det_size=(256, 256))

        # Extract recognition model for ONNX fallback
        self.rec_model = None
        for name, model in self.face_app.models.items():
            if 'recognition' in name or 'w600k' in name or 'rec' in name:
                self.rec_model = model
                print(f"[YOLO26] Recognition model: {name}")
                break

        # --- TensorRT ArcFace engine (optional, fallback to ONNX) ---
        self._trt_rec_ok = False
        trt_dir = os.path.join(cfg.BASE_DIR, "models", "insightface",
                               "models", "buffalo_l")
        rec_engine_path = os.path.join(trt_dir, "w600k_r50_fp16.engine")

        if os.path.exists(rec_engine_path):
            print("[YOLO26] Loading TRT rec engine...")
            trt_logger = trt.Logger(trt.Logger.WARNING)
            trt_runtime = trt.Runtime(trt_logger)
            with open(rec_engine_path, "rb") as f:
                self._rec_engine = trt_runtime.deserialize_cuda_engine(f.read())
            self._rec_context = self._rec_engine.create_execution_context()
            self._trt_rec_ok = True
            print(f"[YOLO26] TRT rec loaded: {rec_engine_path}")
        else:
            print("[YOLO26] TRT rec not found, using ONNX fallback")

        # Выделенный CUDA stream для TRT inference
        self._trt_stream = torch.cuda.Stream()

        # Thread pool для параллельной обработки кропов
        self._pool = ThreadPoolExecutor(max_workers=4)

        # Профайлер
        self._timings = {
            'yolo': deque(maxlen=50),
            'crops': deque(maxlen=50),
            'insight': deque(maxlen=50),
            'total': deque(maxlen=50),
        }
        self._frame_count = 0
        self._log_every = 20

        rec_mode = "TRT" if self._trt_rec_ok else "ONNX"
        print(f"[YOLO26] Ready! (det: ONNX, rec: {rec_mode})")

    # ------------------------------------------------------------------ #
    #  TRT inference
    # ------------------------------------------------------------------ #
    def _trt_infer(self, context, engine, input_dict):
        """TRT инференс через execute_async_v3 с torch.cuda тензорами (zero-copy)."""
        for i in range(engine.num_io_tensors):
            name = engine.get_tensor_name(i)
            if engine.get_tensor_mode(name) == trt.TensorIOMode.INPUT:
                t = input_dict[name]
                if not t.is_contiguous():
                    t = t.contiguous()
                    input_dict[name] = t
                context.set_input_shape(name, tuple(t.shape))
                context.set_tensor_address(name, t.data_ptr())

        outputs = {}
        for i in range(engine.num_io_tensors):
            name = engine.get_tensor_name(i)
            if engine.get_tensor_mode(name) == trt.TensorIOMode.OUTPUT:
                shape = tuple(context.get_tensor_shape(name))
                np_dtype = np.dtype(trt.nptype(engine.get_tensor_dtype(name)))
                torch_dtype = _NP_TO_TORCH.get(np_dtype, torch.float32)
                t = torch.empty(shape, dtype=torch_dtype, device='cuda')
                context.set_tensor_address(name, t.data_ptr())
                outputs[name] = t

        self._trt_stream.synchronize()
        context.execute_async_v3(self._trt_stream.cuda_stream)
        self._trt_stream.synchronize()
        return outputs

    # ------------------------------------------------------------------ #
    #  TRT ArcFace batch recognition
    # ------------------------------------------------------------------ #
    def _trt_batch_rec(self, crops_112, _max_batch=16):
        """
        Батч ArcFace через TRT rec engine.
        crops_112: list of (112,112,3) uint8 numpy arrays
        Returns: (N, 512) normalized embeddings
        Автоматически разбивает на чанки по _max_batch (TRT profile limit).
        """
        if not crops_112:
            return np.empty((0, 512), dtype=np.float32)

        # Препроцессинг всех кропов
        processed = []
        for img in crops_112:
            img_f = img.astype(np.float32)
            img_f = (img_f - 127.5) / 127.5  # [-1, 1]
            img_f = img_f.transpose(2, 0, 1)  # HWC → CHW
            processed.append(img_f)

        all_embeddings = []
        # Разбиваем на чанки по _max_batch
        for start in range(0, len(processed), _max_batch):
            chunk = processed[start:start + _max_batch]
            batch_np = np.stack(chunk, axis=0)  # (chunk_size, 3, 112, 112)
            input_tensor = torch.from_numpy(batch_np).cuda()

            outputs = self._trt_infer(self._rec_context, self._rec_engine,
                                      {'input.1': input_tensor})

            out_name = list(outputs.keys())[0]
            all_embeddings.append(outputs[out_name].cpu().numpy())

        embeddings = np.concatenate(all_embeddings, axis=0)  # (N, 512)

        # L2-нормализация
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.clip(norms, 1e-10, None)
        embeddings = embeddings / norms
        return embeddings

    # ------------------------------------------------------------------ #
    #  Profiling
    # ------------------------------------------------------------------ #
    def _log_timings_ex(self, n_persons, n_faces, mode="FULL"):
        self._frame_count += 1
        if self._frame_count % self._log_every != 0:
            return
        avg = {k: np.mean(v) if v else 0 for k, v in self._timings.items()}
        fps = 1000.0 / avg['total'] if avg['total'] > 0 else 0
        print(
            f"[PERF:{mode}] YOLO:{avg['yolo']:5.1f}ms | "
            f"crops:{avg['crops']:4.1f}ms | "
            f"faces:{avg['insight']:5.1f}ms | "
            f"TOTAL:{avg['total']:5.1f}ms = {fps:.1f}fps | "
            f"persons:{n_persons} faces:{n_faces}"
        )

    # ------------------------------------------------------------------ #
    #  Crop processing: ONNX det → aligned crops → batch TRT rec
    # ------------------------------------------------------------------ #
    def _process_one_crop(self, crop, hx1, hy1, w_frame, h_frame):
        """Детекция лиц через face_app.get(crop), возвращает face info + aligned crop."""
        from core.utils import align_face

        ins_faces = self.face_app.get(crop)
        results = []
        for face in ins_faces:
            fb = face.bbox.astype(int)
            fx1 = max(0, min(int(fb[0]) + hx1, w_frame - 1))
            fy1 = max(0, min(int(fb[1]) + hy1, h_frame - 1))
            fx2 = max(0, min(int(fb[2]) + hx1, w_frame - 1))
            fy2 = max(0, min(int(fb[3]) + hy1, h_frame - 1))

            fw, fh = fx2 - fx1, fy2 - fy1
            if min(fw, fh) < cfg.MIN_FACE_SIZE:
                continue

            landmarks = None
            if face.kps is not None:
                lm = face.kps.copy()
                lm[:, 0] += hx1
                lm[:, 1] += hy1
                landmarks = lm.flatten().astype(np.float32)

            det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.9

            # Aligned crop для батчевого ArcFace (используем локальные kps в crop)
            crop_112 = None
            if face.kps is not None:
                crop_112 = align_face(crop, face.kps)
            if crop_112 is None:
                face_sub = crop[int(fb[1]):int(fb[3]), int(fb[0]):int(fb[2])]
                if face_sub.size > 0 and face_sub.shape[0] >= 10 and face_sub.shape[1] >= 10:
                    crop_112 = cv2.resize(face_sub, (112, 112))

            results.append({
                'bbox': [fx1, fy1, fx2, fy2],
                'landmarks': landmarks,
                'confidence': det_score,
                '_crop_112': crop_112,
            })
        return results

    # ------------------------------------------------------------------ #
    #  Main detect
    # ------------------------------------------------------------------ #
    def detect(self, frame):
        """Detect faces: YOLO persons → head crops → ONNX det → TRT batch rec."""
        t_start = time.perf_counter()
        h_frame, w_frame = frame.shape[:2]

        # 1. YOLO26 person detection
        t0 = time.perf_counter()
        use_half = (cfg.DEVICE == 'cuda')
        results = self.yolo.predict(
            frame,
            imgsz=cfg.YOLO26_IMG_SIZE,
            conf=cfg.YOLO26_CONF_THRES,
            classes=[cfg.YOLO26_PERSON_CLASS],
            verbose=False,
            half=use_half,
        )

        persons = []
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            for i in range(len(boxes)):
                xyxy = boxes.xyxy[i].cpu().numpy().astype(int)
                conf = float(boxes.conf[i].cpu().numpy())
                persons.append((xyxy, conf))
        t_yolo = (time.perf_counter() - t0) * 1000

        if not persons:
            self._timings['yolo'].append(t_yolo)
            self._timings['crops'].append(0)
            self._timings['insight'].append(0)
            self._timings['total'].append((time.perf_counter() - t_start) * 1000)
            self._log_timings_ex(0, 0, "FULL")
            return []

        # 2. Подготовка кропов головы
        t0 = time.perf_counter()
        head_crops = []
        for (px1, py1, px2, py2), person_conf in persons:
            person_h = py2 - py1
            person_w = px2 - px1
            head_h = int(person_h * cfg.YOLO26_HEAD_RATIO)
            pad_x = int(person_w * cfg.YOLO26_HEAD_PAD)
            pad_y = int(head_h * cfg.YOLO26_HEAD_PAD)

            hx1 = max(0, px1 - pad_x)
            hy1 = max(0, py1 - pad_y)
            hx2 = min(w_frame, px2 + pad_x)
            hy2 = min(h_frame, py1 + head_h + pad_y)

            crop = frame[hy1:hy2, hx1:hx2]
            if crop.size == 0 or crop.shape[0] < 20 or crop.shape[1] < 20:
                continue

            head_crops.append((crop, hx1, hy1, hx2, hy2, person_conf))
        t_crops = (time.perf_counter() - t0) * 1000

        # 3. Face processing
        t0 = time.perf_counter()
        faces = []

        if cfg.YOLO26_FAST_CROP:
            # --- FAST MODE: прямой crop → TRT ArcFace (без детекции лиц) ---
            crops_112 = []
            meta = []
            for crop, hx1, hy1, hx2, hy2, person_conf in head_crops:
                crops_112.append(cv2.resize(crop, (112, 112)))
                meta.append((hx1, hy1, hx2, hy2, person_conf))

            if crops_112:
                if self._trt_rec_ok:
                    embeddings = self._trt_batch_rec(crops_112)
                else:
                    embeddings = []
                    for c in crops_112:
                        emb = None
                        if self.rec_model is not None:
                            try:
                                emb = self.rec_model.get_feat(c)
                            except Exception:
                                pass
                        embeddings.append(emb)

                for i, (hx1, hy1, hx2, hy2, person_conf) in enumerate(meta):
                    faces.append({
                        'bbox': [hx1, hy1, hx2, hy2],
                        'landmarks': None,
                        'confidence': person_conf,
                        '_embedding': embeddings[i],
                    })
        else:
            # --- FULL MODE: ONNX det (parallel) → batch TRT rec ---
            crop_jobs = [
                (crop.copy(), hx1, hy1, w_frame, h_frame)
                for crop, hx1, hy1, hx2, hy2, pc in head_crops
            ]
            if len(crop_jobs) == 1:
                faces = self._process_one_crop(*crop_jobs[0])
            elif crop_jobs:
                futures = [
                    self._pool.submit(self._process_one_crop, *job)
                    for job in crop_jobs
                ]
                for f in futures:
                    faces.extend(f.result())

            # Батч ArcFace: собрать aligned кропы → один вызов TRT
            if faces:
                crops_112 = []
                valid_indices = []
                for i, face in enumerate(faces):
                    c = face.pop('_crop_112', None)
                    if c is not None:
                        crops_112.append(c)
                        valid_indices.append(i)

                if crops_112:
                    if self._trt_rec_ok:
                        embeddings = self._trt_batch_rec(crops_112)
                    else:
                        embeddings = []
                        for c in crops_112:
                            try:
                                emb = self.rec_model.get_feat(c).flatten()
                                emb = emb / max(np.linalg.norm(emb), 1e-10)
                                embeddings.append(emb)
                            except Exception:
                                embeddings.append(np.zeros(512, dtype=np.float32))
                        embeddings = np.stack(embeddings)

                    for j, idx in enumerate(valid_indices):
                        faces[idx]['_embedding'] = embeddings[j]

                for face in faces:
                    if '_embedding' not in face:
                        face['_embedding'] = None

        t_insight = (time.perf_counter() - t0) * 1000

        # Профайлинг
        t_total = (time.perf_counter() - t_start) * 1000
        self._timings['yolo'].append(t_yolo)
        self._timings['crops'].append(t_crops)
        self._timings['insight'].append(t_insight)
        self._timings['total'].append(t_total)
        mode_str = "FAST" if cfg.YOLO26_FAST_CROP else "FULL"
        self._log_timings_ex(len(persons), len(faces), mode_str)

        return faces

    # ------------------------------------------------------------------ #
    #  get_embedding (standalone, used by tracker)
    # ------------------------------------------------------------------ #
    def get_embedding(self, frame, bbox, landmarks=None, cached_embedding=None):
        """
        Extract ArcFace embedding.
        Cached embedding from detect() used when available (zero cost).
        """
        if cached_embedding is not None:
            emb = cached_embedding.flatten()
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            return emb

        if cfg.USE_ALIGNMENT and landmarks is not None:
            from core.utils import align_face
            aligned = align_face(frame, landmarks)
            if aligned is not None:
                if self._trt_rec_ok:
                    embeddings = self._trt_batch_rec([aligned])
                    return embeddings[0]
                elif self.rec_model is not None:
                    try:
                        emb = self.rec_model.get_feat(aligned).flatten()
                        emb = emb / np.linalg.norm(emb)
                        return emb
                    except Exception:
                        pass

        x1, y1, x2, y2 = [int(v) for v in bbox]
        pad = 15
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2 = min(frame.shape[1], x2 + pad)
        y2 = min(frame.shape[0], y2 + pad)
        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0 or face_crop.shape[0] < 20 or face_crop.shape[1] < 20:
            return None

        face_resized = cv2.resize(face_crop, (112, 112))

        if self._trt_rec_ok:
            embeddings = self._trt_batch_rec([face_resized])
            return embeddings[0]

        if self.rec_model is None:
            return None
        try:
            emb = self.rec_model.get_feat(face_resized).flatten()
            emb = emb / np.linalg.norm(emb)
            return emb
        except Exception:
            return None
