@echo off
chcp 65001 >nul 2>&1
title ClipEngine - AI Video Clipper
cd /d "%~dp0"

echo ======================================================
echo           INICIANDO CLIPENGINE LOCALMENTE
echo ======================================================
echo.

REM 0. Comprobar si existe FFmpeg
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo [AVISO] FFmpeg no esta instalado en este equipo.
    echo Intentando instalar FFmpeg automaticamente con winget...
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo [AVISO] Si winget fallo, puedes instalarlo con: winget install ffmpeg
    ) else (
        echo [OK] FFmpeg instalado correctamente.
    )
)

REM 1. Comprobar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Python en el sistema.
    echo Descargalo e instalalo desde https://www.python.org/
    pause
    exit /b
)

REM 2. Comprobar si las librerias estan instaladas, si no, instalarlas
python -c "import uvicorn, fastapi" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Instalando librerias necesarias (solo la primera vez)...
    pip install fastapi "uvicorn[standard]" python-multipart httpx cryptography pydantic pydantic-settings sqlalchemy aiosqlite python-dotenv yt-dlp faster-whisper opencv-python-headless moviepy mediapipe
)

REM 3. Ejecutar el lanzador que abre el navegador
python run_app.py

pause
