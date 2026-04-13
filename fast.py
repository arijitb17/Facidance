"""
fast.py

Run all backend microservices together.

Usage:
    python fast.py
"""

import subprocess
import sys


def start_service(name, module, port):
    print(f"🚀 Starting {name} on port {port}...")
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            module,
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
            "--reload",
        ]
    )


if __name__ == "__main__":
    try:
        processes = []

        # Start Auth Service (8000)
        processes.append(
            start_service("Auth Service", "backend.auth.main:app", 8000)
        )

        # Start Admin Service (8001)
        processes.append(
            start_service("Admin Service", "backend.admin.main:app", 8001)
        )

        # Start Teacher Service (8002)
        processes.append(
            start_service("Teacher Service", "backend.teacher.main:app", 8002)
        )

        # Start Student Service (8003)
        processes.append(
            start_service("Student Service", "backend.student.main:app", 8003)
        )

        # Start Face/Scripts Service (8004)
        processes.append(
            start_service("Scripts Service", "backend.scripts.face_service.main:app", 8004)
        )

        print("\n✅ All services started!\nPress CTRL+C to stop.\n")

        # Wait for all processes
        for p in processes:
            p.wait()

    except KeyboardInterrupt:
        print("\n🛑 Shutting down services...")
        for p in processes:
            p.terminate()
        print("✅ All services stopped.")