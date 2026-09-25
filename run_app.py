import os
import sys
import time
import webbrowser
import subprocess

# Forzar salida en UTF-8 para evitar errores de charmap en consolas de Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def main():
    print("=" * 60)
    print("  INICIANDO CLIPENGINE - AI VIDEO CLIPPER")
    print("=" * 60)

    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, "backend")
    
    # 1. Verificar FFmpeg
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(" [OK] FFmpeg detectado correctamente.")
    except Exception:
        print(" [AVISO] FFmpeg no se encontro en el PATH.")

    # 2. Configurar directorios
    os.environ["PYTHONPATH"] = backend_dir
    os.makedirs(os.path.join(backend_dir, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(backend_dir, "output"), exist_ok=True)

    port = 8000
    url = f"http://127.0.0.1:{port}"

    print(f"\n [>] Iniciando servidor en {url}...")

    # 3. Abrir navegador en segundo plano
    def open_browser():
        time.sleep(2.0)
        print(f"\n [>] Abriendo navegador en {url}...\n")
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f" [AVISO] No se pudo abrir el navegador automaticamente: {e}")

    import threading
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    # 4. Iniciar uvicorn
    try:
        import uvicorn
        uvicorn.run("main:app", host="127.0.0.1", port=port, app_dir=backend_dir, reload=False)
    except ImportError:
        print("\n [ERROR] 'uvicorn' no esta instalado.")
        input("\nPresiona Enter para salir...")
    except Exception as e:
        print(f"\n [ERROR] Error al iniciar el servidor: {e}")
        input("\nPresiona Enter para salir...")

if __name__ == "__main__":
    main()
