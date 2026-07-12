"""Read-only browser-agent runner with an auditable action trail.

The agent may search and navigate public pages, including product research. It
records each observable browser action and stops before authentication,
checkout, payment, form submission, sending, or purchase confirmation.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from app.config import settings


TRANSACTIONAL_WORDS = {
    "buy",
    "checkout",
    "purchase",
    "pay",
    "payment",
    "order",
}

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
    removable_phrases = (
        r"\bbuy\s+me\b",
        r"\bpurchase\s+for\s+me\b",
        r"\bplace\s+an?\s+order\s+for\b",
        r"\bsearch\s+for\b",
        r"\blook\s+up\b",
        r"\bfind\b",
        r"\bgoogle\b",
        r"\bbrowse\b",
    )
    for phrase in removable_phrases:
        query = re.sub(phrase, " ", query, flags=re.I)
    query = " ".join(query.split()).strip(" ,.-")
    return query or task.strip()


def _is_public_result(href: str | None) -> bool:
    if not href or not href.startswith(("http://", "https://")):
        return False
    host = urlparse(href).netloc.lower()
    return bool(host)


async def execute_browser_agent(task: str) -> tuple[str, list[dict]]:
    action_log: list[dict] = []
    step = 1

    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        action_log.append(
            _log(
                step,
                "Browser setup failed",
                "Playwright",
                "failure",
                "Browser automation is not installed on the backend.",
            )
        )
        raise BrowserAgentExecutionError(
            "Browser automation is not installed yet. Install backend requirements and run: python -m playwright install chromium",
            action_log,
        ) from exc

    requested_url = _extract_url(task)
    query = _search_query(task)
    must_stop_before_transaction = _requests_transaction(task)

    action_log.append(
        _log(
            step,
            "Started browser",
            "Isolated Chromium session",
            "success",
            "Opened a fresh browser session for this run.",
        )
    )
    step += 1

    browser = None
    current_target = requested_url or "https://www.bing.com/"
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=settings.BROWSER_AGENT_HEADLESS,
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
            )
            page = await context.new_page()
            page.set_default_timeout(settings.BROWSER_AGENT_TIMEOUT_MS)

            if requested_url:
                action_log.append(
                    _log(step, "Opened requested website", requested_url, "pending", "Navigating to the website named in the instruction.")
                )
                await page.goto(requested_url, wait_until="domcontentloaded")
                action_log[-1].update(status="success", note=f"The page opened at {page.url}")
                step += 1
            else:
                action_log.append(
                    _log(step, "Opened search engine", current_target, "pending", "Opening a public search page.")
                )
                await page.goto(current_target, wait_until="domcontentloaded")
                action_log[-1].update(status="success", note="Bing search opened.")
                step += 1

                search_box = page.locator('input[name="q"]').first
                action_log.append(
                    _log(step, "Typed in search bar", query, "pending", "Entering the research query derived from the instruction.")
                )
                await search_box.fill(query)
                action_log[-1].update(status="success", note=f'Searched for: "{query}"')
                step += 1

                action_log.append(
                    _log(step, "Submitted search", query, "pending", "Submitting the search and waiting for results.")
                )
                await search_box.press("Enter")
                await page.wait_for_load_state("domcontentloaded")
                action_log[-1].update(status="success", target=page.url, note="Search results loaded.")
                step += 1

                result_links = page.locator("li.b_algo h2 a")
                result_count = await result_links.count()
                candidates: list[tuple[int, str, str]] = []
                for index in range(min(result_count, 10)):
                    link = result_links.nth(index)
                    href = await link.get_attribute("href")
                    if _is_public_result(href):
                        title_text = await link.evaluate(
                            "element => element.closest('h2')?.innerText || element.textContent || ''"
                        )
                        title = " ".join(title_text.split())
                        candidates.append((index, title or "Untitled result", href or ""))

                action_log.append(
                    _log(
                        step,
                        "Reviewed search results",
                        page.url,
                        "success" if candidates else "failure",
                        f"Found {len(candidates)} public result(s) that could be opened.",
                    )
                )
                step += 1

                if candidates:
                    index, result_title, result_url = candidates[0]
                    action_log.append(
                        _log(
                            step,
                            "Selected search result",
                            result_url,
                            "pending",
                            f'Opening the first public result: "{result_title}"',
                        )
                    )
                    selected_link = result_links.nth(index)
                    async with context.expect_page() as opened_page:
                        await selected_link.evaluate("element => element.click()")
                    page = await opened_page.value
                    page.set_default_timeout(settings.BROWSER_AGENT_TIMEOUT_MS)
                    await page.wait_for_url(
                        re.compile(r"^https?://(?![^/]*bing\.com).+"),
                        wait_until="domcontentloaded",
                    )
                    await page.wait_for_load_state("domcontentloaded")
                    action_log[-1].update(status="success", target=page.url, note=f'Opened "{result_title}" at {page.url}')
                    step += 1

            current_target = page.url
            title = await page.title()
            action_log.append(
                _log(step, "Read page title", page.url, "success", title or "The page loaded without a title.")
            )
            step += 1

            visible_text = await page.locator("body").inner_text(timeout=5000)
            compact_text = " ".join(visible_text.split())
            excerpt = compact_text[:1200]
            action_log.append(
                _log(
                    step,
                    "Read visible page content",
                    page.url,
                    "success",
                    f"Captured {len(compact_text)} characters of visible public page text.",
                )
            )
            step += 1

            stop_note = (
                "Research completed. Stopped before sign-in, checkout, payment, order submission, or purchase confirmation."
                if must_stop_before_transaction
                else "Public page research completed; no sensitive action was attempted."
            )
            action_log.append(
                _log(step, "Stopped at safety boundary", page.url, "success", stop_note)
            )

            response = (
                "Browser research completed.\n\n"
                f"Final URL: {page.url}\n"
                f"Page title: {title or 'No title found'}\n\n"
                "Visible page excerpt:\n"
                f"{excerpt or 'No visible text found.'}\n\n"
                f"Safety: {stop_note}"
            )
            await context.close()
            return response, action_log
    except Exception as exc:
        action_log.append(
            _log(step, "Browser action failed", current_target, "failure", str(exc))
        )
        raise BrowserAgentExecutionError(f"Browser agent failed: {exc}", action_log) from exc
    finally:
        if browser:
            await browser.close()
