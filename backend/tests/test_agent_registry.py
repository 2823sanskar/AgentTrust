import unittest
import uuid

from app.schemas.agent import AgentCreate, AgentResponse
from app.services.agent_service import generate_agent_hash


class TestAgentRegistry(unittest.TestCase):
    def test_generate_agent_hash_deterministic(self):
        hash1 = generate_agent_hash(
            name="OpenClaw AI",
            author_id="dev-123",
            install_cmd="pip install openclaw",
            exec_cmd="openclaw --task '{task}'"
        )
        hash2 = generate_agent_hash(
            name="OpenClaw AI",
            author_id="dev-123",
            install_cmd="pip install openclaw",
            exec_cmd="openclaw --task '{task}'"
        )
        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)

    def test_agent_create_schema_registry_defaults(self):
        agent_in = AgentCreate(
            name="BrowserUse Bot",
            description="Automated browser interaction bot",
            install_cmd="pip install browser-use",
            exec_cmd="browser-use --task '{task}'",
            category="Web Automation"
        )
        self.assertEqual(agent_in.name, "BrowserUse Bot")
        self.assertEqual(agent_in.install_cmd, "pip install browser-use")
        self.assertEqual(agent_in.exec_cmd, "browser-use --task '{task}'")
        self.assertEqual(agent_in.category, "Web Automation")
        self.assertTrue(agent_in.is_public)


    def test_bootstrap_command_template_replacement(self):
        exec_template = 'openclaw --task "{task}"'
        task_prompt = "Scrape headline news from web"
        final_cmd = exec_template.replace("{task}", task_prompt)
        self.assertEqual(final_cmd, 'openclaw --task "Scrape headline news from web"')


    def test_ec2_autostop_idle_threshold_logic(self):
        max_idle_minutes = 30
        idle_counter = 0
        step_increment = 5
        for _ in range(6):
            idle_counter += step_increment
        self.assertEqual(idle_counter, 30)
        self.assertGreaterEqual(idle_counter, max_idle_minutes)


if __name__ == "__main__":
    unittest.main()
