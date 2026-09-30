# -*- coding: UTF-8 -*-
"""
Legacy SORT tracker for face tracking.

This is the original SORT implementation used for face-only tracking.
Kept for backward compatibility and for extract_students.py.
"""

import numpy as np
from scipy.optimize import linear_sum_assignment


class KalmanBoxTracker:
    """
    Kalman Filter для отслеживания bbox.
    Состояние: [x_center, y_center, scale, aspect_ratio, vx, vy, vs]
    """
    count = 0

    def __init__(self, bbox, landmarks=None):
        self.id = KalmanBoxTracker.count
        KalmanBoxTracker.count += 1

        # Состояние: [x, y, s, r, vx, vy, vs]
        self.dim_x = 7
        self.dim_z = 4

        self.x = np.zeros((self.dim_x, 1))
        self.x[:4] = self._bbox_to_z(bbox)

        # Матрицы Kalman Filter
        self.F = np.eye(self.dim_x)
        self.F[0, 4] = 1
        self.F[1, 5] = 1
        self.F[2, 6] = 1

        self.H = np.zeros((self.dim_z, self.dim_x))
        self.H[:4, :4] = np.eye(4)

        self.P = np.eye(self.dim_x) * 10
        self.P[4:, 4:] *= 1000

        self.Q = np.eye(self.dim_x)
        self.Q[4:, 4:] *= 0.01

        self.R = np.eye(self.dim_z) * 1

        # Данные для распознавания
        self.landmarks = landmarks
        self.name = None
        self.score = 0
        self.recognized = False
        self.time_since_update = 0
        self.hits = 1
        self.recognition_attempts = 0
        self.scores_history = []
        self.confidence = 0.0

        # Extraction-specific fields
        self.embeddings = []
        self.photo_count = 0
        self.face_sizes = []
        self.confidences = []

    def _bbox_to_z(self, bbox):
        """Конвертирует [x1,y1,x2,y2] в [x,y,s,r]."""
        x1, y1, x2, y2 = bbox
        w = x2 - x1
        h = y2 - y1
        x = x1 + w / 2
        y = y1 + h / 2
        s = w * h
        r = w / (h + 1e-6)
        return np.array([[x], [y], [s], [r]])

    def _z_to_bbox(self, z):
        """Конвертирует [x,y,s,r] в [x1,y1,x2,y2]."""
        x, y, s, r = z.flatten()
        w = np.sqrt(max(s * r, 1))
        h = s / (w + 1e-6)
        return [int(x - w/2), int(y - h/2), int(x + w/2), int(y + h/2)]

    def predict(self):
        """Предсказание следующего состояния."""
        if self.x[2] + self.x[6] <= 0:
            self.x[6] = 0

        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q
        self.time_since_update += 1
        return self._z_to_bbox(self.x[:4])

    def update(self, bbox, landmarks=None, confidence=None):
        """Обновление по измерению."""
        z = self._bbox_to_z(bbox)

        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)

        y = z - self.H @ self.x
        self.x = self.x + K @ y
        self.P = (np.eye(self.dim_x) - K @ self.H) @ self.P

        self.time_since_update = 0
        self.hits += 1
        if landmarks is not None:
            self.landmarks = landmarks
        if confidence is not None:
            self.confidence = confidence

        # Track quality metrics
        x1, y1, x2, y2 = bbox
        face_size = max(x2 - x1, y2 - y1)
        self.face_sizes.append(face_size)
        if confidence is not None:
            self.confidences.append(confidence)

    def get_state(self):
        """Возвращает текущий bbox."""
        return self._z_to_bbox(self.x[:4])

    @property
    def bbox(self):
        return self.get_state()

    def set_identity(self, name, score):
        """Устанавливает личность с усреднением скоров."""
        self.scores_history.append(score)
        if len(self.scores_history) > 5:
            self.scores_history.pop(0)

        avg_score = np.mean(self.scores_history)

        if name and avg_score > self.score:
            self.name = name
            self.score = avg_score
            self.recognized = True

    def is_duplicate(self, embedding, threshold=0.90):
        """Проверяет, является ли эмбеддинг дубликатом."""
        if not self.embeddings:
            return False
        for saved_emb in self.embeddings:
            if np.dot(saved_emb, embedding) > threshold:
                return True
        return False

    def add_embedding(self, embedding):
        """Добавляет эмбеддинг."""
        self.embeddings.append(embedding)

    def get_mean_embedding(self):
        """Возвращает средний эмбеддинг."""
        if not self.embeddings:
            return None
        mean_emb = np.mean(self.embeddings, axis=0)
        return mean_emb / np.linalg.norm(mean_emb)

    @staticmethod
    def reset_count():
        """Reset ID counter."""
        KalmanBoxTracker.count = 0


class SORTTracker:
    """
    SORT: Simple Online and Realtime Tracking.
    Kalman Filter + Hungarian Algorithm.
    """

    def __init__(self, max_age=30, min_hits=3, iou_threshold=0.3, debug=False):
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        self.trackers = []
        self.finished_tracks = []
        self.debug = debug

    @property
    def tracks(self):
        """Алиас для совместимости."""
        return self.trackers

    def _iou_batch(self, bb_test, bb_gt):
        """Вычисляет IOU матрицу."""
        bb_test = np.array(bb_test)
        bb_gt = np.array(bb_gt)

        if len(bb_test) == 0 or len(bb_gt) == 0:
            return np.empty((len(bb_test), len(bb_gt)))

        xx1 = np.maximum(bb_test[:, 0:1], bb_gt[:, 0].T)
        yy1 = np.maximum(bb_test[:, 1:2], bb_gt[:, 1].T)
        xx2 = np.minimum(bb_test[:, 2:3], bb_gt[:, 2].T)
        yy2 = np.minimum(bb_test[:, 3:4], bb_gt[:, 3].T)

        w = np.maximum(0., xx2 - xx1)
        h = np.maximum(0., yy2 - yy1)
        inter = w * h

        area_test = (bb_test[:, 2] - bb_test[:, 0]) * (bb_test[:, 3] - bb_test[:, 1])
        area_gt = (bb_gt[:, 2] - bb_gt[:, 0]) * (bb_gt[:, 3] - bb_gt[:, 1])

        union = area_test[:, np.newaxis] + area_gt - inter
        return inter / (union + 1e-6)

    def _associate(self, detections, trackers):
        """Hungarian algorithm для сопоставления."""
        if len(trackers) == 0:
            return np.empty((0, 2), dtype=int), np.arange(len(detections)), np.empty(0, dtype=int)

        if len(detections) == 0:
            return np.empty((0, 2), dtype=int), np.empty(0, dtype=int), np.arange(len(trackers))

        det_bboxes = [d['bbox'] for d in detections]
        trk_bboxes = [t.bbox for t in trackers]
        iou_matrix = self._iou_batch(det_bboxes, trk_bboxes)

        if min(iou_matrix.shape) > 0:
            cost_matrix = 1 - iou_matrix
            row_indices, col_indices = linear_sum_assignment(cost_matrix)
        else:
            row_indices = np.empty(0, dtype=int)
            col_indices = np.empty(0, dtype=int)

        matches = []
        for r, c in zip(row_indices, col_indices):
            if iou_matrix[r, c] >= self.iou_threshold:
                matches.append([r, c])

        matches = np.array(matches).reshape(-1, 2) if matches else np.empty((0, 2), dtype=int)

        unmatched_dets = [d for d in range(len(detections)) if d not in matches[:, 0]] if len(matches) else list(range(len(detections)))
        unmatched_trks = [t for t in range(len(trackers)) if t not in matches[:, 1]] if len(matches) else list(range(len(trackers)))

        return matches, np.array(unmatched_dets), np.array(unmatched_trks)

    def update(self, detections):
        """Обновляет треки по детекциям."""
        # Predict
        for t in self.trackers:
            t.predict()

        # Associate
        matches, unmatched_dets, unmatched_trks = self._associate(detections, self.trackers)

        # Update matched trackers
        for m in matches:
            det_idx, trk_idx = m
            self.trackers[trk_idx].update(
                detections[det_idx]['bbox'],
                detections[det_idx].get('landmarks'),
                detections[det_idx].get('confidence')
            )

        # Create new trackers
        for d in unmatched_dets:
            new_tracker = KalmanBoxTracker(
                detections[d]['bbox'],
                detections[d].get('landmarks')
            )
            # Record initial quality metrics
            bbox = detections[d]['bbox']
            x1, y1, x2, y2 = bbox
            new_tracker.face_sizes.append(max(x2 - x1, y2 - y1))
            conf = detections[d].get('confidence')
            if conf is not None:
                new_tracker.confidences.append(conf)
            new_tracker.confidence = detections[d].get('confidence', 0.0)
            self.trackers.append(new_tracker)

        # Remove dead trackers
        active_trackers = []
        for t in self.trackers:
            if t.time_since_update >= self.max_age:
                if t.embeddings:
                    self.finished_tracks.append(t)
            else:
                active_trackers.append(t)
        self.trackers = active_trackers

        return self.trackers

    def get_unrecognized(self):
        """Возвращает треки, которые нужно распознать."""
        import config as cfg
        result = []
        for t in self.trackers:
            if cfg.SKIP_RECOGNIZED and t.recognized and t.score >= cfg.SKIP_CONFIDENCE:
                continue
            if t.recognition_attempts >= cfg.MAX_RECOGNITION_ATTEMPTS:
                continue
            if t.confidence < cfg.MIN_DETECTION_CONF:
                continue
            if not t.recognized:
                result.append(t)
        return result

    def get_track_by_bbox(self, bbox, threshold=0.5):
        """Находит трек по bbox."""
        def iou(box1, box2):
            x1 = max(box1[0], box2[0])
            y1 = max(box1[1], box2[1])
            x2 = min(box1[2], box2[2])
            y2 = min(box1[3], box2[3])
            inter = max(0, x2 - x1) * max(0, y2 - y1)
            area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
            area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
            return inter / (area1 + area2 - inter + 1e-6)

        for track in self.trackers:
            if iou(track.bbox, bbox) >= threshold:
                return track
        return None

    def finalize(self):
        """Завершает все активные треки."""
        for t in self.trackers:
            if t.embeddings:
                self.finished_tracks.append(t)
        self.trackers = []

    def get_all_tracks(self):
        """Возвращает все завершённые треки."""
        return self.finished_tracks


# Aliases for compatibility
FaceTracker = SORTTracker
TrackedFace = KalmanBoxTracker
