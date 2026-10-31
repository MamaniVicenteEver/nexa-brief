from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    app_env: str = 'development'
    nexa_tiktok_host: str = '127.0.0.1'
    nexa_tiktok_port: int = 8100
    nexa_tiktok_key: str = ''
    nexa_tiktok_encryption_key: str = ''
    nexa_tiktok_data_dir: Path = Path('data')
    nexa_tiktok_job_timeout: float = Field(default=1200, gt=0)


settings = Settings()
