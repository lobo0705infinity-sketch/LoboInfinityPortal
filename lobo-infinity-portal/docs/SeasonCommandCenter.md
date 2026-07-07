# Season Command Center

Version 2.6 adds the Season Command Center as the player's weekly season home.

## Purpose

Every authenticated player should immediately understand:

- Who they still need to play.
- How many games remain.
- Whether they are on schedule.
- Who should be their next opponent.
- Whether they are in promotion or relegation danger.

## Architecture

The backend is implemented in `SeasonCommandCenterApi.gs`.

It reuses existing systems:

- `getRequestUser()` for authentication and League Identity.
- `buildPlayerRegistry()` for player membership.
- `updateRegistryStatistics()` for current standings inputs.
- `buildDivisionTable()` for ranking and division status.
- `getAllRecentGameObjects()` for completed pairings.
- Settings for season start and end dates.
- Portal cache invalidation for availability changes.

No duplicate standings or game calculations are introduced.

## Data Sources

- Players sheet
- Game Analytics sheet
- Settings sheet
- Season Availability sheet

## Season Availability

Availability is presentation and scheduling metadata. It does not affect standings, statistics, identity, achievements, or history.

Players may save:

- Status
- Preferred days
- Preferred times
- Notes

## Frontend

The Dashboard renders the Season Command Center for authenticated users only.

The request is made after the Dashboard critical path so Version 2.5.1 startup performance remains intact.

## Commissioner View

The same payload includes a division-level commissioner summary:

- Players finished.
- Players behind pace.
- Missing pairings.
- Late players.

This is informational and does not replace the Commissioner Dashboard or Integrity System.

## Automation

Version 2.6 exposes season status data that automation rules can use for reminders. It does not replace the existing Automation Center event, queue, template, or destination architecture.

The Automation Center includes a `seasonReminder` event type for configurable future Discord/timeline destinations. Portal Notifications also receive personalized season reminders from the same Command Center calculations so a player can see remaining games, recommended next opponents, and promotion/relegation pressure without duplicating scheduling logic.
