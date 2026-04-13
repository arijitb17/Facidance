# -*- coding: utf-8 -*-
import os
import cv2
import numpy as np
# Use albumentations instead of imgaug for NumPy 2.0 compatibility
try:
    import albumentations as A
    AUGMENTATION_AVAILABLE = True
except ImportError:
    AUGMENTATION_AVAILABLE = False
    print("Warning: albumentations not installed. Augmentation will be skipped.")
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
from insightface.app import FaceAnalysis
import pickle
import sys
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Path Configuration
DATASET_PATH = "dataset"
OUTPUT_FILE = "face_embeddings.pkl"
VISUALIZATION_PATH = "training_visualization.png"

def get_db_connection():
    """Get PostgreSQL database connection"""
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("Warning: DATABASE_URL not found in environment variables")
            return None
        
        conn = psycopg2.connect(database_url)
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def update_student_embedding(student_id, embedding_data):
    """Update student face embedding in database"""
    conn = get_db_connection()
    if not conn:
        print(f"Skipping database update for {student_id} (no connection)")
        return False
    
    try:
        cursor = conn.cursor()
        
        # Convert embedding to bytes
        embedding_bytes = embedding_data.tobytes()
        
        # 1. Try to find by student ID first
        cursor.execute("""
            UPDATE "Student" 
            SET "faceEmbedding" = %s 
            WHERE id = %s
        """, (embedding_bytes, student_id))
        
        if cursor.rowcount == 0:
            # 2. Try to find by email prefix
            cursor.execute("""
                UPDATE "Student" 
                SET "faceEmbedding" = %s 
                FROM "User"
                WHERE "Student"."userId" = "User".id 
                AND "User".email LIKE %s
            """, (embedding_bytes, f"{student_id}%"))
        
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"  [OK] Database updated for {student_id}")
            return True
        else:
            print(f"  [!] Student {student_id} not found in database")
            return False
            
    except Exception as e:
        print(f"  [X] Database update failed for {student_id}: {e}")
        conn.rollback()
        return False
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

def main():
    try:
        print("=" * 60)
        print("Face Recognition Training System")
        print("=" * 60)
        
        # Check if dataset exists
        if not os.path.exists(DATASET_PATH):
            print(f"Error: Dataset folder '{DATASET_PATH}' not found")
            print(f"Please run photo.py first to capture student photos")
            sys.exit(1)

        # Initialize InsightFace ArcFace model
        print("\n[1/5] Initializing face recognition model...")
        app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        app.prepare(ctx_id=0, det_size=(640, 640))
        print("  [OK] Model loaded successfully")

        # Storage
        embedding_vectors = []
        labels = []
        face_dict = {}
        db_update_results = {}
        total_students = 0
        total_images_processed = 0

        # Enhanced augmentation pipeline
        print("\n[2/5] Setting up augmentation pipeline...")
        augmenter = None
        if AUGMENTATION_AVAILABLE:
            augmenter = A.Compose([
                A.HorizontalFlip(p=0.5),
                A.Rotate(limit=15, p=0.8),
                A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.8),
                A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=20, p=0.5),
                A.GaussianBlur(blur_limit=(3, 5), p=0.3),
                A.MultiplicativeNoise(multiplier=(0.9, 1.1), p=0.3),
            ])
            print("  [OK] Augmentation ready (albumentations)")
        else:
            print("  [!] Augmentation disabled (albumentations not installed)")

        print("\n[3/5] Processing student photos...")
        print("-" * 60)

        # Process each student folder
        student_folders = [d for d in os.listdir(DATASET_PATH) 
                           if os.path.isdir(os.path.join(DATASET_PATH, d))]
        
        if not student_folders:
            print("Error: No student folders found in dataset/")
            print("Please run photo.py to capture photos first")
            sys.exit(1)

        for idx, student_folder in enumerate(sorted(student_folders), 1):
            person_path = os.path.join(DATASET_PATH, student_folder)
            total_students += 1
            person_embeddings = []
            images_for_person = 0

            print(f"\n[{idx}/{len(student_folders)}] Processing: {student_folder}")

            # Get all image files
            image_files = [f for f in os.listdir(person_path) 
                           if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            
            if not image_files:
                print(f"  [!] No images found for {student_folder}")
                continue

            for image_name in image_files:
                image_path = os.path.join(person_path, image_name)
                
                try:
                    # Load image
                    img = cv2.imread(image_path)
                    if img is None:
                        print(f"  [!] Skipping corrupted: {image_name}")
                        continue
                        
                    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

                    # Detect faces in original
                    faces = app.get(img_rgb)
                    if len(faces) > 0:
                        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
                        emb = face.normed_embedding
                        person_embeddings.append(emb)
                        embedding_vectors.append(emb)
                        labels.append(student_folder)
                        images_for_person += 1

                    # Augmentation (only if augmenter is available)
                    if augmenter is not None:
                        num_augmentations = min(3, max(1, 5 - len(image_files)))
                        
                        for aug_idx in range(num_augmentations):
                            try:
                                # Apply albumentations augmentation
                                augmented = augmenter(image=img_rgb)
                                aug_img = augmented['image']
                                
                                faces_aug = app.get(aug_img)
                                
                                if len(faces_aug) > 0:
                                    face_aug = max(faces_aug, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
                                    emb_aug = face_aug.normed_embedding
                                    person_embeddings.append(emb_aug)
                                    embedding_vectors.append(emb_aug)
                                    labels.append(student_folder)
                                    
                            except Exception as e:
                                continue

                except Exception as e:
                    print(f"  [!] Error processing {image_name}: {e}")
                    continue

            # Create representative embedding
            if person_embeddings:
                person_embeddings = np.array(person_embeddings)
                
                # Calculate median embedding and re-normalize
                median_embedding = np.median(person_embeddings, axis=0)
                median_embedding = median_embedding / np.linalg.norm(median_embedding)
                
                face_dict[student_folder.lower()] = median_embedding
                total_images_processed += images_for_person
                
                print(f"  [OK] Processed {images_for_person} images")
                print(f"  [OK] Generated {len(person_embeddings)} training samples")
            else:
                print(f"  [X] No faces detected for {student_folder}")

        print("\n" + "-" * 60)

        # Validate results
        if not face_dict:
            print("Error: No valid face embeddings generated!")
            sys.exit(1)

        if len(face_dict) < 2:
            print("Warning: Only one student trained. Add more students for better results.")

        # Save embeddings
        print("\n[4/5] Saving embeddings...")
        with open(OUTPUT_FILE, "wb") as f:
            pickle.dump(face_dict, f)
        print(f"  [OK] Saved to '{OUTPUT_FILE}'")

        # Update database
        print("\n[5/5] Updating database...")
        db_success_count = 0
        for student_id, embedding in face_dict.items():
            if update_student_embedding(student_id, embedding):
                db_success_count += 1
        
        print(f"  [OK] Updated {db_success_count}/{len(face_dict)} records in database")

        # Summary
        print("\n" + "=" * 60)
        print("TRAINING COMPLETE!")
        print("=" * 60)
        print(f"[OK] Students trained: {len(face_dict)}")
        print(f"[OK] Total images processed: {total_images_processed}")
        print(f"[OK] Total training samples: {len(embedding_vectors)}")
        print(f"[OK] Embeddings file: '{OUTPUT_FILE}'")
        print(f"[OK] Database records updated: {db_success_count}")

        # Create visualization
        if len(embedding_vectors) >= 4:
            print("\n[BONUS] Creating visualization...")
            create_enhanced_visualization(embedding_vectors, labels)
            print(f"  [OK] Saved to '{VISUALIZATION_PATH}'")

        # Quality assessment
        print("\n" + "=" * 60)
        assess_training_quality(face_dict, labels)
        print("=" * 60)

    except Exception as e:
        print(f"\n[X] Training failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def create_enhanced_visualization(embedding_vectors, labels):
    """Create t-SNE visualization"""
    try:
        embedding_vectors = np.array(embedding_vectors)
        
        scaler = StandardScaler()
        embedding_vectors_scaled = scaler.fit_transform(embedding_vectors)

        n_samples = len(embedding_vectors)
        perplexity = min(30, max(5, n_samples // 3))
        
        tsne = TSNE(
            n_components=2, 
            perplexity=perplexity,
            learning_rate=200, 
            random_state=42, 
            n_iter=1000,
            metric='cosine'
        )
        reduced_embeddings = tsne.fit_transform(embedding_vectors_scaled)

        plt.figure(figsize=(14, 10))
        plt.style.use('seaborn-v0_8-darkgrid')
        
        unique_labels = sorted(list(set(labels)))
        colors = plt.cm.Set3(np.linspace(0, 1, len(unique_labels)))
        
        for i, label in enumerate(unique_labels):
            mask = np.array([l == label for l in labels])
            plt.scatter(
                reduced_embeddings[mask, 0], 
                reduced_embeddings[mask, 1],
                c=[colors[i]], 
                label=label.title(),
                s=80,
                alpha=0.7,
                edgecolors='black',
                linewidth=0.5
            )

        plt.xlabel("t-SNE Component 1", fontsize=12)
        plt.ylabel("t-SNE Component 2", fontsize=12)
        plt.title("Face Embeddings Clustering Visualization", fontsize=14, fontweight='bold')
        plt.legend(title="Students", loc="best")
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(VISUALIZATION_PATH, dpi=300, bbox_inches='tight')
        plt.close()
        
    except Exception as e:
        print(f"  [!] Visualization failed: {e}")

def assess_training_quality(face_dict, labels):
    """Assess training quality"""
    try:
        print("TRAINING QUALITY ASSESSMENT")
        
        student_names = list(face_dict.keys())
        
        if len(student_names) >= 2:
            inter_distances = []
            for i in range(len(student_names)):
                for j in range(i+1, len(student_names)):
                    emb1 = face_dict[student_names[i]]
                    emb2 = face_dict[student_names[j]]
                    # L2 distance
                    distance = np.linalg.norm(emb1 - emb2)
                    inter_distances.append(distance)
            
            avg_inter_distance = np.mean(inter_distances)
            print(f"  Average Inter-student distance (L2): {avg_inter_distance:.3f}")
            
            if avg_inter_distance > 0.8:
                print("  Quality: [*****] EXCELLENT - Students well separated")
            elif avg_inter_distance > 0.6:
                print("  Quality: [****] GOOD - Students adequately separated")
            elif avg_inter_distance > 0.4:
                print("  Quality: [***] FAIR - May have some confusion")
            else:
                print("  Quality: [**] POOR - Add more diverse photos")

        label_counts = {}
        for label in labels:
            label_counts[label] = label_counts.get(label, 0) + 1
        
        min_samples = min(label_counts.values()) if label_counts else 0
        max_samples = max(label_counts.values()) if label_counts else 0
        avg_samples = sum(label_counts.values()) / len(label_counts) if label_counts else 0
        
        print(f"  Samples per student: {min_samples}-{max_samples} (avg: {avg_samples:.1f})")
        
        if min_samples >= 5:
            print("  Sample size: [*****] EXCELLENT")
        elif min_samples >= 3:
            print("  Sample size: [****] GOOD") 
        elif min_samples >= 2:
            print("  Sample size: [***] ACCEPTABLE")
        else:
            print("  Sample size: [**] POOR - Add more photos")

    except Exception as e:
        print(f"  [!] Quality assessment failed: {e}")

if __name__ == "__main__":
    main()