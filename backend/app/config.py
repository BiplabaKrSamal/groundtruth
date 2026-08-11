from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str = ""
    llm_provider: str = "groq"
    llm_model: str = "llama-3.3-70b-versatile"
    cors_origins: str = "http://localhost:5173"
    max_questions_per_quiz: int = 12
    question_time_limit_seconds: int = 20
    retrieval_top_k: int = 4


settings = Settings()
