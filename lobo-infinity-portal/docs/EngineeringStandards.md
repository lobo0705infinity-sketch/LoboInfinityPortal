# Engineering Standards

These standards are permanent for the Lobo Infinity Community Operating System.

## Engineering Rule #1

Reuse existing services.

Prefer extending:

- Identity
- Formatting
- Integrity
- Automation
- Statistics
- Achievements
- Player Intelligence
- Deep Linking

Do not introduce duplicate business logic or parallel systems when an existing production subsystem can be extended.

## Engineering Rule #2

No new top-level architectural concept may be introduced without updating:

- `docs/Architecture.md`
- `docs/APIContracts.md`
- `docs/ProjectStructure.md`
- `docs/TechnicalDebt.md`
- `docs/ReleaseChecklist.md`

Examples of top-level concepts include Organization, Community, Series, Event, Season, Round, Game, Identity, Automation, Achievements, Hall of Fame, and Statistics.

## Engineering Gates

Every release must satisfy all four gates.

### Architecture Gate

- Reuses existing services.
- Avoids duplicate business logic.
- Fits the frozen Version 3 Event Engine architecture.
- Extends the architecture rather than redesigning it.
- Lifecycle and operational repairs reuse existing mutation, automation, audit, and cache paths.

### Compatibility Gate

- No breaking API changes.
- Legacy functionality continues to work.
- Existing player data remains valid.
- Existing URLs remain valid.
- Backward compatibility is documented when behavior changes.
- Invalid operational states are blocked or repaired through documented one-click flows instead of manual sheet edits.

### Performance Gate

- Meets the Performance Budget.
- Adds no unnecessary API requests.
- Avoids Apps Script regressions.
- Blocks regressions on the critical path: startup bundle, startup requests, Dashboard, authentication, Event Overview, shared runtime, shared CSS, and API request count.
- Evaluates lazy-loaded route bundles separately. A lazy-route increase is acceptable only when it is isolated to that route, adds no startup regression, adds no Dashboard regression, adds no API requests, creates no duplicate calculations or caches, and the size increase is documented with the rationale.
- Avoids unjustified bundle-size regression.

### Quality Gate

- `npm run lint` passes.
- `npm run build` passes.
- Apps Script validation passes.
- Documentation is updated.
- Release Checklist is updated.
- Technical Debt is documented.

If any gate fails, the release is incomplete.

## Production Release Policy

Never deploy directly from a feature branch, recovery branch, isolated worktree, dirty worktree, detached commit, or unverified prebuilt local artifact. All production changes must be merged into the latest approved production branch, pass the full production contract and visual regression gates, deploy first to staging, and promote the exact tested deployment to production. A homepage smoke test alone is never sufficient.

Production releases must come from the approved production branch recorded in `release/production.json`. The default production branch is `main`. Feature, hotfix, recovery, and experimental branches may be used for development, but they must be updated from latest `main`, merged into `main`, and released from that complete source state. Codex and humans must not assume a focused branch contains the complete accepted product.

Before any production build or deployment, run:

```bash
git status --porcelain
git branch --show-current
git rev-parse HEAD
npm run release:source
```

The release must stop if the worktree is dirty, the checkout is detached, the branch is not the approved production branch, the branch is behind its upstream, or the source contains untracked release-relevant files.

Frontend and backend are one release pair. `release/production.json` records the approved Apps Script version, deployment ID, endpoint, required routes, and production contract markers. `VITE_API_URL` must match that manifest exactly. A frontend build with a missing, empty, or mismatched API URL is not eligible for production.

Every production release must run:

```bash
npm run release:manifest
npm run release:fingerprint
npm run release:gate
```

The release fingerprint is written to `public/release-fingerprint.json` and exposed in Commissioner Diagnostics under System Information. It records the frontend version, full Git commit, branch, build timestamp, Vercel deployment identifier, Apps Script deployment ID, Apps Script version, API URL fingerprint, and cache version. Bundles with `gitCommit: not-provided`, `deploymentId: not-provided`, or a missing backend deployment ID must not be promoted.

Production-contract tests live in `scripts/production-contract-check.mjs`. They protect accepted product behavior, including Commissioner navigation, My Profile canonical identity, My Profile 3.0 dashboard markers, strict authentication recovery codes, required routes, and API endpoint alignment. Update this contract only for an intentional product decision and document the reason in the release notes.

Visual regression tests live in `scripts/production-visual-check.mjs`. They cover the Commissioner sidebar, My Profile desktop and mobile, Dashboard, Players, Submit Game, Submit Army List, Events, and Commissioner System. Do not overwrite visual baselines during a production release. To intentionally update baselines, review the visual change first, then run:

```bash
UPDATE_VISUAL_BASELINES=1 VISUAL_BASE_URL=<approved-preview-url> npm run release:visual
```

Every release must deploy to staging or a Vercel preview first. Run the full release gate and visual checks against that exact staged deployment:

```bash
CONTRACT_BASE_URL=<staging-url> npm run release:contract
VISUAL_BASE_URL=<staging-url> npm run release:visual
STAGING_URL=<staging-url> npm run release:promotion
```

Do not rebuild between staging validation and production. Promote the exact tested Vercel deployment to the production alias only after staging passes. After promotion, repeat the contract and promotion checks against the public production alias. If staged and production fingerprints differ, the release failed.

Authenticated checks that cannot be performed without a real Google session must be listed as manual checks, not silently marked as verified:

1. Sign in successfully.
2. Refresh and confirm the session persists.
3. Confirm My Profile league, division, and rank.
4. Confirm Submit Game identifies the correct player.
5. Confirm Submit Army List identifies the correct player.
6. Confirm commissioner permissions remain available.

Rollback must restore the matching frontend/backend pair recorded in `release/known-good.json`. Do not roll back only the frontend while leaving an incompatible backend, or roll back only Apps Script while leaving an incompatible frontend. Use:

```bash
npm run release:rollback-plan
```

When production is broken, restore the last known-good pair before making untested emergency edits directly in production.

## Accepted Architecture Releases

### Version 13.0 - Event Context Migration

- Accepted: July 11, 2026.
- Scope: Event-scoped pages consistently respect `eventId` instead of silently falling back to League-wide data.
- Frontend deployment: `dpl_8HBFkvYJYsVddovy2LYJ2o7Z4BqH`.
- Apps Script deployment: `AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng @195`.
- Accepted tradeoff: startup bundle increase remains below 1 kB gzip and is justified by removing a fundamental event-context architecture inconsistency.
- Release evidence: no new startup requests, no duplicate caches, no duplicate calculations, no backend performance regression, and production verification confirmed Team Tournament and League pages render their own scoped data.
