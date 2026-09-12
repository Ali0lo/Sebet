import json
from pathlib import Path
from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DB_FILE = _PROJECT_ROOT / "sebet.db"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Sebet"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "sebet-clearinghouse-redemption-secret-key-2026"

    # Database: defaults to bundled SQLite database for zero-config plug-and-play
    DATABASE_URL: str = f"sqlite+aiosqlite:///{_DEFAULT_DB_FILE}"
    REDIS_URL: str = "redis://localhost:6379/0"

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

