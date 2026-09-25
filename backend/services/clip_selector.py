import json
import re
import httpx

try:
    from backend.config import settings
except ImportError:
    from config import settings

class ClipSelector:
    async def select_clips(self, transcript: dict, min_duration: int, max_duration: int, clip_count: int, campaigns: list = None, credentials: dict = None) -> list:
        # Construir transcripción con timestamps para que la IA sepa los segundos exactos
        timestamped_lines = []
        segments = transcript.get('segments', [])
        for s in segments:
            timestamped_lines.append(f"[{s['start']:.1f}s - {s['end']:.1f}s] {s['text']}")
        
        transcript_body = "\n".join(timestamped_lines[:250]) if timestamped_lines else transcript.get('full_text', '')

        prompt = f"""
You are an expert video editor and social media manager. Your task is to find the most viral moments from the provided video transcript with timestamps.
Find {clip_count} moments that are between {min_duration} and {max_duration} seconds long.
They should have a strong hook at the start, high retention potential, and be suitable for TikTok, Reels, and Shorts.
Use the timestamps from the transcript to set accurate start_time and end_time in seconds.

Return ONLY a valid JSON array. No explanations, no markdown blocks.
Format:
[
  {{
    "title": "Short catchy title in the video language",
    "start_time": 12.5,
    "end_time": 45.0,
    "virality_score": 88.0,
    "summary": "Brief explanation of this moment",
    "hook": "The opening hook phrase"
  }}
]

Transcript with timestamps:
{transcript_body}
"""
        if campaigns:
            try:
                campaigns_json = json.dumps([{"id": c.id, "name": c.name, "description": c.description} for c in campaigns])
                prompt += f"\n\nMatch each clip to one of these campaigns if appropriate:\n{campaigns_json}"
            except Exception:
                pass

        provider = credentials.get("provider") if credentials and credentials.get("provider") else settings.LLM_PROVIDER
        api_key = credentials.get("api_key") if credentials and credentials.get("api_key") else settings.LLM_API_KEY
        model = credentials.get("model") if credentials and credentials.get("model") else settings.LLM_MODEL
        ollama_url = credentials.get("ollama_url") if credentials and credentials.get("ollama_url") else settings.OLLAMA_URL

        results = []
        try:
            if provider == "gemini":
                results = await self._call_gemini(prompt, api_key, model)
            elif provider == "openai":
                results = await self._call_openai(prompt, api_key, model)
            elif provider == "ollama":
                results = await self._call_ollama(prompt, model, ollama_url)
            else:
                results = await self._call_gemini(prompt, api_key, model)
        except Exception as e:
            print(f"[AVISO] Error consultando LLM ({provider}): {e}")

        # Fallback a prueba de fallos: si la IA no devolvió clips válidos, generarlos por distribución inteligente
        if not results or not isinstance(results, list):
            results = self._fallback_moments(segments, min_duration, max_duration, clip_count)

        return results

    def _parse_response(self, text: str) -> list:
        if not text:
            return []
        text = text.strip()
        # 1. Buscar bloque JSON entre corchetes
        match = re.search(r'\[[\s\S]*\]', text)
        if match:
            try:
                data = json.loads(match.group(0))
                if isinstance(data, list) and len(data) > 0:
                    return data
            except Exception:
                pass
                
        # 2. Buscar objeto con campo clips
        match_obj = re.search(r'\{[\s\S]*\}', text)
        if match_obj:
            try:
                data = json.loads(match_obj.group(0))
                for key in ['clips', 'moments', 'results', 'data']:
                    if key in data and isinstance(data[key], list):
                        return data[key]
                return [data]
            except Exception:
                pass
                
        return []

    def _fallback_moments(self, segments: list, min_dur: int, max_dur: int, count: int) -> list:
        """Fallback garantizado: crea clips uniformemente distribuidos a partir de la transcripción"""
        if not segments:
            return [{"title": f"Clip {i+1}", "start_time": float(i * min_dur), "end_time": float((i+1) * min_dur), "virality_score": 75.0, "summary": f"Destacado {i+1}", "hook": ""} for i in range(count)]
            
        total_time = segments[-1].get('end', 60.0)
        target_duration = float(min(max_dur, max(min_dur, 35)))
        step = max(target_duration, total_time / (count + 1))
        
        clips = []
        for i in range(count):
            start = min(total_time - target_duration, max(0.0, i * step))
            end = min(total_time, start + target_duration)
            clips.append({
                "title": f"Momento viral #{i+1}",
                "start_time": round(start, 1),
                "end_time": round(end, 1),
                "virality_score": 80.0 - (i * 2),
                "summary": f"Fragmento del minuto {int(start//60)}:{int(start%60):02d}",
                "hook": f"¡Mira este momento!"
            })
        return clips

    async def _call_gemini(self, prompt: str, api_key: str, model: str) -> list:
        if not api_key:
            return []
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=60.0)
            resp.raise_for_status()
            data = resp.json()
            try:
                text_response = data['candidates'][0]['content']['parts'][0]['text']
                return self._parse_response(text_response)
            except Exception:
                return []

    async def _call_openai(self, prompt: str, api_key: str, model: str) -> list:
        if not api_key:
            return []
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": model or "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are a video editing assistant. You must return valid JSON."},
                {"role": "user", "content": prompt}
            ]
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=60.0)
            resp.raise_for_status()
            data = resp.json()
            try:
                text_response = data['choices'][0]['message']['content']
                return self._parse_response(text_response)
            except Exception:
                return []

    async def _call_ollama(self, prompt: str, model: str, ollama_url: str) -> list:
        url = f"{ollama_url.rstrip('/')}/api/generate"
        payload = {
            "model": model or "llama3.1",
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=120.0)
            resp.raise_for_status()
            data = resp.json()
            try:
                text_response = data['response']
                return self._parse_response(text_response)
            except Exception:
                return []

clip_selector_service = ClipSelector()
