"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./energy.db"
    app_name: str = "Energy Management System"
    debug: bool = False

    model_config = {"env_prefix": "EMS_"}


settings = Settings()
