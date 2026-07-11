"""Demo browser-agent runner for the MVP."""


async def execute_browser_agent(task: str) -> tuple[str, list[dict]]:
    action_log = [
        {
            "step": 1,
            "action": "open_browser",
            "target": "Sandbox browser session",
            "status": "success",
            "note": "Started an isolated demo browser run.",
        },
        {
            "step": 2,
            "action": "understand_task",
            "target": task,
            "status": "success",
            "note": "Converted the user request into browser steps.",
        },
        {
            "step": 3,
            "action": "navigate",
            "target": "Relevant website or search page",
            "status": "success",
            "note": "Opened the page needed for the task.",
        },
        {
            "step": 4,
            "action": "interact",
            "target": "Page controls",
            "status": "success",
            "note": "Searched, clicked, or filled fields needed for the task.",
        },
        {
            "step": 5,
            "action": "safe_stop",
            "target": "Sensitive actions",
            "status": "success",
            "note": "Stopped before payment, sending email, or final purchase.",
        },
    ]
    response = (
        "Browser-agent demo completed. The agent planned and recorded the web actions "
        "needed for this task, stopped before any sensitive final action, and saved "
        "the action log for verification."
    )
    return response, action_log
