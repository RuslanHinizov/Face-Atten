# -*- coding: UTF-8 -*-
"""
FastAPI Backend for Face Recognition System.

Usage:
    cd yolov5-face && python -m api.api_server
    or: python -m uvicorn api.api_server:app --host 0.0.0.0 --port 8000
"""
import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Suppress logs before imports
os.environ['ONNXRUNTIME_LOG_LEVEL'] = '3'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import warnings
warnings.filterwarnings('ignore')

try:
    import onnxruntime
    onnxruntime.set_default_logger_severity(3)
except:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .routes import router
from .database import db

# ============== LOGGING ==============
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============== FASTAPI APP ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Face Recognition API Server...")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="Face Recognition API",
    description="API for face detection and recognition system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routes
app.include_router(router)

# Serve presentation.html
@app.get("/presentation")
@app.get("/presentation.html")
async def presentation():
    p = Path(__file__).parent.parent / "presentation.html"
    return FileResponse(str(p), media_type="text/html")

# Serve video files for presentation
@app.get("/video/demo")
async def video_demo():
    p = Path(__file__).parent.parent / "20260326-0918-48.6758933.mp4"
    return FileResponse(str(p), media_type="video/mp4")

@app.get("/video/418")
async def video_418():
    p = Path(__file__).parent.parent / "data/videos/Гл._418_Аудитория_20260115120000_20260115120713_272742572.mp4"
    return FileResponse(str(p), media_type="video/mp4")

@app.get("/video/428")
async def video_428():
    p = Path(__file__).parent.parent / "data/videos/Гл._428_Аудитория_20260115121652_20260115123658_272740919.mp4"
    return FileResponse(str(p), media_type="video/mp4")

@app.get("/video/screen")
async def video_screen():
    p = Path(__file__).parent.parent / "Screen Recording 2026-03-26 142633.mp4"
    return FileResponse(str(p), media_type="video/mp4")


# ============== MAIN ==============

if __name__ == "__main__":
    import uvicorn
    import argparse

    parser = argparse.ArgumentParser(description='Face Recognition API Server')
    parser.add_argument('--db', type=str, default=None, help='Database file (.pkl)')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host')
    parser.add_argument('--port', type=int, default=8000, help='Port')
    args = parser.parse_args()

    if args.db:
        import config as cfg
        cfg.DATABASE_PATH = args.db
        db.persons.clear()
        db.face_database.clear()
        db._load_face_database()
        logger.info(f"Using database: {args.db}")

    uvicorn.run(app, host=args.host, port=args.port)
