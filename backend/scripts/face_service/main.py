"""
backend/scripts/face_service/main.py

Face Recognition microservice — runs on port 8000.
Wraps train_faces.py, process_student.py, and recognize.py logic as HTTP endpoints.

Resource-aware build for m7iflex.large (2 vCPU / 8 GB RAM):
  - Global inference semaphore: only 1 heavy ONNX call at a time
  - _detect_multiscale: tries variants lazily (only if first pass finds nothing)
  - Training augmentation: capped at 2 passes; skipped when RAM < 1500 MB free
  - All heavy endpoints: asyncio timeout (60s process-student, 300s train, 120s recognize)
  - Uvicorn: 1 worker, backlog 64 (set in __main__ block and start command)

Start with:
    uvicorn backend.scripts.face_service.main:app --port 8000 --workers 1
"""

import asyncio
import logging
import os
import pickle
import shutil
import sys
import time
from contextlib import asynccontextmanager
from functools import wraps

import cv2
import numpy as np
import psutil
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
from backend.common.metrics import (
    FACE_MODEL_LOAD_DURATION_SECONDS,
    FACE_MODEL_LOAD_TOTAL,
    FACE_PHOTOS_OP_DURATION_SECONDS,
    FACE_PHOTOS_OPS_TOTAL,
    FACE_PROCESS_STUDENT_OP_DURATION_SECONDS,
    FACE_PROCESS_STUDENT_OPS_TOTAL,
    FACE_RECOGNIZE_CONFIDENCE,
    FACE_RECOGNIZE_FACES_DETECTED_TOTAL,
    FACE_RECOGNIZE_FRAMES_PROCESSED_TOTAL,
    FACE_RECOGNIZE_OP_DURATION_SECONDS,
    FACE_RECOGNIZE_OPS_TOTAL,
    FACE_RECOGNIZE_STUDENTS_MATCHED_TOTAL,
    FACE_TRAIN_DB_UPDATE_TOTAL,
    FACE_TRAIN_IMAGES_PROCESSED_TOTAL,
    FACE_TRAIN_OP_DURATION_SECONDS,
    FACE_TRAIN_OPS_TOTAL,
    FACE_TRAIN_STUDENTS_PROCESSED_TOTAL,
    FACE_UNHANDLED_ERRORS_TOTAL,
)

logger = logging.getLogger(__name__)
logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(levelname)s: %(message)s")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR        = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
DATASET_PATH    = os.path.join(BASE_DIR, "backend", "dataset")
OUTPUT_FOLDER   = os.path.join(BASE_DIR, "backend", "output")
EMBEDDINGS_FILE = os.path.join(BASE_DIR, "backend", "face_embeddings.pkl")

# ---------------------------------------------------------------------------
# Resource limits — hardcoded for m7iflex.large (2 vCPU / 8 GB RAM)
# ---------------------------------------------------------------------------
# Only 1 ONNX inference at a time — prevents thrashing on 2 vCPUs.
_INFERENCE_SEM = asyncio.Semaphore(1)

# Endpoint timeouts (seconds).
_TIMEOUT_PROCESS_STUDENT = 60
_TIMEOUT_TRAIN           = 300
_TIMEOUT_RECOGNIZE       = 120

# Skip augmentation when free RAM drops below this (MB).
_MIN_FREE_RAM_MB = 1500

# Max augmentation rounds per image.
_MAX_AUG_ROUNDS = 2

# ---------------------------------------------------------------------------
# Lazy model loader — loads exactly once, protected by an asyncio lock
# ---------------------------------------------------------------------------
_face_app   = None
_model_lock = asyncio.Lock()


async def get_face_app_async():
    """Async wrapper: acquires lock then calls the sync loader in a thread."""
    global _face_app
    if _face_app is not None:
        return _face_app
    async with _model_lock:
        if _face_app is not None:
            return _face_app
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _load_face_app)
    return _face_app


def get_face_app():
    """Sync accessor — call only from sync code that already holds the semaphore."""
    global _face_app
    if _face_app is None:
        _load_face_app()
    return _face_app


def _load_face_app():
    global _face_app
    t0 = time.perf_counter()
    try:
        from insightface.app import FaceAnalysis
        # det_size=(320,320) vs (640,640):
        #   - cuts ONNX memory ~1.5 GB → ~600 MB
        #   - cuts per-inference time ~4×
        #   - negligible accuracy loss for classroom photos ≥ 720p
        fa = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        fa.prepare(ctx_id=0, det_size=(320, 320))
        _face_app = fa
        FACE_MODEL_LOAD_TOTAL.labels(status="success").inc()
        ram_free = psutil.virtual_memory().available / 1024**2
        logger.info(f"InsightFace loaded (det_size=320). Free RAM: {ram_free:.0f} MB")
    except Exception:
        FACE_MODEL_LOAD_TOTAL.labels(status="error").inc()
        raise
    finally:
        FACE_MODEL_LOAD_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Lifespan — pre-warm model on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await get_face_app_async()
    except Exception as e:
        logger.warning(f"Could not pre-warm face model: {e}")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Face Recognition Service",
    description="Handles student photo processing, model training, and face recognition.",
    version="1.0.0",
    lifespan=lifespan,
)

Instrumentator(
    should_group_status_codes=False,
    excluded_handlers=["/health", "/metrics"],
).instrument(app).expose(app, include_in_schema=False)

_frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_url, "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers — timeout decorator
# ---------------------------------------------------------------------------
def with_timeout(seconds: int):
    """Wraps an async function with asyncio.wait_for; raises 503 on timeout."""
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            try:
                return await asyncio.wait_for(fn(*args, **kwargs), timeout=seconds)
            except asyncio.TimeoutError:
                endpoint = fn.__name__
                logger.error(f"{endpoint} timed out after {seconds}s")
                FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint=f"/{endpoint}").inc()
                raise HTTPException(
                    status_code=503,
                    detail=f"Request timed out after {seconds}s. The server is under load — retry shortly.",
                )
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Image preprocessing helpers
# ---------------------------------------------------------------------------

def _clahe_enhance(img_bgr: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l_chan, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    lab_eq = cv2.merge([clahe.apply(l_chan), a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)


def _pil_enhance(img_bgr: np.ndarray) -> np.ndarray:
    try:
        from PIL import Image, ImageEnhance
        pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
        pil = ImageEnhance.Brightness(pil).enhance(1.3)
        pil = ImageEnhance.Contrast(pil).enhance(1.6)
        pil = ImageEnhance.Sharpness(pil).enhance(1.5)
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception:
        return img_bgr


def _detect_once(img_rgb: np.ndarray) -> list:
    """Single-pass detection. Caller holds _INFERENCE_SEM."""
    fa = get_face_app()
    try:
        return fa.get(img_rgb) or []
    except Exception as e:
        logger.debug(f"Detection error: {e}")
        return []


def _detect_multiscale(img_rgb: np.ndarray) -> list:
    """
    Lazy multi-variant detection — stops as soon as any pass finds faces:
      1. Original image (cheapest).
      2. CLAHE-enhanced (only if pass 1 finds nothing).
      3. PIL brightness/contrast boost (only if pass 2 finds nothing).

    Caller MUST already hold _INFERENCE_SEM.
    """
    fa = get_face_app()
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    # Pass 1: original
    faces = fa.get(img_rgb) or []
    if faces:
        return _deduplicate_faces(faces)

    # Pass 2: CLAHE
    try:
        clahe_rgb = cv2.cvtColor(_clahe_enhance(img_bgr), cv2.COLOR_BGR2RGB)
        faces = fa.get(clahe_rgb) or []
    except Exception as e:
        logger.debug(f"CLAHE detection error: {e}")
    if faces:
        return _deduplicate_faces(faces)

    # Pass 3: PIL boost
    try:
        pil_rgb = cv2.cvtColor(_pil_enhance(img_bgr), cv2.COLOR_BGR2RGB)
        faces = fa.get(pil_rgb) or []
    except Exception as e:
        logger.debug(f"PIL detection error: {e}")

    return _deduplicate_faces(faces)


def _deduplicate_faces(faces: list) -> list:
    unique: list = []
    for face in faces:
        b = face.bbox
        overlap = any(
            max(0, min(b[2], u.bbox[2]) - max(b[0], u.bbox[0]))
            * max(0, min(b[3], u.bbox[3]) - max(b[1], u.bbox[1]))
            / min(
                max((b[2]-b[0])*(b[3]-b[1]), 1),
                max((u.bbox[2]-u.bbox[0])*(u.bbox[3]-u.bbox[1]), 1),
            ) > 0.7
            for u in unique
        )
        if not overlap:
            unique.append(face)
    return unique


def _free_ram_mb() -> float:
    return psutil.virtual_memory().available / 1024**2


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health():
    ram = psutil.virtual_memory()
    return {
        "status": "ok",
        "service": "face-recognition",
        "port": 8000,
        "ram_free_mb": round(ram.available / 1024**2, 1),
        "ram_used_pct": ram.percent,
        "model_loaded": _face_app is not None,
    }


# ---------------------------------------------------------------------------
# GET /api/student/{student_id}/photos
# ---------------------------------------------------------------------------
@app.get("/api/student/{student_id}/photos")
async def get_student_photos(student_id: str):
    t0 = time.perf_counter()
    try:
        student_dir = os.path.join(DATASET_PATH, student_id)
        if not os.path.exists(student_dir):
            FACE_PHOTOS_OPS_TOTAL.labels(status="success").inc()
            return {"hasPhotos": False, "photoCount": 0}

        files = [
            f for f in os.listdir(student_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png"))
        ]
        FACE_PHOTOS_OPS_TOTAL.labels(status="success").inc()
        return {"hasPhotos": len(files) > 0, "photoCount": len(files)}
    except HTTPException:
        raise
    except Exception as exc:
        FACE_PHOTOS_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/student/{student_id}/photos").inc()
        logger.exception("get_student_photos error")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        FACE_PHOTOS_OP_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# POST /api/process-student
# ---------------------------------------------------------------------------
@app.post("/api/process-student", tags=["Training"])
@with_timeout(_TIMEOUT_PROCESS_STUDENT)
async def process_student(
    studentId: str = Form(...),
    front: UploadFile = File(...),
    left:  UploadFile = File(...),
    right: UploadFile = File(...),
):
    """
    Receive 3 photos, verify a face is detectable in each, persist to dataset/.

    The inference semaphore ensures only one ONNX call runs at a time —
    prevents the 8 GB instance from OOM-killing on concurrent uploads.
    """
    t0 = time.perf_counter()

    async def _run():
        student_dir = os.path.join(DATASET_PATH, studentId)
        os.makedirs(student_dir, exist_ok=True)
        results = {}

        for pose, upload in [("front", front), ("left", left), ("right", right)]:
            raw = await upload.read()
            if not raw:
                FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="empty_upload").inc()
                raise HTTPException(
                    status_code=400,
                    detail=f"{pose} photo upload is empty. Please re-select the file.",
                )

            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="decode_error").inc()
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not decode {pose} image. Use JPG or PNG.",
                )

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            face_found = False
            async with _INFERENCE_SEM:
                loop = asyncio.get_event_loop()
                faces = await loop.run_in_executor(None, _detect_multiscale, img_rgb)
                face_found = len(faces) > 0

            # Fallback: mediapipe (lightweight, no semaphore needed)
            if not face_found:
                try:
                    import mediapipe as mp
                    face_mesh = mp.solutions.face_mesh.FaceMesh(
                        static_image_mode=True, max_num_faces=1, refine_landmarks=True
                    )
                    mesh_result = face_mesh.process(img_rgb)
                    face_mesh.close()
                    face_found = bool(mesh_result.multi_face_landmarks)
                except Exception as mp_err:
                    logger.debug(f"mediapipe fallback error for {pose}: {mp_err}")

            if not face_found:
                FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="no_face_detected").inc()
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"No face detected in {pose} photo. "
                        "Ensure good lighting, face the camera clearly, "
                        "and avoid extreme angles or obstructions."
                    ),
                )

            save_path = os.path.join(student_dir, f"{pose}.jpg")
            cv2.imwrite(save_path, img)
            results[pose] = "saved"
            logger.info(f"[process-student] {studentId}/{pose}.jpg saved")

        FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="success").inc()
        return {
            "success": True,
            "studentId": studentId,
            "photos": results,
            "message": "All 3 photos validated and saved successfully",
        }

    try:
        return await _run()
    except HTTPException:
        raise
    except Exception as exc:
        FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/process-student").inc()
        logger.exception("process_student error")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        FACE_PROCESS_STUDENT_OP_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# POST /api/train
# ---------------------------------------------------------------------------
@app.post("/api/train", tags=["Training"])
@with_timeout(_TIMEOUT_TRAIN)
async def train_model():
    """
    Walk dataset/, extract ArcFace embeddings, save face_embeddings.pkl,
    update DB.

    Augmentation is:
      - capped at _MAX_AUG_ROUNDS (2)
      - skipped entirely when free RAM < _MIN_FREE_RAM_MB (1500 MB)
      - skipped when the student already has >= 3 photos (enough data)
    """
    t0 = time.perf_counter()

    async def _run():
        try:
            import albumentations as A
            augmenter = A.Compose([
                A.HorizontalFlip(p=0.5),
                A.Rotate(limit=15, p=0.8),
                A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.8),
                A.GaussianBlur(blur_limit=(3, 5), p=0.3),
            ])
        except ImportError:
            augmenter = None
            logger.warning("albumentations not installed — augmentation disabled")

        if not os.path.exists(DATASET_PATH):
            FACE_TRAIN_OPS_TOTAL.labels(status="no_dataset").inc()
            raise HTTPException(status_code=404, detail="Dataset folder not found")

        student_folders = [
            d for d in os.listdir(DATASET_PATH)
            if os.path.isdir(os.path.join(DATASET_PATH, d))
        ]
        if not student_folders:
            FACE_TRAIN_OPS_TOTAL.labels(status="no_students").inc()
            raise HTTPException(status_code=404, detail="No student folders found in dataset/")

        face_dict: dict[str, np.ndarray] = {}
        total_images = 0

        for folder in sorted(student_folders):
            person_path = os.path.join(DATASET_PATH, folder)
            image_files = [
                f for f in os.listdir(person_path)
                if f.lower().endswith((".jpg", ".jpeg", ".png"))
            ]
            if not image_files:
                logger.warning(f"No images in {folder}, skipping")
                continue

            person_embeddings: list[np.ndarray] = []

            for img_name in image_files:
                img_path = os.path.join(person_path, img_name)
                img = cv2.imread(img_path)
                if img is None:
                    continue
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

                async with _INFERENCE_SEM:
                    loop = asyncio.get_event_loop()
                    faces = await loop.run_in_executor(None, _detect_multiscale, img_rgb)

                if faces:
                    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                    person_embeddings.append(face.normed_embedding)
                    total_images += 1

                # Augmentation — RAM-guarded, capped at _MAX_AUG_ROUNDS (2)
                # Skip if: no augmenter, student already has >= 3 photos,
                # or free RAM is too low to safely run more ONNX passes.
                aug_rounds = min(_MAX_AUG_ROUNDS, max(0, 3 - len(image_files)))
                ram_ok     = _free_ram_mb() >= _MIN_FREE_RAM_MB

                if augmenter is not None and aug_rounds > 0 and ram_ok and faces:
                    fa = get_face_app()
                    for _ in range(aug_rounds):
                        try:
                            aug_img = augmenter(image=img_rgb)["image"]
                            async with _INFERENCE_SEM:
                                loop = asyncio.get_event_loop()
                                aug_faces = await loop.run_in_executor(None, fa.get, aug_img)
                            if aug_faces:
                                f = max(aug_faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                                person_embeddings.append(f.normed_embedding)
                        except Exception:
                            pass
                elif not ram_ok:
                    logger.warning(
                        f"[train] {folder}: skipping augmentation — "
                        f"free RAM {_free_ram_mb():.0f} MB < {_MIN_FREE_RAM_MB} MB"
                    )

            if person_embeddings:
                arr        = np.array(person_embeddings)
                median_emb = np.median(arr, axis=0)
                median_emb = median_emb / np.linalg.norm(median_emb)
                face_dict[folder.lower()] = median_emb
                logger.info(f"[train] {folder}: {len(person_embeddings)} samples → embedding saved")
            else:
                logger.warning(f"[train] {folder}: no faces detected, skipped")

        if not face_dict:
            FACE_TRAIN_OPS_TOTAL.labels(status="no_embeddings").inc()
            raise HTTPException(status_code=422, detail="No valid face embeddings generated")

        with open(EMBEDDINGS_FILE, "wb") as f:
            pickle.dump(face_dict, f)

        FACE_TRAIN_STUDENTS_PROCESSED_TOTAL.inc(len(face_dict))
        FACE_TRAIN_IMAGES_PROCESSED_TOTAL.inc(total_images)

        _update_db_embeddings(face_dict)

        FACE_TRAIN_OPS_TOTAL.labels(status="success").inc()
        return {
            "success": True,
            "studentsTraced": len(face_dict),
            "totalImagesProcessed": total_images,
            "embeddingsFile": EMBEDDINGS_FILE,
            "students": list(face_dict.keys()),
        }

    try:
        return await _run()
    except HTTPException:
        raise
    except Exception as exc:
        FACE_TRAIN_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/train").inc()
        logger.exception("train_model error")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        FACE_TRAIN_OP_DURATION_SECONDS.observe(time.perf_counter() - t0)


def _update_db_embeddings(face_dict: dict):
    """Best-effort DB update — failures are logged, not raised."""
    try:
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv()
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            FACE_TRAIN_DB_UPDATE_TOTAL.labels(status="skipped").inc()
            return
        conn   = psycopg2.connect(database_url)
        cursor = conn.cursor()
        for student_id, embedding in face_dict.items():
            embedding_bytes = embedding.tobytes()
            cursor.execute(
                'UPDATE "Student" SET "faceEmbedding" = %s WHERE id = %s',
                (embedding_bytes, student_id),
            )
            if cursor.rowcount == 0:
                cursor.execute(
                    'UPDATE "Student" SET "faceEmbedding" = %s '
                    'FROM "User" WHERE "Student"."userId" = "User".id AND "User".email LIKE %s',
                    (embedding_bytes, f"{student_id}%"),
                )
        conn.commit()
        cursor.close()
        conn.close()
        FACE_TRAIN_DB_UPDATE_TOTAL.labels(status="success").inc()
        logger.info(f"[train] DB updated for {len(face_dict)} students")
    except Exception as e:
        FACE_TRAIN_DB_UPDATE_TOTAL.labels(status="error").inc()
        logger.warning(f"[train] DB update skipped: {e}")


# ---------------------------------------------------------------------------
# POST /api/recognize
# ---------------------------------------------------------------------------
def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0


@app.post("/api/recognize", tags=["Recognition"])
@with_timeout(_TIMEOUT_RECOGNIZE)
async def recognize_faces(
    courseId: str = Form(...),
    frames: list[UploadFile] = File(...),
    confidence_threshold: float = Form(0.38),
):
    """
    Accept classroom frames, run ArcFace recognition, return matched IDs.

    Frames are decoded and queued; each frame's ONNX inference runs
    serially under _INFERENCE_SEM so we never saturate the 2 vCPUs.
    """
    t0 = time.perf_counter()

    async def _run():
        if not os.path.exists(EMBEDDINGS_FILE):
            FACE_RECOGNIZE_OPS_TOTAL.labels(status="no_model").inc()
            raise HTTPException(
                status_code=404,
                detail="No trained model found. Please run /api/train first.",
            )

        with open(EMBEDDINGS_FILE, "rb") as f:
            known_faces: dict[str, np.ndarray] = pickle.load(f)

        if not known_faces:
            FACE_RECOGNIZE_OPS_TOTAL.labels(status="empty_embeddings").inc()
            raise HTTPException(status_code=422, detail="Trained embeddings file is empty")

        os.makedirs(OUTPUT_FOLDER, exist_ok=True)
        for item in os.listdir(OUTPUT_FOLDER):
            item_path = os.path.join(OUTPUT_FOLDER, item)
            try:
                os.unlink(item_path) if os.path.isfile(item_path) else shutil.rmtree(item_path)
            except Exception:
                pass

        all_detections: list[dict] = []
        total_faces = 0
        recognized_students: set[str] = set()
        confidences: list[float] = []

        for idx, frame_upload in enumerate(frames):
            raw = await frame_upload.read()
            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                logger.warning(f"[recognize] Frame {idx} could not be decoded, skipping")
                continue

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            async with _INFERENCE_SEM:
                loop = asyncio.get_event_loop()
                unique_faces = await loop.run_in_executor(None, _detect_multiscale, img_rgb)

            recognized_in_frame: set[str] = set()
            for face_idx, face in enumerate(unique_faces):
                emb  = face.normed_embedding
                norm = np.linalg.norm(emb)
                if norm == 0:
                    continue
                emb = emb / norm

                best_match, best_sim = None, 0.0
                for name, known_emb in known_faces.items():
                    sim = _cosine_similarity(emb, known_emb)
                    if sim > best_sim and sim > confidence_threshold and name not in recognized_in_frame:
                        best_match, best_sim = name, sim

                bbox = face.bbox.astype(int).tolist()
                all_detections.append({
                    "imageIndex": idx,
                    "faceIndex":  face_idx,
                    "bbox":       bbox,
                    "confidence": float(best_sim),
                    "studentId":  best_match,
                })

                total_faces += 1
                if best_match:
                    recognized_in_frame.add(best_match)
                    recognized_students.add(best_match)
                    confidences.append(best_sim)
                    FACE_RECOGNIZE_CONFIDENCE.observe(best_sim)
                    logger.info(f"[recognize] ✓ {best_match} ({best_sim:.3f}) in frame {idx}")

            # Save annotated image in a background thread (non-blocking)
            loop = asyncio.get_event_loop()
            loop.run_in_executor(
                None,
                _save_annotated,
                img, unique_faces, known_faces,
                f"frame_{idx:03d}.jpg", confidence_threshold, OUTPUT_FOLDER,
            )

        avg_conf = float(np.mean(confidences)) if confidences else 0.0

        FACE_RECOGNIZE_FACES_DETECTED_TOTAL.inc(total_faces)
        FACE_RECOGNIZE_STUDENTS_MATCHED_TOTAL.inc(len(recognized_students))
        FACE_RECOGNIZE_FRAMES_PROCESSED_TOTAL.inc(len(frames))
        FACE_RECOGNIZE_OPS_TOTAL.labels(status="success").inc()

        return {
            "totalFaces":         total_faces,
            "recognizedStudents": list(recognized_students),
            "averageConfidence":  avg_conf,
            "detections":         all_detections,
            "processedImages":    len(frames),
            "courseId":           courseId,
        }

    try:
        return await _run()
    except HTTPException:
        raise
    except Exception as exc:
        FACE_RECOGNIZE_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/recognize").inc()
        logger.exception("recognize_faces error")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        FACE_RECOGNIZE_OP_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_annotated(img, faces, known_faces, filename, threshold, out_dir):
    try:
        from PIL import Image, ImageDraw, ImageFont
        pil  = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil)
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except Exception:
            font = ImageFont.load_default()

        recognized = set()
        for face in faces:
            bbox = face.bbox.astype(int)
            emb  = face.normed_embedding
            norm = np.linalg.norm(emb)
            if norm == 0:
                continue
            emb = emb / norm
            best_match, best_sim = "Unknown", 0.0
            for name, known_emb in known_faces.items():
                sim = _cosine_similarity(emb, known_emb)
                if sim > best_sim and sim > threshold and name not in recognized:
                    best_match, best_sim = name.title(), sim
            if best_match != "Unknown":
                recognized.add(best_match.lower())
            color = "lime" if best_match != "Unknown" else "red"
            draw.rectangle([bbox[0]-1, bbox[1]-1, bbox[2]+1, bbox[3]+1], outline=color, width=3)
            draw.text((bbox[0], max(0, bbox[1]-20)), f"{best_match} {best_sim:.2f}", fill="white", font=font)
        pil.save(os.path.join(out_dir, f"annotated_{filename}"), quality=95)
    except Exception as e:
        logger.debug(f"Annotated image save failed: {e}")


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.scripts.face_service.main:app",
        host="0.0.0.0",
        port=8000,
        workers=1,               # single process — shares asyncio semaphore correctly
        loop="uvloop",           # faster event loop (pip install uvloop)
        limit_concurrency=4,     # queue beyond 4 concurrent requests
        backlog=64,
        timeout_keep_alive=5,
        reload=False,
    )