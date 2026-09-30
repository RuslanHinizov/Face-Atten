@echo off
echo ================================================
echo FACE TRACKING FRONTEND
echo ================================================
echo.
echo Installing dependencies...
call npm install
echo.
echo Frontend: http://localhost:5173
echo Backend must be running on: http://localhost:8000
echo.
echo Starting frontend...
npm run dev
pause
