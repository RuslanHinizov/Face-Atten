# -*- coding: UTF-8 -*-
"""
BodyFaceTracker: ByteTrack for bodies + face association.

Architecture:
    Frame -> Person Detection (YOLO COCO) -> ByteTrack (body) -> Global_ID
                |
        Face Detection (YOLO-Face) -> Face Association (IoU) -> linked to Global_ID
                |
        ArcFace Recognition -> person_id linked to Global_ID
"""

import numpy as np
from scipy.optimize import linear_sum_assignment
from .byte_tracker import BYTETracker, STrack, iou_batch


class BodyFaceTracker:
    """
    Wrapper over ByteTrack that adds face-to-body association.

    Key benefits:
    - Body is visible almost always (even from behind) -> ID doesn't get lost
    - ByteTrack uses low-confidence detections -> fewer track breaks
    - Face is linked to body via IoU -> recognition when face appears
    """

    def __init__(self, track_thresh=0.5, low_thresh=0.1, match_thresh=0.8,
                 track_buffer=60, frame_rate=30, face_body_iou_thresh=0.3,
                 max_frames_without_face=90, use_virtual_bodies=False):
        """
        Initialize BodyFaceTracker.

        Args:
            track_thresh: ByteTrack high confidence threshold
            low_thresh: ByteTrack low confidence threshold
            match_thresh: ByteTrack IoU matching threshold
            track_buffer: frames to keep lost tracks
            frame_rate: video frame rate
            face_body_iou_thresh: minimum IoU/containment for face-body association
            max_frames_without_face: frames to keep identity without seeing face
            use_virtual_bodies: create virtual body tracks from unmatched faces
        """
        self.byte_tracker = BYTETracker(
            track_thresh=track_thresh,
            low_thresh=low_thresh,
            match_thresh=match_thresh,
            track_buffer=track_buffer,
            frame_rate=frame_rate
        )

        self.face_body_iou_thresh = face_body_iou_thresh
        self.max_frames_without_face = max_frames_without_face
        self.use_virtual_bodies = use_virtual_bodies
        self.finished_tracks = []  # For collect tracks with embeddings after finalize()

    @property
    def tracks(self):
        """Return all active tracks."""
        return self.byte_tracker.tracked_stracks

    def update(self, body_detections, face_detections):
        """
        Update tracker with body and face detections.

        Args:
            body_detections: list of dicts with 'bbox' [x1,y1,x2,y2] and 'confidence'
            face_detections: list of dicts with 'bbox', 'landmarks', 'confidence'

        Returns:
            list of active STrack objects with face associations
        """
        # Step 1: Create virtual bodies for unmatched faces (if enabled)
        virtual_bodies = []
        if self.use_virtual_bodies:
            unmatched_faces = self._find_unmatched_faces(body_detections, face_detections)
            for face_det in unmatched_faces:
                fb = face_det['bbox']
                face_w = fb[2] - fb[0]
                face_h = fb[3] - fb[1]
                vb = [
                    int(fb[0] - face_w * 0.3),
                    int(fb[1] - face_h * 0.1),
                    int(fb[2] + face_w * 0.3),
                    int(fb[3] + face_h * 1.5),
                ]
                virtual_bodies.append({
                    'bbox': vb,
                    'confidence': face_det.get('confidence', 0.5) * 0.8,
                    '_face_det': face_det
                })

        # Step 2: Update body tracks (real + virtual)
        all_bodies = body_detections + virtual_bodies
        tracks = self.byte_tracker.update(all_bodies)

        # Step 4: Associate faces with body tracks
        self._associate_faces(tracks, face_detections)

        return tracks

    def _find_unmatched_faces(self, body_detections, face_detections):
        """Find faces that don't match any body detection."""
        if not face_detections or not body_detections:
            return face_detections if face_detections else []

        unmatched = []
        body_bboxes = [b['bbox'] for b in body_detections]

        for face_det in face_detections:
            fb = face_det['bbox']
            face_area = (fb[2] - fb[0]) * (fb[3] - fb[1])
            if face_area <= 0:
                continue

            best_score = 0
            for bb in body_bboxes:
                # Compute containment: intersection / face_area
                x1 = max(fb[0], bb[0])
                y1 = max(fb[1], bb[1])
                x2 = min(fb[2], bb[2])
                y2 = min(fb[3], bb[3])
                inter = max(0, x2 - x1) * max(0, y2 - y1)
                containment = inter / face_area
                best_score = max(best_score, containment)

            if best_score < self.face_body_iou_thresh:
                unmatched.append(face_det)

        return unmatched

    def _associate_faces(self, tracks, face_detections):
        """
        Associate face detections with body tracks using IoU + containment.

        Algorithm:
        1. For each pair (face, body):
           - iou = IoU(face_bbox, body_bbox)
           - containment = area(face intersection body) / area(face)
           - score = max(iou, containment)

        2. Hungarian matching on score matrix

        3. If score >= FACE_BODY_IOU_THRESH:
           - body_track.associate_face(face)
        """
        if len(tracks) == 0 or len(face_detections) == 0:
            # Clear faces for all tracks if no face detections
            for track in tracks:
                track.clear_face()
            return

        # Get body and face bboxes
        body_bboxes = np.array([track.tlbr for track in tracks])
        face_bboxes = np.array([f['bbox'] for f in face_detections])

        # Compute score matrix (IoU + containment)
        score_matrix = self._compute_face_body_scores(face_bboxes, body_bboxes)

        # Hungarian matching (maximize score -> minimize 1-score)
        cost_matrix = 1 - score_matrix
        row_ind, col_ind = linear_sum_assignment(cost_matrix)

        # Track which faces and bodies are matched
        matched_faces = set()
        matched_bodies = set()

        for face_idx, body_idx in zip(row_ind, col_ind):
            score = score_matrix[face_idx, body_idx]
            if score >= self.face_body_iou_thresh:
                face_det = face_detections[face_idx]
                tracks[body_idx].associate_face(
                    face_bbox=face_det['bbox'],
                    face_landmarks=face_det.get('landmarks'),
                    face_confidence=face_det.get('confidence', 1.0)
                )
                matched_faces.add(face_idx)
                matched_bodies.add(body_idx)

        # Clear faces for unmatched tracks
        for i, track in enumerate(tracks):
            if i not in matched_bodies:
                track.clear_face()

    def _compute_face_body_scores(self, face_bboxes, body_bboxes):
        """
        Compute face-body association scores.

        Score = max(IoU, containment)
        where containment = area(face intersection body) / area(face)

        This handles cases where face is fully inside body (low IoU but high containment).
        """
        n_faces = len(face_bboxes)
        n_bodies = len(body_bboxes)

        if n_faces == 0 or n_bodies == 0:
            return np.zeros((n_faces, n_bodies))

        # Compute IoU
        iou_matrix = iou_batch(face_bboxes, body_bboxes)

        # Compute containment (intersection / face_area)
        containment_matrix = np.zeros((n_faces, n_bodies))

        for i, face_bb in enumerate(face_bboxes):
            face_area = (face_bb[2] - face_bb[0]) * (face_bb[3] - face_bb[1])
            if face_area <= 0:
                continue

            for j, body_bb in enumerate(body_bboxes):
                # Intersection
                x1 = max(face_bb[0], body_bb[0])
                y1 = max(face_bb[1], body_bb[1])
                x2 = min(face_bb[2], body_bb[2])
                y2 = min(face_bb[3], body_bb[3])

                inter_area = max(0, x2 - x1) * max(0, y2 - y1)
                containment_matrix[i, j] = inter_area / (face_area + 1e-6)

        # Final score = max(IoU, containment)
        score_matrix = np.maximum(iou_matrix, containment_matrix)

        return score_matrix

    def get_tracks_for_recognition(self):
        """
        Get tracks that need face recognition.

        Returns tracks that:
        - Have a face associated
        - Are not yet recognized OR need score update
        - Haven't exceeded max recognition attempts
        """
        result = []
        for track in self.byte_tracker.tracked_stracks:
            if not track.is_activated:
                continue

            # Must have face
            if track.face_bbox is None:
                continue

            # Must have decent face confidence
            if track.face_confidence < 0.5:
                continue

            # Check recognition status
            if track.recognized and track.recognition_score >= 0.65:
                continue

            # Check max attempts
            if track.recognition_attempts >= 30:
                continue

            result.append(track)

        return result

    def get_active_tracks(self):
        """Get all active tracks with their current state."""
        result = []
        for track in self.byte_tracker.tracked_stracks:
            if not track.is_activated:
                continue

            # Determine state
            if track.recognized:
                state = 'recognized'
            elif track.face_bbox is not None:
                state = 'tracking'
            else:
                state = 'lost_face'

            result.append({
                'track_id': track.track_id,
                'body_bbox': track.bbox,
                'face_bbox': track.face_bbox,
                'face_landmarks': track.face_landmarks,
                'person_id': track.person_id,
                'name': track.person_name or f'ID:{track.track_id}',
                'confidence': track.recognition_score,
                'recognized': track.recognized,
                'state': state,
                'frames_since_face': track.frames_since_face
            })

        return result

    def reset(self):
        """Reset tracker state."""
        self.byte_tracker = BYTETracker(
            track_thresh=self.byte_tracker.track_thresh,
            low_thresh=self.byte_tracker.low_thresh,
            match_thresh=self.byte_tracker.match_thresh,
            track_buffer=self.byte_tracker.buffer_size,
            frame_rate=30
        )
        self.finished_tracks = []
        STrack.reset_id()

    def finalize(self):
        """Finalize all active tracks - call this when done processing video."""
        # Collect all tracks that have embeddings
        all_stracks = (
            self.byte_tracker.tracked_stracks +
            self.byte_tracker.lost_stracks
        )
        for track in all_stracks:
            if hasattr(track, 'embeddings') and len(track.embeddings) > 0:
                self.finished_tracks.append(track)

    def get_all_tracks(self):
        """Get all finished tracks with embeddings for merge_tracks."""
        return self.finished_tracks
