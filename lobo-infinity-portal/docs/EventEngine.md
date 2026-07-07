# Event Engine

Version 3.0B installs the Event Engine foundation approved in the Version 3 architecture.

This release does not build Community Home, Event Dashboard, Event Statistics, or the future Season Engine.

## Core Objects

The permanent object hierarchy is:

```text
Community
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

- Community
- Series
- Event
- EventTemplate
- Season
- Round
- EventParticipant

## Default Community

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

Version 3.0B provides read-only tooling:

- Migration Audit
- Migration Preview
- Migration Report
- Rollback Strategy

The tooling identifies missing event scope columns and previews future game scoping, but it does not change historical Game Engine rows.

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
