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

Version 3.1.2 adds Event Lifecycle Controls so Commissioners can operate the Current League Event from the portal without editing Google Sheets.

Version 4.3 refines the authenticated Dashboard into the Player Home Dashboard. This remains within the Community Home boundary by reusing the existing Community Command Center aggregate and scheduling services instead of introducing a new player dashboard architecture.

Version 4.4 adds League Personality as an engagement layer. It reuses existing Dashboard, Community Command Center, Scheduling, News, Achievements, and Recent Games data to produce dynamic hero messages, league headlines, featured match cards, season story timeline, spotlights, and Rivalry Room summaries without adding backend endpoints or changing API contracts.

Version 5.0.1 is a Performance Excellence hardening release. It preserves the completed feature set and focuses on Core Web Vitals, perceived dashboard speed, passive RUM, offscreen rendering efficiency, and repeatable Lighthouse measurement.

Version 5.1 is a Runtime Performance and User Experience release. It preserves completed workflows and adds route preloading on navigation intent, route mount timing, long task capture, API cache ratio visibility, and shared search-index normalization to improve perceived responsiveness without changing business logic or backend contracts.

Version 6.0 is the Multi-Event Platform release. It promotes Event ID to an operational data dimension while preserving Current League defaults. Standings, Match Finder, and Scheduling Center now accept Event scope through existing services, rebuilt Game Engine rows include Event ID, and missing historical scope resolves to `event-current-league`.

Version 6.0.1 is the Team Tournament Experience release. It validates the Multi-Event Platform by adding a Team Tournament Event dashboard, team registration, rosters, pairings, team standings, and commissioner tournament tools without creating a separate tournament engine.

Version 6.0.2 is the Event Registration System release. It moves player registration into Event Participants so every Event can support portal-based self-registration, team preferences, free agents, captain flags, commissioner management, profile visibility, and lifecycle-gated registration without Google Forms.

Version 6.0.3 is the Event Home Experience release. It gives every Event a dedicated destination with event identity, lifecycle-aware status, registration state, player status, timeline, news, quick actions, and event navigation.

Version 6.0.3 Commissioner Event Manager adds the operational control center inside Commissioner Dashboard so Events can be created, edited, opened for registration, closed, activated, archived, and managed without direct Google Sheets edits.

Version 7.0 Foundation adds the Data Access Layer. The frontend begins moving
from page-level API calls to repository contracts with provider selection via
`VITE_DATA_PROVIDER`. Google Sheets remains the production provider until a
Firestore or database provider is implemented and contract-tested.

Version 7.1 adds the Firestore provider, automatic schema initialization,
schema versioning, provider health diagnostics, Firestore security rules, and a
repeatable migration utility. Google remains the active production provider
until migration is explicitly enabled.

Version 7.1.1 completes Firestore bootstrap readiness with environment
validation, SDK/connectivity/read/write probes, required seed documents,
Commissioner Bootstrap diagnostics, and Google Sheets startup fallback safety.

Version 7.2 adds Firestore Migration Verification. Commissioner Diagnostics now
compare repository outputs from Google Sheets and Firestore, show field-level
differences, summarize provider latency, verify collection completeness, and
compute readiness before any provider cutover.

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
