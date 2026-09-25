import os
import shutil
import sys

_CACHED_FFMPEG = None

def get_ffmpeg_cmd() -> str:
    """
    Busca y devuelve la ruta absoluta del ejecutable de FFmpeg.
    Prueba en orden:
    1. PATH del sistema (ffmpeg)
    2. Binario oficial integrado en imageio_ffmpeg
    3. Rutas de WinGet en AppData
    4. Rutas comunes en C:\ffmpeg
    """
    global _CACHED_FFMPEG
    if _CACHED_FFMPEG and os.path.exists(_CACHED_FFMPEG):
        return _CACHED_FFMPEG

    # 1. PATH del sistema
    which_ffmpeg = shutil.which("ffmpeg")
    if which_ffmpeg:
        _CACHED_FFMPEG = which_ffmpeg
        return _CACHED_FFMPEG

    # 2. imageio_ffmpeg (viene con pip)
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            _CACHED_FFMPEG = exe
            _ensure_in_path(os.path.dirname(exe))
            return _CACHED_FFMPEG
    except Exception:
        pass

    # 3. WinGet Packages
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        winget_links = os.path.join(local_app_data, "Microsoft", "WinGet", "Links", "ffmpeg.exe")
        if os.path.exists(winget_links):
            _CACHED_FFMPEG = winget_links
            _ensure_in_path(os.path.dirname(winget_links))
            return _CACHED_FFMPEG
            
        packages_dir = os.path.join(local_app_data, "Microsoft", "WinGet", "Packages")
        if os.path.exists(packages_dir):
            for root, dirs, files in os.walk(packages_dir):
                if "ffmpeg.exe" in files:
                    found = os.path.join(root, "ffmpeg.exe")
                    _CACHED_FFMPEG = found
                    _ensure_in_path(os.path.dirname(found))
                    return _CACHED_FFMPEG

    # 4. Rutas directas habituales
    for candidate in [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\tools\ffmpeg\bin\ffmpeg.exe"
    ]:
        if os.path.exists(candidate):
            _CACHED_FFMPEG = candidate
            _ensure_in_path(os.path.dirname(candidate))
            return _CACHED_FFMPEG

    # Fallback a comando genérico
    return "ffmpeg"

def _ensure_in_path(directory: str):
    """Asegura que el directorio del ejecutable esté en os.environ['PATH']"""
    if directory and directory not in os.environ.get("PATH", ""):
        os.environ["PATH"] = directory + os.pathsep + os.environ.get("PATH", "")
