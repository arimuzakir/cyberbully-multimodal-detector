@echo off
title CyberBully Detector V11 — Backend API
color 0A
echo.
echo  ============================================================
echo   CYBERBULLYING DETECTION SYSTEM V11 — FASTAPI BACKEND
echo  ============================================================
echo.
echo  Menginstall dependencies...
pip install -r requirements.txt --quiet
echo.
echo  Menjalankan server di http://localhost:8000
echo  Tekan Ctrl+C untuk menghentikan.
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
