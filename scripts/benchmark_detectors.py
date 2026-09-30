# -*- coding: UTF-8 -*-
"""
A/B benchmark: YOLOv5-Face vs YOLO26+InsightFace.

Reports per-frame:
  - Number of detections
  - Inference time (ms/frame)
  - Face overlap between methods (IoU matching)

Usage:
    python scripts/benchmark_detectors.py data/videos/test.mp4 --frames 100
"""
import sys
import os
import argparse
import time
import warnings

warnings.filterwarnings('ignore')
os.environ['ONNXRUNTIME_LOG_LEVEL'] = '3'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np
import torch

import config as cfg


def iou(box1, box2):
    """IoU between two [x1,y1,x2,y2] boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    a1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    a2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    return inter / (a1 + a2 - inter + 1e-6)


def load_yolov5face(device):
    """Load YOLOv5-Face model."""
    from models.experimental import attempt_load
    model = attempt_load(cfg.YOLO_WEIGHTS, map_location=device)
    model.eval()
    stride = int(model.stride.max())
    if cfg.YOLO_FP16 and device == 'cuda':
        model.half()
    return model, stride


def detect_yolov5face(model, stride, frame, device):
    """Run YOLOv5-Face on a single frame, return list of bbox [x1,y1,x2,y2]."""
    from utils.general import non_max_suppression_face, scale_coords
    from utils.datasets import letterbox
    from core.utils import scale_coords_landmarks

    img = letterbox(frame, new_shape=cfg.YOLO_IMG_SIZE)[0]
    img = img.transpose(2, 0, 1).copy()
    img = torch.from_numpy(img).float() / 255.0
    if img.ndimension() == 3:
        img = img.unsqueeze(0)
    img = img.to(device)
    if cfg.YOLO_FP16 and device == 'cuda':
        img = img.half()

    with torch.no_grad():
        pred = model(img)[0]
    pred = non_max_suppression_face(pred, cfg.YOLO_CONF_THRES, cfg.YOLO_IOU_THRES)

    faces = []
    for det in pred:
        if len(det):
            det[:, :4] = scale_coords(img.shape[2:], det[:, :4], frame.shape).round()
            for j in range(det.size()[0]):
                xyxy = det[j, :4].cpu().numpy().astype(int)
                w, h = xyxy[2] - xyxy[0], xyxy[3] - xyxy[1]
                if min(w, h) >= cfg.MIN_FACE_SIZE:
                    faces.append(xyxy.tolist())
    return faces


def load_yolo26():
    """Load YOLO26+InsightFace detector."""
    from core.yolo26_detector import YOLO26FaceDetector
    return YOLO26FaceDetector()


def detect_yolo26(detector, frame):
    """Run YOLO26+InsightFace on a single frame, return list of bbox."""
    results = detector.detect(frame)
    return [r['bbox'] for r in results]


def match_faces(boxes_a, boxes_b, iou_thresh=0.3):
    """Greedy IoU matching. Returns (matched, only_a, only_b)."""
    used_b = set()
    matched = 0
    for ba in boxes_a:
        best_iou = 0
        best_j = -1
        for j, bb in enumerate(boxes_b):
            if j in used_b:
                continue
            v = iou(ba, bb)
            if v > best_iou:
                best_iou = v
                best_j = j
        if best_iou >= iou_thresh and best_j >= 0:
            matched += 1
            used_b.add(best_j)
    only_a = len(boxes_a) - matched
    only_b = len(boxes_b) - matched
    return matched, only_a, only_b


def main():
    parser = argparse.ArgumentParser(description='Benchmark YOLOv5-Face vs YOLO26+InsightFace')
    parser.add_argument('video', help='Path to video file')
    parser.add_argument('--frames', type=int, default=100, help='Number of frames to process')
    parser.add_argument('--skip', type=int, default=1, help='Process every N-th frame')
    parser.add_argument('--iou-thresh', type=float, default=0.3, help='IoU threshold for matching')
    args = parser.parse_args()

    if not Path(args.video).exists():
        print(f"Error: {args.video} not found")
        return

    device = cfg.DEVICE
    print(f"Device: {device}")
    print(f"Video: {args.video}")
    print(f"Frames: {args.frames}, skip: {args.skip}")
    print()

    # Load models
    print("Loading YOLOv5-Face...")
    yv5_model, yv5_stride = load_yolov5face(device)

    print("Loading YOLO26+InsightFace...")
    y26_det = load_yolo26()

    # Open video
    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        print(f"Error: cannot open {args.video}")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"\nVideo has {total_frames} frames total")
    print(f"{'='*70}")
    print(f"{'Frame':>6} | {'YOLOv5':>8} {'ms':>6} | {'YOLO26':>8} {'ms':>6} | {'Match':>5} {'OnlyV5':>6} {'Only26':>6}")
    print(f"{'-'*70}")

    # Stats accumulators
    v5_counts, v5_times = [], []
    y26_counts, y26_times = [], []
    matches_total, only_v5_total, only_26_total = 0, 0, 0

    frame_idx = 0
    processed = 0

    while processed < args.frames:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        if frame_idx % args.skip != 0:
            continue

        # YOLOv5-Face
        t0 = time.perf_counter()
        v5_boxes = detect_yolov5face(yv5_model, yv5_stride, frame, device)
        t_v5 = (time.perf_counter() - t0) * 1000

        # YOLO26+InsightFace
        t0 = time.perf_counter()
        y26_boxes = detect_yolo26(y26_det, frame)
        t_y26 = (time.perf_counter() - t0) * 1000

        # Match
        matched, only_v5, only_26 = match_faces(v5_boxes, y26_boxes, args.iou_thresh)

        # Accumulate
        v5_counts.append(len(v5_boxes))
        v5_times.append(t_v5)
        y26_counts.append(len(y26_boxes))
        y26_times.append(t_y26)
        matches_total += matched
        only_v5_total += only_v5
        only_26_total += only_26

        processed += 1
        print(f"{frame_idx:>6} | {len(v5_boxes):>8} {t_v5:>5.1f}ms | {len(y26_boxes):>8} {t_y26:>5.1f}ms | {matched:>5} {only_v5:>6} {only_26:>6}")

    cap.release()

    # Summary
    print(f"{'='*70}")
    print(f"\nSummary ({processed} frames):")
    print(f"{'':>20} {'YOLOv5-Face':>15} {'YOLO26+IF':>15}")
    print(f"  {'Avg detections':>18}: {np.mean(v5_counts):>15.1f} {np.mean(y26_counts):>15.1f}")
    print(f"  {'Total detections':>18}: {sum(v5_counts):>15} {sum(y26_counts):>15}")
    print(f"  {'Avg time (ms)':>18}: {np.mean(v5_times):>15.1f} {np.mean(y26_times):>15.1f}")
    print(f"  {'Median time (ms)':>18}: {np.median(v5_times):>15.1f} {np.median(y26_times):>15.1f}")
    print(f"  {'Min time (ms)':>18}: {np.min(v5_times):>15.1f} {np.min(y26_times):>15.1f}")
    print(f"  {'Max time (ms)':>18}: {np.max(v5_times):>15.1f} {np.max(y26_times):>15.1f}")
    print()
    print(f"  Face overlap (IoU >= {args.iou_thresh}):")
    print(f"    Matched:       {matches_total}")
    print(f"    Only YOLOv5:   {only_v5_total}")
    print(f"    Only YOLO26:   {only_26_total}")
    total_dets = matches_total + only_v5_total + only_26_total
    if total_dets > 0:
        overlap_pct = matches_total / total_dets * 100
        print(f"    Overlap rate:  {overlap_pct:.1f}%")


if __name__ == '__main__':
    main()
