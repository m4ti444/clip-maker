@echo off
setlocal enabledelayedexpansion
title ClipEngine - AI Video Clipper
cd /d "%~dp0"

echo ======================================================
echo           INICIANDO CLIPENGINE LOCALMENTE
echo ======================================================
echo.

REM 1. Recargar PATH para que detecte FFmpeg recien instalado
set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;%PATH%"

REM 2. Comprobar si existe FFmpeg
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo [INFO] Buscando FFmpeg...
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements >nul 2>&1
)

REM 3. Comprobar Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Python en el sistema.
    echo Por favor instala Python desde https://www.python.org/
    pause
    exit /b 1
)

echo [OK] Entorno listo. Iniciando ClipEngine...
echo.

REM 4. Ejecutar el lanzador que abre el navegador
python run_app.py

if errorlevel 1 (
    echo.
    echo [AVISO] El programa se detuvo con algun error.
    pause
)
