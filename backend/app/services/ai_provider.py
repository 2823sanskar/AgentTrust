"""OpenRouter-only AI provider service for free-model execution."""

import logging
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)


async def execute_ai_provider(
    provider: str,
    model: str,
    system_prompt: str,
    task: str,
) -> str:
    """
    Execute a task using the configured AI provider.
    
    Args:
        provider: Must be 'openrouter'
        model: OpenRouter's free router or a model ID ending in ':free'
        system_prompt: The agent's system prompt
        task: The user's input task
    
    Returns:
        The AI model's response text.
    
    Raises:
        ValueError: If the provider is not supported or API key is missing.
        Exception: If the AI provider returns an error.
    """
    if provider != "openrouter":
        raise ValueError(f"Unsupported AI provider: {provider}")
    if model != "openrouter/free" and not model.endswith(":free"):
        raise ValueError("Only OpenRouter free models are allowed")
    return await _execute_openrouter(model, system_prompt, task)


async def _execute_openrouter(model: str, system_prompt: str, task: str) -> str:
    if not settings.OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
        default_headers={
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": settings.APP_NAME,
        },
    )

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task},
        ],
        temperature=0.7,
        max_tokens=1024,
    )

    return response.choices[0].message.content or ""
