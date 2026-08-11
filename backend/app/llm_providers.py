import json
from abc import ABC, abstractmethod

from groq import AsyncGroq

from app.config import settings


class LLMProvider(ABC):
    @abstractmethod
    async def complete_json(self, system: str, user: str) -> dict:
        """Return a parsed JSON object from the model. Raises on malformed output."""


class GroqProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        self._client = AsyncGroq(api_key=api_key)
        self._model = model

    async def complete_json(self, system: str, user: str) -> dict:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
        content = response.choices[0].message.content
        return json.loads(content)


_provider: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _provider
    if _provider is None:
        if settings.llm_provider == "groq":
            _provider = GroqProvider(settings.groq_api_key, settings.llm_model)
        else:
            raise ValueError(f"Unknown llm_provider: {settings.llm_provider}")
    return _provider
