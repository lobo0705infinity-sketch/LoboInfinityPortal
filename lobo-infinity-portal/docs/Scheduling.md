# Scheduling

Version 4.0 makes scheduling a first-class community workflow.

Version 4.0.1 refines scheduling for an entirely online league. Physical store, city, travel distance, and location concepts are no longer part of the player-facing scheduling workflow.

## Identity

Scheduling uses `leaguePlayer` for all lookups.

Display names are presentation-only.

## Opponent Tracker

Opponent Tracker is derived from:

- Current division standings.
- Game Engine submitted games.
- Season Availability.

Completed opponents show completed status. Remaining opponents show availability summary, Discord handle, profile link, and Match Finder link.

## Availability

Players can publish:

- Status.
- Preferred days.
- Preferred time window.
- Notes.
- Discord handle.

Availability is stored in the Season Availability sheet and can be edited from Match Finder. My Profile links directly to the availability editor.

After saving, the UI confirms `Availability Saved`. The scheduling cache group is invalidated so refreshed Match Finder data reflects the saved values.

## Match Finder

Match Finder recommends opponents based on:

- Remaining required matchup.
- Same division.
- Availability overlap.
- Opponent season progress.
- Existing pending scheduling requests.

Recommendations are informational only. The system does not automatically schedule matches. Recommendation cards use player-facing labels such as `Priority Opponent`, `Excellent Match`, and `Good Match` instead of unexplained numeric scores.

## Scheduling Requests

Players can send a request with:

- Opponent.
- Proposed date.
- Proposed time.
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
- Players with no availability.
- Outstanding matchups.
- Unanswered requests.
- Upcoming scheduled matches.
- Suggested reminder recipients.
