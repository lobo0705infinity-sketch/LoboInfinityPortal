# Performance

Version 2.5.1 makes performance a first-class release concern.

## Baseline Findings

The main performance bottleneck was not payload size. It was blocking Apps Script execution and eager frontend work:

- The Dashboard depended on the monolithic `home` endpoint.
- `home` synchronously generated Dashboard, Recent Games, News, Intelligence, Hall of Fame, Settings, Streams, and Army Lists.
- Hall of Fame could exceed 25 seconds because it built player careers and achievement history per player.
- The app shipped every page in one initial JavaScript bundle.
- Header controls fetched search, quick jump, and notification data on every route.

## Frontend Strategy

The frontend now uses route-level code splitting through `React.lazy` and `Suspense`.

Large routes such as My Profile, Commissioner Dashboard, Automation Center, Integrity, Hall of Fame, Analytics, Player Profile, Mission Profile, and Faction Profile load only when opened.

Global header controls defer network work:

- Global Search loads its index on focus or first input.
- Quick Jump loads options on focus.
- Notification Center loads notifications when opened.

The frontend GET cache TTL is five minutes to avoid repeated Apps Script calls during normal navigation.

## Dashboard Strategy

Dashboard first paint now uses the lightweight `dashboard` endpoint.

Secondary dashboard widgets hydrate in parallel after first render:

- Recent Games
- News
- League Intelligence
- Settings
- Army List community data

The page no longer blocks on Hall of Fame.

## Backend Strategy

Apps Script cache TTL is now fifteen minutes for public cached endpoints.

The `home` endpoint has been made compatible but slim. It no longer synchronously computes Hall of Fame and League Intelligence.

Heavy systems should remain page-specific:

- Hall of Fame
- Integrity
- Automation
- Commissioner Operations
- League Intelligence

## Stability Notes

Activity tracking now waits longer before writing `lastPage`, reducing cache invalidation immediately after navigation.

POST requests still clear frontend cache because they may mutate backend state. That behavior is intentional.

## Measurement Checklist

For each performance release, record:

- Initial JavaScript bundle size.
- Largest route chunk.
- Largest CSS file.
- Slowest public Apps Script endpoint.
- Dashboard first useful render endpoint timing.
- Largest JSON payload.
- Number of startup API requests.
- Mobile layout shift checks.

## Current Targets

- Initial load under 2 seconds where Apps Script cold start is not involved.
- Dashboard first data under 2 seconds.
- Cached navigation under 300 ms from frontend cache.
- No global Search, Quick Jump, or Notification data requests on initial page load.

## Version 3.4 Reliability Strategy

Version 3.4 moves expensive operational maintenance away from user-facing request paths.

The Snapshot Manager tracks freshness and rebuild duration for derived views that are expensive or operationally important:

- League
- Operations
- Integrity
- Lifecycle
- Standings
- Records
- Hall of Fame
- Analytics
- Search

Background jobs queue snapshot rebuilds and recovery actions. Commissioner diagnostics read snapshot metadata first, then expose explicit rebuild actions for expensive work.

The intended performance behavior is:

- Normal navigation reads cached endpoint responses and existing snapshots.
- Commissioner diagnostics load Platform Health in a lightweight read.
- Recovery actions queue or rebuild targeted snapshots without clearing unrelated caches.
- Failed or stale snapshots produce warnings and safe recovery actions instead of blank pages.

The reliability target is a cache hit rate above 90 percent during normal usage. Targeted cache invalidation should be preferred over global clears.

## Mobile Performance Strategy

Version 2.5.3 keeps the Version 2.5.1 loading model intact.

The mobile release is primarily responsive CSS:

- The sidebar becomes a fixed bottom navigation on small screens without adding JavaScript state.
- Search, notifications, and profile menus become touch-friendly overlays using existing lazy-loaded data paths.
- Dense tables collapse into stacked cards through CSS rather than duplicate mobile components.
- Form controls use larger touch targets and mobile-safe font sizing without extra dependencies.
- Safe-area spacing protects iOS and Android gesture areas.

This release must not add startup API requests or eager Apps Script calls. Search, Quick Jump, and Notifications still load only on interaction.

## Mobile Budget Checks

For every mobile release, compare:

- Initial JavaScript bundle before and after.
- CSS asset before and after.
- Startup API request count before and after.
- Apps Script calls on first render before and after.
- Mobile layout overflow checks for phone portrait, phone landscape, tablet portrait, and tablet landscape.

## Hall of Fame Performance

Version 2.5.4 optimizes the Hall of Fame endpoint as a dedicated scalability release.

Before optimization, Hall of Fame cold builds were dominated by repeated Apps Script and spreadsheet work:

- Standings rebuilt the player registry and league statistics once per division.
- Achievement records were read from the Achievements sheet once per player.
- Army lists were read from the Army Lists sheet once per player.
- Display names could rebuild the player registry during Hall of Fame construction.
- Career leaderboards repeatedly sorted the same career array.
- The API returned more career rows than the current page renders.

The optimized path builds one request-local Hall of Fame context:

- Player registry is loaded once.
- League statistics are applied once.
- Standings for all divisions are derived from the same registry.
- Game analytics are read once.
- Achievement records are read once and indexed by player.
- Army lists are read once and counted by player.
- Display names are derived from the loaded registry.
- The Hall of Fame snapshot is cached using the portal cache version.
- Secondary frontend sections render after first paint without issuing another request.

Performance target:

- Hall of Fame cold Apps Script build under 2 seconds.
- Cached Hall of Fame response under 300 ms where Apps Script cache is warm.
- No increase to Dashboard, authentication, or profile startup work.

## Season Command Center Performance

Version 2.6 adds Season Command Center without changing the Dashboard critical path.

The Dashboard still loads first from the lightweight `dashboard` endpoint. Season Command Center loads only for authenticated users after the page mounts.

Backend performance strategy:

- Reuse the existing player registry.
- Reuse existing standings calculations.
- Read Game Analytics once for opponent pairings.
- Keep availability in a dedicated small sheet.
- Invalidate only the `seasonCommand` cache group when availability changes.

## Event Migration Validation Performance

Version 3.0C adds backend-only validation tooling. It is operations-gated and not called by the public frontend startup path.

Performance characteristics:

- No frontend bundle increase.
- No new startup API requests.
- No production data migration.
- Validation reuses existing production services instead of duplicate calculations.
- Validation may be heavier than normal read endpoints because it compares multiple subsystems in one report; it should be run intentionally during release validation, not on page load.

## Community Command Center Performance

Version 3.1 keeps the Dashboard critical path intact.

The public Dashboard still loads first from the lightweight `dashboard` endpoint. For authenticated users, the Community Command Center loads through one deferred authenticated request after the first render.

The command center reuses existing backend services:

- Event Engine default Current League event.
- Season Command Center calculations.
- Existing notifications, news, streams, army lists, and recent games.

No new dependencies, startup requests, or public page-load blockers are introduced.

Version 3.1.1 keeps the same request model.

Today, My Remaining Games, Event Switcher, and Nudge Engine are derived inside the existing authenticated `communityCommandCenter` response. The frontend does not add a second workflow request, and signed-out users continue to avoid the authenticated command-center call.

This avoids new anonymous startup requests and avoids duplicate statistics calculations.

## Event Lifecycle Performance

Version 3.1.2 embeds Event Lifecycle state in the existing Commissioner Dashboard operations response.

Lifecycle controls are operations-only:

- They do not add public startup requests.
- They do not change authenticated player Dashboard requests.
- They do not add package dependencies.
- Transition mutations refresh event and operations caches after updating Event Engine rows.

The lifecycle card reuses Event Engine, Season Command Center commissioner status, Identity status, Discord status, and Automation rules instead of creating duplicate health calculations.
