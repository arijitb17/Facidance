"""
backend/common/metrics.py

Central Prometheus metrics registry for ALL microservices.
Each service imports only the metrics it needs.

Services and their scrape ports:
  - auth     → :8000  (or wherever auth runs)
  - admin    → :8001
  - teacher  → :8002
  - student  → :8003
  - face     → :8004

Scraped at GET /metrics on each service's port.

Usage example:
    from backend.common.metrics import (
        FACE_RECOGNIZE_OPS_TOTAL,
        FACE_RECOGNIZE_OP_DURATION_SECONDS,
    )
"""

from prometheus_client import Counter, Histogram, Info

# ===========================================================================
# AUTH SERVICE
# ===========================================================================

AUTH_SERVICE_INFO = Info(
    "auth_service",
    "Static metadata about the auth microservice",
)
AUTH_SERVICE_INFO.info({"version": "1.0.0", "service": "auth"})

# Login
LOGIN_ATTEMPTS_TOTAL = Counter(
    "auth_login_attempts_total",
    "Total number of login attempts",
    ["status"],   # "success" | "failure_bad_credentials" | "failure_not_found"
)

LOGIN_DURATION_SECONDS = Histogram(
    "auth_login_duration_seconds",
    "End-to-end latency of the login flow (bcrypt verify + DB lookup + JWT sign)",
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# Teacher registration
REGISTRATION_ATTEMPTS_TOTAL = Counter(
    "auth_registration_attempts_total",
    "Total teacher self-registration attempts",
    ["status"],   # "success" | "conflict_email" | "error"
)

REGISTRATION_DURATION_SECONDS = Histogram(
    "auth_registration_duration_seconds",
    "End-to-end latency of the teacher registration flow",
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# JWT
TOKENS_ISSUED_TOTAL = Counter(
    "auth_tokens_issued_total",
    "Total JWTs successfully signed and returned to clients",
    ["role"],     # "ADMIN" | "TEACHER" | "STUDENT"
)

# Catch-all errors
AUTH_UNHANDLED_ERRORS_TOTAL = Counter(
    "auth_unhandled_errors_total",
    "Unexpected exceptions not caught as HTTPExceptions in the auth service",
    ["endpoint"],
)


# ===========================================================================
# ADMIN SERVICE
# ===========================================================================

ADMIN_SERVICE_INFO = Info(
    "admin_service",
    "Static metadata about the admin microservice",
)
ADMIN_SERVICE_INFO.info({"version": "1.0.0", "service": "admin"})

# ---------------------------------------------------------------------------
# Teachers
# ---------------------------------------------------------------------------

ADMIN_TEACHER_OPS_TOTAL = Counter(
    "admin_teacher_ops_total",
    "Admin operations on teacher records",
    ["operation", "status"],
    # operation: "list" | "approve" | "create" | "delete"
    # status:    "success" | "not_found" | "conflict" | "error"
)

ADMIN_TEACHER_OP_DURATION_SECONDS = Histogram(
    "admin_teacher_op_duration_seconds",
    "Latency of admin teacher operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

ADMIN_DEPARTMENT_OPS_TOTAL = Counter(
    "admin_department_ops_total",
    "Admin operations on department records",
    ["operation", "status"],
    # operation: "list" | "create" | "delete"
)

ADMIN_DEPARTMENT_OP_DURATION_SECONDS = Histogram(
    "admin_department_op_duration_seconds",
    "Latency of admin department operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------

ADMIN_PROGRAM_OPS_TOTAL = Counter(
    "admin_program_ops_total",
    "Admin operations on program records",
    ["operation", "status"],
)

ADMIN_PROGRAM_OP_DURATION_SECONDS = Histogram(
    "admin_program_op_duration_seconds",
    "Latency of admin program operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

ADMIN_COURSE_OPS_TOTAL = Counter(
    "admin_course_ops_total",
    "Admin operations on course records",
    ["operation", "status"],
    # operation: "list" | "create" | "update_teacher" | "delete"
)

ADMIN_COURSE_OP_DURATION_SECONDS = Histogram(
    "admin_course_op_duration_seconds",
    "Latency of admin course operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

ADMIN_STUDENT_OPS_TOTAL = Counter(
    "admin_student_ops_total",
    "Admin operations on student records",
    ["operation", "status"],
    # operation: "list" | "update" | "delete" | "graduate" | "ungraduate"
)

ADMIN_STUDENT_OP_DURATION_SECONDS = Histogram(
    "admin_student_op_duration_seconds",
    "Latency of admin student operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# auto-graduation side-effect counter (fires inside get_students)
ADMIN_AUTO_GRADUATIONS_TOTAL = Counter(
    "admin_auto_graduations_total",
    "Students automatically marked graduated during a list-students call",
)

# ---------------------------------------------------------------------------
# Stats & Analytics
# ---------------------------------------------------------------------------

ADMIN_ANALYTICS_DURATION_SECONDS = Histogram(
    "admin_analytics_duration_seconds",
    "Latency of admin analytics queries",
    ["endpoint"],
    # endpoint: "stats" | "overview" | "attendance_trends"
    #           | "teacher_load" | "program_distribution"
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# ---------------------------------------------------------------------------
# Catch-all errors
# ---------------------------------------------------------------------------

ADMIN_UNHANDLED_ERRORS_TOTAL = Counter(
    "admin_unhandled_errors_total",
    "Unexpected exceptions not caught as HTTPExceptions in the admin service",
    ["endpoint"],
)


# ===========================================================================
# STUDENT SERVICE
# ===========================================================================

STUDENT_SERVICE_INFO = Info(
    "student_service",
    "Static metadata about the student microservice",
)
STUDENT_SERVICE_INFO.info({"version": "1.0.0", "service": "student"})

# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

STUDENT_PROFILE_OPS_TOTAL = Counter(
    "student_profile_ops_total",
    "Student profile operations",
    ["operation", "status"],
    # operation: "get_me" | "update" | "check_photos"
    # status:    "success" | "not_found" | "error"
)

STUDENT_PROFILE_OP_DURATION_SECONDS = Histogram(
    "student_profile_op_duration_seconds",
    "Latency of student profile operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

STUDENT_STATS_DURATION_SECONDS = Histogram(
    "student_stats_duration_seconds",
    "Latency of student stats queries",
    ["endpoint"],
    # endpoint: "stats" | "ai_suggestions"
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

STUDENT_COURSE_OPS_TOTAL = Counter(
    "student_course_ops_total",
    "Student course operations",
    ["operation", "status"],
    # operation: "list" | "get" | "join" | "leave"
    # status:    "success" | "not_found" | "forbidden" | "conflict" | "error"
)

STUDENT_COURSE_OP_DURATION_SECONDS = Histogram(
    "student_course_op_duration_seconds",
    "Latency of student course operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

STUDENT_ATTENDANCE_OPS_TOTAL = Counter(
    "student_attendance_ops_total",
    "Student attendance query operations",
    ["operation", "status"],
    # operation: "course_attendance" | "history"
)

STUDENT_ATTENDANCE_OP_DURATION_SECONDS = Histogram(
    "student_attendance_op_duration_seconds",
    "Latency of student attendance queries",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Catch-all errors
# ---------------------------------------------------------------------------

STUDENT_UNHANDLED_ERRORS_TOTAL = Counter(
    "student_unhandled_errors_total",
    "Unexpected exceptions not caught as HTTPExceptions in the student service",
    ["endpoint"],
)


# ===========================================================================
# TEACHER SERVICE
# ===========================================================================

TEACHER_SERVICE_INFO = Info(
    "teacher_service",
    "Static metadata about the teacher microservice",
)
TEACHER_SERVICE_INFO.info({"version": "1.0.0", "service": "teacher"})

# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

TEACHER_COURSE_OPS_TOTAL = Counter(
    "teacher_course_ops_total",
    "Teacher operations on course records",
    ["operation", "status"],
    # operation: "list" | "get_students" | "remove_student" | "import" | "enroll_existing"
    # status:    "success" | "not_found" | "forbidden" | "conflict" | "error"
)

TEACHER_COURSE_OP_DURATION_SECONDS = Histogram(
    "teacher_course_op_duration_seconds",
    "Latency of teacher course operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Students
# ---------------------------------------------------------------------------

TEACHER_STUDENT_OPS_TOTAL = Counter(
    "teacher_student_ops_total",
    "Teacher operations on student records",
    ["operation", "status"],
    # operation: "list" | "search" | "at_risk"
)

TEACHER_STUDENT_OP_DURATION_SECONDS = Histogram(
    "teacher_student_op_duration_seconds",
    "Latency of teacher student operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------

TEACHER_ATTENDANCE_OPS_TOTAL = Counter(
    "teacher_attendance_ops_total",
    "Teacher attendance operations",
    ["operation", "status"],
    # operation: "get_students" | "train" | "run_training" | "recognize"
    #           | "submit" | "mark_present" | "history"
)

TEACHER_ATTENDANCE_OP_DURATION_SECONDS = Histogram(
    "teacher_attendance_op_duration_seconds",
    "Latency of teacher attendance operations",
    ["operation"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

# face-recognition specific (longer tail — model inference + photo I/O)
TEACHER_FACE_OPS_TOTAL = Counter(
    "teacher_face_ops_total",
    "Face-recognition pipeline operations",
    ["operation", "status"],
    # operation: "train_student" | "run_training" | "recognize"
)

TEACHER_FACE_OP_DURATION_SECONDS = Histogram(
    "teacher_face_op_duration_seconds",
    "Latency of face-recognition operations (includes Python service roundtrip)",
    ["operation"],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
)

# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

TEACHER_REPORT_DURATION_SECONDS = Histogram(
    "teacher_report_duration_seconds",
    "Latency of teacher report generation",
    ["endpoint"],
    # endpoint: "report" | "at_risk"
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# ---------------------------------------------------------------------------
# Stats & Profile
# ---------------------------------------------------------------------------

TEACHER_STATS_DURATION_SECONDS = Histogram(
    "teacher_stats_duration_seconds",
    "Latency of teacher stats/profile queries",
    ["endpoint"],
    # endpoint: "me" | "stats" | "hierarchy"
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ---------------------------------------------------------------------------
# Catch-all errors
# ---------------------------------------------------------------------------

TEACHER_UNHANDLED_ERRORS_TOTAL = Counter(
    "teacher_unhandled_errors_total",
    "Unexpected exceptions not caught as HTTPExceptions in the teacher service",
    ["endpoint"],
)


# ===========================================================================
# FACE RECOGNITION SERVICE  (port 8004)
# ===========================================================================

FACE_SERVICE_INFO = Info(
    "face_service",
    "Static metadata about the face recognition microservice",
)
FACE_SERVICE_INFO.info({"version": "1.0.0", "service": "face-recognition"})

# ---------------------------------------------------------------------------
# Model lifecycle
# Tracks cold-start load time and failures — useful when the heavy
# InsightFace buffalo_l model is slow to initialise on CPU.
# ---------------------------------------------------------------------------

FACE_MODEL_LOAD_TOTAL = Counter(
    "face_model_load_total",
    "Total InsightFace model load attempts",
    ["status"],
    # status: "success" | "error"
)

FACE_MODEL_LOAD_DURATION_SECONDS = Histogram(
    "face_model_load_duration_seconds",
    "Time taken to load the InsightFace model (cold start)",
    buckets=[0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

# ---------------------------------------------------------------------------
# Student photo ingestion  — POST /api/process-student
# Three poses (front/left/right) validated by mediapipe then written to disk.
# ---------------------------------------------------------------------------

FACE_PROCESS_STUDENT_OPS_TOTAL = Counter(
    "face_process_student_ops_total",
    "POST /api/process-student operation results",
    ["status"],
    # status: "success" | "decode_error" | "no_face_detected" | "error"
)

FACE_PROCESS_STUDENT_OP_DURATION_SECONDS = Histogram(
    "face_process_student_op_duration_seconds",
    "End-to-end latency of /api/process-student (mediapipe validation + disk write)",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# ---------------------------------------------------------------------------
# Embedding training  — POST /api/train
# Walks the full dataset/, extracts ArcFace embeddings, writes the pkl,
# and optionally pushes embeddings back to the database.
# ---------------------------------------------------------------------------

FACE_TRAIN_OPS_TOTAL = Counter(
    "face_train_ops_total",
    "POST /api/train operation results",
    ["status"],
    # status: "success" | "no_dataset" | "no_students" | "no_embeddings" | "error"
)

FACE_TRAIN_OP_DURATION_SECONDS = Histogram(
    "face_train_op_duration_seconds",
    "End-to-end latency of /api/train (embedding extraction + pickle write)",
    # Training can take minutes on CPU with many students
    buckets=[1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0],
)

FACE_TRAIN_STUDENTS_PROCESSED_TOTAL = Counter(
    "face_train_students_processed_total",
    "Cumulative student folders successfully embedded across all training runs",
)

FACE_TRAIN_IMAGES_PROCESSED_TOTAL = Counter(
    "face_train_images_processed_total",
    "Cumulative images processed (including augmentations) across all training runs",
)

FACE_TRAIN_DB_UPDATE_TOTAL = Counter(
    "face_train_db_update_total",
    "Attempts to sync face embeddings back to the database after training",
    ["status"],
    # status: "success" | "skipped" | "error"
)

# ---------------------------------------------------------------------------
# Face recognition  — POST /api/recognize
# Accepts classroom frames, matches against known embeddings, returns hits.
# ---------------------------------------------------------------------------

FACE_RECOGNIZE_OPS_TOTAL = Counter(
    "face_recognize_ops_total",
    "POST /api/recognize operation results",
    ["status"],
    # status: "success" | "no_model" | "empty_embeddings" | "error"
)

FACE_RECOGNIZE_OP_DURATION_SECONDS = Histogram(
    "face_recognize_op_duration_seconds",
    "End-to-end latency of /api/recognize across all submitted frames",
    # Recognition can be slow on CPU with many faces
    buckets=[0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
)

FACE_RECOGNIZE_FACES_DETECTED_TOTAL = Counter(
    "face_recognize_faces_detected_total",
    "Cumulative face bounding-box detections across all recognition requests",
)

FACE_RECOGNIZE_STUDENTS_MATCHED_TOTAL = Counter(
    "face_recognize_students_matched_total",
    "Cumulative unique students successfully identified across all recognition requests",
)

FACE_RECOGNIZE_FRAMES_PROCESSED_TOTAL = Counter(
    "face_recognize_frames_processed_total",
    "Cumulative frames submitted to /api/recognize",
)

FACE_RECOGNIZE_CONFIDENCE = Histogram(
    "face_recognize_confidence",
    "Distribution of cosine-similarity scores for matched faces — use to tune confidence_threshold",
    # Dense buckets in the decision zone (0.45–0.95) for threshold tuning
    buckets=[0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.0],
)

# ---------------------------------------------------------------------------
# Student photo status  — GET /api/student/{student_id}/photos
# ---------------------------------------------------------------------------

FACE_PHOTOS_OPS_TOTAL = Counter(
    "face_photos_ops_total",
    "GET /api/student/{student_id}/photos operation results",
    ["status"],
    # status: "success" | "error"
)

FACE_PHOTOS_OP_DURATION_SECONDS = Histogram(
    "face_photos_op_duration_seconds",
    "Latency of /api/student/{student_id}/photos (filesystem stat only)",
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
)

# ---------------------------------------------------------------------------
# Catch-all errors
# ---------------------------------------------------------------------------

FACE_UNHANDLED_ERRORS_TOTAL = Counter(
    "face_unhandled_errors_total",
    "Unexpected exceptions not caught as HTTPExceptions in the face service",
    ["endpoint"],
)