# -*- coding: UTF-8 -*-
"""Face recognition engine with InsightFace."""
import sys
import logging
from pathlib import Path
from typing import Optional
import numpy as np

from config import (
    DEVICE, RECOGNITION_THRESHOLD,
    YOLO_WEIGHTS, INSIGHTFACE_ROOT, ARCFACE_MODEL, ARCFACE_DET_SIZE
)
from .database import db

logger = logging.getLogger(__name__)


class FaceRecognitionEngine:
    def __init__(self):
        self.yolo_model = None
        self.arcface_model = None
        self._initialized = False

    def initialize(self):
        """Lazy initialization of models"""
        if self._initialized:
            return

        try:
            # Load YOLO
            sys.path.insert(0, str(Path(__file__).parent.parent))
            from models.experimental import attempt_load

            logger.info("Loading YOLO model...")
            self.yolo_model = attempt_load(YOLO_WEIGHTS, map_location=DEVICE)
            self.yolo_model.eval()
            if DEVICE == 'cuda':
                self.yolo_model.half()

            # Load InsightFace
            logger.info("Loading InsightFace model...")
            from insightface.app import FaceAnalysis

            self.arcface_model = FaceAnalysis(
                name=ARCFACE_MODEL,
                root=INSIGHTFACE_ROOT,
                providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
            )
            self.arcface_model.prepare(ctx_id=0 if DEVICE == 'cuda' else -1, det_size=ARCFACE_DET_SIZE)

            self._initialized = True
            logger.info("Face recognition engine initialized")
        except Exception as e:
            logger.error(f"Failed to initialize engine: {e}")

    def get_embedding(self, face_img: np.ndarray) -> Optional[np.ndarray]:
        """Get face embedding from cropped face image"""
        if not self._initialized:
            self.initialize()

        if self.arcface_model is None:
            return None

        try:
            faces = self.arcface_model.get(face_img)
            if faces:
                return faces[0].embedding
        except Exception as e:
            logger.error(f"Embedding error: {e}")
        return None

    def recognize_face(self, embedding: np.ndarray) -> tuple:
        """Recognize face by embedding, returns (person_id, confidence)"""
        if embedding is None:
            return None, 0.0

        best_match = None
        best_sim = 0.0

        for person_id, db_embeddings in db.face_database.items():
            if len(db_embeddings) == 0:
                continue

            if db_embeddings.ndim == 1:
                db_embeddings = db_embeddings.reshape(1, -1)

            # Cosine similarity
            embedding_norm = embedding / np.linalg.norm(embedding)
            for db_emb in db_embeddings:
                db_emb_norm = db_emb / np.linalg.norm(db_emb)
                sim = np.dot(embedding_norm, db_emb_norm)
                if sim > best_sim:
                    best_sim = sim
                    best_match = person_id

        if best_sim >= RECOGNITION_THRESHOLD:
            return best_match, float(best_sim)
        return None, float(best_sim)


# Singleton instance
engine = FaceRecognitionEngine()
