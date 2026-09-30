# -*- coding: UTF-8 -*-
"""
Trackers module for face and body tracking.

Includes:
- DeepSORT with appearance features (recommended)
- ByteTrack implementation with body-face association
- Legacy SORT tracker for face-only tracking
"""

from .kalman_filter import KalmanFilter
from .byte_tracker import BYTETracker, STrack
from .body_face_tracker import BodyFaceTracker
from .legacy_sort import SORTTracker, KalmanBoxTracker, FaceTracker, TrackedFace
from .deep_sort import DeepSORT, DeepSORTTrack

__all__ = [
    'KalmanFilter',
    'BYTETracker',
    'STrack',
    'BodyFaceTracker',
    'SORTTracker',
    'KalmanBoxTracker',
    'FaceTracker',
    'TrackedFace',
    'DeepSORT',
    'DeepSORTTrack'
]
