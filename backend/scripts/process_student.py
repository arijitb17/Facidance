import sys
import os
import cv2
import mediapipe as mp

# Set UTF-8 encoding for Windows console (for Windows only)
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True)

def process_student(student_id):
    student_path = os.path.join("dataset", student_id)
    os.makedirs(student_path, exist_ok=True)

    print(f"[INFO] Processing student: {student_id}")

    for pose in ["front", "left", "right"]:
        img_path = os.path.join(student_path, f"{pose}.jpg")

        if not os.path.exists(img_path):
            print(f"[ERROR] Missing {pose}.jpg for {student_id}")
            continue

        img = cv2.imread(img_path)
        if img is None:
            print(f"[WARNING] Could not read {pose}.jpg")
            continue

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        if results.multi_face_landmarks:
            # ✅ Save in the same directory (overwrite existing file)
            cv2.imwrite(img_path, img)
            print(f"[SUCCESS] Face detected and image saved: {pose}.jpg")
        else:
            print(f"[ERROR] No face found in {pose}.jpg")

    print(f"[DONE] Finished processing {student_id}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_student.py <student_id>")
        sys.exit(1)

    student_id = sys.argv[1]
    process_student(student_id)
