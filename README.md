# Facidance — AI-Powered Attendance Management System

> Face recognition-based attendance system for educational institutions.  
> Teachers capture classroom photos; the system automatically identifies enrolled students using deep learning.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Face Recognition Pipeline](#face-recognition-pipeline)
- [User Roles](#user-roles)
- [API Services](#api-services)
- [Deployment](#deployment)
- [Known Limitations & Future Work](#known-limitations--future-work)

---

## Overview

Facidance eliminates manual attendance-taking in classrooms. A teacher triggers a photo capture during a live session; the system runs face recognition against enrolled students and submits attendance — all within seconds. Students can view their attendance history, receive AI-generated suggestions when their attendance drops below 75%, and join courses using entry codes.

Since attendance is only captured **teacher-initiated during a live class**, physical presence is implicitly verified by the classroom environment, making remote spoofing attacks infeasible.

---

## Features

**Teacher**
- Dashboard with course stats and at-risk student alerts (below 75% attendance)
- Enrol students via CSV import or direct entry code
- Capture student face photos (front, left, right) for training
- Trigger face recognition on classroom frames and auto-submit attendance
- Manually mark students present when needed
- View per-course attendance history grouped by date
- Download attendance reports
- Email login credentials to newly imported students

**Student**
- Dashboard showing attendance percentage across all courses
- Join courses using teacher-issued entry codes
- View per-course attendance records and history
- AI-generated suggestions (via Groq + LLaMA 3.1) when attendance falls below threshold — with exact sessions-needed calculations pre-computed

**Admin**
- Full RBAC: manage departments, programs, academic years, semesters, courses
- Manage teacher and student accounts

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (80/443)                         │
│                  Reverse proxy + SSL (Let's Encrypt)        │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
     ┌───────▼────────┐           ┌─────────▼──────────────────┐
     │  Next.js 15    │           │   FastAPI Microservices     │
     │  Frontend      │           │  ┌──────────────────────┐  │
     │  (port 3000)   │           │  │  Auth     (port 8000)│  │
     │                │           │  │  Admin    (port 8001)│  │
     │  React 19      │           │  │  Teacher  (port 8002)│  │
     │  Tailwind CSS  │           │  │  Student  (port 8003)│  │
     │  shadcn/ui     │           │  │  Face     (port 8004)│  │
     │  Socket.IO     │           │  └──────────────────────┘  │
     └────────────────┘           └─────────────┬──────────────┘
                                                │
                              ┌─────────────────▼──────────────┐
                              │         PostgreSQL 16           │
                              │  (via Prisma ORM + asyncpg)    │
                              └────────────────────────────────┘

Face Recognition Pipeline:
  Photos → InsightFace ArcFace → Embeddings (face_embeddings.pkl)
           ↓ augmentation (albumentations)
           ↓ cosine similarity at inference
           ↓ results → Attendance records in DB
```

All services run in Docker and communicate over an internal bridge network. Nothing except Nginx is exposed to the public internet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| State management | TanStack Query v5 |
| Real-time | Socket.IO |
| Backend | FastAPI 0.110, Python 3.11, Uvicorn |
| Auth | JWT (PyJWT), bcrypt |
| Database | PostgreSQL 16, Prisma ORM (schema), asyncpg (async queries) |
| Face recognition | InsightFace ArcFace (`buffalo_l` model), OpenCV, NumPy |
| Augmentation | albumentations |
| AI suggestions | Groq API (LLaMA 3.1 8B Instant) |
| Email | Nodemailer (teacher service) |
| Infrastructure | Docker Compose, Nginx, Let's Encrypt (Certbot), Terraform (AWS) |

---

## Project Structure

```
facidance/
├── frontend/               # Next.js 15 app
│   ├── app/
│   │   ├── (auth)/         # Login / register pages
│   │   ├── admin/          # Admin dashboard
│   │   ├── teacher/        # Teacher dashboard + attendance flow
│   │   └── student/        # Student dashboard
│   ├── components/         # Shared UI components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utility functions
│
├── backend/
│   ├── auth/               # Authentication service (port 8000)
│   ├── admin/              # Admin service (port 8001)
│   ├── teacher/            # Teacher service (port 8002)
│   ├── student/            # Student service (port 8003)
│   ├── scripts/
│   │   ├── face_service/   # Face recognition HTTP service (port 8004)
│   │   ├── train_faces.py  # ArcFace training script
│   │   ├── recognize.py    # Recognition script (called at attendance time)
│   │   └── process_student.py
│   ├── common/             # Shared Prisma client
│   ├── middleware/         # Concurrency guard for face service
│   └── dataset/            # Student photos (gitignored)
│
├── prisma/
│   ├── schema.prisma       # Full DB schema
│   ├── seed.cjs            # Seed data (admin, departments, programs)
│   └── migrations/
│
├── docker/                 # Per-service Dockerfiles
├── nginx/                  # Nginx config + SSL conf
├── terraform/              # AWS infrastructure (EC2, security groups)
├── scripts/                # VPS setup shell script
├── docker-compose.yml      # Main compose (production)
├── docker-compose.override.yml  # Dev overrides
└── .env.example            # Required environment variables
```

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- [Node.js 20+](https://nodejs.org/) (for local frontend development only)
- [Python 3.11+](https://www.python.org/) (for local backend development only)
- A **Groq API key** (free at [console.groq.com](https://console.groq.com)) for AI suggestions
- An email account with SMTP access for student credential emails

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```env
# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:yourpassword@postgres:5432/facidance
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
POSTGRES_DB=facidance

# ── Auth ─────────────────────────────────────────────────────
JWT_SECRET=your_random_jwt_secret_here

# ── Internal service URLs ─────────────────────────────────────
PYTHON_API_URL=http://face:8004

# ── Frontend (public, build-time) ────────────────────────────
NEXT_PUBLIC_AUTH_URL=http://localhost/api/auth
NEXT_PUBLIC_ADMIN_API_URL=http://localhost/api/admin
NEXT_PUBLIC_TEACHER_API_URL=http://localhost/api/teacher
NEXT_PUBLIC_STUDENT_API_URL=http://localhost/api/student

# ── AI Suggestions ────────────────────────────────────────────
GROQ_API_KEY=your_groq_api_key_here

# ── Email (Nodemailer) ────────────────────────────────────────
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here
```

> For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your account password.

---

## Getting Started

### Run with Docker (recommended)

```bash
# 1. Clone the repository
git clone https://github.com/arijitb17/Facidance.git
cd Facidance

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Start all services
docker compose up --build

# 4. The app is available at http://localhost
```

Docker Compose will automatically:
- Start PostgreSQL and wait for it to be healthy
- Run Prisma migrations
- Seed the database with departments, programs, and a default admin account
- Start all 5 FastAPI services, the Next.js frontend, and Nginx

**Default admin credentials** (from seed):
```
Email:    admin@gauhati.ac.in
Password: admin123
```
Change the admin password after first login.

### Local development (without Docker)

**Frontend:**
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

**Backend (any service, e.g. teacher):**
```bash
cd backend
pip install -r requirements.txt --break-system-packages
uvicorn teacher.main:app --reload --port 8002
```

**Face recognition service:**
```bash
pip install -r requirements-face.txt --break-system-packages
uvicorn scripts.face_service.main:app --reload --port 8004
```

---

## Face Recognition Pipeline

### 1. Training (per student)

A teacher captures **3 photos** of a student (front, left profile, right profile) through the web interface. The system:

1. Saves images to `backend/dataset/<student_id>/`
2. Calls `train_faces.py` which uses **InsightFace ArcFace** (`buffalo_l` model) to extract 512-dimensional face embeddings
3. Applies **albumentations** augmentation (flip, rotate, brightness/contrast, blur) to generate additional training samples
4. Computes a **median embedding** across all samples per student and normalises it
5. Saves all embeddings to `face_embeddings.pkl`
6. Updates the student's `faceEmbedding` field in the database

A t-SNE visualisation (`training_visualization.png`) is generated after training to show how well students' face clusters are separated.

### 2. Recognition (at attendance time)

When a teacher triggers attendance:

1. The frontend sends one or more classroom frames to the teacher service
2. The teacher service proxies them to the face recognition service (`port 8004`)
3. `recognize.py` runs ArcFace on each frame, extracts embeddings for every detected face
4. Each detected face is matched against known embeddings using **cosine similarity** (threshold: 0.45)
5. Results are returned as JSON: recognised student IDs, bounding boxes, confidence scores
6. The teacher can review and submit — attendance records are written to the database

### Confidence threshold

The default cosine similarity threshold is **0.45**. Higher values increase precision (fewer false positives) but may miss students; lower values are more permissive. This can be tuned in `recognize.py`.

---

## User Roles

| Role | Access |
|---|---|
| `ADMIN` | Manage departments, programs, academic years, semesters, teachers, students |
| `TEACHER` | Manage courses, enrol students, run attendance, view reports |
| `STUDENT` | View own attendance, join courses, receive AI suggestions |

Roles are enforced at the API level via JWT claims and FastAPI dependencies.

---

## API Services

All services are routed through Nginx. In production:

| Service | Internal port | Nginx path |
|---|---|---|
| Auth | 8000 | `/api/auth` |
| Admin | 8001 | `/api/admin` |
| Teacher | 8002 | `/api/teacher` |
| Student | 8003 | `/api/student` |
| Face | 8004 | Internal only |

Key teacher endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/teacher/attendance/train-student` | Upload student photos for training |
| `POST` | `/teacher/attendance/run-training` | Trigger ArcFace model training |
| `POST` | `/teacher/attendance/recognize` | Run face recognition on classroom frames |
| `POST` | `/teacher/attendance/submit` | Persist attendance records |
| `GET` | `/teacher/reports` | Per-student attendance report |
| `GET` | `/teacher/students/at-risk` | Students below 75% attendance |

---

## Deployment

Infrastructure is defined in `terraform/` targeting **AWS ap-south-1** (Mumbai). The Terraform config provisions an EC2 instance and security groups.

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

After provisioning, run the VPS setup script:

```bash
bash scripts/setup-vps.sh
```

For SSL, run Certbot once manually after DNS is configured:

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d yourdomain.com
```

Certbot auto-renews via the container defined in `docker-compose.yml`.

---

## Known Limitations & Future Work

- **Recognition accuracy degrades** in poor lighting or extreme angles. Collecting more training photos per student (5+ images in varied conditions) significantly improves results.
- **Single embedding per student** — currently a median embedding is used. Storing multiple cluster centroids per student could improve accuracy for students with variable appearance.
- **No attendance export** — PDF/Excel download for attendance reports is not yet implemented.
- **No mobile-optimised camera capture** — the classroom photo capture flow works best on a desktop browser with a webcam.
- **Liveness detection** — not implemented, but not required given that attendance is teacher-initiated in a live classroom environment.
- **Multi-face frame processing** is supported but concurrent recognition requests are rate-limited by a semaphore (`face_concurrency.py`) to prevent overload on CPU-only inference.
