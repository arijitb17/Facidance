# Facidance

Facidance is an AI-powered face recognition attendance system designed for universities and schools. It automates attendance tracking using advanced computer vision and provides comprehensive dashboards for administrators, teachers, and students.

## Features

- **AI Face Recognition:** Automatically track student attendance by scanning photos or live video feeds using InsightFace and OpenCV.
- **Role-based Dashboards:**
  - **Admin:** Manage departments, programs, courses, and overall system health.
  - **Teacher:** Manage classes, track attendance, and train the facial recognition model incrementally for new students.
  - **Student:** View personal attendance history, AI-powered attendance improvement tips (via Groq/Llama-3), and upload face samples.
- **Fast & Scalable Microservices:** The backend is split into independent FastAPI microservices.
- **Modern Frontend:** Built with Next.js and styled with a sleek, responsive dark-mode UI.

## Tech Stack

### Frontend
- **Framework:** Next.js (React)
- **Styling:** CSS Modules / Styled Components with custom themes
- **API Fetching:** React Query & native fetch

### Backend (Microservices)
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL
- **ORM:** Prisma Client Python
- **AI/CV:** InsightFace, OpenCV, NumPy
- **LLM Integration:** Groq (Llama-3.1-8b-instant) for personalized student advice

### Infrastructure
- **Containers:** Docker (PostgreSQL database)
- **API Gateway/Routing:** Next.js API Routes (proxies requests to the respective microservices)

## Architecture

The backend is split into 5 distinct FastAPI microservices:
1. **Frontend:** Next.js UI (Port 3000)
2. **Auth Service:** `backend.auth.main:app` (Port 8000)
3. **Admin Service:** `backend.admin.main:app` (Port 8001)
4. **Teacher Service:** `backend.teacher.main:app` (Port 8002)
5. **Student Service:** `backend.student.main:app` (Port 8003)
6. **Face Service:** `backend.scripts.face_service.main:app` (Port 8004)

## Local Setup & Development

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose

### 1. Database Setup
Start the PostgreSQL database using Docker:
```bash
docker-compose up -d
```
Run Prisma migrations to initialize the schema:
```bash
cd backend/common
prisma db push
```

### 2. Environment Variables
Ensure the following `.env` files are configured:
- Root `.env`: Contains `DATABASE_URL` and `GROQ_API_KEY`.
- Frontend `.env.local`: Contains API routing URLs.

### 3. Start the Backend Microservices
Open a separate terminal for each microservice and run the following commands from the root directory:

```bash
source venv/bin/activate

# Auth
uvicorn backend.auth.main:app --host 0.0.0.0 --port 8000 --reload

# Admin
uvicorn backend.admin.main:app --host 0.0.0.0 --port 8001 --reload

# Teacher
uvicorn backend.teacher.main:app --host 0.0.0.0 --port 8002 --reload

# Student
uvicorn backend.student.main:app --host 0.0.0.0 --port 8003 --reload

# Face Recognition Service
uvicorn backend.scripts.face_service.main:app --host 0.0.0.0 --port 8004 --reload
```

### 4. Start the Frontend
In a new terminal, navigate to the frontend directory and start the Next.js development server:

```bash
cd frontend
npm install
npm run dev
```

The application will now be accessible at `http://localhost:3000`.

## Contributing
When contributing, ensure that all new endpoints are added to their respective microservice router and tested for async non-blocking execution.
