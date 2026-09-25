import asyncio
import os
import subprocess
from backend.config import settings
from backend.security import InputSanitizer

async def cut_clip(video_path: str, start: float, end: float, output_path: str) -> str:
    start = InputSanitizer.sanitize_time_param(start)
    end = InputSanitizer.sanitize_time_param(end)
    
    try:
        in_p = InputSanitizer.sanitize_path(video_path, settings.UPLOAD_DIR)
    except ValueError:
        in_p = InputSanitizer.sanitize_path(video_path, settings.OUTPUT_DIR)
    out_p = InputSanitizer.sanitize_path(output_path, settings.OUTPUT_DIR)
    if os.path.exists(out_p):
        raise ValueError("Output file already exists")

    command = [
        "ffmpeg",
        "-y",
        "-i", in_p,
        "-ss", str(start),
        "-to", str(end),
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:a", "aac",
        out_p
    ]
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600))
    return out_p

def generate_ass_subtitles(words: list, style: str) -> str:
    # A simplified ASS generator
    ass_header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,150,1
Style: Hormozi,Arial,80,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,0,2,10,10,200,1
Style: Minimal,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ass_events = ""
    style_name = style.capitalize() if style.capitalize() in ["Default", "Hormozi", "Minimal"] else "Default"
    
    for word in words:
        start_time = _format_ass_time(word['start'])
        end_time = _format_ass_time(word['end'])
        text = InputSanitizer.sanitize_text(word['word'].strip())
        ass_events += f"Dialogue: 0,{start_time},{end_time},{style_name},,0,0,0,,{text}\n"
    
    return ass_header + ass_events

def _format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

async def add_subtitles(video_path: str, words: list, output_path: str, style: str = 'default') -> str:
    style = InputSanitizer.sanitize_text(style, 20)
    try:
        in_p = InputSanitizer.sanitize_path(video_path, settings.UPLOAD_DIR)
    except ValueError:
        in_p = InputSanitizer.sanitize_path(video_path, settings.OUTPUT_DIR)
    
    is_overwrite = False
    actual_out_p = InputSanitizer.sanitize_path(output_path, settings.OUTPUT_DIR)
    if in_p == actual_out_p:
        is_overwrite = True
        out_p = actual_out_p + ".tmp.mp4"
    else:
        out_p = actual_out_p
        if os.path.exists(out_p):
            raise ValueError("Output file already exists")

    ass_path = in_p + ".ass"
    ass_content = generate_ass_subtitles(words, style)
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
        
    # We must format the ASS path for FFmpeg, escaping backslashes for Windows
    safe_ass_path = ass_path.replace('\\', '\\\\').replace(':', '\\:')
    
    command = [
        "ffmpeg",
        "-y",
        "-i", in_p,
        "-vf", f"ass='{safe_ass_path}'",
        "-c:a", "copy",
        out_p
    ]
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600))
    
    if os.path.exists(ass_path):
        os.remove(ass_path)
        
    if is_overwrite:
        os.replace(out_p, actual_out_p)
    return actual_out_p

async def reframe_vertical(video_path: str, face_positions: list, output_path: str) -> str:
    try:
        in_p = InputSanitizer.sanitize_path(video_path, settings.UPLOAD_DIR)
    except ValueError:
        in_p = InputSanitizer.sanitize_path(video_path, settings.OUTPUT_DIR)
        
    is_overwrite = False
    actual_out_p = InputSanitizer.sanitize_path(output_path, settings.OUTPUT_DIR)
    if in_p == actual_out_p:
        is_overwrite = True
        out_p = actual_out_p + ".tmp.mp4"
    else:
        out_p = actual_out_p
        if os.path.exists(out_p):
            raise ValueError("Output file already exists")

    command = [
        "ffmpeg",
        "-y",
        "-i", in_p,
        "-vf", "crop=ih*(9/16):ih,scale=1080:1920",
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:a", "copy",
        out_p
    ]
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600))
    
    if is_overwrite:
        os.replace(out_p, actual_out_p)
    return actual_out_p
