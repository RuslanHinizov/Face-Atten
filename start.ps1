# Face Recognition System - Startup Script
# Run: .\start.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Face Recognition System - Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

# Start Backend
Write-Host "Starting Backend (Python API)..." -ForegroundColor Yellow
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir'; .\venv\Scripts\Activate.ps1; python -m api.api_server" -PassThru

# Wait for backend
Write-Host "Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend (React)..." -ForegroundColor Yellow
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir\frontend'; npm run dev" -PassThru

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Both services started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""

# Wait and open browser
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Host "Browser opened. Press Enter to exit this window..." -ForegroundColor Gray
Read-Host
