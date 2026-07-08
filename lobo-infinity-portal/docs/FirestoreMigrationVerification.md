# Firestore Migration Verification

Version 7.2 adds the final verification layer before any provider cutover from
Google Sheets to Firestore.

This release does not migrate production data and does not switch the production
provider.

## Dual Provider Verification

Use:

```text
VITE_DATA_PROVIDER=dual
```

In dual mode, player-facing reads return Google Sheets data. Firestore reads run
in parallel for comparison diagnostics. Mismatches are visible only to
Commissioners.

## Migration Dashboard

Commissioner Diagnostics includes:

- Overall readiness.
- Migration progress.
- Repository parity status.
- Mismatch count.
- Last verification time.
- Firestore completeness.
- Synchronization status.
- Rollback instructions.

## Repository Comparison

The migration verifier compares representative read contracts from:

- Dashboard
- Events
- Games
- Notifications
- Players
- Registrations
- Scheduling
- Standings
- Teams
- Analytics

The verifier records:

- Repository
- Method
- First mismatched field
- Google value
- Firestore value
- Severity
- Timestamp

## Difference Viewer

The Difference Viewer in Diagnostics shows provider mismatches in a table. It is
Commissioner-only and does not expose migration state to players.

## Performance Comparison

Diagnostics reports Google Sheets and Firestore latency:

- Average
- Median
- P95

These values are measured from the same verification probes.

## Readiness Rules

The migration dashboard reports `READY FOR FIRESTORE` only when:

- Firestore Bootstrap is not failing.
- Firestore provider health is healthy.
- Required collections are present.
- No critical mismatches exist.
- Repository parity passes.

Any mismatch or bootstrap failure blocks cutover.

## Rollback

Rollback remains configuration-only:

```text
VITE_DATA_PROVIDER=google
```

Redeploying with Google restores the existing Google Sheets provider path.
