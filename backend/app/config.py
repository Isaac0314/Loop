"""Runtime configuration, read from environment variables (or a .env file).

The AI key never reaches the browser: it lives here, server-side only.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database. SQLite by default (zero-config); set DATABASE_URL to a Postgres
    # DSN in production, e.g. postgresql+psycopg://user:pass@host/db
    database_url: str = "sqlite:///./loop_ai.db"

    # Kimi (Moonshot) API. Brief / milestones / act use the fast model;
    # the conversational Ask can use a higher-quality one if you have access.
    kimi_api_key: str = ""
    kimi_base: str = "https://api.moonshot.ai/v1"
    kimi_model: str = "moonshot-v1-32k"
    kimi_model_ask: str = "moonshot-v1-32k"

    # Comma-separated list of allowed CORS origins ("*" for any).
    cors_origins: str = "*"


settings = Settings()
