# Tournament Guide

Version 6.1 turns Team Tournament Events into an operational tournament experience on top of the Event Engine.

## Tournament Home

Open a Team Tournament through:

```text
/event/{eventId}
```

The Event Experience Router loads the Team Tournament experience for `Team Tournament` Events. The page shows registration state, current round, registered teams, registered players, pairings, standings, timeline, free agents, invitations, result reporting, and commissioner tools.

## Registration

Players register through the portal while Event registration is open. Registration is Event-scoped and does not affect League participation.

Players can provide:

- Discord handle
- Preferred team
- Free-agent status
- Captain interest
- Primary faction
- Notes

## Teams

Commissioners can create and update teams from the tournament page or Event Manager. Teams are stored in the Team Tournament Teams sheet and are scoped by Event ID.

Each team contains:

- Team name
- Captain
- Roster
- Discord contact
- Status

## Free Agents And Invitations

Free agents are registered players with `freeAgent=true`.

Commissioners can invite a free agent to a team. Invitations are Event-scoped and track:

- Team
- Captain
- Player
- Status
- Message

Invitation status values are intentionally generic so future player-facing accept/decline actions can reuse the same records.

## Pairings

Commissioners can post pairings from the tournament page.

Pairings include:

- Round
- Team A
- Team B
- Individual player pairings
- Status
- Results summary

Pairings are Event-scoped and do not affect League scheduling.

## Match Reporting

Players can submit Team Tournament results in the portal.

The result form captures:

- Round
- Team A
- Team B
- Player
- Opponent
- Tournament Points
- Objective Points
- Victory Points
- Winning faction
- First turn
- Best moment
- Notes

Scores use `left-right` notation, for example `7-3`.

Submitted tournament results are stored in Team Tournament Results and feed Team standings. They remain separate from League standings.

## Standings

Team standings rank teams by:

1. Tournament Points
2. Objective Points
3. Victory Points
4. Team name

The standings combine Event-scoped Game Engine rows and Team Tournament Result rows.

## Round Lifecycle

Commissioners can update tournament lifecycle/status from the tournament page:

```text
Registration Open -> Registration Closed -> Roster Locked -> Round 1 -> Round 2 -> Round 3 -> Final Round -> Awards -> Archived
```

Lifecycle changes update the existing Event row. No separate tournament lifecycle engine exists.

## Champion

When the Event reaches `Awards`, `Champion`, or `Archived`, the first-place team is displayed as the tournament champion.

Champion data is derived from Team standings and remains Event-scoped.
