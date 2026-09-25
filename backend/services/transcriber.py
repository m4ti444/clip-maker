import asyncio
import os
import subprocess
from faster_whisper import WhisperModel

try:
    from backend.config import settings
    from backend.services.ffmpeg_utils import get_ffmpeg_cmd
except ImportError:
    from config import settings
    from services.ffmpeg_utils import get_ffmpeg_cmd

class Transcriber:
    def __init__(self):
        self.model = None

    def _load_model(self):
        if self.model is None:
            # compute_type="int8" y device="cpu" garantizan máxima compatibilidad sin requerir CUDA
            self.model = WhisperModel(settings.WHISPER_MODEL, device="cpu", compute_type="int8")

    def _extract_audio(self, video_path: str, audio_path: str):
        ffmpeg_bin = get_ffmpeg_cmd()
        command = [
            ffmpeg_bin,
            "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            audio_path
        ]
        subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    def _transcribe_sync(self, video_path: str) -> dict:
        self._load_model()
        audio_path = video_path + ".wav"
        try:
            self._extract_audio(video_path, audio_path)
            segments, info = self.model.transcribe(audio_path, word_timestamps=True)
            
            full_text = ""
            segments_data = []
            for segment in segments:
                full_text += segment.text + " "
                words_data = []
                if segment.words:
                    for word in segment.words:
                        words_data.append({
                            "start": word.start,
                            "end": word.end,
                            "word": word.word,
                            "probability": getattr(word, "probability", 1.0)
                        })
                segments_data.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                    "words": words_data
                })
            
            return {
                "full_text": full_text.strip(),
                "segments": segments_data
            }
        finally:
            if os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except Exception:
                    pass

    async def transcribe(self, video_path: str) -> dict:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, video_path)

transcriber_service = Transcriber()
