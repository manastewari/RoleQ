from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[3]
API_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.5"
    openai_realtime_model: str = "gpt-realtime-2"
    judge0_url: str = "https://ce.judge0.com"
    judge0_auth_token: str | None = None
    judge0_auth_header: str = "X-Auth-Token"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Production/dev deployments should set this to PostgreSQL. The SQLite
    # default keeps the repository runnable on machines without Docker and is
    # also used by the isolated automated test suite.
    database_url: str = f"sqlite:///{(API_DIR / 'platform.db').as_posix()}"
    auth_mode: str = "supabase"
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    jwt_secret: str = "change-this-local-development-secret"
    access_token_minutes: int = 720
    max_upload_bytes: int = 10 * 1024 * 1024
    storage_dir: Path = API_DIR / "storage"
    artifact_retention_days: int = 30

    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", API_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
