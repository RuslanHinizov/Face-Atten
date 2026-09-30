# -*- coding: UTF-8 -*-
"""Face tracking with IoU matching."""
from datetime import datetime
from typing import List, Dict, Optional

# ============== TRACKING CONFIG ==============
RECOGNITION_REFRESH_INTERVAL = 3.0  # Re-recognize after N seconds
IOU_THRESHOLD = 0.3                  # Min IoU to match tracks
TRACK_TIMEOUT = 2.0                  # Remove tracks not seen for N seconds

# ============== TRACKING STATE ==============
# Active tracks per camera: camera_id -> {track_id: {bbox, person_id, confidence, name, role, last_recognition_time}}
active_tracks: Dict[str, Dict[int, dict]] = {}
# Next track ID counter per camera
next_track_id: Dict[str, int] = {}


def calculate_iou(box1: list, box2: list) -> float:
    """Calculate IoU between two bboxes [x1, y1, x2, y2]"""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    if x2 <= x1 or y2 <= y1:
        return 0.0

    intersection = (x2 - x1) * (y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection

    return intersection / union if union > 0 else 0.0


def match_tracks(camera_id: str, current_bboxes: List[list]) -> List[int]:
    """Match current detections to existing tracks, returns track_ids for each bbox"""
    if camera_id not in active_tracks:
        active_tracks[camera_id] = {}
    if camera_id not in next_track_id:
        next_track_id[camera_id] = 0

    tracks = active_tracks[camera_id]
    now = datetime.now().timestamp()

    # Remove stale tracks
    stale_ids = [tid for tid, t in tracks.items() if now - t.get('last_seen', 0) > TRACK_TIMEOUT]
    for tid in stale_ids:
        del tracks[tid]

    matched_track_ids = []
    used_track_ids = set()

    for bbox in current_bboxes:
        best_iou = 0.0
        best_track_id = None

        for track_id, track in tracks.items():
            if track_id in used_track_ids:
                continue
            iou = calculate_iou(bbox, track['bbox'])
            if iou > best_iou and iou >= IOU_THRESHOLD:
                best_iou = iou
                best_track_id = track_id

        if best_track_id is not None:
            # Matched existing track
            used_track_ids.add(best_track_id)
            matched_track_ids.append(best_track_id)
        else:
            # New track
            new_id = next_track_id[camera_id]
            next_track_id[camera_id] += 1
            matched_track_ids.append(new_id)

    return matched_track_ids


def get_track(camera_id: str, track_id: int) -> Optional[dict]:
    """Get track by ID"""
    if camera_id not in active_tracks:
        return None
    return active_tracks[camera_id].get(track_id)


def update_track(camera_id: str, track_id: int, data: dict):
    """Update or create track"""
    if camera_id not in active_tracks:
        active_tracks[camera_id] = {}
    active_tracks[camera_id][track_id] = data


def clear_tracks(camera_id: str = None):
    """Clear tracks for camera or all"""
    if camera_id:
        active_tracks.pop(camera_id, None)
        next_track_id.pop(camera_id, None)
    else:
        active_tracks.clear()
        next_track_id.clear()
