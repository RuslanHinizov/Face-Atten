# -*- coding: UTF-8 -*-
"""Database manager for face recognition system."""
import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
import numpy as np
import torch
import uuid

from config import DATABASE_PATH, BASE_DIR, RTSP_CAMERAS

logger = logging.getLogger(__name__)


class DatabaseManager:
    def __init__(self):
        self.persons: Dict[str, dict] = {}
        self.attendance: Dict[str, dict] = {}
        self.sessions: Dict[str, dict] = {}
        self.cameras: Dict[str, dict] = {}
        self.events: List[dict] = []
        self.face_database: Dict[str, np.ndarray] = {}
        self.current_session: Optional[str] = None

        self._load_face_database()
        self._init_default_cameras()

    def _load_face_database(self):
        """Load face embeddings from database.pkl (torch format)"""
        if Path(DATABASE_PATH).exists():
            try:
                data = torch.load(DATABASE_PATH, map_location='cpu', weights_only=False)

                if isinstance(data, dict) and 'zs' in data and 'idxs' in data:
                    embeddings = data['zs'].numpy() if hasattr(data['zs'], 'numpy') else np.array(data['zs'])
                    indices = data['idxs'].numpy() if hasattr(data['idxs'], 'numpy') else np.array(data['idxs'])
                    names_map = data.get('names', {})
                    id_list = data.get('id_list')  # Multi-folder format

                    # Group by class index
                    unique_classes = np.unique(indices)
                    for class_idx in unique_classes:
                        # Determine person_id based on format
                        if id_list:
                            person_id = id_list[class_idx]
                        else:
                            person_id = str(class_idx + 1)

                        mask = indices == class_idx
                        class_embeddings = embeddings[mask]
                        name = names_map.get(person_id, person_id)

                        # Derive group from person_id prefix
                        if str(person_id).startswith('418'):
                            group = '418'
                        elif str(person_id).startswith('428'):
                            group = '428'
                        else:
                            group = 'unknown'

                        self.persons[person_id] = {
                            'id': person_id,
                            'name': name,
                            'role': 'student',
                            'group': group,
                            'photo_url': None,
                            'has_face_encoding': True,
                            'registered_at': datetime.now().isoformat()
                        }
                        self.face_database[person_id] = class_embeddings

                    logger.info(f"Loaded {len(self.persons)} persons with {len(names_map)} names from database.pkl")
                else:
                    # Legacy dict format
                    for name, embs in data.items():
                        person_id = str(uuid.uuid4())[:8]
                        self.persons[person_id] = {
                            'id': person_id,
                            'name': name,
                            'role': 'teacher' if 'teacher' in name.lower() else 'student',
                            'photo_url': None,
                            'has_face_encoding': True,
                            'registered_at': datetime.now().isoformat()
                        }
                        if isinstance(embs, torch.Tensor):
                            self.face_database[person_id] = embs.numpy()
                        elif isinstance(embs, np.ndarray):
                            self.face_database[person_id] = embs
                    logger.info(f"Loaded {len(self.persons)} persons from database.pkl (dict format)")
            except Exception as e:
                logger.error(f"Error loading database: {e}")

    def _init_default_cameras(self):
        """Initialize camera configurations from config.py

        Supported source types:
        - RTSP: rtsp://user:pass@ip:port/stream
        - Video file: /path/to/video.mp4
        - Webcam: 0, 1, 2 (device index)
        """
        self.cameras = {}

        # Load cameras from config.py RTSP_CAMERAS
        for camera_id, camera_config in RTSP_CAMERAS.items():
            url = camera_config.get('url', '')
            camera_type = 'rtsp' if url.startswith('rtsp://') else 'video'

            self.cameras[camera_id] = {
                'camera_id': camera_id,
                'name': camera_config.get('name', camera_id),
                'source': url,
                'type': camera_type,
                'enabled': True
            }

        logger.info(f"Loaded {len(self.cameras)} cameras from config")

    def save_face_database(self):
        """Save face embeddings to database.pkl (torch format with id_list)"""
        all_embeddings = []
        all_indices = []
        id_list = []
        names_map = {}

        for idx, (person_id, embeddings) in enumerate(self.face_database.items()):
            id_list.append(person_id)
            person = self.persons.get(person_id, {})
            names_map[person_id] = person.get('name', person_id)

            if isinstance(embeddings, np.ndarray):
                for emb in embeddings:
                    all_embeddings.append(emb)
                    all_indices.append(idx)

        if all_embeddings:
            os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
            data = {
                'zs': torch.tensor(np.array(all_embeddings), dtype=torch.float32),
                'idxs': torch.tensor(all_indices, dtype=torch.long),
                'id_list': id_list,
                'names': names_map,
            }
            torch.save(data, DATABASE_PATH)
            logger.info(f"Saved {len(all_embeddings)} embeddings for {len(self.face_database)} persons")


# Singleton instance
db = DatabaseManager()
