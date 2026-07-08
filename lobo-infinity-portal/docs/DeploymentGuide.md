# Deployment Guide

## Production Provider Safety

Google Sheets remains the default production provider:

```text
VITE_DATA_PROVIDER=google
```

Do not switch production to Firestore until Firestore Bootstrap diagnostics,
dual-compare diagnostics, and migration verification all pass.

## Firestore Environment Variables

Configure these values in Vercel when preparing Firestore:

```text
VITE_DATA_PROVIDER
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_REGION
```

`VITE_FIREBASE_REGION` is informational for diagnostics if the project uses the
default Firestore location.

## Bootstrap Verification

After deployment:

1. Sign in as a Commissioner.
2. Open Diagnostics.
3. Review the Firestore Bootstrap panel.
4. Confirm environment variables are configured.
5. Confirm SDK, connection, read test, and write test pass.
6. Confirm schema version is `1`.
7. Confirm collections and seed data are initialized.

If bootstrap fails, Google Sheets remains active and the Diagnostics panel shows
the exact failing stage.

## Firestore Configuration Verification

When Firebase environment variables are added or changed in Vercel:

1. Trigger a fresh production deployment.
2. Hard refresh the production portal in a Commissioner browser session.
3. Open Diagnostics.
4. Confirm the Firestore Bootstrap, Provider Status, Environment Validation,
   Schema Status, Migration Status, Read Probe, and Write Probe panels resolve
   to explicit statuses.
5. Confirm no Firestore panel remains indefinitely in `Loading`.

Expected healthy production verification:

```text
Firestore: PASS
Provider: dual
Bootstrap: Complete
Schema: Version 1
Collections: Initialized
Read Test: PASS
Write Test: PASS
Migration: Ready
```

If any panel reports `FAILED`, `CONFIGURATION ERROR`, `PERMISSION ERROR`, or
`BOOTSTRAP REQUIRED`, leave Google Sheets as the authoritative provider and fix
the reported configuration or permissions issue before running migration.

## Dual Compare

Set:

```text
VITE_DATA_PROVIDER=dual
```

Dual Compare keeps Google Sheets as the player-facing source of truth while
Firestore reads are compared in the background. Mismatches are shown only to
Commissioners.

## Migration Verification

Before switching to Firestore:

1. Deploy with `VITE_DATA_PROVIDER=dual`.
2. Open Commissioner Diagnostics.
3. Review Migration Verification.
4. Confirm all repositories report `MATCH`.
5. Confirm mismatch count is `0`.
6. Confirm Firestore Bootstrap is not failing.
7. Confirm Firestore completeness is `PASS`.

Do not set `VITE_DATA_PROVIDER=firestore` until Diagnostics reports
`READY FOR FIRESTORE`.

## Data Migration

To populate Firestore while keeping Google authoritative:

1. Deploy with Firebase environment variables configured.
2. Sign in as a Commissioner.
3. Open Diagnostics.
4. Click `Run Firestore Migration`.
5. Wait for all collections to report `PASS`.
6. Review Migration Verification and Difference Viewer.

If migration fails, leave `VITE_DATA_PROVIDER=google`, fix the reported issue,
and rerun migration.

## Rollback

Set:

```text
VITE_DATA_PROVIDER=google
```

Redeploy. This restores the Google Sheets provider without code changes.
