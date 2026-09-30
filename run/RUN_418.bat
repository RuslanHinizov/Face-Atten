@echo off
cd /d "%~dp0.."
echo Starting recognition for room 418...
python -m core.video_recognition "rtsp://admin:Zxcv2Zxcv2@192.168.20.23:554/stream" --db data/databases/database418.pkl
pause
