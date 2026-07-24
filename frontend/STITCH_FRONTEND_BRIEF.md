# AgentTrust Frontend Visual Overhaul Brief

Use this brief with Google Stitch or any design-to-code pass. Scope is strictly frontend presentation.

Do not change:

- backend API routes
- database schemas
- Stellar anchoring logic
- auth token behavior
- sandbox execution behavior

## Product Context

AgentTrust verifies external AI agent executions. The UI must make three ideas obvious at a glance:

- agent identity and trust
- cloud sandbox execution evidence
- Stellar proof

## Visual Direction

Design style:

- serious infrastructure product
- dark, precise, high-contrast
- operational dashboard rather than landing-page marketing
- dense but readable
- clear status labels and evidence trails

Avoid:

- oversized hero sections in app views
- decorative gradient blobs
- card-inside-card layouts
- one-note purple/blue palette
- visible explanatory tutorial text

## Key Screens

### Dashboard

Primary goal: scan system and execution state fast.

Must emphasize:

- cloud worker state
- recent execution route: `AWS Staging` or `Local Engine`
- trust score
- verified runs
- latest Stellar proof status

### Agent Detail

Primary goal: decide whether to execute or inspect trust history.

Must emphasize:

- agent name and provider
- Docker image metadata for external Docker agents
- trust score and execution count
- execution history with status, route, hash/proof

### Execute Agent

Primary goal: submit task and see run evidence without ambiguity.

Must emphasize:

- task input editor
- execution status
- stdout/stderr capture
- action log
- hash and Stellar transaction after completion

### Run Detail

Primary goal: audit one execution.

Must emphasize:

- execution hash
- Stellar transaction
- route badge
- action log timeline
- stdout/stderr panels
- verification link

## Component Requirements

Use compact badges for:

- `AWS Staging`
- `Local Engine`
- `On-chain`
- `Verified`
- `Failure`
- `Pending`

Use tables for histories. Use cards only for individual metrics or repeated records.

Use lucide icons where available:

- `Shield`
- `Hash`
- `Activity`
- `Server`
- `Cloud`
- `CheckCircle2`
- `AlertTriangle`

## Output Expectations

If Stitch produces code:

- keep API calls using `frontend/lib/api.ts`
- keep types from `frontend/types/index.ts`
- preserve existing routes
- only replace visual layout/components
- run `npm run lint` before final delivery
