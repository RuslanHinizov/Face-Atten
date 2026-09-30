@echo off
cd /d "%~dp0.."
echo ================================================
echo FACE RECOGNITION SERVER
echo ================================================
echo.
echo Backend: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Starting API server...
echo.
python -m uvicorn api.api_server:app --host 0.0.0.0 --port 8000 --reload
pause
