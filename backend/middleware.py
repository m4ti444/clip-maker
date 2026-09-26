from fastapi import Request, HTTPException
import httpx
import re
from backend.config import settings
from backend.security import CredentialEncryption, AuditLogger

crypto = CredentialEncryption(settings.SESSION_SECRET if hasattr(settings, "SESSION_SECRET") else "default_secret_key_1234567890123")
audit = AuditLogger()

class UserCredentials:
    def __init__(self, provider: str, api_key: str, model: str = None, ollama_url: str = None):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self.ollama_url = ollama_url

def get_user_credentials(request: Request) -> dict:
    provider = request.headers.get("X-LLM-Provider")
    api_key = request.headers.get("X-LLM-API-Key", "")
    model = request.headers.get("X-LLM-Model")
    ollama_url = request.headers.get("X-Ollama-URL")
    
    if api_key.startswith("enc:"):
        try:
            api_key = crypto.decrypt(api_key[4:])
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid encrypted credential")
            
    if api_key:
        if len(api_key) < 8 or len(api_key) > 200:
            raise HTTPException(status_code=400, detail="Invalid API key length")
        if not re.match(r'^[\w\-\.:]+$', api_key):
            raise HTTPException(status_code=400, detail="Invalid API key format")
    
    return {
        "provider": provider,
        "api_key": api_key,
        "model": model,
        "ollama_url": ollama_url
    }

async def validate_credentials(credentials: dict, ip: str = "unknown") -> bool:
    provider = credentials.get("provider")
    api_key = credentials.get("api_key", "")
    model = credentials.get("model") or "gemini-3.8-flash"
    if provider == "gemini" and model in ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"]:
        model = "gemini-3.8-flash"
    ollama_url = credentials.get("ollama_url") or "http://localhost:11434"
    
    if api_key:
        if len(api_key) < 8 or len(api_key) > 200:
            await audit.log_auth(ip, provider, False, "Invalid length")
            return False
        if not re.match(r'^[\w\-\.:]+$', api_key):
            await audit.log_auth(ip, provider, False, "Invalid format")
            return False
    
    if not provider:
        return False
        
    try:
        async with httpx.AsyncClient() as client:
            if provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                resp = await client.post(url, json={"contents": [{"parts": [{"text": "hi"}]}]}, timeout=10.0)
                return resp.status_code == 200
            elif provider == "openai":
                url = "https://api.openai.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {api_key}"}
                resp = await client.post(url, headers=headers, json={"model": model, "messages": [{"role": "user", "content": "hi"}]}, timeout=10.0)
                return resp.status_code == 200
            elif provider == "ollama":
                url = f"{ollama_url}/api/tags"
                resp = await client.get(url, timeout=10.0)
                return resp.status_code == 200
    except Exception:
        return False
    return False
