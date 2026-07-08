# Multi-Event Platform

Version 6.0 extends the existing Event Engine so the portal can operate multiple concurrent Infinity events without introducing a parallel tournament system.

## Scope Model

Every game resolves to exactly one Event.

Missing event scope remains backward compatible:

```text
event-current-league
```

Aggregate views may request:

```text
all
lifetime
```

These scopes read all Event-scoped games and are intended for career and historical statistics.

## Game Ownership

The `Game Engine` and `Game Analytics` rebuild paths append an `Event ID` column. Existing form submissions that do not provide an Event ID are written as `event-current-league`.

This preserves existing July league data while making new rebuilt rows explicitly event-owned.

## Event-Aware Reads

The following reads accept optional `eventId` scope:

- `standings`
- `schedulingCenter`
- `matchFinder`

If omitted, they return Current League data.

## Scheduling Isolation

Scheduling requests include `Event ID`. Match Finder and scheduling request groups filter by the selected Event so requests from one Event do not appear in another Event workflow.

## Standings Isolation

Standings use the existing player registry and standings sorting logic. The only change is that the statistics updater reads Event-scoped `Game Engine` rows before building division tables.

The table renderer still renders the standings array exactly as returned by the API.

## Lifetime Statistics

Version 6.0 establishes the read scope required for lifetime statistics. Dedicated lifetime presentation remains a consumer of the same scoped Game Engine data rather than a separate statistics engine.

## Migration Notes

Historical rows without an `Event ID` are treated as Current League at read time. A rebuild of Game Engine and Game Analytics writes the explicit `event-current-league` value into generated rows.

No manual Google Sheets editing is required for compatibility.
