# -*- coding: UTF-8 -*-
import sys
import io
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
Перенос имён между экспериментами по схожести эмбеддингов.

Использование:
    python scripts/transfer_names.py --save students/exp26
    python scripts/transfer_names.py --load students/exp27
    python scripts/transfer_names.py --from students/exp26 --to students/exp27
"""
import argparse
import pickle
import csv
import numpy as np
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

    if img.shape[:2] != (112, 112):
        img = cv2.resize(img, (112, 112))

    try:
        emb = rec_model.get_feat(img)
        emb = emb.flatten()
        return emb / np.linalg.norm(emb)
    except:
        return None


def compute_student_embedding(rec_model, student_dir):
    """Вычисляет средний эмбеддинг студента."""
    embeddings = []
    for img_path in student_dir.glob("*.jpg"):
        emb = get_embedding(rec_model, img_path)
        if emb is not None:
            embeddings.append(emb)

    if not embeddings:
        return None

    mean_emb = np.mean(embeddings, axis=0)
    return mean_emb / np.linalg.norm(mean_emb)


def load_names_from_csv(exp_dir):
    """Загружает имена из CSV."""
    csv_path = exp_dir / "students.csv"
    names = {}
    if csv_path.exists():
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get('name', '').strip()
                if name:
                    names[int(row['id'])] = name
    return names


def save_names_template(exp_dir, output_path=None):
    """Сохраняет шаблон имён с эмбеддингами."""
    exp_dir = Path(exp_dir)
    if not exp_dir.exists():
        exp_dir = Path(cfg.STUDENTS_DIR) / exp_dir

    if not exp_dir.exists():
        print(f"Error: {exp_dir} not found")
        return

    print(f"Loading from: {exp_dir}")

    # Загружаем имена
    names = load_names_from_csv(exp_dir)
    if not names:
        print("No names found in CSV!")
        return

    print(f"Found {len(names)} named students")

    # Загружаем модель
    rec_model = load_recognition_model()

    # Вычисляем эмбеддинги для студентов с именами
    templates = {}
    for student_id, name in tqdm(names.items(), desc="Computing embeddings"):
        student_dir = exp_dir / str(student_id)
        if student_dir.exists():
            emb = compute_student_embedding(rec_model, student_dir)
            if emb is not None:
                templates[name] = emb

    print(f"Computed {len(templates)} templates")

    # Сохраняем
    if output_path is None:
        output_path = Path(cfg.STUDENTS_DIR) / "names_template.pkl"
    else:
        output_path = Path(output_path)

    with open(output_path, 'wb') as f:
        pickle.dump(templates, f)

    print(f"Saved: {output_path}")
    return templates


def transfer_names(target_dir, template_path=None, threshold=0.5):
    """Переносит имена в новый эксперимент."""
    target_dir = Path(target_dir)
    if not target_dir.exists():
        target_dir = Path(cfg.STUDENTS_DIR) / target_dir

    if not target_dir.exists():
        print(f"Error: {target_dir} not found")
        return

    # Загружаем шаблон
    if template_path is None:
        template_path = Path(cfg.STUDENTS_DIR) / "names_template.pkl"
    else:
        template_path = Path(template_path)

    if not template_path.exists():
        print(f"Error: Template not found: {template_path}")
        print("Run with --save first!")
        return

    with open(template_path, 'rb') as f:
        templates = pickle.load(f)

    print(f"Loaded {len(templates)} name templates")
    print(f"Target: {target_dir}")

    # Загружаем модель
    rec_model = load_recognition_model()

    # Находим студентов в target
    student_dirs = [d for d in target_dir.iterdir() if d.is_dir() and d.name.isdigit()]
    print(f"Found {len(student_dirs)} students in target")

    # Сопоставляем
    matches = {}
    template_names = list(templates.keys())
    template_embs = np.array([templates[n] for n in template_names])

    for student_dir in tqdm(student_dirs, desc="Matching"):
        student_id = int(student_dir.name)
        emb = compute_student_embedding(rec_model, student_dir)

        if emb is not None:
            # Находим лучшее совпадение
            scores = np.dot(template_embs, emb)
            best_idx = np.argmax(scores)
            best_score = scores[best_idx]

            if best_score >= threshold:
                matches[student_id] = {
                    'name': template_names[best_idx],
                    'score': float(best_score)
                }

    print(f"\nMatched {len(matches)} / {len(student_dirs)} students")

    # Показываем совпадения
    print("\nMatches:")
    for sid, data in sorted(matches.items()):
        print(f"  {sid}: {data['name']} ({data['score']:.2f})")

    # Обновляем CSV
    csv_path = target_dir / "students.csv"

    # Читаем существующий CSV
    rows = []
    if csv_path.exists():
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                sid = int(row['id'])
                if sid in matches:
                    row['name'] = matches[sid]['name']
                rows.append(row)
    else:
        # Создаём новый
        for student_dir in sorted(student_dirs, key=lambda x: int(x.name)):
            sid = int(student_dir.name)
            photo_count = len(list(student_dir.glob("*.jpg")))
            rows.append({
                'id': sid,
                'photos': photo_count,
                'tracks': 1,
                'name': matches.get(sid, {}).get('name', '')
            })

    # Записываем
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'photos', 'tracks', 'name'])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nCSV updated: {csv_path}")

    # Статистика
    unmatched = len(student_dirs) - len(matches)
    if unmatched > 0:
        print(f"\n{unmatched} students without names (new people or low match)")


def main():
    parser = argparse.ArgumentParser(description='Transfer names between experiments')
    parser.add_argument('--save', type=str, help='Save names template from exp (e.g., exp26)')
    parser.add_argument('--load', type=str, help='Load names into exp (e.g., exp27)')
    parser.add_argument('--from', dest='from_exp', type=str, help='Source exp with names')
    parser.add_argument('--to', type=str, help='Target exp to fill names')
    parser.add_argument('--threshold', type=float, default=0.5, help='Match threshold')
    args = parser.parse_args()

    if args.save:
        save_names_template(args.save)
    elif args.load:
        transfer_names(args.load, threshold=args.threshold)
    elif args.from_exp and args.to:
        print(f"Transferring names: {args.from_exp} -> {args.to}")
        save_names_template(args.from_exp)
        transfer_names(args.to, threshold=args.threshold)
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python transfer_names.py --save exp26")
        print("  python transfer_names.py --load exp27")
        print("  python transfer_names.py --from exp26 --to exp27")


if __name__ == "__main__":
    main()
