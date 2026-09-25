import asyncio
import os
import subprocess

try:
    from backend.config import settings
    from backend.security import InputSanitizer
    from backend.services.ffmpeg_utils import get_ffmpeg_cmd
except ImportError:
    from config import settings
    from security import InputSanitizer
    from services.ffmpeg_utils import get_ffmpeg_cmd

async def cut_clip(video_path: str, start: float, end: float, output_path: str) -> str:
    start = InputSanitizer.sanitize_time_param(start)
    end = InputSanitizer.sanitize_time_param(end)
    ffmpeg_bin = get_ffmpeg_cmd()
    
    try:
        in_p = InputSanitizer.sanitize_path(video_path, settings.UPLOAD_DIR)
    except ValueError:
        in_p = InputSanitizer.sanitize_path(video_path, settings.OUTPUT_DIR)
        
    out_p = InputSanitizer.sanitize_path(output_path, settings.OUTPUT_DIR)
    
    # Si el archivo destino existe, eliminarlo antes de reescribir
    if os.path.exists(out_p):
        try:
            os.remove(out_p)
        except Exception:
            pass

    duration = max(0.5, end - start)
    command = [
        ffmpeg_bin,
        "-y",
        "-ss", str(start),
        "-i", in_p,
        "-t", str(duration),
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:a", "aac",
        "-avoid_negative_ts", "make_zero",
        out_p
    ]
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600))
    return out_p

def generate_ass_subtitles(words: list, style: str) -> str:
    ass_header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,150,1
Style: Hormozi,Arial,80,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,2,10,10,200,1
Style: Minimal,Arial,42,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ass_events = ""
    style_name = style.capitalize() if style.capitalize() in ["Default", "Hormozi", "Minimal"] else "Default"
    
    for word in words:
        if not word.get('word'):
            continue
        start_time = _format_ass_time(max(0.0, word['start']))
        end_time = _format_ass_time(max(0.0, word['end']))
        text = InputSanitizer.sanitize_text(word['word'].strip())
        if text:
            ass_events += f"Dialogue: 0,{start_time},{end_time},{style_name},,0,0,0,,{text}\n"
    
    return ass_header + ass_events

def _format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

async def add_subtitles(video_path: str, words: list, output_path: str, style: str = 'default') -> str:
    if not words:
        return output_path
        
    ffmpeg_bin = get_ffmpeg_cmd()
    try:
        in_p = InputSanitizer.sanitize_path(video_path, settings.UPLOAD_DIR)
    except ValueError:
        in_p = InputSanitizer.sanitize_path(video_path, settings.OUTPUT_DIR)
        
    actual_out_p = InputSanitizer.sanitize_path(output_path, settings.OUTPUT_DIR)
    tmp_out = actual_out_p + ".sub_tmp.mp4"
    ass_path = in_p + ".ass"

    try:
        ass_content = generate_ass_subtitles(words, style)
        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_content)
            
        # Formato de ruta compatible con FFmpeg en Windows (barras directas y dos puntos escapados)
        norm_ass = os.path.abspath(ass_path).replace("\\", "/")
        norm_ass = norm_ass.replace(":", "\\:")
        
        command = [
            ffmpeg_bin,
            "-y",
            "-i", in_p,
            "-vf", f"subtitles='{norm_ass}'",
            "-c:a", "copy",
            tmp_out
        ]
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600))
        
        if os.path.exists(tmp_out):
            if os.path.exists(actual_out_p):
                os.remove(actual_out_p)
            os.replace(tmp_out, actual_out_p)
            return actual_out_p
    except Exception as e:
        # Si fallan los subtítulos por fuentes o librerías, preservar el video sin crashear
        print(f"[AVISO] No se pudieron aplicar subtítulos: {e}. Manteniendo clip original.")
        if os.path.exists(tmp_out):
            try:
                os.remove(tmp_out)
            except Exception:
                pass
    finally:
        if os.path.exists(ass_path):
            try:
                os.remove(ass_path)
            except Exception:
                pass
                
    return actual_out_p

async def reframe_vertical(video_path: str, face_positions: list, output_path: str) -> str:
    ffmpeg_bin = get_ffmpeg_cmd()
    try:
        in_p = InputSanitizer.sanitize_path(video_path, settings.UPLOAD_DIR)
    except ValueError:
        in_p = InputSanitizer.sanitize_path(video_path, settings.OUTPUT_DIR)
        
    actual_out_p = InputSanitizer.sanitize_path(output_path, settings.OUTPUT_DIR)
    tmp_out = actual_out_p + ".crop_tmp.mp4"

    try:
        # Filtro de recorte centrado a 9:16 con redondeo a números pares
        crop_filter = "crop=trunc(ih*9/32)*2:ih,scale=1080:1920"
        command = [
            ffmpeg_bin,
            "-y",
            "-i", in_p,
            "-vf", crop_filter,
            "-c:v", "libx264",
            "-preset", "fast",
            "-c:a", "copy",
            tmp_out
        ]
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600))
        
        if os.path.exists(tmp_out):
            if os.path.exists(actual_out_p):
                os.remove(actual_out_p)
            os.replace(tmp_out, actual_out_p)
            return actual_out_p
    except Exception as e:
        print(f"[AVISO] No se pudo reencuadrar verticalmente: {e}. Manteniendo formato original.")
        if os.path.exists(tmp_out):
            try:
                os.remove(tmp_out)
            except Exception:
                pass
                
    return actual_out_p
