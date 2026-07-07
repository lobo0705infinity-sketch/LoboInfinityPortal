# Event Lifecycle Controls

Version 3.1.2 makes Events operable from the portal.

Commissioners should not edit Google Sheets to advance an Event through its lifecycle.

## Stages

```text
Planning
Registration Open
Registration Closed
Roster Locked
Schedule Generated
Active
Midseason
Final Week
Awards
Archived
```

## Permissions

- Assistant Commissioners can view lifecycle health.
- Commissioners can advance lifecycle stages.
- Commissioners can perform safe rollbacks.

The backend enforces `runSeasonControl` for lifecycle mutations.

## Data

Lifecycle controls reuse existing Event Engine sheets:

- `Events`
- `Event Participants`
- `Event Seasons`
- `Event Rounds`

Lifecycle audit writes to:

- `Event Lifecycle Audit`

## Transition Behavior

Every successful transition:

- Updates the Event row.
- Synchronizes related Season and Round status.
- Publishes `eventLifecycleTransition` through Automation Center.
- Queues configured destinations such as Portal, Discord, Timeline, News, and Commissioner Feed according to Automation rules.
- Writes an audit row with timestamp, commissioner, event, previous stage, new stage, reason, and automation result.
- Refreshes event and operations caches.

## Rollback

Rollback is available only when it is safe.

Safe examples:

- `Registration Open` to `Planning`
- `Registration Closed` to `Registration Open`
- `Roster Locked` to `Registration Closed` if no rounds or submitted games block the rollback

Unsafe examples:

- After schedule generation
- After submitted games
- After archive

## Commissioner Dashboard

The Event Lifecycle card appears under Commissioner Dashboard Event Management.

It shows:

- Current stage
- Status
- Participants
- Registration
- Rounds
- Automation
- Discord
- Start Date
- End Date
- Current Round
- Current Season
- Event health
- Commissioner warnings
- Automation template preview
- Audit log

## Automation

Lifecycle transitions publish:

```text
eventLifecycleTransition
```

This event type is handled by the existing Automation Center and can be configured like other automation events.
