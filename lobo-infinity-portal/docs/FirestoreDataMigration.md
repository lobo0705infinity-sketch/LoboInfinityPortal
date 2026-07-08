# Firestore Data Migration

Version 7.3 adds an explicit Firestore migration service. It copies production
Google Sheets data into Firestore while keeping Google Sheets authoritative.

This is not the production provider switch.

## Safety Model

- Google Sheets remains authoritative.
- Firestore receives mirrored documents.
- Migration is run from Commissioner Diagnostics.
- Writes are idempotent and use stable document ids.
- Running migration more than once updates existing Firestore documents.
- No Google Sheets data is modified.

## Migrated Collections

The migration service populates:

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

Bootstrap-created `__schema` marker documents remain in place.

## Migration Dashboard

Commissioner Diagnostics displays:

- Overall migration status.
- Documents written.
- Documents verified.
- Throughput.
- Per-collection status.
- Per-collection duration.
- Failures and warnings.
- Repository parity after migration.

## Verification

After migration completes, the portal runs Firestore Migration Verification.
The verifier compares representative repository reads from Google Sheets and
Firestore and reports readiness.

## Rollback

Rollback is configuration-only:

```text
VITE_DATA_PROVIDER=google
```

Firestore data may be cleared and migrated again. Google Sheets remains
untouched.

## Recovery

If migration is interrupted, rerun it. Stable document ids and merge writes make
the operation repeatable.
