# Recovery

Version 3.4 introduces a Commissioner Recovery Center for safe operational rebuilds.

## Recovery Actions

Supported recovery actions:

- Rebuild Standings Snapshot.
- Rebuild Records Snapshot.
- Rebuild Hall of Fame Snapshot.
- Rebuild Search Snapshot.
- Rebuild Analytics Snapshot.
- Rebuild Lifecycle Snapshot.
- Rebuild Operations Snapshot.
- Rebuild Integrity Snapshot.
- Rebuild Everything.

Actions require confirmation in the UI and are permission-gated in Apps Script.

## Recovery Workflow

1. Commissioner opens Diagnostics.
2. Platform Health reports stale, failed, or missing operational data.
3. Commissioner selects the smallest targeted recovery action.
4. Apps Script executes or queues the rebuild.
5. Reliability audit entry is written.
6. Platform Health refreshes.

## Automatic Recovery

The reliability layer may safely seed missing snapshot metadata and report stale snapshots as warnings.

Automatic recovery must not perform destructive operations. Expensive or sensitive rebuilds remain explicit Commissioner actions.

## Failure Handling

If a rebuild fails:

- The job is marked failed.
- The error is stored on the job.
- Platform Health score is reduced.
- A warning is displayed.
- Commissioners can retry with the same recovery action.

Existing cached data should remain usable whenever possible.
