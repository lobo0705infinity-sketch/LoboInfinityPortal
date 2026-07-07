# Event Migration Validation

Version 3.0C validates that the Event Engine foundation can represent the existing production League without changing results.

This is a validation release only.

It does not:

- Migrate historical games.
- Add Event dashboards.
- Add Community Home.
- Change frontend routes.
- Change legacy API response contracts.

## Validation Scope

The backend validation endpoint is:

```text
eventMigrationValidation
```

It compares Legacy Mode to Event Engine Mode for:

- Standings
- Player Statistics
- Hall of Fame
- Achievements
- Player Intelligence
- Timeline
- Automation
- Notifications
- Discord Events
- Army Lists
- Recent Games
- Deep Links
- Career Statistics
- Promotion
- Relegation

## Event Engine Mode

Event Engine Mode resolves missing scope to:

```text
event-current-league
season-current-league
round-current-league
```

It then reuses the same production services as Legacy Mode. This proves the Event abstraction can wrap the current League without introducing duplicate calculations.

## PASS Criteria

A subsystem passes when:

- The normalized Legacy result and Event result match.
- No expected top-level fields are removed.
- No renamed fields are introduced.
- No production data is mutated.

Volatile operational fields such as timestamps are excluded from hash comparison.

## Migration Safety

Historical games can receive default Event scope as metadata only if:

- Winner is present.
- Loser is present.
- Mission is present.
- Existing calculations remain unchanged.

Version 3.0C only reports this readiness. The actual data migration is deferred to a future release.

## Rollback

No rollback of game data is required because no production data migration occurs.

If the validation layer needs to be disabled:

1. Remove or ignore the `eventMigrationValidation` API route.
2. Leave existing legacy APIs untouched.
3. Keep Event Engine foundation sheets for future migration work or manually archive them after review.
