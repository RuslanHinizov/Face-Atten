# Face Recognition Attendance System

Система распознавания лиц для автоматического учёта посещаемости. Использует YOLOv5-Face для детекции и ArcFace (InsightFace) для распознавания.

## Возможности

- Детекция лиц в реальном времени (YOLOv5-Face)
- Распознавание по базе данных (ArcFace/InsightFace)
- DeepSORT трекинг для стабильного отслеживания
- Веб-интерфейс с React + TypeScript
- REST API на FastAPI
- WebSocket стриминг видео
- Поддержка RTSP камер и видеофайлов
- Автоматическое извлечение лиц студентов из видео

## Структура проекта

```
yolov5-face/
├── api/                    # Backend API
│   └── api_server.py       # FastAPI сервер
├── core/                   # Ядро распознавания
│   └── video_recognition.py # Основной скрипт распознавания
├── scripts/                # Утилиты
│   ├── extract_students.py # Извлечение лиц из видео
│   ├── generate_latent_base.py # Генерация базы эмбеддингов
│   ├── transfer_names.py   # Перенос имён между базами
│   └── ...
├── data/
│   ├── databases/          # Базы данных (.pkl)
│   └── videos/             # Тестовые видео
├── run/                    # Batch-файлы для запуска
├── frontend/               # React приложение
├── models/                 # Код моделей YOLO
├── weights/                # Веса моделей (.pt)
├── trackers/               # Алгоритмы трекинга
├── utils/                  # Вспомогательные функции
├── students/               # Фото студентов
├── config.py               # Конфигурация
└── requirements.txt        # Зависимости
```

## Установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/YOUR_USERNAME/yolov5-face-recognition.git
cd yolov5-face-recognition
```

### 2. Создание виртуального окружения

```bash
python -m venv venv
venv\Scripts\activate  # Windows
# или
source venv/bin/activate  # Linux/Mac
```

### 3. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 4. Скачивание весов моделей

Скачайте и поместите в папку `weights/`:
- [yolov5s-face.pt](https://github.com/clibdev/yolov5-face/releases/latest/download/yolov5s-face.pt) - детекция лиц

InsightFace модели скачаются автоматически при первом запуске.

### 5. Установка frontend

```bash
cd frontend
npm install
cd ..
```

## Запуск

### Быстрый запуск (Windows)

```bash
run\START_ALL.bat
```

### Ручной запуск

**Backend:**
```bash
python -m api.api_server
# или
python -m uvicorn api.api_server:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Открыть в браузере:**
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

### Распознавание видео (без веб-интерфейса)

```bash
# Видеофайл
python -m core.video_recognition data/videos/test.mp4

# RTSP камера
python -m core.video_recognition "rtsp://admin:password@192.168.1.100:554/stream"

# С указанием базы данных
python -m core.video_recognition data/videos/test.mp4 --db data/databases/database.pkl

# С записью результата
python -m core.video_recognition data/videos/test.mp4 -r
```

## Создание базы данных лиц

### 1. Извлечение лиц из видео

```bash
python scripts/extract_students.py data/videos/lecture.mp4
```

Результат сохраняется в `students/exp1/`, `students/exp2/` и т.д.

### 2. Присвоение имён

Переименуйте папки в `students/expN/` по именам студентов или создайте `names.csv`:

```csv
id,name
1,Иванов Алексей
2,Петрова Мария
3,Сидоров Дмитрий
```

### 3. Генерация базы эмбеддингов

```bash
python scripts/generate_latent_base.py --faces_dir students/exp1 --use-arcface --align --output data/databases/database.pkl
```

## Конфигурация

Основные настройки в `config.py`:

```python
# Детекция
YOLO_CONF_THRES = 0.70        # Порог уверенности детекции
MIN_FACE_SIZE = 30            # Минимальный размер лица (px)

# Распознавание
RECOGNITION_THRESHOLD = 0.20  # Порог схожести (меньше = строже)

# Пути
DATABASE_PATH = 'data/databases/database.pkl'
STUDENTS_DIR = 'students'
```

## API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/persons` | Список всех персон |
| POST | `/api/persons` | Добавить персону |
| GET | `/api/attendance` | Записи посещаемости |
| GET | `/api/attendance/stats` | Статистика |
| WS | `/ws/camera/{id}` | Видеопоток камеры |

Полная документация: http://localhost:8000/docs

## Технологии

**Backend:**
- Python 3.10+
- FastAPI
- PyTorch
- YOLOv5-Face
- InsightFace (ArcFace)
- OpenCV

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS
- Zustand

## Лицензия

MIT License

## Инструкция по запуску

Полная инструкция для установки на другом компьютере находится в [ZAPUSK.md](ZAPUSK.md).

