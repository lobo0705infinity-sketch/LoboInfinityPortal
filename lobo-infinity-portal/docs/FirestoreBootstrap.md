# Firestore Bootstrap

Version 7.1.1 adds a Commissioner-visible bootstrap process for the Firestore
provider. The bootstrap does not migrate production data and does not switch the
active provider away from Google Sheets.

## Purpose

The bootstrap answers these operational questions:

- Is Firebase configured?
- Can the Firebase SDK initialize?
- Can Firestore be reached?
- Can the portal read `settings/schema`?
- Can the portal write and delete a temporary bootstrap probe?
- Are required collections initialized?
- Are required seed documents present?
- Is Google Sheets still safe as the production fallback?

## Required Environment Variables

Configure these in Vercel before enabling Firestore or dual mode:

- `VITE_DATA_PROVIDER`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Diagnostics displays each variable as configured or missing. Secret values are
not printed.

## Provider Modes

- `google`: Google Sheets remains the active production provider.
- `firestore`: Firestore is selected. If bootstrap fails, repository calls fall
  back to Google Sheets so the portal remains available.
- `dual`: Google Sheets remains the source of truth while Firestore is read in
  the background for comparison diagnostics.
- `mock`: Local fixture provider for tests and development.

## Automatic Initialization

On Firestore connection, the portal initializes:

- `events`
- `players`
- `games`
- `registrations`
- `teams`
- `pairings`
- `notifications`
- `missions`
- `factions`
- `analytics`
- `settings`

Each collection receives a managed `__schema` marker. Firestore does not create
empty collections, so marker documents make initialization observable.

## Seed Documents

The bootstrap creates required baseline documents if missing:

- `events/event-current-league`
- `settings/schema`
- `settings/defaults`
- `analytics/default`

The schema document records:

```json
{
  "schemaVersion": 1,
  "portalVersion": "7.1.1",
  "provider": "firestore",
  "initializedBy": "bootstrap"
}
```

## Diagnostics

Commissioner Diagnostics includes a Firestore Bootstrap panel with:

- Overall health
- Provider mode
- Project ID
- Region
- SDK status
- Auth SDK status
- Connection status
- Read test
- Write test
- Schema version
- Collections initialized
- Seed data status
- Security status
- Missing environment variables
- Startup fallback status

Version 7.3.1 hardens the panel for production verification. Bootstrap,
provider health, and migration verification checks are bounded by explicit
timeouts. If a check cannot complete, Diagnostics must display a concrete
status such as `FAILED`, `CONFIGURATION ERROR`, `PERMISSION ERROR`, or
`BOOTSTRAP REQUIRED` instead of remaining in a permanent loading state.

After Firebase environment variables are changed in Vercel, trigger a fresh
production deployment before validating this panel. Vite environment variables
are compiled into the deployed frontend bundle, so an existing deployment will
not automatically consume newly added Firebase values.

Version 7.3.2 requires the browser to be signed into Firebase Auth before
bootstrap write probes can pass. The portal bridges the existing Google ID token
into Firebase Auth when Firebase is configured. Commissioner Diagnostics shows
the Firebase user and role claim used by Firestore rules.

## Safety

Firestore bootstrap failures do not take down production. Google Sheets remains
active until migration is explicitly enabled and verified.
