# -*- coding: UTF-8 -*-
"""
Повторное слияние студентов по эмбеддингам.
Использует уже сохранённые фото без повторной обработки видео.

Usage:
    python scripts/remerge_students.py students/exp23 --threshold 0.38
"""
import argparse
import sys
import numpy as np
import shutil
import csv
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tqdm import tqdm
import cv2

import config as cfg
from insightface.app import FaceAnalysis


def load_recognition_model():
    """Загружает модель распознавания."""
    print("[Model] Loading ArcFace...")
    app = FaceAnalysis(
        name=cfg.ARCFACE_MODEL,
        root=cfg.INSIGHTFACE_ROOT,
        providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
    )
    app.prepare(ctx_id=0, det_size=cfg.ARCFACE_DET_SIZE)

    rec_model = None
    for name, model in app.models.items():
        if 'recognition' in name or 'w600k' in name or 'rec' in name:
            rec_model = model
            print(f"[Model] Recognition model: {name}")
            break
    return rec_model


def get_embedding(rec_model, img_path):
    """Извлекает эмбеддинг из изображения."""
    img = cv2.imread(str(img_path))
    if img is None:
        return None

    # Resize if needed
    if img.shape[:2] != (112, 112):
        img = cv2.resize(img, (112, 112))

    try:
        emb = rec_model.get_feat(img)
        emb = emb.flatten()
        return emb / np.linalg.norm(emb)
    except:
        return None


def compute_student_embedding(rec_model, student_dir):
    """Вычисляет средний эмбеддинг студента по всем его фото."""
    embeddings = []

    for img_path in student_dir.glob("*.jpg"):
        emb = get_embedding(rec_model, img_path)
        if emb is not None:
            embeddings.append(emb)

    if not embeddings:
        return None

    mean_emb = np.mean(embeddings, axis=0)
    return mean_emb / np.linalg.norm(mean_emb)


def merge_students(student_embeddings, threshold):
    """
    Объединяет студентов с помощью агрессивной кластеризации.

    Args:
        student_embeddings: dict {student_id: embedding}
        threshold: порог схожести для объединения

    Returns:
        dict: new_id -> [old_ids]
    """
    # Создаём матрицу схожести
    ids = list(student_embeddings.keys())
    n = len(ids)

    if n == 0:
        return {}

    # Вычисляем попарную схожесть
    embs = np.array([student_embeddings[i] for i in ids])
    similarity = embs @ embs.T

    # Union-Find для группировки
    parent = list(range(n))

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    # Объединяем по схожести
    for i in range(n):
        for j in range(i + 1, n):
            if similarity[i, j] >= threshold:
                union(i, j)

    # Группируем по корневому элементу
    groups = {}
    for i in range(n):
        root = find(i)
        if root not in groups:
            groups[root] = []
        groups[root].append(ids[i])

    # Переназначаем ID
    result = {}
    for new_id, (_, old_ids) in enumerate(sorted(groups.items()), 1):
        result[new_id] = sorted(old_ids)

    return result


def reorganize_folders(base_dir, merge_map, backup=True):
    """
    Реорганизует папки согласно новому слиянию.

    Args:
        base_dir: корневая папка со студентами
        merge_map: dict {new_id: [old_ids]}
        backup: создавать ли бэкап
    """
    base_dir = Path(base_dir)

    # Backup
    if backup:
        backup_dir = base_dir.parent / f"{base_dir.name}_backup"
        if backup_dir.exists():
            shutil.rmtree(backup_dir)
        shutil.copytree(base_dir, backup_dir)
        print(f"Backup created: {backup_dir}")

    # Создаём временные папки
    temp_dir = base_dir / "_temp_merge"
    temp_dir.mkdir(exist_ok=True)

    total_photos = 0

    for new_id, old_ids in tqdm(merge_map.items(), desc="Reorganizing"):
        new_student_dir = temp_dir / str(new_id)
        new_student_dir.mkdir(exist_ok=True)

        photo_num = 1
        for old_id in old_ids:
            old_dir = base_dir / str(old_id)
            if old_dir.exists():
                for photo in sorted(old_dir.glob("*.jpg")):
                    new_path = new_student_dir / f"{photo_num:03d}.jpg"
                    shutil.copy2(str(photo), str(new_path))
                    photo_num += 1
                    total_photos += 1

    # Удаляем старые папки и переносим новые
    for item in base_dir.iterdir():
        if item.name != "_temp_merge" and item.is_dir():
            shutil.rmtree(item)

    for item in temp_dir.iterdir():
        shutil.move(str(item), str(base_dir / item.name))

    temp_dir.rmdir()

    return total_photos


def save_csv(output_dir, merge_map):
    """Сохраняет обновлённый CSV."""
    csv_path = output_dir / "students.csv"

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'photos', 'merged_from', 'name'])
        writer.writeheader()

        for student_id, old_ids in sorted(merge_map.items()):
            student_dir = output_dir / str(student_id)
            photo_count = len(list(student_dir.glob("*.jpg"))) if student_dir.exists() else 0

            writer.writerow({
                'id': student_id,
                'photos': photo_count,
                'merged_from': ','.join(map(str, old_ids)) if len(old_ids) > 1 else '',
                'name': ''
            })

    print(f"CSV saved: {csv_path}")


def main():
    parser = argparse.ArgumentParser(description='Remerge students by embeddings')
    parser.add_argument('input_dir', help='Directory with student folders (e.g., students/exp23)')
    parser.add_argument('--threshold', '-t', type=float, default=cfg.CLUSTERING_THRESHOLD,
                        help=f'Similarity threshold (default: {cfg.CLUSTERING_THRESHOLD})')
    parser.add_argument('--no-backup', action='store_true', help='Skip backup')
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.exists():
        print(f"Error: Directory not found: {input_dir}")
        return

    print(f"Input: {input_dir}")
    print(f"Threshold: {args.threshold}")

    # Load model
    rec_model = load_recognition_model()

    # Find existing students
    student_dirs = [d for d in input_dir.iterdir() if d.is_dir() and d.name.isdigit()]
    print(f"Found {len(student_dirs)} students")

    # Compute embeddings
    print("\nComputing embeddings...")
    student_embeddings = {}
    for student_dir in tqdm(student_dirs):
        student_id = int(student_dir.name)
        emb = compute_student_embedding(rec_model, student_dir)
        if emb is not None:
            student_embeddings[student_id] = emb

    print(f"Valid embeddings: {len(student_embeddings)}")

    # Merge
    print(f"\nMerging with threshold {args.threshold}...")
    merge_map = merge_students(student_embeddings, args.threshold)

    print(f"Before: {len(student_dirs)} students")
    print(f"After: {len(merge_map)} students")

    # Show merge details
    merged_count = sum(1 for ids in merge_map.values() if len(ids) > 1)
    print(f"Groups merged: {merged_count}")

    if merged_count > 0:
        print("\nMerge details (showing up to 10):")
        shown = 0
        for new_id, old_ids in merge_map.items():
            if len(old_ids) > 1 and shown < 10:
                print(f"  Student {new_id} <- {old_ids}")
                shown += 1

    # Confirm
    if len(merge_map) == len(student_dirs):
        print("\nNo changes needed - no students to merge at this threshold.")
        return

    response = input(f"\nReorganize folders? ({len(student_dirs)} -> {len(merge_map)}) [y/N]: ")
    if response.lower() != 'y':
        print("Cancelled.")
        return

    # Reorganize
    total_photos = reorganize_folders(input_dir, merge_map, backup=not args.no_backup)

    # Save CSV
    save_csv(input_dir, merge_map)

    print(f"\n{'='*50}")
    print("REMERGE COMPLETE")
    print(f"{'='*50}")
    print(f"Students: {len(student_dirs)} -> {len(merge_map)}")
    print(f"Photos: {total_photos}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
