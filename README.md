# 🎬 ClipEngine - Motor de Clips con IA Local

Herramienta local para generar clips virales automáticamente a partir de videos largos, con interfaz gráfica, detección inteligente de momentos, reencuadre vertical 9:16 y clasificación por campañas.

## ✨ Características

- **Descarga automática** desde YouTube, Twitch, Kick y más (via yt-dlp)
- **Transcripción con IA** usando faster-whisper (local, sin enviar datos a la nube)
- **Detección de momentos virales** con LLM (Gemini Flash, OpenAI, o Ollama local)
- **Reencuadre vertical 9:16** con seguimiento de rostro (MediaPipe)
- **Subtítulos animados** estilo Hormozi / TikTok word-by-word
- **Gestión de campañas** para clasificar clips según temas y requisitos
- **Interfaz web moderna** con React + Tailwind (dark mode)
- **100% local** - tus videos y datos nunca salen de tu máquina

## 🏗️ Arquitectura

```
clip-engine/
├── backend/           # FastAPI + Python
│   ├── main.py        # Servidor API
│   ├── config.py      # Configuración
│   ├── services/      # Lógica de negocio
│   │   ├── downloader.py       # Descarga con yt-dlp
│   │   ├── transcriber.py      # Transcripción con Whisper
│   │   ├── clip_selector.py    # Selección con LLM
│   │   ├── video_processor.py  # Corte, subtítulos, reencuadre
│   │   ├── face_tracker.py     # Detección de rostro
│   │   └── campaign_manager.py # Gestión de campañas
│   ├── models/        # Schemas Pydantic
│   └── database/      # SQLite async
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       ├── components/  # Componentes reutilizables
│       ├── pages/       # Páginas principales
│       └── api/         # Cliente HTTP
└── README.md
```

## 📋 Requisitos Previos

1. **Python 3.10+** - [Descargar](https://python.org)
2. **Node.js 18+** - [Descargar](https://nodejs.org)
3. **FFmpeg** - Debe estar instalado y accesible en el PATH del sistema
   - Windows: `winget install ffmpeg` o descargar de [ffmpeg.org](https://ffmpeg.org/download.html)
   - Verificar: `ffmpeg -version`

## 🚀 Instalación

### 1. Clonar y preparar el backend

```bash
cd clip-engine/backend

# Crear entorno virtual
python -m venv venv

# Activar (Windows)
.\venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la carpeta `backend/`:

```env
# Proveedor de LLM: 'gemini', 'openai', o 'ollama'
LLM_PROVIDER=gemini

# API Key (Gemini o OpenAI)
LLM_API_KEY=tu_api_key_aquí

# Modelo del LLM
LLM_MODEL=gemini-2.0-flash

# Modelo de Whisper: tiny, base, small, medium, large
WHISPER_MODEL=base

# URL de Ollama (solo si usas Ollama)
OLLAMA_URL=http://localhost:11434
```

### 3. Iniciar el backend

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Instalar e iniciar el frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev
```

### 5. Abrir la aplicación

Visita **http://localhost:5173** en tu navegador.

## 🎯 Uso

### Generar Clips
1. Pega una URL de YouTube/Twitch o sube un archivo de video
2. Ajusta la duración mínima/máxima de los clips
3. Elige cuántos clips quieres generar
4. Activa/desactiva subtítulos y reencuadre vertical
5. Haz clic en **"Procesar Video"**
6. Espera a que la IA analice y corte los clips
7. Previsualiza, ajusta y descarga tus clips

### Gestionar Campañas
1. Ve a la sección **"Campañas"**
2. Crea campañas con nombre, descripción, palabras clave y requisitos
3. Los clips se clasificarán automáticamente según la campaña más compatible
4. Filtra y exporta clips organizados por campaña

## ⚙️ Configuración de LLM

### Gemini (Recomendado - Rápido y gratuito)
1. Obtén una API key en [Google AI Studio](https://aistudio.google.com/apikey)
2. Configura `LLM_PROVIDER=gemini` y `LLM_API_KEY=tu_key`

### OpenAI
1. Obtén una API key en [OpenAI Platform](https://platform.openai.com/api-keys)
2. Configura `LLM_PROVIDER=openai` y `LLM_API_KEY=tu_key`

### Ollama (100% Local, sin API key)
1. Instala [Ollama](https://ollama.com)
2. Descarga un modelo: `ollama pull llama3.1`
3. Configura `LLM_PROVIDER=ollama` y `LLM_MODEL=llama3.1`

## 📝 Licencia

MIT - Uso libre para proyectos personales y comerciales.
