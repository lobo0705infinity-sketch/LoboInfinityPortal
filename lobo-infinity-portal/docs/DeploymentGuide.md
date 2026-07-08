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

## Dual Compare

Set:

```text
VITE_DATA_PROVIDER=dual
```

Dual Compare keeps Google Sheets as the player-facing source of truth while
Firestore reads are compared in the background. Mismatches are shown only to
Commissioners.

## Rollback

Set:

```text
VITE_DATA_PROVIDER=google
```

Redeploy. This restores the Google Sheets provider without code changes.
