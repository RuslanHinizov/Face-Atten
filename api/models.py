# -*- coding: UTF-8 -*-
"""Pydantic models for API requests/responses."""
from typing import Optional, List
from pydantic import BaseModel


class PersonCreate(BaseModel):
    name: str
    role: str = "student"


class PersonResponse(BaseModel):
    id: str
    name: str
    role: str
    group: Optional[str] = None
    photo_url: Optional[str] = None
    has_face_encoding: bool = False
    registered_at: str


class AttendanceRecord(BaseModel):
    id: str
    person_id: str
    name: str
    role: str
    status: str  # present, late, absent
    timestamp: str
    confidence: float
    camera_id: Optional[str] = None
    group: Optional[str] = None


class AttendanceStats(BaseModel):
    total: int
    present: int
    late: int
    absent: int
    teacher_present: bool
    group: Optional[str] = None


class SessionCreate(BaseModel):
    name: str
    course_code: str


class SessionResponse(BaseModel):
    id: str
    name: str
    course_code: str
    start_time: str
    end_time: str
    status: str  # scheduled, active, completed


class CameraConfig(BaseModel):
    camera_id: str
    name: str
    source: str
    type: str  # rtsp, webcam, video
    enabled: bool


class CameraTest(BaseModel):
    source: str


class DatabaseSelect(BaseModel):
    path: str


class EnrollmentStart(BaseModel):
    name: str
    role: str = "student"


class EnrollmentStatus(BaseModel):
    session_id: str
    person_name: str
    current_stage: int
    total_stages: int
    stages_completed: List[str]
    status: str  # 'in_progress' | 'completed' | 'cancelled'
