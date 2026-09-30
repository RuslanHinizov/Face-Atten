# -*- coding: UTF-8 -*-
"""
Генерация database.pkl из enrollment-фотографий.

Сканирует data/enrollment/ (и опционально colleagues/), детектирует лица
через InsightFace, извлекает эмбеддинги и сохраняет в database.pkl.

Использование:
    # Только enrollment фотки:
    python scripts/build_enrollment_db.py

    # Enrollment + colleagues:
    python scripts/build_enrollment_db.py --sources enrollment colleagues

    # С указанием выходного файла:
    python scripts/build_enrollment_db.py --output data/databases/database.pkl

    # Добавить к существующей базе (не перезаписывать):
    python scripts/build_enrollment_db.py --merge

Структура data/enrollment/:
    data/enrollment/
        {person_id}/              # UUID (86eb39c8)
            straight_0.jpg        # Полные кадры 720p
            straight_1.jpg
            left_0.jpg
            ...

Структура colleagues/:
    colleagues/
        1/                        # Числовые папки
            001.png
        2/
            001.png
        students.csv              # id,photos,tracks,name
"""
import argparse
import os
import sys
import csv
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ['ONNXRUNTIME_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore')

import cv2
import numpy as np
import torch
from tqdm import tqdm

import config as cfg


def load_insightface():
    """Загружает InsightFace модель (det + rec)."""
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(
        name=cfg.ARCFACE_MODEL,
        root=cfg.INSIGHTFACE_ROOT,
        providers=['CUDAExecutionProvider', 'CPUExecutionProvider'],
    )
    app.prepare(ctx_id=0, det_size=cfg.ARCFACE_DET_SIZE)
    print(f"InsightFace загружен: {cfg.ARCFACE_MODEL}")
    return app


def extract_embedding(app, img):
    """Детектирует лицо и возвращает эмбеддинг (512-dim).

    Args:
        app: FaceAnalysis instance
        img: BGR изображение (полный кадр или кроп)

    Returns:
        np.ndarray (512,) или None
    """
    faces = app.get(img)
    if not faces:
        return None

    # Берём самое большое лицо
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

    emb = face.normed_embedding
    if emb is None:
        return None

    return emb.astype(np.float32)


def load_existing_names(db_path):
    """Загружает маппинг id->name из существующей базы."""
    names = {}
    if not Path(db_path).exists():
        return names
    try:
        data = torch.load(db_path, map_location='cpu', weights_only=False)
        names = data.get('names', {})
        print(f"Загружено {len(names)} имён из существующей базы")
    except Exception as e:
        print(f"Не удалось прочитать имена из {db_path}: {e}")
    return names


def process_enrollment(app, enrollment_dir, existing_names):
    """Обработка data/enrollment/ — полные кадры, UUID-папки.

    Returns:
        list of (person_id, name, np.ndarray embedding)
    """
    enrollment_dir = Path(enrollment_dir)
    if not enrollment_dir.exists():
        print(f"Папка {enrollment_dir} не найдена, пропускаю")
        return []

    person_dirs = sorted([d for d in enrollment_dir.iterdir() if d.is_dir()])
    print(f"\n{'='*50}")
    print(f"Enrollment: {enrollment_dir}")
    print(f"Найдено {len(person_dirs)} персон")
    print(f"{'='*50}")

    results = []
    for person_dir in tqdm(person_dirs, desc="Enrollment"):
        person_id = person_dir.name
        name = existing_names.get(person_id, person_id)

        photos = sorted(person_dir.glob("*.jpg")) + sorted(person_dir.glob("*.png"))
        if not photos:
            print(f"  {person_id} ({name}): нет фотографий, пропускаю")
            continue

        ok = 0
        for photo_path in photos:
            img = cv2.imread(str(photo_path))
            if img is None:
                continue

            emb = extract_embedding(app, img)
            if emb is not None:
                results.append((person_id, name, emb))
                ok += 1

        if ok == 0:
            print(f"  {person_id} ({name}): 0/{len(photos)} эмбеддингов")
        else:
            tqdm.write(f"  {person_id} ({name}): {ok}/{len(photos)} эмбеддингов")

    return results


def process_colleagues(app, colleagues_dir):
    """Обработка colleagues/ — нумерованные папки + students.csv.

    Returns:
        list of (person_id, name, np.ndarray embedding)
    """
    colleagues_dir = Path(colleagues_dir)
    if not colleagues_dir.exists():
        print(f"Папка {colleagues_dir} не найдена, пропускаю")
        return []

    # Загрузить имена из students.csv
    csv_names = {}
    csv_path = colleagues_dir / "students.csv"
    if csv_path.exists():
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                sid = str(row.get('id', ''))
                name = row.get('name', '').strip()
                if sid:
                    csv_names[sid] = name if name else sid
        print(f"Загружено {len(csv_names)} имён из {csv_path}")

    # Числовые папки
    class_dirs = sorted(
        [d for d in colleagues_dir.iterdir() if d.is_dir() and d.name.isdigit()],
        key=lambda x: int(x.name)
    )

    print(f"\n{'='*50}")
    print(f"Colleagues: {colleagues_dir}")
    print(f"Найдено {len(class_dirs)} персон")
    print(f"{'='*50}")

    prefix = colleagues_dir.name  # "colleagues"
    results = []

    for class_dir in tqdm(class_dirs, desc="Colleagues"):
        class_id = class_dir.name
        person_id = f"{prefix}_{class_id}"
        name = csv_names.get(class_id, person_id)

        photos = sorted(class_dir.glob("*.jpg")) + sorted(class_dir.glob("*.png"))
        if not photos:
            continue

        ok = 0
        for photo_path in photos:
            img = cv2.imread(str(photo_path))
            if img is None:
                continue

            emb = extract_embedding(app, img)
            if emb is not None:
                results.append((person_id, name, emb))
                ok += 1

        if ok == 0:
            print(f"  {person_id} ({name}): 0/{len(photos)} эмбеддингов")

    return results


def build_database(results, output_path, merge_path=None):
    """Собирает database.pkl из списка (person_id, name, embedding).

    Args:
        results: list of (person_id, name, embedding)
        output_path: куда сохранить
        merge_path: если указан, загрузить существующую базу и добавить
    """
    # Группируем по person_id
    persons = {}
    names_map = {}
    for person_id, name, emb in results:
        if person_id not in persons:
            persons[person_id] = []
            names_map[person_id] = name
        persons[person_id].append(emb)

    # Если merge — загружаем существующую базу и добавляем
    if merge_path and Path(merge_path).exists():
        try:
            existing = torch.load(merge_path, map_location='cpu', weights_only=False)
            existing_names = existing.get('names', {})
            existing_id_list = existing.get('id_list', [])
            existing_zs = existing['zs'].numpy()
            existing_idxs = existing['idxs'].numpy()

            for idx, pid in enumerate(existing_id_list):
                if pid not in persons:
                    mask = existing_idxs == idx
                    embs = existing_zs[mask]
                    persons[pid] = [e for e in embs]
                    names_map[pid] = existing_names.get(pid, pid)

            print(f"Слияние с существующей базой: +{len(existing_id_list)} ID")
        except Exception as e:
            print(f"Ошибка слияния: {e}")

    if not persons:
        print("Нет данных для сохранения!")
        return

    # Собираем тензоры
    all_embeddings = []
    all_indices = []
    id_list = []

    for idx, (person_id, embs) in enumerate(persons.items()):
        id_list.append(person_id)
        for emb in embs:
            all_embeddings.append(emb)
            all_indices.append(idx)

    zs = torch.tensor(np.array(all_embeddings), dtype=torch.float32)
    idxs = torch.tensor(all_indices, dtype=torch.long)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    data = {
        'zs': zs,
        'idxs': idxs,
        'id_list': id_list,
        'names': names_map,
    }
    torch.save(data, output_path)

    print(f"\n{'='*50}")
    print(f"РЕЗУЛЬТАТ")
    print(f"{'='*50}")
    print(f"Сохранено: {output_path}")
    print(f"Персон: {len(id_list)}")
    print(f"Эмбеддингов: {zs.shape[0]} x {zs.shape[1]}")
    for pid in id_list:
        n = sum(1 for i in all_indices if id_list[i] == pid)
        print(f"  {pid}: {names_map.get(pid, '?')} ({n} emb)")


def main():
    parser = argparse.ArgumentParser(description="Генерация database.pkl из enrollment/colleagues фоток")
    parser.add_argument('--sources', nargs='+', default=['enrollment'],
                        choices=['enrollment', 'colleagues'],
                        help='Источники данных (default: enrollment)')
    parser.add_argument('--enrollment-dir', type=str,
                        default=os.path.join(cfg.BASE_DIR, 'data/enrollment'),
                        help='Путь к enrollment фоткам')
    parser.add_argument('--colleagues-dir', type=str,
                        default=os.path.join(cfg.BASE_DIR, 'colleagues'),
                        help='Путь к colleagues фоткам')
    parser.add_argument('--output', type=str, default=cfg.DATABASE_PATH,
                        help=f'Выходной файл (default: {cfg.DATABASE_PATH})')
    parser.add_argument('--merge', action='store_true',
                        help='Слить с существующей базой (не перезаписывать)')
    args = parser.parse_args()

    print(f"Device: {cfg.DEVICE}")
    print(f"Sources: {args.sources}")
    print(f"Output: {args.output}")

    app = load_insightface()
    existing_names = load_existing_names(args.output)

    all_results = []

    if 'enrollment' in args.sources:
        results = process_enrollment(app, args.enrollment_dir, existing_names)
        all_results.extend(results)

    if 'colleagues' in args.sources:
        results = process_colleagues(app, args.colleagues_dir)
        all_results.extend(results)

    print(f"\nВсего эмбеддингов: {len(all_results)}")

    merge_path = args.output if args.merge else None
    build_database(all_results, args.output, merge_path)


if __name__ == "__main__":
    main()
