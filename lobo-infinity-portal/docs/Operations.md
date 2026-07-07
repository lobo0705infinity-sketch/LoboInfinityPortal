# Operations

Version 3.4 treats operations as a reliability layer around existing production systems.

## Platform Health

Commissioners can inspect Platform Health from Diagnostics.

Platform Health shows:

- Apps Script version.
- Frontend version.
- Snapshot freshness.
- Job queue status.
- Cache health.
- Average API timing.
- Cache hit and miss rates.
- Failed background jobs.
- Last successful rebuild.
- Operational warnings.

The page is read-only except for Commissioner-gated recovery and cache actions.

## Snapshot Manager

Snapshots are metadata records for expensive or important derived data.

Each snapshot includes:

- ID.
- Label.
- Generation timestamp.
- Generation duration.
- Version.
- Dependencies.
- Status.
- Record count.
- Error message.

Snapshots are read-only from the user interface. Rebuilds are explicit Commissioner recovery actions.

## Job Queue

The background job queue records expensive maintenance work.

Supported jobs include:

- Rebuild Standings.
- Rebuild Analytics.
- Rebuild Records.
- Rebuild Hall of Fame.
- Rebuild Search Index.
- Rebuild Integrity Snapshot.
- Rebuild Operations Snapshot.
- Refresh Cache Groups.

Jobs are tracked as queued, running, completed, or failed. Failures remain visible in Platform Health until a successful recovery action is recorded.

## Cache Management

Commissioners can invalidate targeted cache groups from Diagnostics.

Global cache clearing should be avoided unless a release or incident requires it. Targeted invalidation preserves performance and reduces Apps Script load.

## Audit Logging

Reliability actions create audit records containing:

- Timestamp.
- Commissioner.
- Action.
- Target.
- Duration.
- Result.
- Error, when applicable.

These records are operational audit entries and do not replace existing Event Lifecycle or Automation audit logs.
