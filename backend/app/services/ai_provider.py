"""
AI Provider service: Unified interface for Groq, OpenAI, and Gemini.
"""

import logging
from openai import AsyncOpenAI
from google import genai

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
        provider: One of 'groq', 'openai', 'gemini'
        model: The model identifier (e.g., 'llama-3.3-70b-versatile')
        system_prompt: The agent's system prompt
        task: The user's input task
    
    Returns:
        The AI model's response text.
    
    Raises:
        ValueError: If the provider is not supported or API key is missing.
        Exception: If the AI provider returns an error.
    """
    if provider == "groq":
        return await _execute_groq(model, system_prompt, task)
    elif provider == "openai":
        return await _execute_openai(model, system_prompt, task)
    elif provider == "gemini":
        return await _execute_gemini(model, system_prompt, task)
    elif provider == "openrouter":
        return await _execute_openrouter(model, system_prompt, task)
    else:
        raise ValueError(f"Unsupported AI provider: {provider}")


async def _execute_groq(model: str, system_prompt: str, task: str) -> str:
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured")

    client = AsyncOpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.GROQ_API_KEY,
    )

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task},
        ],
        temperature=0.7,
        max_tokens=4096,
    )

    return response.choices[0].message.content or ""


async def _execute_openai(model: str, system_prompt: str, task: str) -> str:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured")

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task},
        ],
        temperature=0.7,
        max_tokens=4096,
    )

    return response.choices[0].message.content or ""


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
        max_tokens=4096,
    )

    return response.choices[0].message.content or ""


async def _execute_gemini(model: str, system_prompt: str, task: str) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # Combine system prompt and task for Gemini's generate_content
    full_prompt = f"{system_prompt}\n\nUser task: {task}"

    response = client.models.generate_content(
        model=model,
        contents=full_prompt,
    )

    return response.text or ""
