"""Read-only browser research with an auditable action trail."""

from __future__ import annotations

import re
from urllib.parse import quote_plus, urlparse

from app.config import settings


TRANSACTIONAL_WORDS = {"buy", "checkout", "purchase", "pay", "payment", "order"}


class BrowserAgentExecutionError(RuntimeError):
    """Preserve completed browser steps when a run fails partway through."""

    def __init__(self, message: str, action_log: list[dict]):
        super().__init__(message)
        self.action_log = action_log


def _log(step: int, action: str, target: str, status: str, note: str) -> dict:
    return {
        "step": step,
        "action": action,
        "target": target,
        "status": status,
        "note": note,
    }


def _requests_transaction(task: str) -> bool:
    normalized = task.lower()
    return any(re.search(rf"\b{re.escape(word)}\b", normalized) for word in TRANSACTIONAL_WORDS)


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


def _search_query(task: str) -> str:
    query = task
    for phrase in (
        r"\bbuy\s+me\b",
        r"\bpurchase\s+for\s+me\b",
        r"\bplace\s+an?\s+order\s+for\b",
        r"\bsearch\s+for\b",
        r"\blook\s+up\b",
        r"\bfind\b",
        r"\bgoogle\b",
        r"\bbrowse\b",
    ):
        query = re.sub(phrase, " ", query, flags=re.I)
    return " ".join(query.split()).strip(" ,.-") or task.strip()


def _is_public_result(href: str | None) -> bool:
    if not href or not href.startswith(("http://", "https://")):
        return False
    return bool(urlparse(href).netloc)


async def execute_browser_agent(task: str) -> tuple[str, list[dict]]:
    action_log: list[dict] = []
    step = 1

    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        action_log.append(_log(step, "Browser setup failed", "Playwright", "failure", "Browser automation is not installed on the backend."))
        raise BrowserAgentExecutionError("Browser automation is not installed.", action_log) from exc

    requested_url = _extract_url(task)
    query = _search_query(task)
    search_url = f"https://www.bing.com/search?q={quote_plus(query)}"
    must_stop_before_transaction = _requests_transaction(task)
    current_target = requested_url or search_url

    action_log.append(_log(step, "Started browser", "Isolated Chromium session", "success", "Opened a fresh browser session for this run."))
    step += 1

    browser = None
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=settings.BROWSER_AGENT_HEADLESS)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            )
            page = await context.new_page()
            page.set_default_timeout(settings.BROWSER_AGENT_ACTION_TIMEOUT_MS)
            page.set_default_navigation_timeout(settings.BROWSER_AGENT_NAVIGATION_TIMEOUT_MS)

            if requested_url:
                action_log.append(_log(step, "Opened requested website", requested_url, "pending", "Navigating to the website named in the instruction."))
            else:
                action_log.append(_log(step, "Searched the web", query, "pending", "Opening search results directly for the research query."))

            await page.goto(current_target, wait_until="domcontentloaded")
            action_log[-1].update(status="success", target=page.url, note=f"Page loaded at {page.url}")
            step += 1

            if not requested_url:
                result_links = page.locator('li.b_algo h2 a, a[data-testid="result-title-a"], article h2 a, .result__title a')
                candidates: list[tuple[str, str]] = []
                for index in range(min(await result_links.count(), 10)):
                    link = result_links.nth(index)
                    href = await link.get_attribute("href")
                    if _is_public_result(href):
                        title = " ".join((await link.inner_text()).split()) or "Untitled result"
                        candidates.append((title, href or ""))

                action_log.append(_log(step, "Reviewed search results", page.url, "success" if candidates else "failure", f"Found {len(candidates)} public result(s) that could be opened."))
                step += 1

                if candidates:
                    result_title, result_url = candidates[0]
                    action_log.append(_log(step, "Opened search result", result_url, "pending", f'Opening the first public result: "{result_title}"'))
                    await page.goto(result_url, wait_until="domcontentloaded")
                    action_log[-1].update(status="success", target=page.url, note=f'Opened "{result_title}" at {page.url}')
                    step += 1

            current_target = page.url
            title = await page.title()
            action_log.append(_log(step, "Read page title", page.url, "success", title or "The page loaded without a title."))
            step += 1

            visible_text = await page.locator("body").inner_text(timeout=settings.BROWSER_AGENT_ACTION_TIMEOUT_MS)
            compact_text = " ".join(visible_text.split())
            excerpt = compact_text[:3000]
            action_log.append(_log(step, "Read visible page content", page.url, "success", f"Captured {len(compact_text)} characters of visible public page text."))
            step += 1

            stop_note = (
                "Research completed. Stopped before sign-in, checkout, payment, order submission, or purchase confirmation."
                if must_stop_before_transaction
                else "Public page research completed; no sensitive action was attempted."
            )
            action_log.append(_log(step, "Stopped at safety boundary", page.url, "success", stop_note))

            response = (
                "Browser research completed.\n\n"
                f"Final URL: {page.url}\n"
                f"Page title: {title or 'No title found'}\n\n"
                f"Visible page excerpt:\n{excerpt or 'No visible text found.'}\n\n"
                f"Safety: {stop_note}"
            )
            await context.close()
            return response, action_log
    except Exception as exc:
        if action_log and action_log[-1]["status"] == "pending":
            action_log[-1].update(status="failure", note=str(exc))
        else:
            action_log.append(_log(step, "Browser action failed", current_target, "failure", str(exc)))
        raise BrowserAgentExecutionError(f"Browser agent failed: {exc}", action_log) from exc
    finally:
        if browser:
            await browser.close()
