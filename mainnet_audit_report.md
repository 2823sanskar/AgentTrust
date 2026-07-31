# AgentTrust — Testnet Audit & Mainnet Readiness Report

> Generated: 2026-07-24 | Branch: `current-development`

---

## 1. Current Network Setup

AgentTrust uses **Stellar blockchain exclusively** — there are **no EVM smart contracts** (no Solidity, no Hardhat, no Wagmi, no Web3Modal, no MetaMask, no Polygon/Ethereum/Arbitrum/Base).

| Property | Current Value |
|---|---|
| **Blockchain** | Stellar |
| **Current Network** | **Testnet** |
| **Horizon URL** | `https://horizon-testnet.stellar.org` |
| **Explorer** | `https://stellar.expert/explorer/testnet/` |
| **Funding Mechanism** | Friendbot (testnet faucet, auto-funded on startup) |
| **Wallet Provider** | Freighter browser extension (`@stellar/freighter-api`) |
| **Transaction Type** | `manage_data_op` with `HashMemo` (SHA-256 of run evidence) |

---

## 2. Hardcoded Testnet References

### 🔴 Critical — Must Fix Before Mainnet (Code Bugs)

| File | Line | Issue |
|---|---|---|
| [VerificationPanel.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/components/VerificationPanel.tsx#L50) | 50 | **Hardcoded** `testnet` in explorer URL — ignores `NEXT_PUBLIC_STELLAR_NETWORK` env var |
| [stellar.py](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/blockchain/stellar.py#L43) | 43 | Falls back to `TESTNET_NETWORK_PASSPHRASE` — but only if `settings.STELLAR_NETWORK` is not `"mainnet"`. Already gated ✅ (just needs env var) |

**VerificationPanel.tsx line 50 — exact bug:**
```typescript
// BUG: hardcoded "testnet", never reads NEXT_PUBLIC_STELLAR_NETWORK
const stellarUrl = stellarTxId
  ? `https://stellar.expert/explorer/testnet/tx/${stellarTxId}`
  : null;

// FIX:
const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
const stellarUrl = stellarTxId
  ? `https://stellar.expert/explorer/${STELLAR_NETWORK === "mainnet" ? "public" : "testnet"}/tx/${stellarTxId}`
  : null;
```

---

### 🟡 UI Text — Must Update for Mainnet Branding

| File | Line | Hardcoded Text |
|---|---|---|
| [footer.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/components/layout/footer.tsx#L42) | 42 | `"Built on Stellar Testnet."` |
| [VerificationPanel.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/components/VerificationPanel.tsx#L86) | 86 | `"Stellar Testnet Transaction Anchor Proof"` |
| [runs/[id]/page.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/runs/[id]/page.tsx#L224) | 224 | `"Stellar Testnet Proof"` (span label) |
| [verify/[runId]/page.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/verify/[runId]/page.tsx#L55) | 55 | `"anchored on Stellar Testnet."` in meta description |
| [(landing)/page.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/(landing)/page.tsx#L27) | 27, 45, 58, 105 | Multiple "Stellar Testnet" in landing copy |
| [verify_deployment.py](file:///c:/Users/Admin/Desktop/AgentTrust/verify_deployment.py#L219) | 214–219 | Hardcoded `https://stellar.expert/explorer/testnet/tx/` in deployment script |
| [DEPLOYMENT_STAGING.md](file:///c:/Users/Admin/Desktop/AgentTrust/DEPLOYMENT_STAGING.md#L20) | 20, 59–62 | All docs labeled "Stellar Testnet" |

---

### 🟢 Already Correctly Gated (No Code Change Needed — Just Env Var)

| File | Line | Behavior |
|---|---|---|
| [config.py](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/config.py#L34) | 34–35 | `STELLAR_NETWORK = "testnet"` and `STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org"` — **defaults only**, overridden by `.env` |
| [stellar_service.py](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/services/stellar_service.py#L56) | 56–59 | `_network_passphrase()` — correctly returns `PUBLIC_NETWORK_PASSPHRASE` when `STELLAR_NETWORK == "mainnet"` ✅ |
| [stellar_service.py](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/services/stellar_service.py#L71) | 71–73 | `_fund_testnet_account()` — **skips entirely** when `STELLAR_NETWORK == "mainnet"` ✅ |
| [stellar_service.py](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/services/stellar_service.py#L101) | 101–102 | Raises `ValueError` if `STELLAR_SECRET_KEY` missing on mainnet ✅ |
| [blockchain/stellar.py](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/blockchain/stellar.py#L40) | 40–43 | `_network_passphrase()` — same mainnet check ✅ |
| [stellar_service.py](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/services/stellar_service.py#L49) | 49–53 | `stellar_explorer_url()` — dynamic, uses `"public"` for mainnet ✅ |
| [runs/[id]/page.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/runs/[id]/page.tsx#L17) | 17–18 | `process.env.NEXT_PUBLIC_STELLAR_NETWORK \|\| "testnet"` — reads env var correctly ✅ |
| [verify/[runId]/page.tsx](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/verify/[runId]/page.tsx#L15) | 15–16 | Same dynamic pattern ✅ |
| [stellar-wallet.ts](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/lib/stellar-wallet.ts#L47) | 47 | Reads network from Freighter directly — wallet auto-detects ✅ |

---

## 3. Smart Contract Deployment Status

> **Not applicable.** AgentTrust does **not use EVM smart contracts**.

Stellar uses **transaction-based anchoring** — execution hashes are embedded as `HashMemo` on self-payment transactions. There are no Solidity contracts, ABIs, or deployment scripts.

| Item | Status |
|---|---|
| Solidity / Vyper contracts | ❌ None |
| Hardhat / Foundry config | ❌ None |
| ABI files | ❌ None |
| Deployed contract addresses | ❌ None |
| On-chain mechanism | ✅ Stellar `manage_data_op` + `HashMemo` |

---

## 4. Environment Variables Required for Mainnet

### Backend (`backend/.env` on EC2)

| Variable | Testnet Value | **Mainnet Value** |
|---|---|---|
| `STELLAR_SECRET_KEY` | Testnet secret key | **Funded Mainnet secret key** |
| `STELLAR_PUBLIC_KEY` | Testnet public key | **Corresponding mainnet public key** |
| `STELLAR_NETWORK` | `testnet` | **`mainnet`** |
| `STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` | **`https://horizon.stellar.org`** |
| `DATABASE_URL` | Supabase pooler URL | Same or new production DB |
| `JWT_SECRET` | Any secret | Long random production secret |
| `ENVIRONMENT` | `development` | **`production`** |
| `CORS_ORIGINS` | localhost + EC2 IP | Production domain(s) |
| `OPENROUTER_API_KEY` | Dev key | Production key |

> [!IMPORTANT]
> On mainnet, `STELLAR_SECRET_KEY` **must** be pre-funded with real XLM. The Friendbot faucet is automatically disabled when `STELLAR_NETWORK=mainnet`.

### Frontend (Vercel Environment Variables)

| Variable | Testnet Value | **Mainnet Value** |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://3.213.68.179:8000/api` | `https://api.agenttrust.io/api` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | *(not set, defaults to `testnet`)* | **`mainnet`** |
| `NEXT_PUBLIC_BACKEND_URL` | EC2 IP | Production backend URL |

---

## 5. Frontend / Wallet Provider Changes Required

### Code Changes (Required)

| File | Change Needed |
|---|---|
| [VerificationPanel.tsx:50](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/components/VerificationPanel.tsx#L50) | Replace hardcoded `testnet` URL with `NEXT_PUBLIC_STELLAR_NETWORK`-aware dynamic URL |

### UI Text Changes (Branding)

| File | Current Text | Suggested Mainnet Text |
|---|---|---|
| [footer.tsx:42](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/components/layout/footer.tsx#L42) | `"Built on Stellar Testnet."` | `"Built on Stellar."` |
| [VerificationPanel.tsx:86](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/components/VerificationPanel.tsx#L86) | `"Stellar Testnet Transaction Anchor Proof"` | `"Stellar Transaction Anchor Proof"` |
| [runs/[id]/page.tsx:224](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/runs/[id]/page.tsx#L224) | `"Stellar Testnet Proof"` | `"Stellar Proof"` |
| [verify/[runId]/page.tsx:55](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/verify/[runId]/page.tsx#L55) | `"anchored on Stellar Testnet."` | `"anchored on Stellar."` |
| [(landing)/page.tsx:27,45,58,105](file:///c:/Users/Admin/Desktop/AgentTrust/frontend/app/(landing)/page.tsx) | Multiple "Stellar Testnet" | Replace with "Stellar" |

### Wallet Provider
- **Freighter** (`@stellar/freighter-api`) — no config change needed. Users switch networks inside the Freighter extension.
- The app reads `networkInfo.network` from Freighter at connection time and stores it as `stellar_wallet_network`.
- Schema default in [user.py:38](file:///c:/Users/Admin/Desktop/AgentTrust/backend/app/schemas/user.py#L38): `stellar_wallet_network: str = Field(default="testnet")` — consider changing to `"mainnet"` before launch.

---

## 6. Database Schema — Blockchain Fields

| Model | Field | Type | Notes |
|---|---|---|---|
| `Run` | `hash` | `VARCHAR(64)` | SHA-256 hex digest — network agnostic |
| `Run` | `stellar_transaction` | `VARCHAR(255)` | Tx hash — valid on both networks |
| `Run` | `stellar_ledger_sequence` | `INTEGER` | Ledger number — network agnostic |
| `Run` | `anchored_at` | `TIMESTAMP` | Timestamp — network agnostic |
| `Run` | `anchor_status` | `VARCHAR(32)` | `pending_anchor` / `anchored` — network agnostic |
| `Run` | `user_stellar_wallet_network` | `VARCHAR(20)` | Stores `"testnet"` or `"mainnet"` per wallet |
| `User` | `stellar_wallet_network` | `VARCHAR(20)` | Same — stores user's connected network |

> [!NOTE]
> No schema migrations are required for mainnet. All fields are network-agnostic. Existing testnet rows will remain in the DB with `user_stellar_wallet_network = "testnet"`.

---

## 7. Mainnet Migration Checklist

```
[ ] 1. Fund a real Stellar mainnet account with XLM
[ ] 2. Set STELLAR_NETWORK=mainnet in backend/.env on EC2
[ ] 3. Set STELLAR_HORIZON_URL=https://horizon.stellar.org in backend/.env
[ ] 4. Set STELLAR_SECRET_KEY and STELLAR_PUBLIC_KEY to mainnet keys
[ ] 5. Set ENVIRONMENT=production in backend/.env
[ ] 6. Fix VerificationPanel.tsx:50 hardcoded testnet URL (1 line code fix)
[ ] 7. Add NEXT_PUBLIC_STELLAR_NETWORK=mainnet to Vercel env vars
[ ] 8. Update UI text in footer.tsx, VerificationPanel.tsx, runs page, verify page, landing page
[ ] 9. Update WalletConnectRequest default in user.py from "testnet" to "mainnet"
[ ] 10. Update verify_deployment.py to use mainnet explorer URL
[ ] 11. Restart backend service: sudo systemctl restart agenttrust-backend-live.service
[ ] 12. Redeploy frontend on Vercel
```
