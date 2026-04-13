# main.py
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import cv2
import numpy as np
import pickle
from typing import List
import shutil
from pathlib import Path
import json
import mediapipe as mp
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
# Use albumentations instead of imgaug for NumPy 2.0 compatibility
try:
    import albumentations as A
    AUGMENTATION_AVAILABLE = True
except ImportError:
    AUGMENTATION_AVAILABLE = False
    print("Warning: albumentations not installed. Augmentation will be skipped.")
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

load_dotenv()

app = FastAPI(title="Face Recognition API")
@app.get("/health")
def health():
    return {"status": "ok"}
# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://gu-attend.vercel.app",
        "*"  
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
DATASET_PATH = "dataset"
TEST_IMAGES_PATH = "test-images"
OUTPUT_PATH = "output"
EMBEDDINGS_FILE = "face_embeddings.pkl"

# Create directories
for path in [DATASET_PATH, TEST_IMAGES_PATH, OUTPUT_PATH]:
    Path(path).mkdir(parents=True, exist_ok=True)

# Initialize models (lazy loading)
face_app = None
face_mesh = None

def get_face_app():
    """Lazy load FaceAnalysis - only import when needed"""
    global face_app
    if face_app is None:
        try:
            # Import here to avoid startup errors
            from insightface.app import FaceAnalysis
            face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
            # prepare may vary depending on insightface version
            try:
                face_app.prepare(ctx_id=0, det_size=(640, 640))
            except Exception:
                # fallback if prepare signature differs
                pass
        except ImportError as e:
            print(f"Failed to load insightface: {e}")
            raise HTTPException(
                status_code=500,
                detail="Face recognition model not available. Check onnxruntime / insightface installation."
            )
    return face_app

def get_face_mesh():
    global face_mesh
    if face_mesh is None:
        mp_face_mesh = mp.solutions.face_mesh
        face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True)
    return face_mesh

def get_db_connection():
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return None
        return psycopg2.connect(database_url)
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

# --------------------
# Helper functions for digital zoom & augmented crops
# --------------------
def clamp(val, a, b):
    return max(a, min(b, val))

def crop_with_margin(img, x1, y1, x2, y2, margin=0.4):
    """Crop image around bbox with relative margin (fraction of bbox size)."""
    h, w = img.shape[:2]
    bw = x2 - x1
    bh = y2 - y1
    mx = int(bw * margin)
    my = int(bh * margin)
    cx1 = clamp(x1 - mx, 0, w - 1)
    cy1 = clamp(y1 - my, 0, h - 1)
    cx2 = clamp(x2 + mx, 0, w - 1)
    cy2 = clamp(y2 + my, 0, h - 1)
    # ensure indices are valid
    if cx2 <= cx1 or cy2 <= cy1:
        return img[0:1, 0:1].copy()
    return img[cy1:cy2, cx1:cx2].copy()

def make_augmented_crops(img_rgb, bbox, zoom_scales=(1.6, 2.2), shifts_px=(0.0, 0.08, -0.08), rotations_deg=(0, -10, 10)):
    """
    Given an RGB image and bbox (x1,y1,x2,y2), produce a list of augmented crops:
    - zoom_scales: relative scale factor to increase crop size (digital zoom)
    - shifts_px: relative horizontal shifts (fraction of face width). Positive -> right.
    - rotations_deg: small rotation angles to simulate different head tilts
    Returns list of crops (RGB numpy arrays).
    """
    h, w = img_rgb.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    bw = max(1, x2 - x1)
    bh = max(1, y2 - y1)
    center_x = x1 + bw // 2
    center_y = y1 + bh // 2

    crops = []
    for scale in zoom_scales:
        crop_w = int(bw * scale)
        crop_h = int(bh * scale)
        for shift_frac in shifts_px:
            shift_x = int(shift_frac * bw)
            cx = clamp(center_x + shift_x, 0, w - 1)
            cy = clamp(center_y, 0, h - 1)
            x_start = clamp(cx - crop_w // 2, 0, w - 1)
            y_start = clamp(cy - crop_h // 2, 0, h - 1)
            x_end = clamp(x_start + crop_w, 0, w)
            y_end = clamp(y_start + crop_h, 0, h)
            if x_end <= x_start or y_end <= y_start:
                continue
            crop = img_rgb[y_start:y_end, x_start:x_end].copy()
            if crop.size == 0:
                continue

            # Add small rotations
            for angle in rotations_deg:
                if angle == 0:
                    crops.append(crop)
                else:
                    (ch, cw) = crop.shape[:2]
                    M = cv2.getRotationMatrix2D((cw // 2, ch // 2), angle, 1.0)
                    rotated = cv2.warpAffine(crop, M, (cw, ch), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
                    crops.append(rotated)
    # also return a slightly padded original crop as baseline
    try:
        original_pad = crop_with_margin(img_rgb, x1, y1, x2, y2, margin=0.25)
        if original_pad is not None and original_pad.size > 0:
            crops.insert(0, original_pad)
    except Exception:
        pass
    return crops

# --------------------
# Endpoints
# --------------------
@app.get("/")
async def root():
    return {"status": "Face Recognition API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint that doesn't require onnxruntime"""
    return {
        "status": "healthy",
        "api": "running",
        "python_version": "3.11"
    }

@app.post("/api/process-student")
async def process_student(
    studentId: str = Form(...),
    front: UploadFile = File(...),
    left: UploadFile = File(...),
    right: UploadFile = File(...),
):
    """Process and validate student photos"""
    try:
        student_dir = Path(DATASET_PATH) / studentId
        student_dir.mkdir(parents=True, exist_ok=True)

        mesh = get_face_mesh()
        results = {}

        for pose, file in [("front", front), ("left", left), ("right", right)]:
            # Save file
            file_path = student_dir / f"{pose}.jpg"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Validate face
            img = cv2.imread(str(file_path))
            if img is None:
                results[pose] = {"success": False, "error": "Invalid image"}
                continue

            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            face_results = mesh.process(rgb)

            if face_results.multi_face_landmarks:
                cv2.imwrite(str(file_path), img)
                results[pose] = {"success": True}
            else:
                results[pose] = {"success": False, "error": "No face detected"}

        return JSONResponse(
            content={
                "success": True,
                "studentId": studentId,
                "results": results,
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/train")
async def train_faces():
    """Train face recognition model"""
    try:
        if not os.path.exists(DATASET_PATH):
            raise HTTPException(status_code=400, detail="No dataset found")

        app_model = get_face_app()  # This will now fail gracefully if onnxruntime issues
        face_dict = {}
        embedding_vectors = []
        labels = []

        # Initialize augmenter if albumentations is available
        augmenter = None
        if AUGMENTATION_AVAILABLE:
            augmenter = A.Compose([
                A.HorizontalFlip(p=0.5),
                A.Rotate(limit=15, p=0.8),
                A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.8),
                A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=20, p=0.5),
            ])

        student_folders = [
            d
            for d in os.listdir(DATASET_PATH)
            if os.path.isdir(os.path.join(DATASET_PATH, d))
        ]

        for student_folder in student_folders:
            person_path = os.path.join(DATASET_PATH, student_folder)
            person_embeddings = []

            image_files = [
                f
                for f in os.listdir(person_path)
                if f.lower().endswith((".jpg", ".jpeg", ".png"))
            ]

            for image_name in image_files:
                image_path = os.path.join(person_path, image_name)
                img = cv2.imread(image_path)
                if img is None:
                    continue

                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                faces = app_model.get(img_rgb)

                if len(faces) > 0:
                    face = max(
                        faces,
                        key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
                    )
                    emb = getattr(face, "normed_embedding", None)
                    if emb is not None:
                        person_embeddings.append(emb)
                        embedding_vectors.append(emb)
                        labels.append(student_folder)

                # Augmentation (only if augmenter is available)
                if augmenter is not None:
                    for _ in range(2):
                        try:
                            # albumentations expects numpy array in RGB format
                            augmented = augmenter(image=img_rgb)
                            aug_img = augmented['image']
                        except Exception:
                            aug_img = img_rgb
                        faces_aug = app_model.get(aug_img)
                        if len(faces_aug) > 0:
                            face_aug = max(
                                faces_aug,
                                key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
                            )
                            emb_aug = getattr(face_aug, "normed_embedding", None)
                            if emb_aug is not None:
                                person_embeddings.append(emb_aug)
                                embedding_vectors.append(emb_aug)
                                labels.append(student_folder)

            if person_embeddings:
                median_embedding = np.median(person_embeddings, axis=0)
                if np.linalg.norm(median_embedding) > 0:
                    median_embedding = median_embedding / np.linalg.norm(median_embedding)
                face_dict[student_folder.lower()] = median_embedding

                # Update database
                conn = get_db_connection()
                if conn:
                    try:
                        cursor = conn.cursor()
                        embedding_bytes = median_embedding.tobytes()
                        cursor.execute(
                            """
                            UPDATE "Student" 
                            SET "faceEmbedding" = %s 
                            WHERE id = %s
                        """,
                            (embedding_bytes, student_folder),
                        )
                        conn.commit()
                        cursor.close()
                        conn.close()
                    except Exception as e:
                        print(f"DB update error: {e}")

        # Save embeddings
        with open(EMBEDDINGS_FILE, "wb") as f:
            pickle.dump(face_dict, f)

        return JSONResponse(
            content={
                "success": True,
                "studentsTrained": len(face_dict),
                "totalSamples": len(embedding_vectors),
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- REPLACED recognize endpoint with digital-zoom + angle crops for small faces ---
@app.post("/api/recognize")
async def recognize_faces(
    frames: List[UploadFile] = File(...),
    courseId: str = Form(...),
):
    """Recognize faces from uploaded frames with automatic digital-zoom + small-angle crops for small faces."""
    try:
        # Clear and save new frames
        shutil.rmtree(TEST_IMAGES_PATH, ignore_errors=True)
        Path(TEST_IMAGES_PATH).mkdir(parents=True, exist_ok=True)

        for idx, frame in enumerate(frames):
            file_path = Path(TEST_IMAGES_PATH) / f"frame_{idx}.jpg"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(frame.file, buffer)

        # Load embeddings
        if not os.path.exists(EMBEDDINGS_FILE):
            raise HTTPException(status_code=400, detail="No trained model found")

        with open(EMBEDDINGS_FILE, "rb") as f:
            known_faces = pickle.load(f)

        app_model = get_face_app()
        recognized_students = set()
        all_detections = []
        confidences = []

        image_files = sorted(
            [
                f
                for f in os.listdir(TEST_IMAGES_PATH)
                if f.lower().endswith((".jpg", ".jpeg", ".png"))
            ]
        )

        # Thresholds you can tune:
        MIN_FACE_AREA = 40 * 40  # if face bbox area < this we consider it "small" (pixels^2)
        SIMILARITY_THRESHOLD = 0.45

        for idx, img_name in enumerate(image_files):
            img_path = os.path.join(TEST_IMAGES_PATH, img_name)
            img = cv2.imread(img_path)
            if img is None:
                continue

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            faces = app_model.get(img_rgb)

            for face_idx, face in enumerate(faces):
                # insightface bbox format: [x1,y1,x2,y2] but confirm with your version
                try:
                    x1, y1, x2, y2 = [int(v) for v in face.bbox[:4]]
                except Exception:
                    # fallback - skip if bbox not available
                    continue

                bw = max(1, x2 - x1)
                bh = max(1, y2 - y1)
                area = bw * bh

                candidate_embeddings = []

                # Always include the direct embedding if available
                emb = getattr(face, "normed_embedding", None)
                if emb is not None and np.linalg.norm(emb) > 0:
                    emb = emb / np.linalg.norm(emb)
                    candidate_embeddings.append(emb)

                # If face is small, create augmented crops (digital zoom + small angle/shift)
                if area < MIN_FACE_AREA:
                    crops = make_augmented_crops(
                        img_rgb,
                        (x1, y1, x2, y2),
                        zoom_scales=(1.8, 2.6),
                        shifts_px=(0.0, 0.10, -0.10),
                        rotations_deg=(0, -8, 8),
                    )
                    # Run detector/feature extractor on crops
                    for crop in crops:
                        try:
                            faces_c = app_model.get(crop)
                        except Exception:
                            faces_c = []

                        if not faces_c:
                            continue
                        # choose the largest face in the crop
                        f_best = max(
                            faces_c,
                            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
                        )
                        emb_c = getattr(f_best, "normed_embedding", None)
                        if emb_c is not None and np.linalg.norm(emb_c) > 0:
                            emb_c = emb_c / np.linalg.norm(emb_c)
                            candidate_embeddings.append(emb_c)

                # Now compare all candidate embeddings to known faces and pick best
                best_match, best_sim = None, 0.0
                for emb_candidate in candidate_embeddings:
                    if emb_candidate is None or np.linalg.norm(emb_candidate) == 0:
                        continue
                    for name, known_emb in known_faces.items():
                        # ensure both normalized
                        try:
                            ke = known_emb / np.linalg.norm(known_emb) if np.linalg.norm(known_emb) > 0 else known_emb
                        except Exception:
                            ke = known_emb
                        denom = np.linalg.norm(emb_candidate) * np.linalg.norm(ke)
                        if denom == 0:
                            continue
                        sim = float(np.dot(emb_candidate, ke) / denom)
                        if sim > best_sim and sim > SIMILARITY_THRESHOLD:
                            best_match, best_sim = name, sim

                if best_match:
                    recognized_students.add(best_match)
                    confidences.append(best_sim)
                    all_detections.append(
                        {
                            "imageIndex": idx,
                            "faceIndex": face_idx,
                            "confidence": float(best_sim),
                            "studentId": best_match,
                            "bbox": [int(x1), int(y1), int(x2), int(y2)],
                            "was_small": area < MIN_FACE_AREA,
                        }
                    )

        avg_confidence = float(np.mean(confidences)) if confidences else 0.0

        return JSONResponse(
            content={
                "totalFaces": len(all_detections),
                "recognizedStudents": list(recognized_students),
                "averageConfidence": avg_confidence,
                "detections": all_detections,
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)