# Roadmap

Version 3.0D freezes the Version 3 Event Engine roadmap.

Future releases should extend the frozen Event Engine architecture rather than redesign it.

## Version 3 Roadmap

| Version | Focus | Status |
| --- | --- | --- |
| 3.0A | Architecture | Completed |
| 3.0B | Foundation | Completed |
| 3.0C | Validation | Completed |
| 3.0D | Baseline | Completed |
| 3.1 | Community Home | Completed |
| 3.2 | Event Migration | Planned |
| 3.3 | Event Statistics | Planned |
| 3.4 | Event Automation | Planned |
| 3.5 | Archives | Planned |

## Release Boundaries

### 3.1 Community Home

Build the Community Home and event directory experience on top of the existing Event Engine foundation.

Do not perform historical data migration in this release unless explicitly re-scoped.

Version 3.1 ships the authenticated Community Command Center as the first Community Home surface. The broader public event directory remains future work.

Version 3.1.1 completes the first player workflow pass by turning the Community Command Center into a personal mission briefing with Today, My Remaining Games, Nudge Engine, event switching, and prioritized next actions.

### 3.2 Event Migration

Add explicit event scope to historical data after migration validation has passed.

Migration must preserve standings, statistics, achievements, Hall of Fame, Player Intelligence, automation, notifications, and deep links.

### 3.3 Event Statistics

Make statistics explicitly scope-aware across Community, Event Type, Event, Season, Round, Faction, Mission, and Opponent.

Reuse existing statistics services.

### 3.4 Event Automation

Extend the existing Automation Center with event-owned automation rules, timelines, Discord routing, and notification behavior.

Do not create a second automation system.

### 3.5 Archives

Create permanent Event archives and historical views for completed leagues, tournaments, campaigns, special events, and future formats.

Reuse Hall of Fame, Achievements, Formatting, Deep Linking, and snapshot patterns.
