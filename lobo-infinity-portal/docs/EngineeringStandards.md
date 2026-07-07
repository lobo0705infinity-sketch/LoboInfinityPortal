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

### Compatibility Gate

- No breaking API changes.
- Legacy functionality continues to work.
- Existing player data remains valid.
- Existing URLs remain valid.
- Backward compatibility is documented when behavior changes.

### Performance Gate

- Meets the Performance Budget.
- Adds no unnecessary API requests.
- Avoids Apps Script regressions.
- Avoids bundle-size regression unless justified and documented.

### Quality Gate

- `npm run lint` passes.
- `npm run build` passes.
- Apps Script validation passes.
- Documentation is updated.
- Release Checklist is updated.
- Technical Debt is documented.

If any gate fails, the release is incomplete.
