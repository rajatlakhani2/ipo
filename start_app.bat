@echo off
cd /d "%~dp0"
echo Starting Family Office Dashboard...
echo Waiting for application to initialize...
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5001/login.html"
python app.py
pause
