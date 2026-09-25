import os
import sys
import time
import socket
import webbrowser
import subprocess

# Forzar salida en UTF-8 para evitar errores de charmap en consolas de Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def find_free_port(start_port=8000, max_attempts=20) -> int:
    """Encuentra un puerto disponible de forma automática para evitar errores de puerto ocupado."""
    for p in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', p))
                return p
            except OSError:
                continue
    return start_port

def setup_environment():
    """Configura rutas del sistema, FFmpeg y directorios necesarios."""
    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, "backend")

    for path in [backend_dir, project_root]:
        if path not in sys.path:
            sys.path.insert(0, path)

    os.environ["PYTHONPATH"] = backend_dir
    os.makedirs(os.path.join(backend_dir, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(backend_dir, "output"), exist_ok=True)

    # Inyectar FFmpeg si existe
    try:
        from services.ffmpeg_utils import get_ffmpeg_cmd
        ffmpeg_cmd = get_ffmpeg_cmd()
        print(f" [OK] Motor FFmpeg verificado: {os.path.basename(ffmpeg_cmd)}")
    except Exception as e:
        print(f" [AVISO] Comprobando FFmpeg: {e}")

    # Verificar que el frontend compilado exista en backend/static/
    static_index = os.path.join(backend_dir, "static", "index.html")
    if not os.path.exists(static_index):
        frontend_dist_index = os.path.join(project_root, "frontend", "dist", "index.html")
        if os.path.exists(frontend_dist_index):
            import shutil
            target_static = os.path.join(backend_dir, "static")
            shutil.copytree(os.path.join(project_root, "frontend", "dist"), target_static, dirs_exist_ok=True)
            print(" [OK] Interfaz visual copiada a backend/static/")

def main():
    print("=" * 60)
    print("      CLIPENGINE - AI VIDEO CLIPPER (LOCAL ENGINE)")
    print("=" * 60)

    setup_environment()

    # Buscar puerto libre dinámicamente
    port = find_free_port(8000)
    url = f"http://127.0.0.1:{port}"

    print(f"\n [>] Iniciando servidor web en: {url}")
    print("     (Presiona CTRL+C en esta consola para detenerlo cuando quieras)\n")

    # Abrir navegador automáticamente cuando el servidor esté listo
    def open_browser():
        time.sleep(2.0)
        print(f" [>] Abriendo navegador en {url}...")
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f" [AVISO] Abre manualmente en tu navegador: {url}")

    import threading
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    # Iniciar servidor Uvicorn
    try:
        import uvicorn
        uvicorn.run("main:app", host="127.0.0.1", port=port, app_dir="backend", log_level="info")
    except KeyboardInterrupt:
        print("\n [INFO] Servidor detenido por el usuario.")
    except Exception as e:
        print(f"\n [ERROR INESPERADO] {e}")
        import traceback
        traceback.print_exc()
        input("\nPresiona Enter para cerrar...")

if __name__ == "__main__":
    main()
