# -*- coding: UTF-8 -*-
"""
DeepSORT tracker with appearance features.

Key improvements over SORT:
1. Uses appearance embeddings (ArcFace) for re-identification
2. Cascade matching - prioritizes recently seen tracks
3. Better handling of occlusions and ID switches
"""

import numpy as np
from scipy.optimize import linear_sum_assignment
from .kalman_filter import KalmanFilter


class DeepSORTTrack:
    """Single track with Kalman state and appearance features."""

    _id_counter = 0

    def __init__(self, bbox, embedding=None, n_init=3, max_age=30, frame_idx=0):
        """
        Initialize track.

        Args:
            bbox: [x1, y1, x2, y2]
            embedding: appearance feature vector (512-dim from ArcFace)
            n_init: frames before track is confirmed
            max_age: frames to keep track without detection
            frame_idx: current frame index for temporal tracking
        """
        DeepSORTTrack._id_counter += 1
        self.track_id = DeepSORTTrack._id_counter

        self.kf = KalmanFilter()
        # Convert bbox to [cx, cy, aspect, height]
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        self.mean, self.covariance = self.kf.initiate([cx, cy, w/h, h])

        self.hits = 1
        self.age = 1
        self.time_since_update = 0

        self.n_init = n_init
        self.max_age = max_age

        # Temporal tracking - for merge_tracks constraint
        self.start_frame = frame_idx
        self.end_frame = frame_idx

        # Appearance features - keep last N embeddings
        self.embeddings = []
        self.max_embeddings = 100
        if embedding is not None:
            self.embeddings.append(embedding)

        # State: tentative -> confirmed -> deleted
        self.state = 'tentative'

        # For photo saving
        self.photos = []
        self.landmarks_history = []
        self.confidence_history = []
        self.face_sizes = []
        self.confidences = []
        self.photo_count = 0
        self.saved_embeddings = []  # Separate list for duplicate checking

    @classmethod
    def reset_id(cls):
        cls._id_counter = 0

    @property
    def id(self):
        return self.track_id

    def predict(self):
        """Predict next state."""
        self.mean, self.covariance = self.kf.predict(self.mean, self.covariance)
        self.age += 1
        self.time_since_update += 1

    def update(self, bbox, embedding=None, confidence=1.0, landmarks=None, frame_idx=None):
        """Update track with new detection."""
        # Update Kalman
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        self.mean, self.covariance = self.kf.update(
            self.mean, self.covariance, [cx, cy, w/h, h]
        )

        # Update appearance
        if embedding is not None:
            self.embeddings.append(embedding)
            if len(self.embeddings) > self.max_embeddings:
                self.embeddings.pop(0)

        self.hits += 1
        self.time_since_update = 0

        # Update temporal tracking
        if frame_idx is not None:
            self.end_frame = frame_idx

        # Update state
        if self.state == 'tentative' and self.hits >= self.n_init:
            self.state = 'confirmed'

        # Store for photos
        self.confidence_history.append(confidence)
        if landmarks is not None:
            self.landmarks_history.append(landmarks)

    def mark_missed(self):
        """Mark track as missed this frame."""
        if self.state == 'tentative':
            self.state = 'deleted'
        elif self.time_since_update > self.max_age:
            self.state = 'deleted'

    @property
    def bbox(self):
        """Get current bbox [x1, y1, x2, y2]."""
        cx, cy, aspect, h = self.mean[:4]
        w = aspect * h
        return [
            int(cx - w/2),
            int(cy - h/2),
            int(cx + w/2),
            int(cy + h/2)
        ]

    @property
    def tlbr(self):
        """Alias for bbox."""
        return self.bbox

    def get_mean_embedding(self):
        """Get mean of stored embeddings."""
        if not self.embeddings:
            return None
        mean_emb = np.mean(self.embeddings, axis=0)
        return mean_emb / (np.linalg.norm(mean_emb) + 1e-6)

    def add_embedding(self, embedding):
        """Add embedding (called externally)."""
        if embedding is not None:
            self.embeddings.append(embedding)
            if len(self.embeddings) > self.max_embeddings:
                self.embeddings.pop(0)

    def is_duplicate(self, embedding, threshold=0.90):
        """Check if embedding is duplicate of saved photos (not tracking embeddings)."""
        if not self.saved_embeddings or embedding is None:
            return False
        for saved_emb in self.saved_embeddings:
            if np.dot(saved_emb, embedding) > threshold:
                return True
        return False

    def mark_saved(self, embedding, face_size, confidence):
        """Mark that a photo was saved with this embedding."""
        if embedding is not None:
            self.saved_embeddings.append(embedding)
        self.face_sizes.append(face_size)
        self.confidences.append(confidence)

    def is_confirmed(self):
        return self.state == 'confirmed'

    def is_deleted(self):
        return self.state == 'deleted'


class DeepSORT:
    """
    DeepSORT tracker with appearance matching.

    Algorithm:
    1. Predict all track positions
    2. Cascade matching:
       a. Match confirmed tracks by appearance (cosine) + position
       b. Match remaining by IoU
    3. Update matched tracks
    4. Create new tracks for unmatched detections
    5. Delete old tracks
    """

    def __init__(self, max_age=30, n_init=3, max_cosine_dist=0.4,
                 nn_budget=100, iou_threshold=0.3):
        """
        Initialize DeepSORT.

        Args:
            max_age: frames to keep track without detection
            n_init: frames before track is confirmed
            max_cosine_dist: max cosine distance for appearance matching
            nn_budget: max embeddings per track
            iou_threshold: IoU threshold for position matching
        """
        self.max_age = max_age
        self.n_init = n_init
        self.max_cosine_dist = max_cosine_dist
        self.nn_budget = nn_budget
        self.iou_threshold = iou_threshold

        self.tracks = []
        self.all_tracks_history = []  # Все треки включая удалённые
        DeepSORTTrack.reset_id()

    def update(self, detections, embeddings=None, frame_idx=0):
        """
        Update tracker with new detections.

        Args:
            detections: list of dicts with 'bbox', 'confidence', 'landmarks'
            embeddings: list of embedding vectors (same order as detections)
            frame_idx: current frame index for temporal tracking

        Returns:
            list of active confirmed tracks
        """
        if embeddings is None:
            embeddings = [None] * len(detections)

        # Step 1: Predict
        for track in self.tracks:
            track.predict()

        # Step 2: Cascade matching
        # Split tracks by time since update (cascade)
        confirmed_tracks = [t for t in self.tracks if t.is_confirmed()]
        unconfirmed_tracks = [t for t in self.tracks if not t.is_confirmed() and not t.is_deleted()]

        # Match confirmed tracks first (cascade by age)
        matched_track_indices = set()
        matched_det_indices = set()

        # Group confirmed tracks by time_since_update
        for age in range(self.max_age + 1):
            age_tracks = [(i, t) for i, t in enumerate(confirmed_tracks)
                         if t.time_since_update == age and i not in matched_track_indices]

            if not age_tracks:
                continue

            unmatched_dets = [i for i in range(len(detections)) if i not in matched_det_indices]
            if not unmatched_dets:
                break

            # Match by appearance + position
            matches = self._match_cascade(
                [t for _, t in age_tracks],
                [detections[i] for i in unmatched_dets],
                [embeddings[i] for i in unmatched_dets]
            )

            for track_local_idx, det_local_idx in matches:
                track_idx = age_tracks[track_local_idx][0]
                det_idx = unmatched_dets[det_local_idx]

                confirmed_tracks[track_idx].update(
                    detections[det_idx]['bbox'],
                    embeddings[det_idx],
                    detections[det_idx].get('confidence', 1.0),
                    detections[det_idx].get('landmarks'),
                    frame_idx=frame_idx
                )
                matched_track_indices.add(track_idx)
                matched_det_indices.add(det_idx)

        # IoU fallback for unmatched confirmed tracks
        unmatched_dets = [i for i in range(len(detections)) if i not in matched_det_indices]
        unmatched_confirmed = [(i, confirmed_tracks[i]) for i in range(len(confirmed_tracks))
                               if i not in matched_track_indices]

        if unmatched_dets and unmatched_confirmed:
            iou_matches = self._match_iou(
                [t for _, t in unmatched_confirmed],
                [detections[i] for i in unmatched_dets]
            )

            for track_local_idx, det_local_idx in iou_matches:
                track_idx = unmatched_confirmed[track_local_idx][0]
                det_idx = unmatched_dets[det_local_idx]

                confirmed_tracks[track_idx].update(
                    detections[det_idx]['bbox'],
                    embeddings[det_idx],
                    detections[det_idx].get('confidence', 1.0),
                    detections[det_idx].get('landmarks'),
                    frame_idx=frame_idx
                )
                matched_track_indices.add(track_idx)
                matched_det_indices.add(det_idx)

        # Match unconfirmed tracks by IoU
        unmatched_dets = [i for i in range(len(detections)) if i not in matched_det_indices]
        unmatched_unconf = [(i, t) for i, t in enumerate(unconfirmed_tracks)]

        if unmatched_dets and unmatched_unconf:
            iou_matches = self._match_iou(
                [t for _, t in unmatched_unconf],
                [detections[i] for i in unmatched_dets]
            )

            for track_local_idx, det_local_idx in iou_matches:
                track = unmatched_unconf[track_local_idx][1]
                det_idx = unmatched_dets[det_local_idx]

                track.update(
                    detections[det_idx]['bbox'],
                    embeddings[det_idx],
                    detections[det_idx].get('confidence', 1.0),
                    detections[det_idx].get('landmarks'),
                    frame_idx=frame_idx
                )
                matched_det_indices.add(det_idx)

        # Step 3: Mark missed tracks
        for i, track in enumerate(confirmed_tracks):
            if i not in matched_track_indices:
                track.mark_missed()

        for track in unconfirmed_tracks:
            track.mark_missed()

        # Step 4: Create new tracks for unmatched detections
        unmatched_dets = [i for i in range(len(detections)) if i not in matched_det_indices]
        for det_idx in unmatched_dets:
            det = detections[det_idx]
            self.tracks.append(DeepSORTTrack(
                det['bbox'],
                embeddings[det_idx],
                n_init=self.n_init,
                max_age=self.max_age,
                frame_idx=frame_idx
            ))

        # Step 5: Save deleted tracks to history, then remove from active
        for t in self.tracks:
            if t.is_deleted() and len(t.embeddings) > 0:
                self.all_tracks_history.append(t)
        self.tracks = [t for t in self.tracks if not t.is_deleted()]

        # Return confirmed tracks
        return [t for t in self.tracks if t.is_confirmed()]

    def _match_cascade(self, tracks, detections, embeddings):
        """Match by combined appearance (cosine) + IoU position."""
        if not tracks or not detections:
            return []

        n_tracks = len(tracks)
        n_dets = len(detections)

        # --- IoU matrix ---
        track_bboxes = np.array([t.bbox for t in tracks])
        det_bboxes = np.array([d['bbox'] for d in detections])
        iou_matrix = self._iou_batch(track_bboxes, det_bboxes)
        iou_cost = 1 - iou_matrix  # 0 = perfect overlap

        # --- Cosine distance matrix ---
        track_embeddings = []
        has_appearance = []
        for track in tracks:
            mean_emb = track.get_mean_embedding()
            if mean_emb is None:
                mean_emb = np.zeros(512)
                has_appearance.append(False)
            else:
                has_appearance.append(True)
            track_embeddings.append(mean_emb)

        track_embeddings = np.array(track_embeddings)
        det_embeddings = np.array([e if e is not None else np.zeros(512) for e in embeddings])
        det_has_emb = [e is not None for e in embeddings]

        # Normalize
        track_norm = track_embeddings / (np.linalg.norm(track_embeddings, axis=1, keepdims=True) + 1e-6)
        det_norm = det_embeddings / (np.linalg.norm(det_embeddings, axis=1, keepdims=True) + 1e-6)
        cos_sim = np.dot(track_norm, det_norm.T)
        cos_cost = 1 - cos_sim

        # --- Combined cost: weighted blend ---
        # If both have embeddings: 0.4*cosine + 0.6*iou
        # If either missing embedding: pure IoU
        cost_matrix = np.full((n_tracks, n_dets), 1e5)
        for i in range(n_tracks):
            for j in range(n_dets):
                if iou_matrix[i, j] < 0.05:
                    # No spatial overlap at all — skip
                    continue
                if has_appearance[i] and det_has_emb[j]:
                    cost_matrix[i, j] = 0.4 * cos_cost[i, j] + 0.6 * iou_cost[i, j]
                    # Gate: reject if cosine too far even with good IoU
                    if cos_cost[i, j] > self.max_cosine_dist:
                        cost_matrix[i, j] = 1e5
                else:
                    # No embedding — use pure IoU
                    cost_matrix[i, j] = iou_cost[i, j]

        # Hungarian matching
        if cost_matrix.size > 0:
            row_ind, col_ind = linear_sum_assignment(cost_matrix)
            matches = []
            for r, c in zip(row_ind, col_ind):
                if cost_matrix[r, c] < 1e5:
                    matches.append((r, c))
            return matches

        return []

    def _match_iou(self, tracks, detections):
        """Match by IoU only."""
        if not tracks or not detections:
            return []

        track_bboxes = np.array([t.bbox for t in tracks])
        det_bboxes = np.array([d['bbox'] for d in detections])

        iou_matrix = self._iou_batch(track_bboxes, det_bboxes)
        cost_matrix = 1 - iou_matrix

        # Gate by threshold
        cost_matrix[iou_matrix < self.iou_threshold] = 1e5

        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        matches = []
        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] < 1e5:
                matches.append((r, c))

        return matches

    def _iou_batch(self, bboxes1, bboxes2):
        """Compute IoU between two sets of boxes."""
        n1, n2 = len(bboxes1), len(bboxes2)
        iou = np.zeros((n1, n2))

        for i, b1 in enumerate(bboxes1):
            for j, b2 in enumerate(bboxes2):
                x1 = max(b1[0], b2[0])
                y1 = max(b1[1], b2[1])
                x2 = min(b1[2], b2[2])
                y2 = min(b1[3], b2[3])

                inter = max(0, x2 - x1) * max(0, y2 - y1)
                area1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
                area2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
                union = area1 + area2 - inter

                iou[i, j] = inter / (union + 1e-6)

        return iou

    def get_tracks(self):
        """Get all confirmed tracks."""
        return [t for t in self.tracks if t.is_confirmed()]

    def get_all_tracks(self):
        """Get all tracks including deleted (from history)."""
        # Combine active tracks with history
        active_with_emb = [t for t in self.tracks if len(t.embeddings) > 0]
        return self.all_tracks_history + active_with_emb

    def finalize(self):
        """Called when done - return all tracks with embeddings."""
        return [t for t in self.tracks if len(t.embeddings) > 0]

    def reset(self):
        """Reset tracker."""
        self.tracks = []
        self.all_tracks_history = []
        DeepSORTTrack.reset_id()
