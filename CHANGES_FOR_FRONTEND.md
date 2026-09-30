# Изменения для фронтенда — что и где менять

## Архитектура: Display отдельно, Inference отдельно

### Суть
Бэкенд теперь работает по схеме: **3 независимых потока на каждую камеру**

```
CaptureWorker (поток)  →  FrameBuffer   →  MJPEG stream (async)
                              ↓
InferenceWorker (поток) →  ResultBuffer  →  WebSocket broadcast (async)
```

- **MJPEG stream** (`<img>`) — обновляется на скорости capture (25 FPS)
- **WebSocket** — шлёт JSON с детекциями из ResultBuffer (~10 раз/сек)
- **Canvas overlay** — рисует bbox/имена поверх видео на 30 FPS через requestAnimationFrame

Дисплей НИКОГДА не ждёт инференс. Видео плавное, оверлей обновляется независимо.

---

## Бэкенд — что изменилось

### 1. `api/streaming.py` — ПОЛНОСТЬЮ ПЕРЕПИСАН

**Было:** один async генератор, который читает кадр + детектит + отдаёт MJPEG в одном цикле.

**Стало:** 3 независимых компонента:
- `FrameBuffer` — потокобезопасный буфер последнего кадра
- `ResultBuffer` — потокобезопасный буфер результата инференса (faces, fps, resolution)
- `CaptureWorker(Thread)` — читает видео/RTSP в FrameBuffer на своей скорости
- `InferenceWorker(Thread)` — берёт кадр из FrameBuffer, детектит каждые N кадров, пишет в ResultBuffer
- `generate_mjpeg()` — async, читает из FrameBuffer, отдаёт JPEG на STREAM_FPS
- `broadcast_loop()` — async, читает из ResultBuffer, шлёт JSON в WebSocket

**WebSocket формат сообщения теперь включает два FPS:**
```json
{
  "type": "faces",
  "camera_id": "camera-1",
  "faces": [...],
  "fps": 23,              // INF FPS — скорость инференса
  "capture_fps": 60,      // CAP FPS — скорость захвата кадров
  "resolution": {"width": 1280, "height": 720},
  "timestamp": "..."
}
```

### 2. `api/engine.py` — переписан на TRT

**Было:** InsightFace ONNX (det_10g + w600k_r50) — медленно (~3-4 FPS)

**Стало:** YOLOv8-face TRT + ArcFace TRT — быстро (~20+ FPS)
- `detect_faces(frame)` — YOLOv8-face TRT, возвращает bbox + landmarks
- `get_embeddings_batch(frame, faces)` — ArcFace TRT batch, возвращает 512-dim embeddings
- `get(frame)` — совместимый с InsightFace API (detect + embed в одном вызове)
- `_gpu_lock` — threading.Lock для сериализации GPU доступа между камерами
- `recognize_face(embedding)` — vectorized cosine similarity

---

## Фронтенд — что менять

### 1. `store/attendanceStore.ts`
Добавить `group?` в `Person`:
```ts
export interface Person {
  id: string
  name: string
  role: 'student' | 'teacher'
  photoUrl?: string
  group?: string         // <-- ДОБАВИТЬ
}
```

### 2. `components/FaceRecognitionOverlay.tsx` — ПОЛНОСТЬЮ ПЕРЕПИСАТЬ

**Было:** React `<div>` с CSS позиционированием. Каждое обновление = ререндер React.

**Стало:** HTML `<canvas>` с `requestAnimationFrame`. Читает из `useRef`, **ноль ререндеров**.

Ключевые моменты:
- `canvasRef` + `facesRef` + `resolutionRef`
- `useEffect` запускает `requestAnimationFrame` цикл на 30fps
- DPI-aware (devicePixelRatio для Retina)
- Рисует: bbox рамка + уголки (corners) + лейбл с именем и confidence%
- Цвет: зелёный для teacher, синий для student

```tsx
// Пропсы не меняются — тот же интерфейс
<FaceRecognitionOverlay faces={facesRef.current} resolution={resolutionRef.current} />
```

### 3. `components/CameraFeed.tsx` — оптимизировать

**Ключевое изменение:** faces и resolution хранятся в `useRef`, не в `useState`.

```tsx
// Refs для canvas (без ререндера)
const facesRef = useRef<IdentifiedFace[]>([])
const resolutionRef = useRef({ width: 0, height: 0 })

// UI stats — с throttle (max 2 раза/сек)
const [infFps, setInfFps] = useState(0)
const [capFps, setCapFps] = useState(0)
const lastUiUpdateRef = useRef(0)
```

В `ws.onmessage`:
```tsx
if (message.type === 'faces') {
  // Refs обновляются мгновенно — canvas подхватит на следующем кадре
  if (message.faces) {
    facesRef.current = message.faces
    setDetectedFaces(cameraId, message.faces)  // для store (таблица посещаемости)
  }
  if (message.resolution) {
    resolutionRef.current = message.resolution
  }

  // UI обновляется с throttle — max 2 раза/сек
  const now = Date.now()
  if (now - lastUiUpdateRef.current > 500) {
    lastUiUpdateRef.current = now
    if (message.faces) setFacesCount(message.faces.length)
    if (message.fps !== undefined) setInfFps(message.fps)
    if (message.capture_fps !== undefined) setCapFps(message.capture_fps)
    if (message.resolution) setResolution(message.resolution)
  }
}
```

Отображение двух FPS:
```tsx
{infFps > 0 && (
  <div className="px-2.5 py-1 rounded-full bg-black/50 text-white/90 backdrop-blur-md">
    <span className="text-xs font-mono">INF {infFps}</span>
  </div>
)}
{capFps > 0 && (
  <div className="px-2.5 py-1 rounded-full bg-black/50 text-white/90 backdrop-blur-md">
    <span className="text-xs font-mono">CAP {capFps}</span>
  </div>
)}
```

### 4. `components/CameraTile.tsx`

Заменить `fps` на `infFps` + `capFps`:
```tsx
const [infFps, setInfFps] = useState(0)
const [capFps, setCapFps] = useState(0)

// В ws.onmessage:
if (message.fps !== undefined) setInfFps(message.fps)
if (message.capture_fps !== undefined) setCapFps(message.capture_fps)

// В JSX:
<span className="text-[10px] font-mono text-white">INF {infFps} CAP {capFps}</span>
```

### 5. `components/ExpandedView.tsx`

То же самое — заменить один `fps` на два:
```tsx
const [infFps, setInfFps] = useState(0)
const [capFps, setCapFps] = useState(0)

// В ws.onmessage:
if (message.fps !== undefined) setInfFps(message.fps)
if (message.capture_fps !== undefined) setCapFps(message.capture_fps)

// В JSX — два отдельных бейджа:
{streamLoaded && infFps > 0 && (
  <div className="..."><span>INF {infFps}</span></div>
)}
{streamLoaded && capFps > 0 && (
  <div className="..."><span>CAP {capFps}</span></div>
)}
```

### 6. `services/api.ts`

Фикс: `params` теперь передаётся в запрос:
```ts
const params = group ? `?group=${group}` : ''
return apiRequest<...>(`/attendance/stats${params}`)  // было без ${params}
```

---

## Почему это работает без лагов

| Компонент | Скорость | Блокирует? |
|-----------|----------|-----------|
| MJPEG `<img>` | 25 FPS (capture) | Нет — браузер обновляет сам |
| WebSocket JSON | ~10 msg/sec | Нет — ref обновляется мгновенно |
| Canvas overlay | 30 FPS (rAF) | Нет — читает ref, не ждёт WS |
| UI counters | 2 updates/sec | Нет — throttled setState |

**До:** каждое WS сообщение → 3-4 setState → React ререндер → DOM перестроение → лаг
**После:** WS → ref (0мс) → canvas рисует на следующем кадре (16мс) → плавно

---

## Список изменённых файлов фронтенда

| Файл | Что изменилось |
|------|---------------|
| `store/attendanceStore.ts` | +`group?` в Person interface |
| `components/FaceRecognitionOverlay.tsx` | **Полностью переписан** на canvas + rAF |
| `components/CameraFeed.tsx` | faces/resolution в ref, throttled setState, два FPS |
| `components/CameraTile.tsx` | infFps + capFps вместо fps |
| `components/ExpandedView.tsx` | infFps + capFps вместо fps |
| `services/api.ts` | Фикс params в getAttendanceStats |
| `pages/Enrollment.tsx` | Фикс TS ошибки `_completed` |
| `components/CalendarView.tsx` | Фикс `day` → `selectedDay` |
| `components/TrendChart.tsx` | Удалён неиспользуемый `total`, `_entry` → `entry` |
| `pages/Dashboard.tsx` | Удалён неиспользуемый импорт `X` |
