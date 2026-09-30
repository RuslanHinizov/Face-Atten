# -*- coding: UTF-8 -*-
"""Отрисовка результатов распознавания на кадре."""
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Кэшируем шрифты при загрузке модуля
try:
    FONT_MAIN = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
    FONT_INFO = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 16)
except Exception:
    FONT_MAIN = ImageFont.load_default()
    FONT_INFO = ImageFont.load_default()


def draw_styled_corner(img, pt1, pt2, color, thickness, r):
    """Рисует аккуратные уголки вместо полной рамки."""
    x1, y1 = pt1
    x2, y2 = pt2
    d = min(20, (x2 - x1) // 4)

    # Верхний левый
    cv2.line(img, (x1, y1), (x1 + d, y1), color, thickness)
    cv2.line(img, (x1, y1), (x1, y1 + d), color, thickness)
    # Верхний правый
    cv2.line(img, (x2, y1), (x2 - d, y1), color, thickness)
    cv2.line(img, (x2, y1), (x2, y1 + d), color, thickness)
    # Нижний левый
    cv2.line(img, (x1, y2), (x1 + d, y2), color, thickness)
    cv2.line(img, (x1, y2), (x1, y2 - d), color, thickness)
    # Нижний правый
    cv2.line(img, (x2, y2), (x2 - d, y2), color, thickness)
    cv2.line(img, (x2, y2), (x2, y2 - d), color, thickness)


def draw_frame(frame, tracks, capture_fps, inference_fps):
    """Отрисовывает результаты на кадре со стильным оформлением."""
    overlay = frame.copy()

    recognized_count = 0
    labels_to_draw = []

    for track in tracks:
        # Handle both ByteTrack (body_bbox + face_bbox) and legacy (bbox only) formats
        body_bbox = track.get('body_bbox')
        face_bbox = track.get('face_bbox') or track.get('bbox')
        name = track.get('name', '???')
        score = track.get('confidence', track.get('score', 0))
        recognized = track.get('recognized', False)
        state = track.get('state', 'tracking')
        track_id = track.get('track_id', track.get('id', 0))

        # Определяем основной bbox для рисования
        if body_bbox:
            x1, y1, x2, y2 = [int(v) for v in body_bbox]
        elif face_bbox:
            x1, y1, x2, y2 = [int(v) for v in face_bbox]
        else:
            continue

        # Стиль в зависимости от статуса
        if recognized and name:
            color = (46, 204, 113)  # Emerald Green
            label = f" {name} • {score:.0%} "
            recognized_count += 1
        elif state == 'lost_face':
            color = (241, 196, 15)  # Sun Flower Yellow
            label = f" ID:{track_id} (без лица) "
        elif recognized:
            color = (52, 152, 219)  # Peter River Blue
            label = f" Неизвестный • {score:.0%} "
        else:
            color = (149, 165, 166)  # Asbestos Gray
            label = f" ID:{track_id} Обработка... "

        # Рисуем body bbox (если есть)
        if body_bbox:
            bx1, by1, bx2, by2 = [int(v) for v in body_bbox]
            cv2.rectangle(frame, (bx1, by1), (bx2, by2), color, 1, cv2.LINE_AA)
            draw_styled_corner(frame, (bx1, by1), (bx2, by2), color, 2, 5)

        # Рисуем face bbox (если есть и отличается от body)
        if face_bbox and body_bbox:
            fx1, fy1, fx2, fy2 = [int(v) for v in face_bbox]
            cv2.rectangle(frame, (fx1, fy1), (fx2, fy2), (255, 255, 255), 1, cv2.LINE_AA)
        elif face_bbox and not body_bbox:
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
            draw_styled_corner(frame, (x1, y1), (x2, y2), color, 2, 5)

        # Позиция для текста (над body или face)
        label_y = y1 - 30 if y1 > 40 else y2 + 10
        labels_to_draw.append({
            'text': label,
            'pos': (x1, label_y),
            'color': color
        })

    # Верхняя панель (Glassmorphism)
    cv2.rectangle(overlay, (0, 0), (frame.shape[1], 45), (30, 30, 30), -1)
    frame = cv2.addWeighted(overlay, 0.7, frame, 0.3, 0)

    # PIL для красивого текста и кириллицы
    pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil_img)

    # Подписи объектов
    for item in labels_to_draw:
        txt = item['text']
        x, y = item['pos']
        bbox = draw.textbbox((x, y), txt, font=FONT_MAIN)
        draw.rounded_rectangle(bbox, radius=4, fill=item['color'])
        draw.text((x, y), txt, font=FONT_MAIN, fill=(255, 255, 255))

    # Статистика
    info_text = (f"INF: {inference_fps:.1f} FPS  |  "
                 f"CAP: {capture_fps:.1f} FPS  |  "
                 f"TRACKS: {len(tracks)}  |  "
                 f"FOUND: {recognized_count}")

    draw.text((20, 12), info_text, font=FONT_INFO, fill=(255, 255, 255))

    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
