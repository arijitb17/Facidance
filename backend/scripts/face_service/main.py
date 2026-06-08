"""
backend/scripts/face_service/main.py

Face Recognition microservice — runs on port 8000.
Wraps train_faces.py, process_student.py, and recognize.py logic as HTTP endpoints.

Start with:
    uvicorn backend.scripts.face_service.main:app --port 8000 --reload
"""

import logging
import os
import pickle
import shutil
import sys
import time
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

# ---------------------------------------------------------------------------
# Import all metrics from the central registry
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
# Paths  (adjust if your project root differs)
# ---------------------------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
DATASET_PATH    = os.path.join(BASE_DIR, "backend", "dataset")
TEST_FOLDER     = os.path.join(BASE_DIR, "backend", "test-images")
OUTPUT_FOLDER   = os.path.join(BASE_DIR, "backend", "output")
EMBEDDINGS_FILE = os.path.join(BASE_DIR, "backend", "face_embeddings.pkl")


# ---------------------------------------------------------------------------
# Lazy-load InsightFace once at startup (heavy model)
# ---------------------------------------------------------------------------
_face_app = None

def get_face_app():
    global _face_app
    if _face_app is None:
        t0 = time.perf_counter()
        try:
            from insightface.app import FaceAnalysis
            _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            _face_app.prepare(ctx_id=0, det_size=(640, 640))
            FACE_MODEL_LOAD_TOTAL.labels(status="success").inc()
            logger.info("InsightFace model loaded")
        except Exception:
            FACE_MODEL_LOAD_TOTAL.labels(status="error").inc()
            raise
        finally:
            FACE_MODEL_LOAD_DURATION_SECONDS.observe(time.perf_counter() - t0)
    return _face_app


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm model on startup so first request isn't slow
    try:
        get_face_app()
    except Exception as e:
        logger.warning(f"Could not pre-warm face model: {e}")
    yield


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "face-recognition", "port": 8000}


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
        return {
            "hasPhotos": len(files) > 0,
            "photoCount": len(files)
        }
    except HTTPException:
        raise
    except Exception:
        FACE_PHOTOS_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/student/{student_id}/photos").inc()
        raise
    finally:
        FACE_PHOTOS_OP_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# POST /api/process-student
# Saves front/left/right photos for a student and validates faces exist.
# Called by teacher service train_student()
# ---------------------------------------------------------------------------

@app.post("/api/process-student", tags=["Training"])
async def process_student(
    studentId: str = Form(...),
    front: UploadFile = File(...),
    left:  UploadFile = File(...),
    right: UploadFile = File(...),
):
    """
    Receive 3 photos (front, left, right) for a student, verify a face is
    detectable in each, and persist them to dataset/<studentId>/.
    """
    t0 = time.perf_counter()
    try:
        import mediapipe as mp

        student_dir = os.path.join(DATASET_PATH, studentId)
        os.makedirs(student_dir, exist_ok=True)

        face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True, max_num_faces=1, refine_landmarks=True
        )

        results = {}
        for pose, upload in [("front", front), ("left", left), ("right", right)]:
            raw = await upload.read()
            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

            if img is None:
                FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="decode_error").inc()
                raise HTTPException(status_code=400, detail=f"Could not decode {pose} image")

            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mesh_result = face_mesh.process(rgb)

            if not mesh_result.multi_face_landmarks:
                FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="no_face_detected").inc()
                raise HTTPException(
                    status_code=422,
                    detail=f"No face detected in {pose} photo. Please retake with good lighting.",
                )

            save_path = os.path.join(student_dir, f"{pose}.jpg")
            cv2.imwrite(save_path, img)
            results[pose] = "saved"
            logger.info(f"[process-student] {studentId}/{pose}.jpg saved")

        face_mesh.close()

        FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="success").inc()
        return {
            "success": True,
            "studentId": studentId,
            "photos": results,
            "message": "All 3 photos validated and saved successfully",
        }
    except HTTPException:
        raise
    except Exception:
        FACE_PROCESS_STUDENT_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/process-student").inc()
        raise
    finally:
        FACE_PROCESS_STUDENT_OP_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# POST /api/train
# Re-trains the InsightFace embeddings from the full dataset/ directory.
# Called by teacher service run_training()
# ---------------------------------------------------------------------------

@app.post("/api/train", tags=["Training"])
async def train_model():
    """
    Walk dataset/ folder, extract ArcFace embeddings for every student,
    save face_embeddings.pkl, and update the database.
    Mirrors the logic in train_faces.py.
    """
    t0 = time.perf_counter()
    try:
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

        fa = get_face_app()

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

                faces = fa.get(img_rgb)
                if faces:
                    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                    person_embeddings.append(face.normed_embedding)
                    total_images += 1

                # Augmentation
                if augmenter is not None:
                    for _ in range(min(3, max(1, 5 - len(image_files)))):
                        try:
                            aug_img = augmenter(image=img_rgb)["image"]
                            aug_faces = fa.get(aug_img)
                            if aug_faces:
                                f = max(aug_faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                                person_embeddings.append(f.normed_embedding)
                        except Exception:
                            pass

            if person_embeddings:
                arr = np.array(person_embeddings)
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

        # Increment bulk counters
        FACE_TRAIN_STUDENTS_PROCESSED_TOTAL.inc(len(face_dict))
        FACE_TRAIN_IMAGES_PROCESSED_TOTAL.inc(total_images)

        # Optional: update DB embeddings
        _update_db_embeddings(face_dict)

        FACE_TRAIN_OPS_TOTAL.labels(status="success").inc()
        return {
            "success": True,
            "studentsTraced": len(face_dict),
            "totalImagesProcessed": total_images,
            "embeddingsFile": EMBEDDINGS_FILE,
            "students": list(face_dict.keys()),
        }
    except HTTPException:
        raise
    except Exception:
        FACE_TRAIN_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/train").inc()
        raise
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
        conn = psycopg2.connect(database_url)
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
# Run face recognition on one or more uploaded frames.
# Called by teacher service recognize_faces()
# ---------------------------------------------------------------------------

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0


@app.post("/api/recognize", tags=["Recognition"])
async def recognize_faces(
    courseId: str = Form(...),
    frames: list[UploadFile] = File(...),
    confidence_threshold: float = Form(0.45),
):
    """
    Accept classroom frame images, run ArcFace recognition against the
    trained embeddings, and return matched student IDs + confidence scores.
    """
    t0 = time.perf_counter()
    try:
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

        fa = get_face_app()
        os.makedirs(OUTPUT_FOLDER, exist_ok=True)

        # Clear old output
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

            # Try original + brightness-enhanced
            face_candidates: list = []
            for variant in [img, _enhance(img)]:
                try:
                    detected = fa.get(cv2.cvtColor(variant, cv2.COLOR_BGR2RGB))
                    face_candidates.extend(detected)
                except Exception as e:
                    logger.debug(f"Detection error on variant: {e}")

            # Deduplicate overlapping bboxes (IoU > 0.7)
            unique_faces = _deduplicate_faces(face_candidates)

            recognized_in_frame: set[str] = set()
            for face_idx, face in enumerate(unique_faces):
                emb = face.normed_embedding
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
                    "faceIndex": face_idx,
                    "bbox": bbox,
                    "confidence": float(best_sim),
                    "studentId": best_match,
                })

                total_faces += 1
                if best_match:
                    recognized_in_frame.add(best_match)
                    recognized_students.add(best_match)
                    confidences.append(best_sim)
                    FACE_RECOGNIZE_CONFIDENCE.observe(best_sim)
                    logger.info(f"[recognize] ✓ {best_match} ({best_sim:.3f}) in frame {idx}")

            # Save annotated frame
            _save_annotated(img, unique_faces, known_faces, f"frame_{idx:03d}.jpg",
                            confidence_threshold, OUTPUT_FOLDER)

        avg_conf = float(np.mean(confidences)) if confidences else 0.0

        # Bulk counter increments
        FACE_RECOGNIZE_FACES_DETECTED_TOTAL.inc(total_faces)
        FACE_RECOGNIZE_STUDENTS_MATCHED_TOTAL.inc(len(recognized_students))
        FACE_RECOGNIZE_FRAMES_PROCESSED_TOTAL.inc(len(frames))
        FACE_RECOGNIZE_OPS_TOTAL.labels(status="success").inc()

        return {
            "totalFaces": total_faces,
            "recognizedStudents": list(recognized_students),
            "averageConfidence": avg_conf,
            "detections": all_detections,
            "processedImages": len(frames),
            "courseId": courseId,
        }
    except HTTPException:
        raise
    except Exception:
        FACE_RECOGNIZE_OPS_TOTAL.labels(status="error").inc()
        FACE_UNHANDLED_ERRORS_TOTAL.labels(endpoint="/api/recognize").inc()
        raise
    finally:
        FACE_RECOGNIZE_OP_DURATION_SECONDS.observe(time.perf_counter() - t0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enhance(img: np.ndarray) -> np.ndarray:
    try:
        from PIL import Image, ImageEnhance
        pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        pil = ImageEnhance.Brightness(pil).enhance(1.2)
        pil = ImageEnhance.Contrast(pil).enhance(1.5)
        pil = ImageEnhance.Sharpness(pil).enhance(1.3)
        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception:
        return img


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


def _save_annotated(img, faces, known_faces, filename, threshold, out_dir):
    try:
        from PIL import Image, ImageDraw, ImageFont
        pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil)
        try:
            font = ImageFont.truetype("arial.ttf", 20)
        except Exception:
            font = ImageFont.load_default()

        recognized = set()
        for face in faces:
            bbox = face.bbox.astype(int)
            emb = face.normed_embedding
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
    uvicorn.run("main:app", host="0.0.0.0", port=8004, reload=True)