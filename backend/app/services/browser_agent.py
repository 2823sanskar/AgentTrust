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


def _error_text(exc: Exception) -> str:
    message = str(exc).strip()
    if message:
        return message
    return f"{type(exc).__name__}: {repr(exc)}"


def _is_network_block(message: str) -> bool:
    needles = (
        "WinError 10013",
        "ERR_NETWORK_ACCESS_DENIED",
        "ERR_INTERNET_DISCONNECTED",
        "ERR_NAME_NOT_RESOLVED",
        "net::ERR_FAILED",
    )
    return any(needle in message for needle in needles)


async def _goto_first_available(page, urls: list[str], step: int, action_log: list[dict]) -> str:
    last_error = ""
    for url in urls:
        try:
            await page.goto(url, wait_until="domcontentloaded")
            action_log[-1].update(status="success", target=page.url, note=f"Page loaded at {page.url}")
            return page.url
        except Exception as exc:
            last_error = _error_text(exc)
            action_log[-1].update(status="blocked" if _is_network_block(last_error) else "failure", target=url, note=last_error)
            if url != urls[-1]:
                action_log.append(_log(step, "Retried search provider", urls[-1], "pending", "Primary search page failed; trying fallback search."))
    raise BrowserAgentExecutionError(f"Search page failed: {last_error}", action_log)


async def _safe_goto(page, url: str) -> None:
    """Try multiple wait_until strategies, falling back gracefully."""
    for wait_until in ("domcontentloaded", "load", "commit"):
        try:
            await page.goto(url, wait_until=wait_until)
            return
        except Exception:
            if wait_until == "commit":
                raise


async def _safe_text(page) -> str:
    for selector in ("main", "article", "body"):
        try:
            locator = page.locator(selector)
            if await locator.count() == 0:
                continue
            text = await locator.first.inner_text(timeout=5000)
            if text.strip():
                return text
        except Exception:
            continue
    try:
        return await page.evaluate("document.body ? document.body.innerText : ''")
    except Exception:
        return ""


async def execute_browser_agent(task: str) -> tuple[str, list[dict]]:
    action_log: list[dict] = []
    step = 1

    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        message = _error_text(exc)
        action_log.append(_log(step, "Browser setup failed", "Playwright", "blocked", f"Browser automation is not installed on the backend. {message}"))
        return (
            "Browser agent could not start.\n\n"
            "Playwright is not installed on the backend. The run is recorded for audit instead of failing the execution.",
            action_log,
        )

    requested_url = _extract_url(task)
    query = _search_query(task)
    search_url = f"https://www.bing.com/search?q={quote_plus(query)}"
    fallback_search_url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
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
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                ignore_https_errors=True,
            )
            page = await context.new_page()
            page.set_default_timeout(settings.BROWSER_AGENT_ACTION_TIMEOUT_MS)
            page.set_default_navigation_timeout(settings.BROWSER_AGENT_NAVIGATION_TIMEOUT_MS)

            if requested_url:
                action_log.append(_log(step, "Opened requested website", requested_url, "pending", "Navigating to the website named in the instruction."))
            else:
                action_log.append(_log(step, "Searched the web", query, "pending", "Opening search results directly for the research query."))

            if requested_url:
                await _safe_goto(page, current_target)
                action_log[-1].update(status="success", target=page.url, note=f"Page loaded at {page.url}")
            else:
                await _goto_first_available(page, [search_url, fallback_search_url], step, action_log)
            step += 1

            if not requested_url:
                result_links = page.locator('li.b_algo h2 a, a[data-testid="result-title-a"], article h2 a, .result__title a, a.result__a')
                candidates: list[tuple[str, str]] = []
                try:
                    count = min(await result_links.count(), 10)
                    for index in range(count):
                        link = result_links.nth(index)
                        href = await link.get_attribute("href")
                        if _is_public_result(href):
                            title = " ".join((await link.inner_text()).split()) or "Untitled result"
                            candidates.append((title, href or ""))
                except Exception:
                    pass

                action_log.append(_log(step, "Reviewed search results", page.url, "success", f"Found {len(candidates)} public result(s) that could be opened."))
                step += 1

                opened_result = False
                for result_title, result_url in candidates[:5]:
                    action_log.append(_log(step, "Opened search result", result_url, "pending", f'Opening public result: "{result_title}"'))
                    try:
                        await _safe_goto(page, result_url)
                        action_log[-1].update(status="success", target=page.url, note=f'Opened "{result_title}" at {page.url}')
                        opened_result = True
                        step += 1
                        break
                    except Exception as exc:
                        action_log[-1].update(status="failure", target=result_url, note=_error_text(exc))
                        step += 1

                if not opened_result:
                    action_log.append(_log(step, "Used search results page", page.url, "success", "No safe result link opened; using search page content instead."))
                    step += 1

            current_target = page.url
            title = await page.title()
            action_log.append(_log(step, "Read page title", page.url, "success", title or "The page loaded without a title."))
            step += 1

            visible_text = await _safe_text(page)
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
        message = _error_text(exc)
        if isinstance(exc, BrowserAgentExecutionError):
            action_log = exc.action_log
        blocked = _is_network_block(message)
        status_value = "blocked" if blocked else "failure"
        note = (
            "Backend browser has no outbound internet access in this local environment. "
            f"Original error: {message}"
            if blocked
            else message
        )
        if action_log and action_log[-1]["status"] == "pending":
            action_log[-1].update(status=status_value, note=note)
        else:
            action_log.append(_log(step, "Browser action failed", current_target, status_value, note))
        if action_log:
            heading = (
                "Browser agent could not reach the web from this machine."
                if blocked
                else "Browser research completed with recoverable errors."
            )
            response = (
                f"{heading}\n\n"
                f"Last target: {current_target}\n"
                f"Error: {message}\n\n"
                "The run is recorded with its action log for audit."
            )
            return response, action_log
        raise BrowserAgentExecutionError(f"Browser agent failed: {message}", action_log) from exc
    finally:
        if browser:
            try:
                await browser.close()
            except Exception:
                pass
