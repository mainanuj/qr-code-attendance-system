@echo off
cd /d "%~dp0"

echo Starting QR Attendance System...

start "" http://localhost:5000

cd backend
npm.cmd start

pause
