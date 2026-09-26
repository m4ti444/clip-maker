import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    UPLOAD_DIR: str = "./uploads"
    OUTPUT_DIR: str = "./output"
    DB_URL: str = "sqlite+aiosqlite:///./clipengine.db"
    WHISPER_MODEL: str = "base"
    LLM_PROVIDER: str = "gemini"  # gemini, openai, ollama
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-3.8-flash"
    OLLAMA_URL: str = "http://localhost:11434"
    DEFAULT_CLIP_MIN_DURATION: int = 30
    DEFAULT_CLIP_MAX_DURATION: int = 60
    DEFAULT_CLIP_COUNT: int = 5
    TEMP_FILE_TTL_HOURS: int = 24
    MAX_UPLOAD_SIZE_MB: int = 500
    SESSION_SECRET: str = "clipengine-secret-change-me"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
