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

## Team Tournament Event

Version 6.0.1 adds `Team Tournament` as a first-class Event type in the existing Event Engine.

The default Team Tournament seed is:

```text
event-august-2026-team-tournament
```

Team Tournament data is event-scoped:

- Team registration writes Event Participants for the Team Tournament Event.
- Team records live in the `Team Tournament Teams` sheet.
- Pairings live in the `Team Tournament Pairings` sheet.
- Team standings derive from games whose `Event ID` matches the Team Tournament Event.

League standings, league scheduling, and league Match Finder views remain isolated from Team Tournament data.

Commissioner management uses existing operations permissions. No parallel tournament engine is introduced.

## Event Registration

Version 6.0.2 moves registration into the Event Engine.

Every Event owns its registrations through Event Participants. Registering for one Event does not affect any other Event.

Registration data includes player identity plus Event-specific fields such as Discord, preferred team, captain flag, free-agent flag, faction, notes, and status.

Team Tournament registration is the first consumer of the generic registration engine.

## Event Home

Version 6.0.3 adds a shared Event Home experience.

Every Event can be opened at:

```text
/event/{eventId}
```

The Event Home composes Event Engine data, Event Registration, rounds, event-scoped games, timeline entries, news, quick actions, and personalized player status into one destination.

Event-specific pages such as Team Tournament remain specialized views, but the Event Home is the default landing page for understanding the selected competition.

## Commissioner Event Manager

Version 6.0.3 also adds the Commissioner Event Manager.

The Event Manager lives inside `/commissioner` and operates the same Event Engine records used by Event Home, Team Tournament, registration, standings, and scheduling.

Commissioners can:

- Create Events.
- Edit Event details.
- Open, close, or reopen registration.
- Select the current active Event.
- Update lifecycle and archive state.
- Manage participants and registration status.
- Manage Team Tournament teams and pairings.

No separate League manager or Team Tournament manager is introduced.

## Standings Isolation

Standings use the existing player registry and standings sorting logic. The only change is that the statistics updater reads Event-scoped `Game Engine` rows before building division tables.

The table renderer still renders the standings array exactly as returned by the API.

## Lifetime Statistics

Version 6.0 establishes the read scope required for lifetime statistics. Dedicated lifetime presentation remains a consumer of the same scoped Game Engine data rather than a separate statistics engine.

## Migration Notes

Historical rows without an `Event ID` are treated as Current League at read time. A rebuild of Game Engine and Game Analytics writes the explicit `event-current-league` value into generated rows.

No manual Google Sheets editing is required for compatibility.
