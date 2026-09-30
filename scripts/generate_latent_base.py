# -*- coding: UTF-8 -*-
"""
Скрипт для генерации latent_base.pth с embeddings лиц.

Использование:
    # Для ArcFace с выравниванием лиц (рекомендуется - лучшая точность):
    python generate_latent_base.py --faces_dir students/exp18 --use-arcface --align --output database.pkl

    # Для ArcFace без выравнивания:
    python generate_latent_base.py --faces_dir students/exp18 --use-arcface --output database.pkl

    # Для FaceNet:
    python generate_latent_base.py --faces_dir students/exp18 --use-facenet --output latent_base_facenet.pth

Структура папки faces_dir:
    faces_dataset/
        1/           # Класс 1
            img1.jpg
            img2.jpg
        2/           # Класс 2
            img1.jpg
        ...

Опции выравнивания:
    --align          Включает выравнивание лиц по ключевым точкам (глаза, нос, рот)
"""

import argparse
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import cv2
import numpy as np
from tqdm import tqdm

# Config
import config as cfg

# YOLO imports для детекции landmarks
from models.experimental import attempt_load
from utils.general import check_img_size, non_max_suppression_face, scale_coords
from utils.datasets import letterbox


def align_face(img, landmarks, output_size=None):
    """
    Выравнивает лицо по ключевым точкам с помощью аффинного преобразования.

    Args:
        img: Исходное изображение (BGR)
        landmarks: 10 значений [x1,y1,x2,y2,...] или массив (5,2)
        output_size: Размер выходного изображения

    Returns:
        Выровненное изображение лица 112x112
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

    aligned = cv2.warpAffine(img, M, output_size, borderValue=0.0)
    return aligned


def scale_coords_landmarks(img1_shape, coords, img0_shape):
    """Масштабирует landmarks к оригинальному размеру изображения."""
    gain = min(img1_shape[0] / img0_shape[0], img1_shape[1] / img0_shape[1])
    pad = (img1_shape[1] - img0_shape[1] * gain) / 2, (img1_shape[0] - img0_shape[0] * gain) / 2
    coords[:, [0, 2, 4, 6, 8]] -= pad[0]
    coords[:, [1, 3, 5, 7, 9]] -= pad[1]
    coords[:, :10] /= gain
    return coords


class FaceDetector:
    """Детектор лиц на основе YOLO для извлечения landmarks."""

    def __init__(self, weights_path=None, device=None, img_size=None):
        self.device = device or cfg.DEVICE
        weights_path = weights_path or cfg.YOLO_WEIGHTS
        img_size = img_size or cfg.YOLO_IMG_SIZE
        self.model = attempt_load(weights_path, map_location=self.device)
        self.stride = int(self.model.stride.max())
        self.img_size = check_img_size(img_size, s=self.stride)

    def detect(self, img):
        """
        Детектирует лицо и возвращает landmarks.

        Args:
            img: BGR изображение

        Returns:
            landmarks (10 значений) или None
        """
        img0 = img.copy()
        h0, w0 = img0.shape[:2]

        # Letterbox
        img_lb = letterbox(img0, new_shape=self.img_size)[0]
        img_lb = img_lb.transpose(2, 0, 1).copy()
        img_tensor = torch.from_numpy(img_lb).to(self.device).float() / 255.0
        if img_tensor.ndimension() == 3:
            img_tensor = img_tensor.unsqueeze(0)

        with torch.no_grad():
            pred = self.model(img_tensor)[0]

        pred = non_max_suppression_face(pred, cfg.YOLO_CONF_THRES, cfg.YOLO_IOU_THRES)

        for det in pred:
            if len(det):
                # Масштабируем bbox и landmarks
                det[:, :4] = scale_coords(img_tensor.shape[2:], det[:, :4], img0.shape).round()
                det[:, 5:15] = scale_coords_landmarks(img_tensor.shape[2:], det[:, 5:15], img0.shape).round()

                # Берём первое (наиболее уверенное) лицо
                landmarks = det[0, 5:15].cpu().numpy()
                return landmarks

        return None


def load_model(weights_path, device, use_facenet=False, use_arcface=False, arcface_model='buffalo_l'):
    """Загружает модель распознавания."""
    if use_arcface:
        from insightface.app import FaceAnalysis
        app = FaceAnalysis(
            name=arcface_model,
            root=cfg.INSIGHTFACE_ROOT,
            providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
        )
        app.prepare(ctx_id=0, det_size=cfg.ARCFACE_DET_SIZE)

        # Извлекаем recognition model
        rec_model = None
        for name, model in app.models.items():
            if 'recognition' in name or 'w600k' in name or 'rec' in name:
                rec_model = model
                print(f"Загружена ArcFace модель: {name} (512-dim embedding)")
                break

        if rec_model is None:
            raise RuntimeError("Recognition model not found in InsightFace")
        return rec_model
    elif use_facenet:
        from facenet_pytorch import InceptionResnetV1
        model = InceptionResnetV1(pretrained='vggface2').eval().to(device)
        print("Загружена FaceNet модель (512-dim embedding)")
        return model
    else:
        raise ValueError("Укажите --use-arcface или --use-facenet")


def preprocess_face(image_path, use_facenet=False, use_arcface=False):
    """
    Загружает и предобрабатывает изображение лица.

    Предполагается, что изображения уже выровнены (aligned).
    """
    img = cv2.imread(str(image_path))
    if img is None:
        return None

    if use_arcface:
        # ArcFace: возвращаем BGR изображение как есть
        # InsightFace сам обрабатывает изображение
        return img
    elif use_facenet:
        # FaceNet: 160x160 RGB, normalized
        img = cv2.resize(img, (160, 160))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        tensor = torch.from_numpy(img).permute(2, 0, 1).float() / 255.0
        tensor = (tensor - 0.5) / 0.5
    else:
        # ContrastiveModel: 128x128 Grayscale
        img = cv2.resize(img, (128, 128))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        tensor = torch.from_numpy(img).float() / 255.0
        tensor = tensor.unsqueeze(0)  # Add channel dim

    if use_arcface:
        return img
    return tensor.unsqueeze(0)  # Add batch dim


def generate_latent_base(faces_dir, model, device, use_facenet=False, use_arcface=False,
                         face_detector=None, use_alignment=True):
    """
    Генерирует базу embeddings из папки с лицами.

    Args:
        faces_dir: Путь к папке с лицами
        model: Модель для извлечения embeddings
        device: Устройство (cuda/cpu)
        use_facenet: Использовать FaceNet
        use_arcface: Использовать ArcFace
        face_detector: FaceDetector для выравнивания (опционально)
        use_alignment: Использовать выравнивание лиц

    Returns:
        dict: {"zs": tensor embeddings, "idxs": tensor class indices}
    """
    faces_dir = Path(faces_dir)
    all_embeddings = []
    all_indices = []

    # Получаем список классов (папок)
    class_dirs = sorted([d for d in faces_dir.iterdir() if d.is_dir() and d.name.isdigit()],
                        key=lambda x: int(x.name))

    print(f"Найдено {len(class_dirs)} классов (папки с числовыми именами)")

    aligned_count = 0
    fallback_count = 0

    for class_dir in tqdm(class_dirs, desc="Обработка классов"):
        class_idx = int(class_dir.name)  # Имя папки = индекс класса

        # Получаем все изображения в папке
        image_files = list(class_dir.glob("*.jpg")) + list(class_dir.glob("*.png"))

        for img_path in image_files:
            if use_arcface:
                # ArcFace: загружаем BGR изображение
                img = cv2.imread(str(img_path))
                if img is None:
                    print(f"Не удалось загрузить: {img_path}")
                    continue

                # Пробуем выровнять лицо
                aligned_img = None
                if use_alignment and face_detector is not None:
                    landmarks = face_detector.detect(img)
                    if landmarks is not None:
                        aligned_img = align_face(img, landmarks)
                        if aligned_img is not None:
                            aligned_count += 1

                # Извлекаем embedding
                try:
                    if aligned_img is not None:
                        # Используем выровненное лицо напрямую
                        embedding = model.get_feat(aligned_img)
                    else:
                        # Fallback: resize до 112x112
                        resized = cv2.resize(img, (112, 112))
                        embedding = model.get_feat(resized)
                        fallback_count += 1

                    embedding = embedding.flatten()
                    embedding = embedding / np.linalg.norm(embedding)
                except Exception as e:
                    print(f"Ошибка на {img_path}: {e}")
                    continue

                all_embeddings.append(torch.from_numpy(embedding).unsqueeze(0))
                all_indices.append(class_idx - 1)  # 0-indexed
            else:
                tensor = preprocess_face(img_path, use_facenet, use_arcface)
                if tensor is None:
                    print(f"Не удалось загрузить: {img_path}")
                    continue

                tensor = tensor.to(device)

                with torch.inference_mode():
                    if use_facenet:
                        embedding = model(tensor)
                    else:
                        embedding = model.forward_single(tensor)

                all_embeddings.append(embedding.cpu())
                all_indices.append(class_idx - 1)  # 0-indexed

    # Собираем в тензоры
    zs = torch.cat(all_embeddings, dim=0)
    idxs = torch.tensor(all_indices, dtype=torch.long)

    print(f"\nСтатистика выравнивания:")
    print(f"  - Выровнено: {aligned_count}")
    print(f"  - Fallback (без выравнивания): {fallback_count}")
    print(f"Создано {len(all_embeddings)} embeddings размерности {zs.shape[1]}")

    # Загружаем имена из students.csv
    names = {}
    csv_path = faces_dir / "students.csv"
    if csv_path.exists():
        import csv
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                sid = str(row.get('id', ''))
                name = row.get('name', '').strip()
                if sid:
                    names[sid] = name if name else sid
        print(f"Загружено {len(names)} имён из {csv_path}")
    else:
        print(f"students.csv не найден, имена будут ID")

    return {"zs": zs, "idxs": idxs, "names": names}


def generate_latent_base_multi(faces_dirs, model, device, use_facenet=False, use_arcface=False,
                                face_detector=None, use_alignment=True):
    """
    Генерирует базу embeddings из нескольких папок с лицами.
    ID будут иметь формат "prefix_id" (например "418_1", "428_5").
    """
    import csv

    all_embeddings = []
    all_ids = []  # Строковые ID с префиксом
    all_names = {}

    aligned_count = 0
    fallback_count = 0

    for faces_dir in faces_dirs:
        faces_dir = Path(faces_dir)
        prefix = faces_dir.name  # Имя папки как префикс (418, 428)

        print(f"\n{'='*50}")
        print(f"Обработка: {faces_dir} (префикс: {prefix})")
        print(f"{'='*50}")

        # Получаем список классов (папок)
        class_dirs = sorted([d for d in faces_dir.iterdir() if d.is_dir() and d.name.isdigit()],
                            key=lambda x: int(x.name))

        print(f"Найдено {len(class_dirs)} классов")

        # Загружаем имена из students.csv
        csv_path = faces_dir / "students.csv"
        local_names = {}
        if csv_path.exists():
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    sid = str(row.get('id', ''))
                    name = row.get('name', '').strip()
                    if sid:
                        local_names[sid] = name if name else f"{prefix}_{sid}"
            print(f"Загружено {len(local_names)} имён из {csv_path}")

        for class_dir in tqdm(class_dirs, desc=f"[{prefix}] Классы"):
            class_id = class_dir.name
            full_id = f"{prefix}_{class_id}"  # Например "418_1"

            # Получаем все изображения в папке
            image_files = list(class_dir.glob("*.jpg")) + list(class_dir.glob("*.png"))

            for img_path in image_files:
                if use_arcface:
                    img = cv2.imread(str(img_path))
                    if img is None:
                        continue

                    aligned_img = None
                    if use_alignment and face_detector is not None:
                        landmarks = face_detector.detect(img)
                        if landmarks is not None:
                            aligned_img = align_face(img, landmarks)
                            if aligned_img is not None:
                                aligned_count += 1

                    try:
                        if aligned_img is not None:
                            embedding = model.get_feat(aligned_img)
                        else:
                            resized = cv2.resize(img, (112, 112))
                            embedding = model.get_feat(resized)
                            fallback_count += 1

                        embedding = embedding.flatten()
                        embedding = embedding / np.linalg.norm(embedding)
                    except Exception as e:
                        continue

                    all_embeddings.append(torch.from_numpy(embedding).unsqueeze(0))
                    all_ids.append(full_id)
                else:
                    tensor = preprocess_face(img_path, use_facenet, use_arcface)
                    if tensor is None:
                        continue

                    tensor = tensor.to(device)

                    with torch.inference_mode():
                        if use_facenet:
                            embedding = model(tensor)
                        else:
                            embedding = model.forward_single(tensor)

                    all_embeddings.append(embedding.cpu())
                    all_ids.append(full_id)

            # Добавляем имя с префиксом
            name = local_names.get(class_id, full_id)
            all_names[full_id] = name

    # Собираем в тензоры
    zs = torch.cat(all_embeddings, dim=0)

    # Создаём маппинг id -> index
    unique_ids = list(dict.fromkeys(all_ids))  # Сохраняем порядок
    id_to_idx = {id_: idx for idx, id_ in enumerate(unique_ids)}
    idxs = torch.tensor([id_to_idx[id_] for id_ in all_ids], dtype=torch.long)

    print(f"\n{'='*50}")
    print(f"ИТОГО:")
    print(f"  - Выровнено: {aligned_count}")
    print(f"  - Fallback: {fallback_count}")
    print(f"  - Embeddings: {len(all_embeddings)}")
    print(f"  - Уникальных студентов: {len(unique_ids)}")
    print(f"  - Имён: {len(all_names)}")
    print(f"{'='*50}")

    return {"zs": zs, "idxs": idxs, "names": all_names, "id_list": unique_ids}


def main():
    parser = argparse.ArgumentParser(description="Генерация database.pkl")
    parser.add_argument('--faces_dir', type=str, nargs='+', required=True,
                        help='Путь к папке(ам) с лицами (можно несколько)')
    parser.add_argument('--weights', type=str, default=None,
                        help='Путь к весам ContrastiveModel')
    parser.add_argument('--use-facenet', action='store_true',
                        help='Использовать FaceNet вместо ContrastiveModel')
    parser.add_argument('--use-arcface', action='store_true',
                        help='Использовать ArcFace/InsightFace (рекомендуется)')
    parser.add_argument('--arcface-model', type=str, default=cfg.ARCFACE_MODEL,
                        help='Модель InsightFace (по умолчанию: buffalo_l)')
    parser.add_argument('--align', action='store_true', default=cfg.USE_ALIGNMENT,
                        help='Использовать выравнивание лиц')
    parser.add_argument('--output', type=str, default=cfg.DATABASE_PATH,
                        help='Путь для сохранения database')
    args = parser.parse_args()

    print(f"Устройство: {cfg.DEVICE}")
    cfg.print_config()

    device = cfg.DEVICE

    # Загрузка модели распознавания
    model = load_model(
        args.weights, device,
        use_facenet=args.use_facenet,
        use_arcface=args.use_arcface,
        arcface_model=args.arcface_model
    )

    # Загрузка детектора для выравнивания
    face_detector = None
    if args.align and args.use_arcface:
        print(f"\nЗагрузка YOLO для выравнивания лиц: {cfg.YOLO_WEIGHTS}")
        face_detector = FaceDetector()
        print("Выравнивание лиц: ВКЛЮЧЕНО")
    else:
        print("Выравнивание лиц: ВЫКЛЮЧЕНО")

    # Генерация базы
    if len(args.faces_dir) == 1:
        # Одна папка - старое поведение
        latent_base = generate_latent_base(
            args.faces_dir[0], model, device,
            use_facenet=args.use_facenet,
            use_arcface=args.use_arcface,
            face_detector=face_detector,
            use_alignment=args.align
        )
    else:
        # Несколько папок - объединяем с префиксами
        latent_base = generate_latent_base_multi(
            args.faces_dir, model, device,
            use_facenet=args.use_facenet,
            use_arcface=args.use_arcface,
            face_detector=face_detector,
            use_alignment=args.align
        )

    # Сохранение
    torch.save(latent_base, args.output)
    print(f"\nСохранено в {args.output}")
    print(f"  - zs shape: {latent_base['zs'].shape}")
    print(f"  - idxs shape: {latent_base['idxs'].shape}")
    print(f"  - names: {len(latent_base.get('names', {}))}")


if __name__ == "__main__":
    main()
