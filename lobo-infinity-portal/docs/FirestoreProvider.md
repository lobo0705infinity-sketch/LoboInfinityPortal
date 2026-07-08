# Firestore Provider

Version 7.1 adds a production-ready Firestore provider behind the Data Access
Layer. Google Sheets remains the default production provider.

## Configuration

Set `VITE_DATA_PROVIDER` to choose the active provider:

- `google`: current production default.
- `firestore`: Firestore only.
- `dual`: Google primary reads with Firestore comparison diagnostics.
- `mock`: fixture provider.

Firestore bootstrap validates these Vite environment variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_REGION optional
```

## Automatic Initialization

On first Firestore provider connection, the portal verifies the schema and
creates marker documents for:

```text
events
players
games
registrations
teams
pairings
notifications
missions
factions
analytics
settings
```

If no Events exist, the provider seeds `event-current-league` as `Current
League`.

Schema metadata is written to `settings/schema`:

```json
{
  "schemaVersion": 1,
  "provider": "firestore",
  "portalVersion": "7.1.1",
  "initializedBy": "bootstrap"
}
```

## Diagnostics

Commissioner Diagnostics displays:

- Active provider.
- Firestore project and region.
- Schema version.
- Initialization status.
- Collection names and document counts.
- Provider latency.
- Dual Compare mismatches.
- Provider errors.

Version 7.1.1 adds a dedicated Firestore Bootstrap diagnostics panel for
environment validation, SDK initialization, read/write probes, schema status,
seed documents, and startup fallback status.

## Dual Compare

`VITE_DATA_PROVIDER=dual` keeps Google Sheets as the player-facing source of
truth. Reads are mirrored to Firestore in the background and compared. Writes
continue to Google only. Differences are recorded in Commissioner Diagnostics
and never shown to players.

Version 7.2 adds a dedicated Migration Verification report in Diagnostics. It
runs representative repository reads against Google Sheets and Firestore,
records the first differing field, compares latency, checks Firestore
collection completeness, and reports whether the portal is ready for provider
cutover.

Version 7.3 adds the Commissioner-run Firestore Data Migration action. It
copies Google-backed repository data into Firestore collections with stable
document ids, then reruns parity verification. Google Sheets remains
authoritative.

## Security Rules

Production rules live in `firestore.rules` and are referenced by
`firebase.json`. The rules assume Firebase Auth custom claims:

- `role`: `League Member`, `Assistant Commissioner`, or `Commissioner`.
- `leaguePlayer`: canonical player id/name.

Until Firebase Auth custom claims are wired into production auth, keep
`VITE_DATA_PROVIDER=google` for production player traffic.

## Migration Utility

`src/services/data/providers/firestoreMigration.ts` provides an idempotent
migration utility that copies Events, registrations, Team Tournament teams, and
pairings through provider contracts. Future migration releases should expand it
for full historical games, player statistics, faction analytics, mission
analytics, notifications, and records.
