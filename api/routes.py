# -*- coding: UTF-8 -*-
"""API routes for face recognition system."""
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional
import numpy as np
import cv2
import uuid
import torch

from fastapi import APIRouter, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from config import DATABASE_PATH, DEVICE
from .models import (
    PersonCreate, PersonResponse, AttendanceRecord, AttendanceStats,
    SessionCreate, SessionResponse, CameraConfig, CameraTest, DatabaseSelect,
    EnrollmentStart, EnrollmentStatus
)
from .database import db
from .engine import engine
from .streaming import generate_mjpeg, subscribe, unsubscribe, get_latest_faces, get_backend_info
from .enrollment import (
    create_session as create_enrollment_session,
    get_session as get_enrollment_session,
    cancel_session as cancel_enrollment_session,
    complete_enrollment,
    process_enrollment_frame,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============== PERSONS ENDPOINTS ==============

@router.get("/api/persons", response_model=List[PersonResponse])
async def get_persons(role: Optional[str] = None, group: Optional[str] = None):
    """Get all persons, optionally filtered by role and/or group"""
    persons = list(db.persons.values())
    if role:
        persons = [p for p in persons if p['role'] == role]
    if group:
        persons = [p for p in persons if p.get('group') == group]
    return persons


@router.post("/api/persons", response_model=PersonResponse)
async def add_person(person: PersonCreate):
    """Add a new person"""
    person_id = str(uuid.uuid4())[:8]
    new_person = {
        'id': person_id,
        'name': person.name,
        'role': person.role,
        'photo_url': None,
        'has_face_encoding': False,
        'registered_at': datetime.now().isoformat()
    }
    db.persons[person_id] = new_person
    return new_person


@router.delete("/api/persons/{person_id}")
async def delete_person(person_id: str):
    """Delete a person"""
    if person_id not in db.persons:
        raise HTTPException(status_code=404, detail="Person not found")

    del db.persons[person_id]
    if person_id in db.face_database:
        del db.face_database[person_id]
    db.save_face_database()
    return {"success": True}


@router.post("/api/persons/{person_id}/faces")
async def upload_face_images(person_id: str, images: List[UploadFile] = File(...)):
    """Upload face images for a person"""
    if person_id not in db.persons:
        raise HTTPException(status_code=404, detail="Person not found")

    engine.initialize()
    embeddings = []

    for image_file in images:
        try:
            contents = await image_file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is not None:
                embedding = engine.get_embedding(img)
                if embedding is not None:
                    embeddings.append(embedding)
        except Exception as e:
            logger.error(f"Error processing image: {e}")

    if embeddings:
        db.face_database[person_id] = np.array(embeddings)
        db.persons[person_id]['has_face_encoding'] = True
        db.save_face_database()
        return {"success": True, "message": f"Тіркелді: {len(embeddings)} бет"}

    raise HTTPException(status_code=400, detail="No valid faces found in images")


# ============== ATTENDANCE ENDPOINTS ==============

@router.get("/api/attendance", response_model=List[AttendanceRecord])
async def get_attendance(group: Optional[str] = None):
    """Get attendance records including absent students (in persons but not detected)"""
    records = list(db.attendance.values())

    # Add absent students — they are in persons but never detected by camera
    attended_ids = set(db.attendance.keys())
    for person in db.persons.values():
        if person['role'] == 'student' and person['id'] not in attended_ids:
            records.append({
                'id': f"absent-{person['id']}",
                'person_id': person['id'],
                'name': person['name'],
                'role': 'student',
                'status': 'absent',
                'timestamp': datetime.now().isoformat(),
                'confidence': 0.0,
                'camera_id': None,
                'group': person.get('group'),
            })

    if group:
        records = [r for r in records if r.get('group') == group]
    return records


@router.get("/api/attendance/stats", response_model=AttendanceStats)
async def get_attendance_stats(group: Optional[str] = None):
    """Get attendance statistics, optionally filtered by group (418 or 428)"""
    all_students = [p for p in db.persons.values() if p['role'] == 'student']
    if group:
        all_students = [p for p in all_students if p.get('group') == group]
    total_students = len(all_students)

    attended = [a for a in db.attendance.values() if a['role'] == 'student']
    if group:
        attended = [a for a in attended if a.get('group') == group]

    return {
        'total': total_students,
        'present': len([s for s in attended if s['status'] == 'present']),
        'late': len([s for s in attended if s['status'] == 'late']),
        'absent': total_students - len(attended),
        'teacher_present': any(a['role'] == 'teacher' for a in db.attendance.values()),
        'group': group
    }


# ============== SESSION ENDPOINTS ==============

@router.get("/api/session/current")
async def get_current_session():
    """Get current active session"""
    if db.current_session and db.current_session in db.sessions:
        return db.sessions[db.current_session]
    return None


@router.post("/api/session/start", response_model=SessionResponse)
async def start_session(session: SessionCreate):
    """Start a new session"""
    session_id = str(uuid.uuid4())[:8]
    new_session = {
        'id': session_id,
        'name': session.name,
        'course_code': session.course_code,
        'start_time': datetime.now().isoformat(),
        'end_time': (datetime.now().replace(hour=datetime.now().hour + 1, minute=30)).isoformat(),
        'status': 'active'
    }
    db.sessions[session_id] = new_session
    db.current_session = session_id
    db.attendance.clear()
    return new_session


@router.post("/api/session/end")
async def end_session():
    """End current session"""
    if db.current_session and db.current_session in db.sessions:
        db.sessions[db.current_session]['status'] = 'completed'
        db.current_session = None
    return {"success": True}


# ============== EVENTS ENDPOINTS ==============

@router.get("/api/events")
async def get_events(limit: int = 10):
    """Get recent attendance events"""
    return db.events[-limit:][::-1]


# ============== CAMERA ENDPOINTS ==============

@router.get("/api/cameras", response_model=List[CameraConfig])
async def get_cameras():
    """Get camera configurations"""
    return list(db.cameras.values())


@router.put("/api/cameras/{camera_id}")
async def update_camera(camera_id: str, config: CameraConfig):
    """Update camera configuration"""
    db.cameras[camera_id] = config.model_dump()
    return {"success": True}


@router.post("/api/cameras/test")
async def test_camera(config: CameraTest):
    """Test camera connection"""
    try:
        cap = cv2.VideoCapture(config.source)
        if cap.isOpened():
            ret, _ = cap.read()
            cap.release()
            if ret:
                return {"success": True, "message": "Камера қосылды"}
        return {"success": False, "message": "Камераға қосылу мүмкін емес"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ============== MJPEG STREAM ==============

@router.get("/api/stream/{camera_id}")
async def mjpeg_stream(camera_id: str):
    """MJPEG video stream endpoint"""
    camera = db.cameras.get(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    return StreamingResponse(
        generate_mjpeg(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ============== WEBSOCKET FOR FACE DATA ==============

@router.websocket("/ws/camera/{camera_id}")
async def camera_websocket(websocket: WebSocket, camera_id: str):
    """WebSocket endpoint for face detection metadata only"""
    await websocket.accept()
    logger.info(f"Camera {camera_id} WebSocket connected (faces only)")

    camera = db.cameras.get(camera_id)
    if not camera:
        await websocket.send_json({"type": "status", "camera_id": camera_id, "status": "error", "message": "Camera not found"})
        await websocket.close()
        return

    # Subscribe to face updates
    subscribe(camera_id, websocket)

    await websocket.send_json({"type": "status", "camera_id": camera_id, "status": "connected"})

    # Send latest faces if available
    latest = get_latest_faces(camera_id)
    if latest:
        await websocket.send_json({
            "type": "faces",
            "camera_id": camera_id,
            "faces": latest,
            "timestamp": datetime.now().isoformat()
        })

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        logger.info(f"Camera {camera_id} WebSocket disconnected")
    except Exception:
        pass
    finally:
        unsubscribe(camera_id, websocket)


# ============== DATABASE MANAGEMENT ==============

@router.get("/api/databases")
async def list_databases():
    """List available database files"""
    databases = []
    for pkl_file in Path(".").glob("*.pkl"):
        try:
            data = torch.load(pkl_file, map_location='cpu', weights_only=False)
            if 'zs' in data:
                count = len(np.unique(data['idxs'].numpy()))
                names_count = len(data.get('names', {}))
                databases.append({
                    'path': pkl_file.name,
                    'persons': count,
                    'names': names_count,
                    'size_kb': pkl_file.stat().st_size / 1024,
                    'current': pkl_file.name == DATABASE_PATH
                })
        except:
            pass
    return databases


@router.post("/api/databases/select")
async def select_database(config: DatabaseSelect):
    """Switch to a different database"""
    db_path = Path(config.path)
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Database not found")

    db.persons.clear()
    db.face_database.clear()
    db.attendance.clear()

    import config as cfg
    cfg.DATABASE_PATH = config.path
    db._load_face_database()

    return {
        "success": True,
        "message": f"Switched to {config.path}",
        "persons_count": len(db.persons)
    }


# ============== ENROLLMENT ENDPOINTS ==============

@router.post("/api/enrollment/start", response_model=EnrollmentStatus)
async def start_enrollment(data: EnrollmentStart):
    """Start a new enrollment session"""
    session = create_enrollment_session(data.name, data.role)
    return session.to_dict()


@router.get("/api/enrollment/{session_id}", response_model=EnrollmentStatus)
async def get_enrollment(session_id: str):
    """Get enrollment session status"""
    session = get_enrollment_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Enrollment session not found")
    return session.to_dict()


@router.delete("/api/enrollment/{session_id}")
async def delete_enrollment(session_id: str):
    """Cancel and cleanup an enrollment session"""
    if cancel_enrollment_session(session_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Enrollment session not found")


@router.post("/api/enrollment/{session_id}/complete")
async def finalize_enrollment(session_id: str):
    """Complete enrollment: generate embeddings and save to DB"""
    session = get_enrollment_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Enrollment session not found")

    result = complete_enrollment(session)
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    return result


@router.websocket("/ws/enrollment/{session_id}")
async def enrollment_websocket(websocket: WebSocket, session_id: str):
    """WebSocket for real-time enrollment frame processing.

    Client sends: binary JPEG frame data
    Server responds: JSON with detection results and enrollment progress
    """
    await websocket.accept()

    session = get_enrollment_session(session_id)
    if not session:
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        return

    logger.info(f"Enrollment WebSocket connected for session {session_id}")
    await websocket.send_json({
        "type": "connected",
        **session.to_dict(),
    })

    try:
        while True:
            # Receive binary JPEG frame
            data = await websocket.receive_bytes()

            # Decode JPEG to numpy array
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json({"error": "Invalid frame"})
                continue

            # Process frame
            result = process_enrollment_frame(session, frame)
            await websocket.send_json(result)

            if result.get('completed'):
                await asyncio.sleep(0.5)
                await websocket.close(1000, "Enrollment complete")
                return

    except WebSocketDisconnect:
        logger.info(f"Enrollment WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"Enrollment WebSocket error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass


# ============== HEALTH CHECK ==============

@router.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "device": DEVICE,
        "database": DATABASE_PATH,
        "persons_count": len(db.persons),
        "has_face_database": len(db.face_database) > 0,
        "video_backends": get_backend_info()
    }
