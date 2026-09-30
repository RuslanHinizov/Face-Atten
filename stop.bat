@echo off
echo Stopping all services...

:: Kill Python backend
taskkill /f /im python.exe 2>nul

:: Kill Node.js frontend
taskkill /f /im node.exe 2>nul

echo.
echo All services stopped.
pause
