@echo off
title CyberBully Detector V12 SOTA — Master Launcher
color 0B
echo.
echo ================================================================
echo    CYBERBULLYING DETECTION MULTIMODAL V12 SOTA - REAL-TIME SYSTEM
echo ================================================================
echo.
echo  1. Menjalankan Backend FastAPI Server (Port 8000)...
start "CyberBully Detector API (Port 8000)" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo  2. Menjalankan Web Frontend Server (Port 5500)...
start "CyberBully Detector Web (Port 5500)" cmd /k "cd /d %~dp0frontend && python -m http.server 5500"

timeout /t 3 /nobreak >nul

echo.
echo  3. Membuka Dashboard Website di Browser...
start http://localhost:5500/index.html

echo.
echo ================================================================
echo  [PETUNJUK PEMASANGAN CHROME EXTENSION]
echo  1. Buka Google Chrome dan ketik pada address bar: chrome://extensions
echo  2. Aktifkan tombol 'Developer mode' (Mode pengembang) di kanan atas
echo  3. Klik tombol 'Load unpacked' (Muat ekstensi yang belum dibongkar)
echo  4. Pilih folder: %~dp0extension
echo  5. Buka YouTube / Twitter / IG / TikTok untuk melihat deteksi real-time!
echo ================================================================
echo.
echo Sistem sedang berjalan. Biarkan jendela terminal tetap terbuka.
pause
