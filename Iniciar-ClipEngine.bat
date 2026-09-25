@echo off
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
        echo [ERROR] No se pudo instalar FFmpeg automaticamente.
        echo Por favor ejecuta en PowerShell: winget install ffmpeg
        pause
    ) else (
        echo [OK] FFmpeg instalado correctamente.
    )
)

REM 1. Crear entorno virtual si no existe
if not exist "backend\venv" (
    echo [PASO 1/2] Creando entorno virtual aislado (venv)...
    python -m venv backend\venv
    if errorlevel 1 (
        echo [ERROR] No se pudo crear el entorno virtual de Python.
        pause
        exit /b
    )
)

REM 2. Activar entorno virtual
call backend\venv\Scripts\activate.bat

REM 3. Comprobar si uvicorn esta instalado, si no, instalar dependencias
python -c "import uvicorn, fastapi" >nul 2>&1
if errorlevel 1 (
    echo [PASO 2/2] Instalando librerias de IA y video (esto solo ocurre la primera vez)...
    echo           (faster-whisper, yt-dlp, ffmpeg-tools, fastapi, mediapipe...)
    echo.
    python -m pip install --upgrade pip
    pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo [ERROR] Hubo un problema instalando las dependencias.
        pause
        exit /b
    )
    echo.
    echo [OK] Todas las librerias fueron instaladas con exito.
    echo.
)

REM 4. Ejecutar el lanzador que abre el navegador
python run_app.py

pause
