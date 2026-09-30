# -*- coding: UTF-8 -*-
"""
ByteTrack implementation for body tracking.

Based on: https://github.com/ifzhang/ByteTrack
Paper: ByteTrack: Multi-Object Tracking by Associating Every Detection Box
"""

import numpy as np
from scipy.optimize import linear_sum_assignment
from .kalman_filter import KalmanFilter


class TrackState:
    """Track state enumeration."""
    New = 0
    Tracked = 1
    Lost = 2
    Removed = 3


class BaseTrack:
    """Base class for tracks."""
    _count = 0

    track_id = 0
    is_activated = False
    state = TrackState.New

    history = []
    features = []
    curr_feature = None
    score = 0
    start_frame = 0
    frame_id = 0
    time_since_update = 0

    @property
    def end_frame(self):
        return self.frame_id

    @staticmethod
    def next_id():
        BaseTrack._count += 1
        return BaseTrack._count

    def activate(self, *args):
        raise NotImplementedError

    def predict(self):
        raise NotImplementedError

    def update(self, *args, **kwargs):
        raise NotImplementedError

    def mark_lost(self):
        self.state = TrackState.Lost

    def mark_removed(self):
        self.state = TrackState.Removed

    @staticmethod
    def reset_id():
        BaseTrack._count = 0


class STrack(BaseTrack):
    """
    Single object track for ByteTrack.
    Contains body bbox and optionally associated face data.
    """
    shared_kalman = KalmanFilter()

    def __init__(self, tlwh, score):
        """
        Initialize track.

        Args:
            tlwh: [x1, y1, width, height] bounding box
            score: detection confidence
        """
        # Wait to activate on first successful match
        self._tlwh = np.asarray(tlwh, dtype=np.float32)
        self.kalman_filter = None
        self.mean, self.covariance = None, None
        self.is_activated = False

        self.score = score
        self.tracklet_len = 0

        # Face association data
        self.face_bbox = None
        self.face_landmarks = None
        self.face_confidence = 0.0
        self.frames_since_face = 0

        # Recognition data
        self.person_id = None
        self.person_name = None
        self.recognition_score = 0.0
        self.recognized = False
        self.recognition_attempts = 0
        self.scores_history = []

    def predict(self):
        """Kalman filter prediction step."""
        mean_state = self.mean.copy()
        if self.state != TrackState.Tracked:
            mean_state[7] = 0
        self.mean, self.covariance = self.kalman_filter.predict(mean_state, self.covariance)

    @staticmethod
    def multi_predict(stracks):
        """Predict for multiple tracks."""
        if len(stracks) > 0:
            multi_mean = np.asarray([st.mean.copy() for st in stracks])
            multi_covariance = np.asarray([st.covariance for st in stracks])
            for i, st in enumerate(stracks):
                if st.state != TrackState.Tracked:
                    multi_mean[i][7] = 0
            multi_mean, multi_covariance = STrack.shared_kalman.predict(
                multi_mean, multi_covariance
            )
            for i, (mean, cov) in enumerate(zip(multi_mean, multi_covariance)):
                stracks[i].mean = mean
                stracks[i].covariance = cov

    def activate(self, kalman_filter, frame_id):
        """Start a new tracklet."""
        self.kalman_filter = kalman_filter
        self.track_id = self.next_id()
        self.mean, self.covariance = self.kalman_filter.initiate(self.tlwh_to_xyah(self._tlwh))

        self.tracklet_len = 0
        self.state = TrackState.Tracked
        if frame_id == 1:
            self.is_activated = True
        self.frame_id = frame_id
        self.start_frame = frame_id

    def re_activate(self, new_track, frame_id, new_id=False):
        """Reactivate a lost track."""
        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.tracklet_len = 0
        self.state = TrackState.Tracked
        self.is_activated = True
        self.frame_id = frame_id
        if new_id:
            self.track_id = self.next_id()
        self.score = new_track.score

    def update(self, new_track, frame_id):
        """
        Update a matched track.

        Args:
            new_track: newly detected track
            frame_id: current frame id
        """
        self.frame_id = frame_id
        self.tracklet_len += 1

        new_tlwh = new_track.tlwh
        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_tlwh)
        )
        self.state = TrackState.Tracked
        self.is_activated = True

        self.score = new_track.score

        # Increment frames_since_face (will be reset in associate_face)
        self.frames_since_face += 1

    @property
    def tlwh(self):
        """Get current position in bounding box format (top left x, top left y, width, height)."""
        if self.mean is None:
            return self._tlwh.copy()
        ret = self.mean[:4].copy()
        ret[2] *= ret[3]
        ret[:2] -= ret[2:] / 2
        return ret

    @property
    def tlbr(self):
        """Convert to (top left x, top left y, bottom right x, bottom right y)."""
        ret = self.tlwh.copy()
        ret[2:] += ret[:2]
        return ret

    @property
    def bbox(self):
        """Return bbox as [x1, y1, x2, y2]."""
        return self.tlbr.astype(int).tolist()

    @staticmethod
    def tlwh_to_xyah(tlwh):
        """Convert to center position (x, y, aspect ratio, height)."""
        ret = np.asarray(tlwh).copy()
        ret[:2] += ret[2:] / 2
        ret[2] /= ret[3]
        return ret

    @staticmethod
    def tlbr_to_tlwh(tlbr):
        """Convert tlbr to tlwh."""
        ret = np.asarray(tlbr).copy()
        ret[2:] -= ret[:2]
        return ret

    @staticmethod
    def tlwh_to_tlbr(tlwh):
        """Convert tlwh to tlbr."""
        ret = np.asarray(tlwh).copy()
        ret[2:] += ret[:2]
        return ret

    def associate_face(self, face_bbox, face_landmarks=None, face_confidence=0.0):
        """Associate a face detection with this body track."""
        self.face_bbox = face_bbox
        self.face_landmarks = face_landmarks
        self.face_confidence = face_confidence
        self.frames_since_face = 0

    def clear_face(self):
        """Clear face association."""
        self.face_bbox = None
        self.face_landmarks = None
        self.face_confidence = 0.0

    def set_identity(self, person_id, name, score):
        """Set recognized identity with score averaging."""
        self.scores_history.append(score)
        if len(self.scores_history) > 5:
            self.scores_history.pop(0)

        avg_score = np.mean(self.scores_history)

        if person_id and avg_score > self.recognition_score:
            self.person_id = person_id
            self.person_name = name
            self.recognition_score = avg_score
            self.recognized = True

    # === Extraction-specific methods for extract_students.py compatibility ===

    @property
    def id(self):
        """Alias for track_id (for legacy compatibility)."""
        return self.track_id

    def get_mean_embedding(self):
        """Return mean embedding from collected embeddings."""
        if not hasattr(self, 'embeddings') or not self.embeddings:
            return None
        mean_emb = np.mean(self.embeddings, axis=0)
        return mean_emb / (np.linalg.norm(mean_emb) + 1e-6)

    def add_embedding(self, embedding):
        """Add embedding to collection."""
        if not hasattr(self, 'embeddings'):
            self.embeddings = []
        self.embeddings.append(embedding)

    def is_duplicate(self, embedding, threshold=0.90):
        """Check if embedding is duplicate of existing ones."""
        if not hasattr(self, 'embeddings') or not self.embeddings:
            return False
        for saved_emb in self.embeddings:
            if np.dot(saved_emb, embedding) > threshold:
                return True
        return False

    def __repr__(self):
        return f'STrack(id={self.track_id}, tlwh={self.tlwh}, score={self.score:.2f})'


def iou_batch(atlbrs, btlbrs):
    """
    Compute IoU between two sets of bboxes.

    Args:
        atlbrs: (N, 4) [x1, y1, x2, y2]
        btlbrs: (M, 4) [x1, y1, x2, y2]

    Returns:
        iou_matrix: (N, M)
    """
    atlbrs = np.asarray(atlbrs)
    btlbrs = np.asarray(btlbrs)

    if atlbrs.size == 0 or btlbrs.size == 0:
        return np.zeros((len(atlbrs), len(btlbrs)))

    atlbrs = atlbrs.reshape(-1, 4)
    btlbrs = btlbrs.reshape(-1, 4)

    # Intersection
    xx1 = np.maximum(atlbrs[:, 0:1], btlbrs[:, 0].T)
    yy1 = np.maximum(atlbrs[:, 1:2], btlbrs[:, 1].T)
    xx2 = np.minimum(atlbrs[:, 2:3], btlbrs[:, 2].T)
    yy2 = np.minimum(atlbrs[:, 3:4], btlbrs[:, 3].T)

    w = np.maximum(0., xx2 - xx1)
    h = np.maximum(0., yy2 - yy1)
    inter = w * h

    # Union
    area_a = (atlbrs[:, 2] - atlbrs[:, 0]) * (atlbrs[:, 3] - atlbrs[:, 1])
    area_b = (btlbrs[:, 2] - btlbrs[:, 0]) * (btlbrs[:, 3] - btlbrs[:, 1])
    union = area_a[:, np.newaxis] + area_b - inter

    iou = inter / (union + 1e-6)
    return iou


def linear_assignment(cost_matrix, thresh):
    """
    Linear assignment with threshold.

    Returns:
        matches, unmatched_a, unmatched_b
    """
    if cost_matrix.size == 0:
        return np.empty((0, 2), dtype=int), \
               np.arange(cost_matrix.shape[0], dtype=int), \
               np.arange(cost_matrix.shape[1], dtype=int)

    matches = []
    if cost_matrix.shape[0] <= cost_matrix.shape[1]:
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] <= thresh:
                matches.append([r, c])
        unmatched_a = [i for i in range(cost_matrix.shape[0]) if i not in [m[0] for m in matches]]
        unmatched_b = [j for j in range(cost_matrix.shape[1]) if j not in [m[1] for m in matches]]
    else:
        col_ind, row_ind = linear_sum_assignment(cost_matrix.T)
        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] <= thresh:
                matches.append([r, c])
        unmatched_a = [i for i in range(cost_matrix.shape[0]) if i not in [m[0] for m in matches]]
        unmatched_b = [j for j in range(cost_matrix.shape[1]) if j not in [m[1] for m in matches]]

    return np.array(matches).reshape(-1, 2), np.array(unmatched_a), np.array(unmatched_b)


def iou_distance(atracks, btracks):
    """
    Compute cost matrix based on IoU.

    Args:
        atracks: list of STrack
        btracks: list of STrack

    Returns:
        cost_matrix: (N, M) where cost = 1 - IoU
    """
    if len(atracks) == 0 or len(btracks) == 0:
        return np.zeros((len(atracks), len(btracks)))

    atlbrs = [track.tlbr for track in atracks]
    btlbrs = [track.tlbr for track in btracks]

    iou_matrix = iou_batch(atlbrs, btlbrs)
    cost_matrix = 1 - iou_matrix
    return cost_matrix


def fuse_score(cost_matrix, detections):
    """
    Fuse detection scores into cost matrix.

    Args:
        cost_matrix: (N, M) IoU-based cost
        detections: list of detection STrack

    Returns:
        fused_cost: cost matrix with scores fused
    """
    if cost_matrix.size == 0:
        return cost_matrix

    iou_sim = 1 - cost_matrix
    det_scores = np.array([det.score for det in detections])
    det_scores = np.expand_dims(det_scores, axis=0).repeat(cost_matrix.shape[0], axis=0)
    fuse_sim = iou_sim * det_scores
    fuse_cost = 1 - fuse_sim
    return fuse_cost


class BYTETracker:
    """
    ByteTrack: Multi-Object Tracking by Associating Every Detection Box.

    Key features:
    - Two-stage association: high-confidence + low-confidence detections
    - Kalman filter for motion prediction
    - IoU-based matching
    """

    def __init__(self, track_thresh=0.5, low_thresh=0.1, match_thresh=0.8, track_buffer=30, frame_rate=30):
        """
        Initialize ByteTracker.

        Args:
            track_thresh: threshold to separate high/low confidence detections
            low_thresh: minimum detection confidence to consider
            match_thresh: IoU threshold for matching (cost = 1 - match_thresh)
            track_buffer: frames to keep lost tracks
            frame_rate: video frame rate
        """
        self.track_thresh = track_thresh
        self.low_thresh = low_thresh
        self.match_thresh = match_thresh

        self.frame_id = 0
        self.det_thresh = track_thresh + 0.1
        self.buffer_size = int(frame_rate / 30.0 * track_buffer)
        self.max_time_lost = self.buffer_size
        self.kalman_filter = KalmanFilter()

        # Track pools
        self.tracked_stracks = []  # type: list[STrack]
        self.lost_stracks = []     # type: list[STrack]
        self.removed_stracks = []  # type: list[STrack]

    @property
    def tracks(self):
        """Return all active tracks (for compatibility)."""
        return self.tracked_stracks + self.lost_stracks

    def update(self, detections):
        """
        Update tracker with new detections.

        Args:
            detections: list of dicts with 'bbox' [x1,y1,x2,y2] and 'confidence'

        Returns:
            list of active STrack objects
        """
        self.frame_id += 1
        activated_stracks = []
        refind_stracks = []
        lost_stracks = []
        removed_stracks = []

        # Convert detections to STrack
        if len(detections) > 0:
            bboxes = np.array([d['bbox'] for d in detections])
            scores = np.array([d.get('confidence', 1.0) for d in detections])

            # Convert [x1,y1,x2,y2] to [x1,y1,w,h]
            tlwhs = bboxes.copy()
            tlwhs[:, 2:] -= tlwhs[:, :2]

            # Separate high and low confidence detections
            remain_inds = scores > self.low_thresh
            inds_low = scores > self.low_thresh
            inds_high = scores > self.track_thresh

            inds_first = np.logical_and(inds_low, inds_high)
            inds_second = np.logical_and(inds_low, np.logical_not(inds_high))

            dets_first = [STrack(tlwhs[i], scores[i]) for i in range(len(tlwhs)) if inds_first[i]]
            dets_second = [STrack(tlwhs[i], scores[i]) for i in range(len(tlwhs)) if inds_second[i]]
        else:
            dets_first = []
            dets_second = []

        # Separate tracked and lost tracks
        unconfirmed = []
        tracked_stracks = []
        for track in self.tracked_stracks:
            if not track.is_activated:
                unconfirmed.append(track)
            else:
                tracked_stracks.append(track)

        # Step 1: First association with high confidence detections
        strack_pool = self._joint_stracks(tracked_stracks, self.lost_stracks)

        # Predict with Kalman filter
        STrack.multi_predict(strack_pool)

        # Match with high confidence detections
        dists = iou_distance(strack_pool, dets_first)
        dists = fuse_score(dists, dets_first)
        matches, u_track, u_detection = linear_assignment(dists, thresh=self.match_thresh)

        for itracked, idet in matches:
            track = strack_pool[itracked]
            det = dets_first[idet]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id)
                activated_stracks.append(track)
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # Step 2: Second association with low confidence detections
        r_tracked_stracks = [strack_pool[i] for i in u_track if strack_pool[i].state == TrackState.Tracked]
        dists = iou_distance(r_tracked_stracks, dets_second)
        matches, u_track, u_detection_second = linear_assignment(dists, thresh=0.5)

        for itracked, idet in matches:
            track = r_tracked_stracks[itracked]
            det = dets_second[idet]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id)
                activated_stracks.append(track)
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # Mark unmatched tracks as lost
        for it in u_track:
            track = r_tracked_stracks[it]
            if not track.state == TrackState.Lost:
                track.mark_lost()
                lost_stracks.append(track)

        # Deal with unconfirmed tracks
        dets_remain = [dets_first[i] for i in u_detection]
        dists = iou_distance(unconfirmed, dets_remain)
        dists = fuse_score(dists, dets_remain)
        matches, u_unconfirmed, u_detection = linear_assignment(dists, thresh=0.7)

        for itracked, idet in matches:
            unconfirmed[itracked].update(dets_remain[idet], self.frame_id)
            activated_stracks.append(unconfirmed[itracked])

        for it in u_unconfirmed:
            track = unconfirmed[it]
            track.mark_removed()
            removed_stracks.append(track)

        # Initialize new stracks
        for inew in u_detection:
            track = dets_remain[inew]
            if track.score < self.det_thresh:
                continue
            track.activate(self.kalman_filter, self.frame_id)
            activated_stracks.append(track)

        # Update lost stracks
        for track in self.lost_stracks:
            if self.frame_id - track.end_frame > self.max_time_lost:
                track.mark_removed()
                removed_stracks.append(track)

        # Update track pools
        self.tracked_stracks = [t for t in self.tracked_stracks if t.state == TrackState.Tracked]
        self.tracked_stracks = self._joint_stracks(self.tracked_stracks, activated_stracks)
        self.tracked_stracks = self._joint_stracks(self.tracked_stracks, refind_stracks)
        self.lost_stracks = self._sub_stracks(self.lost_stracks, self.tracked_stracks)
        self.lost_stracks.extend(lost_stracks)
        self.lost_stracks = self._sub_stracks(self.lost_stracks, self.removed_stracks)
        self.removed_stracks.extend(removed_stracks)
        self.tracked_stracks, self.lost_stracks = self._remove_duplicate_stracks(
            self.tracked_stracks, self.lost_stracks
        )

        return [t for t in self.tracked_stracks if t.is_activated]

    @staticmethod
    def _joint_stracks(tlista, tlistb):
        """Combine two track lists without duplicates."""
        exists = {}
        res = []
        for t in tlista:
            exists[t.track_id] = 1
            res.append(t)
        for t in tlistb:
            tid = t.track_id
            if not exists.get(tid, 0):
                exists[tid] = 1
                res.append(t)
        return res

    @staticmethod
    def _sub_stracks(tlista, tlistb):
        """Remove tracks in tlistb from tlista."""
        stracks = {}
        for t in tlista:
            stracks[t.track_id] = t
        for t in tlistb:
            tid = t.track_id
            if stracks.get(tid, 0):
                del stracks[tid]
        return list(stracks.values())

    @staticmethod
    def _remove_duplicate_stracks(stracksa, stracksb):
        """Remove duplicate tracks between two lists based on IoU."""
        pdist = iou_distance(stracksa, stracksb)
        pairs = np.where(pdist < 0.15)
        dupa, dupb = [], []
        for p, q in zip(*pairs):
            timep = stracksa[p].frame_id - stracksa[p].start_frame
            timeq = stracksb[q].frame_id - stracksb[q].start_frame
            if timep > timeq:
                dupb.append(q)
            else:
                dupa.append(p)
        resa = [t for i, t in enumerate(stracksa) if i not in dupa]
        resb = [t for i, t in enumerate(stracksb) if i not in dupb]
        return resa, resb
