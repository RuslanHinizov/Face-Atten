# -*- coding: UTF-8 -*-
"""Утилиты: подавление stdout, выравнивание лиц, IoU, маппинг имён."""
import io
import sys
import csv
import cv2
import numpy as np
from pathlib import Path
from contextlib import contextmanager

import config as cfg


@contextmanager
def suppress_stdout():
    """Подавляет вывод в stdout."""
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        yield
    finally:
        sys.stdout = old_stdout


def align_face(img, landmarks, output_size=None):
    """
    Выравнивает лицо по 5 ключевым точкам.

    Args:
        img: BGR изображение
        landmarks: 10 значений [x1,y1,...,x5,y5] или массив (5,2)
        output_size: размер выхода (по умолчанию из конфига)

    Returns:
        Выровненное изображение 112x112 или None
    """
    if output_size is None:
        output_size = cfg.ARCFACE_INPUT_SIZE

    if isinstance(landmarks, (list, tuple)):
        landmarks = np.array(landmarks)

    if landmarks.size == 10:
        src_pts = landmarks.reshape(5, 2).astype(np.float32)
    else:
        src_pts = landmarks.astype(np.float32)

    M, _ = cv2.estimateAffinePartial2D(src_pts, cfg.ARCFACE_DST, method=cv2.LMEDS)
    if M is None:
        return None

    return cv2.warpAffine(img, M, output_size, borderValue=0.0)


def scale_coords_landmarks(img1_shape, coords, img0_shape):
    """Масштабирует landmarks к оригинальному размеру."""
    gain = min(img1_shape[0] / img0_shape[0], img1_shape[1] / img0_shape[1])
    pad = (img1_shape[1] - img0_shape[1] * gain) / 2, (img1_shape[0] - img0_shape[0] * gain) / 2
    coords[:, [0, 2, 4, 6, 8]] -= pad[0]
    coords[:, [1, 3, 5, 7, 9]] -= pad[1]
    coords[:, :10] /= gain
    return coords


def iou(box1, box2):
    """Intersection over Union для двух bbox."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])

    return inter / (area1 + area2 - inter + 1e-6)


def load_name_mapping(database_path, csv_path=None):
    """
    Загружает маппинг ID -> имя из students.csv.
    Приоритет: явно указанный csv_path > рядом с базой > папки students/*.
    """
    mapping = {}

    # Если явно указан CSV - используем только его
    if csv_path and Path(csv_path).exists():
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    sid = str(row.get('id', ''))
                    name = row.get('name', '').strip()
                    if sid and name:
                        mapping[sid] = name
            print(f"[Config] Loaded {len(mapping)} names from: {csv_path}")
            return mapping
        except Exception as e:
            print(f"[Config] Error loading CSV {csv_path}: {e}")

    # Иначе ищем автоматически
    csv_paths = [
        Path(database_path).parent / "students.csv",
    ]

    # Добавляем все папки в students/
    students_dir = Path(cfg.STUDENTS_DIR)
    if students_dir.exists():
        for sub_dir in sorted(students_dir.iterdir(), reverse=True):
            if sub_dir.is_dir():
                csv_paths.append(sub_dir / "students.csv")

    for csv_file in csv_paths:
        if csv_file.exists():
            try:
                with open(csv_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        sid = str(row.get('id', ''))
                        name = row.get('name', '').strip()
                        if sid and name:
                            mapping[sid] = name
                if mapping:
                    print(f"[Config] Loaded {len(mapping)} names from: {csv_file}")
                    return mapping
            except Exception as e:
                print(f"[Config] Error loading CSV {csv_file}: {e}")

    print(f"[Config] No names found in CSV files")
    return mapping
