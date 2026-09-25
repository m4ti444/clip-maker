import json
import httpx
from backend.config import settings

class ClipSelector:
    async def select_clips(self, transcript: dict, min_duration: int, max_duration: int, clip_count: int, campaigns: list = None, credentials: dict = None) -> list:
        prompt = f"""
You are an expert video editor and social media manager. Your task is to find the most viral moments from the provided video transcript.
Find {clip_count} moments that are between {min_duration} and {max_duration} seconds long.
They should have a strong hook, high engagement potential, and be suitable for short-form platforms (TikTok, Reels, Shorts).
Return the result as a JSON array. DO NOT return markdown blocks, ONLY valid JSON.
Format:
[
  {{
    "title": "Catchy title in English or Spanish depending on context",
    "start_time": 12.3,
    "end_time": 45.6,
    "virality_score": 85.5,
    "summary": "Brief summary",
    "hook": "The hook phrase used",
    "campaign_matches": []
  }}
]

Transcript:
{transcript['full_text']}
"""
        if campaigns:
            prompt += f"\n\nConsider these campaigns and match clips if relevant:\n{json.dumps([c.dict() for c in campaigns])}"

        provider = credentials.get("provider") if credentials and credentials.get("provider") else settings.LLM_PROVIDER
        api_key = credentials.get("api_key") if credentials and credentials.get("api_key") else settings.LLM_API_KEY
        model = credentials.get("model") if credentials and credentials.get("model") else settings.LLM_MODEL
        ollama_url = credentials.get("ollama_url") if credentials and credentials.get("ollama_url") else settings.OLLAMA_URL

        if provider == "gemini":
            return await self._call_gemini(prompt, api_key, model)
        elif provider == "openai":
            return await self._call_openai(prompt, api_key, model)
        elif provider == "ollama":
            return await self._call_ollama(prompt, model, ollama_url)
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")

    def _parse_response(self, text: str) -> list:
        # rudimentary cleanup
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())

    async def _call_gemini(self, prompt: str, api_key: str, model: str) -> list:
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
            except (KeyError, IndexError, json.JSONDecodeError):
                return []

    async def _call_openai(self, prompt: str, api_key: str, model: str) -> list:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"}
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=60.0)
            resp.raise_for_status()
            data = resp.json()
            try:
                text_response = data['choices'][0]['message']['content']
                return json.loads(text_response).get("clips", self._parse_response(text_response))
            except (KeyError, IndexError, json.JSONDecodeError):
                return []

    async def _call_ollama(self, prompt: str, model: str, ollama_url: str) -> list:
        url = f"{ollama_url}/api/generate"
        payload = {
            "model": model,
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
            except (KeyError, json.JSONDecodeError):
                return []

clip_selector_service = ClipSelector()
