"""Regression coverage for interactive desktop execution startup."""

import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import execution_service


class InteractiveExecutionTests(unittest.IsolatedAsyncioTestCase):
    async def test_current_user_is_passed_to_desktop_initializer(self) -> None:
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        agent = SimpleNamespace(status="active")
        user = SimpleNamespace(
            id=user_id,
            stellar_wallet_address="G" + ("A" * 55),
            stellar_wallet_network="mainnet",
        )
        agent_result = MagicMock()
        agent_result.scalar_one_or_none.return_value = agent
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = user
        db = AsyncMock()
        db.execute.side_effect = [agent_result, user_result]
        expected_response = object()

        with patch.object(
            execution_service,
            "_start_interactive_desktop_run",
            AsyncMock(return_value=expected_response),
        ) as start_desktop:
            response = await execution_service.execute_agent(
                db,
                agent_id,
                user_id,
                "Open a terminal",
                is_interactive=True,
            )

        self.assertIs(response, expected_response)
        self.assertIs(start_desktop.await_args.kwargs["user"], user)


if __name__ == "__main__":
    unittest.main()
