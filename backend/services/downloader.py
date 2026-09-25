import asyncio
import os
import yt_dlp
import uuid

try:
    from backend.security import InputSanitizer
    from backend.services.ffmpeg_utils import get_ffmpeg_cmd
except ImportError:
    from security import InputSanitizer
    from services.ffmpeg_utils import get_ffmpeg_cmd

async def download_video(url: str, output_dir: str) -> dict:
    url = InputSanitizer.sanitize_url(url)
    os.makedirs(output_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    output_template = os.path.join(output_dir, f"{file_id}.%(ext)s")
    
    ffmpeg_path = get_ffmpeg_cmd()
    
    def match_filter(info_dict, *args, **kwargs):
        duration = info_dict.get('duration')
        if duration and duration > 14400:
            return "Video is too long (max 4 hours)"
        return None

    ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best',
        'outtmpl': output_template,
        'merge_output_format': 'mp4',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'max_filesize': 2 * 1024 * 1024 * 1024,
        'match_filter': match_filter,
        'allow_unplayable_formats': False,
        'ffmpeg_location': os.path.dirname(ffmpeg_path) if os.path.isabs(ffmpeg_path) else None
    }
    
    # Remover llaves con valor None
    ydl_opts = {k: v for k, v in ydl_opts.items() if v is not None}
    
    def extract():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=True)

    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(None, extract)
    
    filepath = ydl_opts['outtmpl'] % {'ext': 'mp4'} 
    if 'requested_downloads' in info and len(info['requested_downloads']) > 0:
        filepath = info['requested_downloads'][0]['filepath']
    elif os.path.exists(filepath):
        pass
    else:
        # Buscar el archivo generado con ese prefijo
        candidates = [os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.startswith(file_id)]
        if candidates:
            filepath = candidates[0]
        else:
            filepath = os.path.join(output_dir, f"{file_id}.mp4")

    filename = os.path.basename(filepath)
    filename = InputSanitizer.sanitize_filename(filename)
    filepath = os.path.join(output_dir, filename)

    return {
        "filepath": filepath,
        "title": info.get("title", "Unknown Title"),
        "duration": info.get("duration", 0.0),
        "thumbnail": info.get("thumbnail", "")
    }

async def get_video_info(url: str) -> dict:
    url = InputSanitizer.sanitize_url(url)
    ydl_opts = {
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }
    def extract():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)
            
    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(None, extract)
    return {
        "title": info.get("title", "Unknown"),
        "duration": info.get("duration", 0.0),
        "thumbnail": info.get("thumbnail", "")
    }
