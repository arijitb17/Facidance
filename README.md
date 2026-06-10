<p align="center">
  <img src="frontend/public/logo.png" width="80" alt="Facidance Logo" onerror="this.src='https://via.placeholder.com/80?text=Facidance';"/>
</p>

<h1 align="center">Facidance Core</h1>

<p align="center">
  <b>AI-Powered Face Recognition Attendance System (Web & Backend Microservices)</b><br/>
  Built for Gauhati University · Department of Information Technology
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-React-000000?logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-Microservices-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-blue" />
</p>

---

## ✨ Overview

**Facidance** is a modern, AI-powered face recognition attendance system designed for universities and schools. It automates attendance tracking using advanced computer vision models (InsightFace/ArcFace) and provides comprehensive, role-based dashboards for administrators, teachers, and students.

This repository contains the **Next.js Web Application** and the **FastAPI Microservices Backend**.

📱 **Looking for the Mobile App?** Check out the [Facidance_Mobile](https://github.com/Monaswi0104/Facidance_Mobile) repository.

---

## 🎯 Features

### 🎓 Student Portal
- **Dashboard:** View personal attendance history and real-time statistics.
- **AI Feedback:** Receive personalized, AI-generated attendance improvement tips powered by Groq (Llama-3).
- **Face Registration:** Upload face samples to register for automated attendance.

### 👨‍🏫 Teacher Portal
- **Course Management:** Manage assigned classes, student lists, and session histories.
- **Automated Attendance:** Track attendance seamlessly through face recognition via the web or mobile app.
- **Model Training:** Incrementally train the facial recognition model for new students directly from the dashboard.

### 🏛 Admin Portal
- **Institution Management:** Manage departments, programs, and courses.
- **System Health:** Monitor the overall system health, microservices status, and usage analytics.
- **User Management:** Oversee and approve teacher and student registrations.

---

## 🧠 AI Models & Computer Vision

Facidance utilizes a robust Deep Learning pipeline to ensure accurate and secure face recognition:

- **InsightFace (Buffalo_L):** Core model utilizing RetinaFace for face detection and ArcFace (ResNet) for high-accuracy feature extraction/embeddings.
- **OpenCV & PIL:** Handles image loading, drawing bounding boxes, and enhancements (brightness/contrast adjustments).
- **Albumentations:** Used for data augmentation during the training process to improve model robustness.
- **Scikit-learn (t-SNE):** Used for clustering face embeddings and creating data visualizations to assess training quality.
- **Cosine Similarity Matching:** Custom mathematical calculations to match live face embeddings against the PostgreSQL database.

---

## 🛠 Tech Stack

### Web Frontend
- **Framework:** Next.js (React)
- **Styling:** CSS Modules / Styled Components with custom dark-mode themes
- **API Fetching:** React Query & native fetch

### Backend (Microservices)
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL (Containerized)
- **ORM:** Prisma Client Python
- **AI/CV:** InsightFace, OpenCV, NumPy, Scikit-learn
- **LLM Integration:** Groq (Llama-3.1-8b-instant)

---

## 🏗 Architecture

The backend is strictly divided into **5 independent FastAPI microservices** for high availability and scalability:

1. **Frontend UI** (Next.js) - Port `3000`
2. **Auth Service** (`backend.auth.main:app`) - Port `8000`
3. **Admin Service** (`backend.admin.main:app`) - Port `8001`
4. **Teacher Service** (`backend.teacher.main:app`) - Port `8002`
5. **Student Service** (`backend.student.main:app`) - Port `8003`
6. **Face Service / Scripts** (`backend.scripts.face_service.main:app`) - Port `8004`

---

## 🚀 Local Setup & Development

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose

### 1. Database Setup
Start the PostgreSQL database using Docker:
```bash
docker-compose up -d
```
Initialize the schema with Prisma:
```bash
cd backend/common
prisma db push
```

### 2. Environment Variables
Ensure the following `.env` files are configured:
- **Root `.env`**: Needs `DATABASE_URL` and `GROQ_API_KEY`.
- **Frontend `.env.local`**: Needs API routing URLs (e.g., `NEXT_PUBLIC_AUTH_API_URL`).

### 3. Start the Backend Microservices
Open a separate terminal for each microservice and run the following commands from the root directory:

```bash
# Activate Virtual Environment
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
*(Alternatively, use `python fast.py` to run all microservices simultaneously).*

### 4. Start the Frontend
In a new terminal, navigate to the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

The application will now be accessible at `http://localhost:3000`.

---

## 🤝 Contributing
When contributing, ensure that all new endpoints are added to their respective microservice router and tested for async non-blocking execution.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License
This project is licensed under the **MIT License**.

## 👨‍💻 Author
**Arijit** — [@arijitb17](https://github.com/arijitb17)

---

<p align="center">
  <b>Facidance</b> — AI-Powered Smart Attendance System 🎓
</p>
