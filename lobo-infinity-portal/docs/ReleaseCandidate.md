# Release Candidate Hardening

Version: RC-1

Purpose: stabilize the completed portal without adding user-facing features.

## Audit Scope

RC hardening reviews the application page by page across:

- Public dashboard and unauthenticated states
- Player Home Dashboard
- Match Finder, Availability, scheduling requests, and opponent tracking
- Standings, players, profiles, factions, missions, games, streams, rules, and timeline
- Notifications, search, quick jump, and account controls
- Commissioner Dashboard, Operations, Lifecycle, Integrity, Diagnostics, Recovery, Automation, and Platform Health
- Desktop, tablet, and mobile shells

## Findings

### UX

The core workflows are complete and route-based code splitting is already in place. The most visible remaining RC issue was shell-control polish: mobile navigation, profile menu, and notification flyouts had working controls but incomplete accessible dialog metadata and no Escape-key close behavior.

### Desktop

Desktop pages use consistent tactical panels, command cards, and page headers. No desktop-only blocking issue was found during RC-1. Continued polish should focus on reducing duplicated operational copy in commissioner-heavy panels.

### Mobile

The native mobile shell is active, with compact top controls and bottom navigation. Availability save visibility was fixed in v4.0.2a. RC-1 improves mobile menu accessibility and makes flyout behavior more predictable.

### Accessibility

RC-1 adds:

- Dynamic open/close labels for the mobile navigation button
- `aria-controls` and `aria-haspopup` for menu triggers
- Dialog IDs for flyout panels
- Escape-to-close behavior for mobile navigation, profile menu, and notification menu
- Clearer notification trigger copy when there are no unread notifications

### Performance

No new startup requests were added. The changes are limited to event listeners that are registered only while a flyout is open.

### Code Quality

The source audit found no active `console.log`, `debugger`, `TODO`, `FIXME`, `HACK`, `TEMP`, `WORKAROUND`, or `XXX` items requiring code changes. Template constant names in backend automation/event files are intentional and not cleanup targets.

## Regression Focus

Before tagging a release candidate, verify:

- Authentication and sign-out
- Dashboard and Player Home
- Match Finder and Availability
- Scheduling requests
- Notifications and mark-read behavior
- Mobile menu, search, profile menu, and bottom navigation
- Commissioner Dashboard, Lifecycle, Integrity, Diagnostics, and Recovery
- Standings, Hall of Fame, player profiles, factions, missions, and game details

## RC-1 Changes

RC-1 intentionally limits implementation to shell polish and documentation:

- Mobile navigation exposes accurate state and closes with Escape.
- Profile menu exposes dialog relationship metadata and closes with Escape.
- Notification menu exposes dialog relationship metadata, has clearer trigger text, and closes with Escape.

No business logic, APIs, authentication, scheduling, Event Engine, Google Sheets schema, or commissioner permissions changed.
