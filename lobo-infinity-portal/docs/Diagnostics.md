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
- Frontend client workflow telemetry, including availability save attempts, successes, failures, and verification failures.
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

Version 4.0.2 adds read-only Availability Save diagnostics. These records are browser-local diagnostics surfaced to Commissioners and include event name, status, duration, and non-sensitive detail. They do not change scheduling permissions, do not expose OAuth tokens, and do not replace backend audit logging.

Version 5.0.1 expands browser-local Real User Monitoring. Commissioner Diagnostics now exposes:

- First Contentful Paint.
- Largest Contentful Paint.
- Cumulative Layout Shift.
- Interaction to Next Paint approximation.
- Route transition timing.
- JavaScript and CSS transfer size.
- Resource count.
- Existing API timing and cache metrics.

These metrics are collected through passive browser performance APIs and are not sent to a backend endpoint.
