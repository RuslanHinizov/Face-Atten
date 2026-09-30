@echo off
echo ========================================
echo   Face Recognition System - Startup
echo ========================================
echo.

cd /d "%~dp0"

echo Starting Backend (Python API)...
start "Backend API" cmd /k "cd /d %~dp0 && call venv\Scripts\activate && python -m api.api_server"

echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo Starting Frontend (React)...
start "Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ========================================
echo   Both services started!
echo ========================================
echo.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
echo   Press any key to open browser...
pause >nul

start http://localhost:5173
