# Diagnostics

Diagnostics is the Commissioner-facing platform health surface.

## Purpose

Diagnostics answers:

- Is the platform healthy?
- Are snapshots fresh?
- Are background jobs failing?
- Is the cache performing normally?
- Which endpoints are slow in the browser?
- What recovery actions are available?

## Data Sources

Diagnostics combines:

- Frontend performance telemetry from the browser.
- Apps Script reliability metadata.
- Snapshot Manager records.
- Job Queue records.
- Cache Manager metrics.
- Recent reliability audit entries.

## Permissions

Viewing diagnostics requires Commissioner-level access.

Recovery and cache actions require cache-management permission. Assistant Commissioners can view operational status only if their role grants the required operations permission.

## Safety

Diagnostics must not bypass:

- OAuth.
- Commissioner permissions.
- Audit logging.
- Event Lifecycle validation.
- Integrity validation.
- Cache invalidation rules.

The Diagnostics page uses existing services and returns refreshed Platform Health after each action.
