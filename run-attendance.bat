@echo off
setlocal

echo Starting QR Code Attendance System...
echo.
echo Backend API:  http://localhost:5000
echo React app:    http://localhost:5173
echo.

start "QR Attendance Backend" /D "%~dp0backend" cmd.exe /k npm.cmd start
start "QR Attendance Frontend" /D "%~dp0frontend-react" cmd.exe /k npm.cmd run dev

timeout /t 2 /nobreak >nul
start "" http://localhost:5173

echo The backend and frontend opened in separate terminal windows.
echo To stop the project, press Ctrl+C in both windows and close them.
pause
