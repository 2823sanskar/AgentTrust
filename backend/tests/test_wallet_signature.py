import base64
import hashlib
import unittest

from stellar_sdk import Keypair

from app.api.auth import (
    STELLAR_SIGNED_MESSAGE_PREFIX,
    _verify_wallet_signature,
)


class WalletSignatureVerificationTests(unittest.TestCase):
    def setUp(self):
        self.keypair = Keypair.random()
        self.message = (
            "AgentTrust wallet ownership\n"
            f"Address: {self.keypair.public_key}\n"
            "Network: mainnet\n"
            "Time: 2026-07-25T00:00:00.000Z"
        )

    def test_accepts_freighter_sep53_signature(self):
        payload = hashlib.sha256(
            STELLAR_SIGNED_MESSAGE_PREFIX + self.message.encode("utf-8")
        ).digest()
        signature = base64.b64encode(self.keypair.sign(payload)).decode("ascii")

        _verify_wallet_signature(
            self.keypair.public_key,
            self.message,
            signature,
        )

    def test_accepts_legacy_raw_message_signature(self):
        signature = base64.b64encode(
            self.keypair.sign(self.message.encode("utf-8"))
        ).decode("ascii")

        _verify_wallet_signature(
            self.keypair.public_key,
            self.message,
            signature,
        )

    def test_rejects_signature_for_different_message(self):
        payload = hashlib.sha256(
            STELLAR_SIGNED_MESSAGE_PREFIX + self.message.encode("utf-8")
        ).digest()
        signature = base64.b64encode(self.keypair.sign(payload)).decode("ascii")

        with self.assertRaises(ValueError):
            _verify_wallet_signature(
                self.keypair.public_key,
                f"{self.message}\nAltered: true",
                signature,
            )


if __name__ == "__main__":
    unittest.main()
