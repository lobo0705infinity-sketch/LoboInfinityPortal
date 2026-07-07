# Event Engine

Version 3.0B installs the Event Engine foundation approved in the Version 3 architecture.

This release does not build Community Home, Event Dashboard, Event Statistics, or the future Season Engine.

## Core Objects

The permanent object hierarchy is:

```text
Organization
  |
  |-- Community
        |
        |-- Series
              |
              |-- Event
                    |
                    |-- Season
                          |
                          |-- Round
                                |
                                |-- Game
```

Version 3.0B creates the foundation objects:

- Organization
- Community
- Series
- Event
- EventTemplate
- Season
- Round
- EventParticipant

## Default Community

The default organization is:

```text
organization-lobo-infinity
Lobo Infinity
```

The default community is:

```text
community-lobo-infinity
Lobo Infinity Community
```

The default series is:

```text
series-lobo-league
Lobo Infinity League Series
```

## Default Event

The backward-compatible default event is:

```text
event-current-league
Current League
```

Existing APIs continue to work against legacy league data. During the migration window, missing `eventId`, `seasonId`, and `roundId` resolve to:

```text
event-current-league
season-current-league
round-current-league
```

## Sheets

Version 3.0B creates only the minimum foundation sheets:

- Events
- Event Templates
- Event Participants
- Event Seasons
- Event Rounds

No historical production data is migrated automatically.

## Event Templates

Seeded templates:

- League Season Template
- Army Roulette Template
- Team Tournament Template
- Aurora VII Campaign Template
- Escalation League Template
- Narrative Weekend Template

Templates are blueprints only. Runtime event behavior should read copied Event configuration, not branch directly on template identity.

## Migration Tooling

Version 3.0B and 3.0C provide read-only tooling:

- Migration Audit
- Migration Preview
- Migration Report
- Rollback Strategy
- Migration Validation

The tooling identifies missing event scope columns, previews future game scoping, compares legacy and Event Engine default-scope outputs, and documents rollback behavior. It does not change historical Game Engine rows.

## Event Migration Validation

Version 3.0C validates that the Event Engine can replace the legacy League model without changing production results.

The validation compares:

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

Each comparison reports:

- Legacy Result summary
- Event Result summary
- Legacy hash
- Event hash
- Match status
- PASS or FAIL

The Event Result is produced through the default Event Engine scope:

```text
event-current-league
season-current-league
round-current-league
```

This is a validation release only. It does not migrate production data.

## Compatibility

Legacy endpoints remain the production surface:

- `dashboard`
- `standings`
- `recentGames`
- `hallOfFame`
- `myProfile`
- `notifications`
- `timeline`
- `achievements`
- `intelligence`
- `automation`
- `deep links`

Future milestones will make these endpoints Event-aware through scope parameters while preserving current defaults.

## Event Lifecycle Controls

Version 3.1.2 adds operational lifecycle controls for Events.

Supported lifecycle stages:

```text
Planning -> Registration Open -> Registration Closed -> Roster Locked -> Schedule Generated -> Active -> Midseason -> Final Week -> Awards -> Archived
```

Lifecycle controls operate the existing `Events`, `Event Seasons`, `Event Rounds`, and `Event Participants` sheets.

They do not create a parallel event model.

Commissioner Dashboard reads lifecycle state from the operations payload. Commissioners can advance or safely roll back lifecycle stages through `eventLifecycleTransition`.

Every successful transition:

- Updates the Event lifecycle stage.
- Updates Event status and registration state.
- Synchronizes Season and Round status.
- Publishes `eventLifecycleTransition` through Automation Center.
- Writes `Event Lifecycle Audit`.
- Refreshes event and operations caches.

Rollback is intentionally limited. It is safe only before schedule generation or submitted games make the previous state operationally ambiguous.

## Baseline Freeze

Version 3.0D freezes the Event Engine baseline.

Future releases extend this hierarchy rather than redesigning it:

```text
Organization -> Community -> Series -> Event -> Season -> Round -> Game
```

No new top-level architectural concept may be introduced without updating Architecture, API Contracts, Project Structure, Technical Debt, and Release Checklist documentation.
