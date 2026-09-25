@echo off
title ClipEngine - AI Video Clipper
cd /d "%~dp0"

echo ======================================================
echo           INICIANDO CLIPENGINE LOCALMENTE
echo ======================================================
echo.

REM 1. Agregar rutas de WinGet y herramientas al PATH de esta sesion
set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;%PATH%"

REM 2. Comprobar si Python esta disponible
where python >nul 2>&1
if errorlevel 1 (
    REM Intentar buscar en rutas comunes de Windows
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"
    if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" set "PATH=%LOCALAPPDATA%\Programs\Python\Python310;%LOCALAPPDATA%\Programs\Python\Python310\Scripts;%PATH%"
    if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" set "PATH=%LOCALAPPDATA%\Python\pythoncore-3.14-64;%LOCALAPPDATA%\Python\pythoncore-3.14-64\Scripts;%PATH%"
    
    where python >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] No se pudo encontrar Python en el sistema.
        echo Por favor instala Python desde https://www.python.org/ y asegurate de marcar 'Add Python to PATH'.
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Python detectado.
echo [INFO] Iniciando motor ClipEngine...
echo.

REM 3. Ejecutar el orquestador principal
python run_app.py

if errorlevel 1 (
    echo.
    echo ======================================================
    echo  [AVISO] El programa se cerro con un codigo de error.
    echo ======================================================
    echo.
    pause
)
