# Data Access Layer

Version 7.0 Foundation introduces a frontend Data Access Layer between React
pages and the current storage transport. Pages should consume repositories from
`src/services/data` instead of calling storage or transport code directly.

## Architecture

```text
Page or component
  -> Repository
  -> DataProvider
  -> Storage provider
  -> Google Sheets, Firestore, Supabase, PostgreSQL, mock fixtures
```

The default production provider is `google`, implemented by
`GoogleSheetsProvider`. It delegates to the existing normalized API client, so
this release changes the application boundary without changing API contracts,
cache behavior, Event Engine behavior, or Google Sheets schema.

## Provider Selection

The active provider is selected by `VITE_DATA_PROVIDER`.

- `google`: Apps Script and Google Sheets, current production default.
- `firestore`: Firebase Firestore provider with automatic schema initialization and health reporting.
- `dual`: Google primary reads with Firestore comparison diagnostics.
- `mock`: stubbed provider reserved for test fixtures.

If `firestore` is selected and Firestore cannot initialize, repository calls
fall back to Google Sheets and Commissioner Diagnostics displays the bootstrap
failure. This keeps the production portal available while Firestore is being
prepared.

Changing storage providers should be a configuration change after the target
provider implements every repository contract.

## Repository Contracts

Repository interfaces live in `src/services/data/repositories`.

- `DashboardRepository`: dashboard, home, and command center summaries.
- `PlayerRepository`: player profiles, current profile, comparison, profile updates.
- `GameRepository`: recent games and game-adjacent submissions.
- `EventRepository`: event catalog, event home, Event Manager operations.
- `TeamRepository`: Team Tournament data, teams, pairings, invitations, results, round advancement.
- `RegistrationRepository`: event registration, withdraw, and commissioner registration management.
- `SchedulingRepository`: Match Finder, availability, scheduling requests, and calendar exports.
- `StandingsRepository`: division standings.
- `AnalyticsRepository`: factions, missions, records, Hall of Fame, and league intelligence.
- `NotificationRepository`: notifications and notification state.

## Migration Rule

New pages and components must not import the storage transport directly. Use
repositories:

```ts
import { eventRepository, standingsRepository } from '../services/data'
```

Legacy imports from `services/api` may remain for shared domain types during
the migration, but data reads and writes should move to repository methods.

## Firestore Migration

The Firestore migration path is intentionally narrow:

1. Configure Firebase environment variables.
2. Open Commissioner Diagnostics and verify Firestore Bootstrap health.
3. Run `VITE_DATA_PROVIDER=dual` to compare Google and Firestore reads.
4. Use the migration utility to seed Firestore.
5. Keep repository interfaces unchanged.
6. Open Commissioner Diagnostics and verify Migration Readiness.
7. Set `VITE_DATA_PROVIDER=firestore` only after contract validation passes.

Version 7.3 exposes the migration utility in Commissioner Diagnostics as
`Run Firestore Migration`. It writes Firestore mirror documents only; it does
not mutate Google Sheets.

Pages, Event Engine UI, scheduling workflows, and tournament operations should
not require rewrites when the provider changes.
