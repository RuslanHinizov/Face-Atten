@echo off
cd /d "%~dp0.."
echo ================================================
echo FACE RECOGNITION SYSTEM
echo ================================================
echo.
echo Starting Backend (port 8000)...
start "Backend" cmd /k "cd /d %~dp0.. && python -m uvicorn api.api_server:app --host 0.0.0.0 --port 8000"

echo Starting Frontend (port 5173)...
start "Frontend" cmd /k "cd /d %~dp0..\frontend && npm install && npm run dev"

echo.
echo ================================================
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo ================================================
pause
