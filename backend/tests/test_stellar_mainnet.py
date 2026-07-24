"""Focused safeguards for Stellar Mainnet anchoring and legacy receipt reads."""

import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from stellar_sdk import Keypair, Network

from app.blockchain.stellar import _horizon_url
from app.config import Settings, settings
from app.schemas.user import UserResponse
from app.services import stellar_service


class MainnetSettingsTests(unittest.TestCase):
    def make_settings(self, **overrides) -> Settings:
        values = {
            "_env_file": None,
            "STELLAR_NETWORK": "mainnet",
            "STELLAR_HORIZON_URL": "https://horizon.stellar.org",
            "STELLAR_MAX_BASE_FEE": 10_000,
        }
        values.update(overrides)
        return Settings(**values)

    def test_mainnet_aliases_normalize(self) -> None:
        for alias in ("mainnet", "public", "pubnet"):
            with self.subTest(alias=alias):
                configured = self.make_settings(STELLAR_NETWORK=alias)
                self.assertEqual(configured.STELLAR_NETWORK, "mainnet")

    def test_testnet_runtime_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "Mainnet-only"):
            self.make_settings(
                STELLAR_NETWORK="testnet",
                STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org",
            )

    def test_non_https_horizon_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "must use HTTPS"):
            self.make_settings(STELLAR_HORIZON_URL="http://horizon.stellar.org")

    def test_fee_safety_floor_is_enforced(self) -> None:
        with self.assertRaisesRegex(ValueError, "at least 100"):
            self.make_settings(STELLAR_MAX_BASE_FEE=99)

    def test_legacy_testnet_wallet_is_hidden_until_reconnected(self) -> None:
        response = UserResponse(
            id=uuid.uuid4(),
            name="Test User",
            email="test@example.com",
            role="user",
            stellar_wallet_address=Keypair.random().public_key,
            stellar_wallet_network="testnet",
            created_at=datetime.now(timezone.utc),
        )
        self.assertIsNone(response.stellar_wallet_address)
        self.assertIsNone(response.stellar_wallet_network)


class MainnetAnchoringTests(unittest.IsolatedAsyncioTestCase):
    async def asyncTearDown(self) -> None:
        stellar_service._runtime_keypair = None

    async def test_keypair_must_be_explicit_and_match(self) -> None:
        keypair = Keypair.random()
        stellar_service._runtime_keypair = None
        with (
            patch.object(settings, "STELLAR_SECRET_KEY", keypair.secret),
            patch.object(settings, "STELLAR_PUBLIC_KEY", keypair.public_key),
        ):
            configured = await stellar_service._get_anchor_keypair()
        self.assertEqual(configured.public_key, keypair.public_key)

    async def test_mismatched_keypair_is_rejected(self) -> None:
        secret_keypair = Keypair.random()
        other_public_key = Keypair.random().public_key
        stellar_service._runtime_keypair = None
        with (
            patch.object(settings, "STELLAR_SECRET_KEY", secret_keypair.secret),
            patch.object(settings, "STELLAR_PUBLIC_KEY", other_public_key),
        ):
            with self.assertRaisesRegex(ValueError, "does not match"):
                await stellar_service._get_anchor_keypair()

    async def test_failed_anchor_keeps_mainnet_provenance(self) -> None:
        run = SimpleNamespace(hash="ab" * 32)
        failed = {
            "tx_hash": None,
            "ledger": None,
            "success": False,
            "error": "offline",
        }
        with patch.object(
            stellar_service,
            "submit_hash_to_stellar",
            AsyncMock(return_value=failed),
        ):
            fields = await stellar_service.anchor_run_hash(run)
        self.assertEqual(fields["stellar_network"], "mainnet")
        self.assertEqual(fields["anchor_status"], "pending_anchor")

    async def test_historical_testnet_receipt_remains_readable(self) -> None:
        run = SimpleNamespace(
            stellar_transaction="a" * 64,
            stellar_network="testnet",
            hash="cd" * 32,
            stellar_ledger_sequence=123,
            anchored_at=None,
            anchor_status="anchored",
        )
        verified = {
            "exists": True,
            "memo_matches": True,
            "ledger": 123,
            "created_at": "2026-07-24T00:00:00Z",
        }
        verifier = AsyncMock(return_value=verified)
        with patch.object(stellar_service, "verify_stellar_transaction", verifier):
            receipt = await stellar_service.verify_run_receipt(run)

        self.assertTrue(receipt["verified"])
        self.assertEqual(receipt["network"], "testnet")
        self.assertIn("/explorer/testnet/tx/", receipt["explorer_url"])
        self.assertEqual(verifier.await_args.kwargs["network"], "testnet")

    def test_write_passphrase_and_default_horizon_are_mainnet(self) -> None:
        self.assertEqual(
            stellar_service._network_passphrase(),
            Network.PUBLIC_NETWORK_PASSPHRASE,
        )
        self.assertEqual(_horizon_url(), "https://horizon.stellar.org")
