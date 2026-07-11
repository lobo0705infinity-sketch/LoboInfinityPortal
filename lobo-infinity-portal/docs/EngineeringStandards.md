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

## Accepted Architecture Releases

### Version 13.0 - Event Context Migration

- Accepted: July 11, 2026.
- Scope: Event-scoped pages consistently respect `eventId` instead of silently falling back to League-wide data.
- Frontend deployment: `dpl_8HBFkvYJYsVddovy2LYJ2o7Z4BqH`.
- Apps Script deployment: `AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng @195`.
- Accepted tradeoff: startup bundle increase remains below 1 kB gzip and is justified by removing a fundamental event-context architecture inconsistency.
- Release evidence: no new startup requests, no duplicate caches, no duplicate calculations, no backend performance regression, and production verification confirmed Team Tournament and League pages render their own scoped data.
