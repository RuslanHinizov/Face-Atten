# Запуск проекта Face-Atten на другом компьютере

Это руководство поможет скачать проект, установить зависимости и запустить веб-интерфейс системы учёта посещаемости по распознаванию лиц.

> Инструкция рассчитана прежде всего на Windows 10/11. Для распознавания понадобятся веса модели YOLO и собственная база лиц: большие файлы, видеозаписи и персональные данные студентов в GitHub не загружаются.

## 1. Что установить заранее

Установите:

- **Git**: https://git-scm.com/downloads
- **Python 3.10** (64-бит): https://www.python.org/downloads/release/python-31011/ Во время установки включите `Add Python to PATH`.
- **Node.js LTS** (вместе с npm): https://nodejs.org/

Проверьте установку в PowerShell:

```powershell
git --version
python --version
node --version
npm --version
```

Если команда `python` не найдена, переустановите Python с параметром `Add Python to PATH` и откройте новое окно PowerShell.

## 2. Скачать проект

Откройте PowerShell в папке, где хотите хранить проект, затем выполните:

```powershell
git clone https://github.com/RuslanHinizov/Face-Atten.git
cd Face-Atten
```

## 3. Установить Python-зависимости

В корне проекта выполните:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install insightface onnxruntime
```

Если PowerShell запрещает запуск скриптов, выполните для текущего окна:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Для видеокарты NVIDIA и ускорения через CUDA сначала установите совместимую версию PyTorch по официальной инструкции: https://pytorch.org/get-started/locally/. Для первого запуска можно использовать CPU, но обработка видео будет медленнее.

## 4. Скачать веса модели

Из корня проекта выполните:

```powershell
New-Item -ItemType Directory -Force weights | Out-Null
Invoke-WebRequest -Uri "https://github.com/clibdev/yolov5-face/releases/latest/download/yolov5s-face.pt" -OutFile "weights/yolov5s-face.pt"
```

При первом запуске InsightFace может автоматически загрузить модель распознавания. Для этого нужен доступ к интернету.

## 5. Установить зависимости веб-интерфейса

```powershell
cd frontend
npm install
cd ..
```

## 6. Запустить систему

Откройте **два окна PowerShell** в папке `Face-Atten`.

В первом окне запустите сервер:

```powershell
.\.venv\Scripts\Activate.ps1
python -m api.api_server
```

Во втором окне запустите веб-интерфейс:

```powershell
cd Face-Atten\frontend
npm run dev
```

Если вы уже находитесь в корне проекта, для второго окна используйте `cd frontend`.

Откройте в браузере:

- Приложение: http://localhost:5173
- Документация API: http://localhost:8000/docs

Чтобы остановить серверы, нажмите `Ctrl+C` в каждом окне.

## Важно: база лиц и камеры

Базы (`.pkl`), фотографии студентов, видео и записи камер не входят в репозиторий. После клонирования проект не содержит исходную базу лиц. Чтобы распознавать людей, настройте камеры и создайте свою базу лиц из изображений/видео с необходимым разрешением на обработку персональных данных. Не публикуйте базы, фотографии, пароли камер и видеозаписи в открытом репозитории.

Пути к моделям, базе и параметры камер находятся в `config.py`. Основной YOLO-файл ожидается по пути `weights/yolov5s-face.pt`; используемая по умолчанию база указана в `DATABASE_PATH`. Указывайте RTSP-адреса только локально и не отправляйте их в публичный GitHub.

## Частые проблемы

- **`ModuleNotFoundError`**: активируйте `.venv` и повторите `pip install -r requirements.txt` и `pip install insightface onnxruntime`.
- **Не найден файл весов**: проверьте, что `weights/yolov5s-face.pt` скачан и не пустой.
- **Порт 8000 или 5173 занят**: остановите другой процесс, занимающий порт, затем перезапустите соответствующий сервер.
- **Браузер не соединяется с API**: убедитесь, что backend работает на `http://localhost:8000`; frontend ожидает локальный API.
- **CUDA недоступна**: приложение может работать на CPU, но обработка будет медленнее.

## Запуск из другого ИИ-ассистента

Передайте ассистенту этот запрос после клонирования репозитория:

> Открой проект Face-Atten. Прочитай `ZAPUSK.md`, проверь наличие Python, Node.js и Git, создай виртуальное окружение, установи backend- и frontend-зависимости и скачай необходимые веса модели, если отсутствуют. Затем запусти backend и frontend в отдельных терминалах и проверь, что приложение открывается по адресу http://localhost:5173, а API — по адресу http://localhost:8000/docs. Не удаляй и не публикуй базы данных, фотографии, видео и конфиденциальные настройки. Если возникнет ошибка, объясни её и исправь.
