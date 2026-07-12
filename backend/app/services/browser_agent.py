"""Real browser-agent runner for the MVP.

The first browser-agent version intentionally supports safe read-only tasks:
opening a URL or searching the web, collecting page text, and recording every
step. It stops before sensitive actions such as login, checkout, or sending.
"""

from __future__ import annotations

import re
from urllib.parse import quote_plus, urlparse

from app.config import settings


SENSITIVE_WORDS = {
    "buy",
    "checkout",
    "purchase",
    "pay",
    "payment",
    "order",
    "login",
    "log in",
    "sign in",
    "signup",
    "sign up",
    "password",
    "email send",
    "send email",
    "submit",
}


def _log(step: int, action: str, target: str, status: str, note: str) -> dict:
    return {
        "step": step,
        "action": action,
        "target": target,
        "status": status,
        "note": note,
    }


def _is_sensitive(task: str) -> bool:
    normalized = task.lower()
    return any(word in normalized for word in SENSITIVE_WORDS)


def _extract_url(task: str) -> str | None:
    match = re.search(r"https?://[^\s]+", task)
    if match:
        return match.group(0).rstrip(".,)")

    domain_match = re.search(
        r"\b(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?:/[^\s]*)?",
        task,
    )
    if domain_match:
        value = domain_match.group(0).rstrip(".,)")
        return value if value.startswith("http") else f"https://{value}"

    return None


def _search_url(task: str) -> str:
    cleaned = re.sub(r"\b(search|google|find|look up|browse)\b", "", task, flags=re.I)
    query = cleaned.strip() or task.strip()
    return f"https://duckduckgo.com/?q={quote_plus(query)}"


async def execute_browser_agent(task: str) -> tuple[str, list[dict]]:
    action_log: list[dict] = []
    step = 1

    if _is_sensitive(task):
        action_log.append(
            _log(
                step,
                "safe_stop",
                "Sensitive browser action",
                "success",
                "The browser agent stopped before login, payment, purchase, submit, or sending actions.",
            )
        )
        return (
            "I stopped before doing a sensitive action. This MVP browser agent can safely open pages, search, and read public information, but it will not log in, pay, submit forms, send emails, or complete purchases.",
            action_log,
        )

    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        action_log.append(
            _log(
                step,
                "browser_dependency_missing",
                "Playwright",
                "failure",
                "Install backend requirements and run: python -m playwright install chromium",
            )
        )
        raise RuntimeError(
            "Browser automation is not installed yet. Install backend requirements and run: python -m playwright install chromium"
        ) from exc

    target_url = _extract_url(task) or _search_url(task)
    parsed = urlparse(target_url)

    action_log.append(
        _log(
            step,
            "open_browser",
            "Chromium sandbox",
            "success",
            "Started a real isolated browser session for this run.",
        )
    )
    step += 1

    browser = None
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=settings.BROWSER_AGENT_HEADLESS,
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="AgentTrustBrowserAgent/1.0",
            )
            page = await context.new_page()
            page.set_default_timeout(settings.BROWSER_AGENT_TIMEOUT_MS)

            action_log.append(
                _log(
                    step,
                    "navigate",
                    target_url,
                    "pending",
                    f"Opening {parsed.netloc or 'search results'} in the browser.",
                )
            )
            await page.goto(target_url, wait_until="domcontentloaded")
            action_log[-1]["status"] = "success"
            action_log[-1]["note"] = f"Opened page with final URL: {page.url}"
            step += 1

            title = await page.title()
            action_log.append(
                _log(
                    step,
                    "read_title",
                    page.url,
                    "success",
                    title or "Page loaded without a title.",
                )
            )
            step += 1

            visible_text = await page.locator("body").inner_text(timeout=5000)
            compact_text = " ".join(visible_text.split())
            excerpt = compact_text[:1200]

            action_log.append(
                _log(
                    step,
                    "extract_page_text",
                    page.url,
                    "success",
                    f"Captured {len(compact_text)} characters of visible page text.",
                )
            )
            step += 1

            action_log.append(
                _log(
                    step,
                    "safe_stop",
                    "End of read-only browser task",
                    "success",
                    "Stopped after public page reading; no login, payment, form submit, or purchase was attempted.",
                )
            )

            response = (
                "Browser task completed.\n\n"
                f"Final URL: {page.url}\n"
                f"Page title: {title or 'No title found'}\n\n"
                "Visible page excerpt:\n"
                f"{excerpt or 'No visible text found.'}"
            )
            await context.close()
            return response, action_log
    except Exception as exc:
        action_log.append(
            _log(
                step,
                "browser_error",
                target_url,
                "failure",
                str(exc),
            )
        )
        raise RuntimeError(f"Browser agent failed: {exc}") from exc
    finally:
        if browser:
            await browser.close()
