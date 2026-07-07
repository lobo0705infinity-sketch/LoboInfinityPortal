# Scheduling

Version 4.0 makes scheduling a first-class community workflow.

## Identity

Scheduling uses `leaguePlayer` for all lookups.

Display names are presentation-only.

## Opponent Tracker

Opponent Tracker is derived from:

- Current division standings.
- Game Engine submitted games.
- Season Availability.

Completed opponents show completed status. Remaining opponents show availability summary, preferred store, Discord handle, profile link, and Match Finder link.

## Availability

Players can publish:

- Status.
- Preferred days.
- Preferred times.
- Monday through Sunday availability.
- Notes.
- Home store.
- City.
- Maximum travel distance.
- Preferred locations.
- Discord handle.

Availability is stored in the Season Availability sheet and can be edited from Match Finder. My Profile links directly to the availability editor.

## Match Finder

Match Finder recommends opponents based on:

- Remaining required matchup.
- Same division.
- Availability overlap.
- Preferred store.
- Opponent season progress.
- Existing pending scheduling requests.

Recommendations are informational only. The system does not automatically schedule matches.

## Scheduling Requests

Players can send a request with:

- Opponent.
- Proposed date.
- Proposed time.
- Location.
- Optional message.

Recipients can accept, decline, or suggest another time.

Accepted requests can export an `.ics` calendar file for Google Calendar, Apple Calendar, and Outlook.

## Notifications

Scheduling requests generate notifications through the existing notification system.

Notification read, dismissed, and archived state still persists in the Users sheet.

## Commissioner Scheduling

Commissioners can view scheduling status from the Commissioner Dashboard.

The panel shows:

- Division completion.
- Players behind schedule.
- Inactive players.
- Outstanding matchups.
- Suggested reminder recipients.
