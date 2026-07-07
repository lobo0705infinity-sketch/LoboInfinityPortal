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

## Lifecycle Validation

Version 3.1.2.1 adds a self-healing validation layer to the existing lifecycle service. Validation runs whenever lifecycle data is loaded and before any Commissioner transition is allowed.

Validation checks:

- Registration state versus lifecycle stage.
- Event status versus lifecycle stage.
- Awards stage versus incomplete season games.
- Archived events with open registration.
- Schedule-generated or active events without participants or rounds.

The validation report returns:

- Overall status.
- Health score.
- Blocking issues.
- Warnings.
- Problem, reason, impact, and recommended action.
- Repair action metadata for one-click Commissioner repair.

Health score bands:

- `95-100`: Green, Healthy.
- `75-94`: Yellow, Needs Attention.
- `50-74`: Orange, Action Required.
- `<50`: Red, Critical.

## Self-Healing Repairs

Repairs use the same `eventLifecycleTransition` endpoint with `direction=repair`. Repairs are not a separate lifecycle system. They update existing Event Engine rows, publish lifecycle automation, write audit entries, invalidate cache, and refresh the dashboard.

Supported repair patterns:

- Synchronize registration with lifecycle stage.
- Synchronize event status with lifecycle stage.
- Return an event to a safe stage when prerequisites are incomplete.
- Reopen registration if a schedule exists without participants.

Unsafe advances are blocked. For example, an `Active` event with `Registration Open` cannot advance to `Midseason`; the Commissioner receives the validation problem and a `Close Registration` repair action instead.

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
- Health score
- Blocking lifecycle issues
- Self-healing repair actions
- Commissioner warnings
- Automation template preview
- Audit log

## Automation

Lifecycle transitions publish:

```text
eventLifecycleTransition
```

This event type is handled by the existing Automation Center and can be configured like other automation events.
