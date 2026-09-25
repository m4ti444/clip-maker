import asyncio
import os
import subprocess
from faster_whisper import WhisperModel
from backend.config import settings

class Transcriber:
    def __init__(self):
        # We load model lazily or at init based on requirements
        self.model = None

    def _load_model(self):
        if self.model is None:
            self.model = WhisperModel(settings.WHISPER_MODEL, device="cpu", compute_type="int8")

    def _extract_audio(self, video_path: str, audio_path: str):
        command = [
            "ffmpeg",
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
                for word in segment.words:
                    words_data.append({
                        "start": word.start,
                        "end": word.end,
                        "word": word.word,
                        "probability": word.probability
                    })
                segments_data.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text,
                    "words": words_data
                })
            
            return {
                "full_text": full_text.strip(),
                "segments": segments_data
            }
        finally:
            if os.path.exists(audio_path):
                os.remove(audio_path)

    async def transcribe(self, video_path: str) -> dict:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, video_path)

transcriber_service = Transcriber()
