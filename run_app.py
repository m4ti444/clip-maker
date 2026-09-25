import os
import sys
import time
import webbrowser
import subprocess

def main():
    print("=" * 60)
    print(" 🎬 INICIANDO CLIPENGINE - AI VIDEO CLIPPER")
    print("=" * 60)

    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, "backend")
    
    # 1. Verificar FFmpeg
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(" [OK] FFmpeg detectado correctamente.")
    except FileNotFoundError:
        print(" [AVISO] FFmpeg no se encontró en el PATH del sistema.")
        print("         Para instalarlo en Windows ejecuta en PowerShell: winget install ffmpeg")

    # 2. Configurar variables de entorno y directorios
    os.environ["PYTHONPATH"] = backend_dir
    os.makedirs(os.path.join(backend_dir, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(backend_dir, "output"), exist_ok=True)

    port = 8000
    url = f"http://localhost:{port}"

    print(f"\n [>] Iniciando servidor en {url}...")

    # 3. Lanzar el navegador después de 2.5 segundos en segundo plano
    def open_browser():
        time.sleep(2.5)
        print(f"\n [>] Abriendo navegador en {url}...\n")
        webbrowser.open(url)

    import threading
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    # 4. Iniciar uvicorn
    try:
        import uvicorn
        uvicorn.run("main:app", host="127.0.0.1", port=port, app_dir=backend_dir, reload=False)
    except ImportError:
        print("\n [ERROR] 'uvicorn' no está instalado en este entorno de Python.")
        print("         Instala las dependencias con: pip install -r backend/requirements.txt")
        input("\nPresiona Enter para salir...")

if __name__ == "__main__":
    main()
