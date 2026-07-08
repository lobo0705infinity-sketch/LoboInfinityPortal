# Lobo Infinity Community Operating System Architecture

## Version 3 Event Engine Baseline

Version 3.0D establishes the permanent Event Engine Baseline.

The Version 3 Event Engine architecture is frozen.

Future releases extend this architecture rather than redesign it.

The permanent top-level hierarchy is:

```text
Organization -> Community -> Series -> Event -> Season -> Round -> Game
```

The current production system operates one Organization and one Community:

```text
Organization: Lobo Infinity
Community: Lobo Infinity Community
```

The Organization layer is the governance boundary above Community. It exists so future communities, venues, brands, or operating groups can be added without changing the Event Engine root model.

Version 3.0D is an architecture baseline release only. It does not change runtime behavior, production data, APIs, UI, authentication, or player functionality.

## Core Systems

The portal is organized around stable, reusable services:

- Portal Identity authenticates Google users and stores portal preferences in the Users sheet.
- League Identity maps Google Email to the permanent Player key in the Players sheet.
- Formatting centralizes league presentation such as TP, OP, VP, records, dates, and summaries.
- Integrity monitors formulas, standings, game engine data, identity, divisions, army lists, streams, and news.
- Achievements persist player milestones by permanent league player.
- Hall of Fame and Career preserve historical league records.
- Discord Automation publishes league events without duplicating league business logic.

League lookups must use the permanent player key. Google display names and player display names are presentation-only.

## LTS Baseline

Version 2.5.4 is the first Long-Term Support baseline.

Stable production subsystems:

- Google authentication and Portal Identity.
- League Identity through permanent Players sheet keys.
- Player Display Names as presentation-only aliases.
- Formatting service for TP, OP, VP, records, dates, and summaries.
- Integrity System for commissioner health audits.
- Automation Center with event, queue, template, and destination architecture.
- Discord as the first automation destination.
- Deep links for permanent navigation.
- Achievements tied to permanent league players.
- Player Intelligence and My Profile.
- Hall of Fame snapshot architecture.
- Season Command Center derived from standings, game analytics, settings, and availability.
- Event Engine foundation with Current League as the backward-compatible default Event.
- Apps Script cache manager.
- Vercel source-based deployment pipeline.

Future releases should extend these systems instead of replacing them.

## Performance Architecture

The portal uses route-level code splitting so large player, commissioner, integrity, automation, Hall of Fame, and analytics pages load only when opened.

The Dashboard uses a fast critical path:

- First render comes from the lightweight `dashboard` endpoint.
- Secondary widgets hydrate in parallel after first paint.
- Hall of Fame is page-specific and does not block Dashboard.

Global header controls defer network work until interaction:

- Search index loads on search focus.
- Quick Jump data loads on menu focus.
- Notifications load when the notification menu opens.

Version 5.1 adds runtime performance instrumentation and route preloading without changing application architecture:

- Route chunks may preload after explicit navigation intent such as hover, focus, touch, or Quick Jump selection.
- Preloading is limited to JavaScript route chunks and does not fetch page data early.
- Route mount timing, long tasks, API cache ratio, and shared in-flight requests are exposed through Commissioner Diagnostics.
- Browser-local telemetry remains passive and does not add backend writes or bypass authentication.

## Platform Reliability Architecture

Version 3.4 adds a reliability layer without changing league rules, player workflows, Event Engine behavior, or Google Sheets schema.

The reliability layer is organized around read-only snapshots and asynchronous recovery jobs:

- Snapshot Manager tracks League, Operations, Integrity, Lifecycle, Standings, Records, Hall of Fame, Analytics, and Search snapshots.
- Job Queue records queued, running, completed, and failed background work in Apps Script properties.
- Platform Health exposes snapshot freshness, job failures, cache health, endpoint timing, and recovery status to Commissioners.
- Recovery Center queues rebuilds for expensive derived data instead of performing those rebuilds during normal user requests.
- Cache Manager supports targeted invalidation and rebuilds rather than global cache clearing.

Reliability services extend the existing Apps Script cache, diagnostics, operations, integrity, lifecycle, Hall of Fame, and search systems. They do not replace those systems or bypass permission checks.

Reliability mutations are Commissioner-gated, write audit entries, and return the same Platform Health payload so the Commissioner interface can refresh without issuing follow-up requests.

## Community Scheduling Architecture

Version 4.0 adds community scheduling as a player-facing layer on top of the existing Season Command Center.

Scheduling uses the permanent `leaguePlayer` key for every lookup. Google display name and player display name remain presentation-only.

The scheduling model extends existing systems:

- Opponent Tracker is derived from current division standings and Game Engine results.
- Availability uses the existing Season Availability sheet with additional optional presentation fields.
- Scheduling Requests are stored in a dedicated Scheduling Requests sheet.
- Match Finder recommendations reuse Season Command Center opponent status, availability, division, and progress data.
- Notifications reuse the existing notification state system and add scheduling-specific alerts.
- Commissioner scheduling status reuses existing operations permissions and division progress calculations.

Scheduling does not modify game results, standings formulas, Event Lifecycle, Integrity validation, Discord automation, or authentication.

## Team Tournament Architecture

Version 6.0.1 proves the Multi-Event Platform with a Team Tournament experience built as a normal Event Engine event.

Team Tournament support reuses the platform systems:

- Event Engine owns the Team Tournament Event, season, and round.
- Event Participants records player registration without changing league participation.
- Team Tournament Teams stores captains, rosters, faction restrictions, logos, Discord contact, and roster status.
- Team Tournament Pairings stores round pairings and individual player pairing notes.
- Team standings derive only from Game Engine rows matching the Team Tournament Event ID.
- Commissioner tools use existing operations permissions.
- Notifications, scheduling, diagnostics, and lifetime statistics remain shared platform services.

No separate tournament engine exists. League data and Team Tournament data stay operationally isolated through Event ID scope.

## Event Registration Architecture

Version 6.0.2 makes registration an Event Engine concern.

Event registration reuses:

- OAuth and League Identity for the authenticated player.
- Event Participants as the registration source of truth.
- Event Lifecycle registration state to open and close self-service changes.
- Notifications for registration-open and registration-count alerts.
- Player Profiles to surface registered Events.
- Commissioner operations permission for registration management.

Version 6.0.3 adds Commissioner Event Manager operations on top of the Event Engine.

- The Commissioner Dashboard lazy-loads the Event Manager only for operations users.
- Event Manager reads compose Events, Event Participants, Event Rounds, Team Tournament teams, and Team Tournament pairings.
- Mutations are permission-gated through existing Commissioner season-control permissions.
- The current active Event is stored as an Event status marker and is consumed by the Event catalog.
- Event Manager does not add a parallel League or Tournament management system.

Registration is scoped by Event ID. Registering for the Team Tournament does not change League participation, League standings, League scheduling, or any other Event.

## Event Home Architecture

Version 6.0.3 adds a shared Event Home surface for all Events.

The Event Home is a composition layer. It reads from:

- Event Engine Event, Season, and Round records.
- Event Registration.
- Event-scoped recent games.
- Existing notification and news-style presentation.
- Event-specific links such as Team Tournament pairings or standings.

It does not introduce a new event model. Event-specific pages remain consumers of the same Event ID.

Version 4.0.1 narrows scheduling to the league's online model. Player-facing availability and match requests use status, preferred days, preferred time window, Discord handle, and optional notes. Physical location metadata remains backward-compatible in the data model but is not used for recommendations or player-facing scheduling decisions.

## Mobile Experience Architecture

Version 4.1 makes the portal mobile-first at the presentation layer.

The mobile shell keeps existing routes, APIs, authentication, permissions, and business logic unchanged while improving:

- Bottom safe-area navigation for phones.
- Compact tablet sidebar for 768px to 1024px widths.
- Mobile overlays for search, notifications, and profile controls.
- Card-based table presentation for standings and operations tables.
- Large touch targets for forms, scheduling requests, notifications, and commissioner actions.
- Sticky submit actions for long mobile forms.
- Safe-area viewport support for iOS and Android browsers.
- PWA readiness through manifest metadata and mobile app-capable tags.

The mobile layer is CSS-first and route-compatible. It does not add startup API requests or change data contracts.

Version 4.2 replaces the phone shell with a native-app style interaction model while keeping desktop behavior largely unchanged.

Phone navigation uses:

- A compact app bar with menu, brand, search, and notification controls.
- A slide-down mobile menu for secondary destinations and commissioner-only routes.
- A fixed bottom navigation bar for Home, Match Finder, Standings, Notifications, and Profile.
- A floating Submit Match action sourced from the same portal settings as the desktop submit button.
- A full-screen mobile search surface that also contains quick-jump destinations.

The v4.2 shell preserves existing routes, permissions, authentication, scheduling, notifications, diagnostics, operations, and API contracts. It does not introduce a new mobile backend or parallel routing system.

Frontend GET responses are cached for five minutes per authenticated URL. Backend Apps Script cached endpoints use a fifteen-minute cache TTL with stale fallback support.

## Deep-Link Architecture

Permanent portal routes are now part of the League Operating System contract. Discord, Automation, Timeline, and future Open Graph features should request URLs from `DeepLinkApi.gs` instead of manually building links.

Canonical route examples:

- `/game/{gameId}`
- `/player/{leaguePlayer}`
- `/career/{leaguePlayer}`
- `/achievement/{achievementId}`
- `/hall-of-fame`
- `/faction/{faction}`
- `/mission/{mission}`
- `/season/{season}`
- `/weekly-report`
- `/news/{newsId}`
- `/stream/{streamId}`
- `/army-list/{listId}`

Plural legacy routes remain supported for existing navigation. Singular routes are preferred for event and Discord links.

## League Automation Center

The League Automation Center is the portal communication layer.

Every important league event should be published once as a League Event. The event then drives configured destinations such as Portal, Discord, Timeline, News, Commissioner Feed, future Email, future Push, and future Public API.

The backend service is implemented in `AutomationApi.gs` and owns:

- Event definitions.
- Automation rules.
- Message templates.
- Queue state.
- Replay operations.
- Weekly automation.
- Season automation entry points.
- Destination dispatch.

Automation storage sheets:

- `Automation Events`
- `Automation Rules`
- `Automation Templates`
- `Automation Queue`

Existing mutation points publish events rather than directly sending destination-specific messages. This keeps game submission, achievements, streams, commissioner news, army list approvals, and season operations independent from Discord delivery.

Automation failures are recorded in the queue and must not interrupt league operations.

## Discord Automation

Discord integration is implemented as a backend Apps Script destination service in `DiscordApi.gs`.

The service owns:

- Discord configuration in the `Discord Config` sheet.
- Discord automation history in the `Discord Automation Log` sheet.
- Webhook delivery through `UrlFetchApp`.
- Message preview, send, resend, test, and disable operations.
- Duplicate prevention for already-sent event/title pairs.
- Rate limiting by configured messages per hour.
- Failure logging and retry queue state.

Webhook URLs are never returned to public frontend payloads. The Commissioner Dashboard receives only masked webhook state.

## Discord Configuration

The `Discord Config` sheet stores:

- `enabled`
- `webhookUrl`
- `announcementChannel`
- `adminChannel`
- `rateLimitPerHour`
- `automationEvents`
- `retryLimit`
- `brandingColor`
- `thumbnailUrl`
- `lastAutomationRun`

If the sheet or keys are missing, the backend creates safe defaults automatically. Automation is disabled by default until a Commissioner configures and enables it.

## Discord Events

Supported automation events include:

- Game Submitted
- Achievement Unlocked
- Promotion
- Relegation
- Season Start
- Season End
- League News
- Commissioner News
- New Stream
- Army List of the Week
- Player of the Week
- Mission Rotation
- Faction Leader Changes
- Hall of Fame Induction
- League Records Broken
- Weekly Standings
- Upcoming Games Reminder
- Season Countdown
- Manual Announcement
- Test Connection

Automatic hooks are best-effort. A Discord failure is logged but does not stop game rebuilds, news saves, stream saves, achievement unlocks, army list approvals, or season operations.

## Commissioner Tools

The League Automation Center exposes:

- Automation status.
- Discord health.
- Queue size.
- Last message.
- Last failure.
- Retry queue.
- Per-event destination rules.
- Editable templates.
- Manual event publishing.
- Run, pause, resume, replay, retry, and clear controls.

The Commissioner Dashboard also shows Discord operational status.

## Discord Tools

The Commissioner Dashboard exposes:

- Webhook configuration.
- Enable/disable automation.
- Rate and retry limits.
- Event list configuration.
- Test webhook.
- Send announcement.
- Run weekly automation.
- Preview latest generated message.
- Automation log.
- Manual resend for failed messages.

Assistant Commissioners can view operations and send announcements where their existing permissions allow it. Commissioners manage webhook settings.

## Troubleshooting

If Discord messages are not posted:

1. Confirm `enabled` is `true`.
2. Confirm the webhook URL is configured in the Commissioner Dashboard.
3. Use Test Webhook.
4. Check the Discord Automation Log sheet for failure, retry count, response, and status.
5. Confirm the event is included in `automationEvents`.
6. Confirm rate limit has not been reached.
7. Use Resend on failed log entries after correcting the configuration.

Webhook failures should never interrupt normal league operation.

## Mobile Experience

Version 2.5.3 treats the mobile shell as a first-class application surface.

The responsive architecture keeps the existing route and data systems:

- Authentication, Identity, Formatting, Integrity, Automation, Achievements, and Player Intelligence remain unchanged.
- Mobile navigation is handled by the existing `Sidebar` route list with route metadata for small-screen ordering.
- The most common mobile destinations are promoted in the bottom navigation: Dashboard, My Profile, Standings, Notifications, and Timeline.
- Global Search remains lazy-loaded, but opens as a mobile overlay when focused.
- Notifications and profile actions use the existing menus with mobile overlay sizing.
- Tables, cards, and forms adapt through responsive CSS rather than duplicate mobile pages.
- Safe-area spacing is applied so controls do not collide with mobile browser or operating-system gestures.

The mobile layer must not add startup requests. New mobile behavior should be implemented with existing cached APIs and interaction-triggered fetches wherever possible.

## Hall of Fame Snapshot Architecture

Version 2.5.4 makes Hall of Fame a snapshot-driven endpoint.

The Hall of Fame API keeps the existing response contract, but its backend construction now runs through one optimized context:

- `RecordsApi.gs` builds a single player registry and applies statistics once.
- Division standings are derived from that registry instead of rebuilding every division independently.
- Game analytics are read once.
- Achievement records are read once and indexed by permanent league player.
- Army lists are read once and indexed by permanent league player.
- Player display names are derived from the loaded registry.
- The final Hall of Fame payload is cached as a snapshot using the current portal cache version.

This preserves Identity, Achievements, Formatting, My Profile, and Player Intelligence behavior while removing repeated spreadsheet scans from the Hall of Fame request path.

Snapshot invalidation follows the existing portal cache version model. Full cache invalidation advances the version and naturally abandons old Hall of Fame snapshots.

## Season Command Center

Season Command Center is a player-facing season status layer, not a duplicate standings system.

It derives opponent status, progress, promotion/relegation position, deadline status, and division completion from:

- Authenticated `leaguePlayer`.
- Existing player registry.
- Existing standings calculations.
- Existing Game Analytics.
- Existing Settings season dates.
- Dedicated Season Availability metadata.

Availability is scheduling metadata only. It never changes league statistics, standings, achievements, history, or identity.

## Event Engine Foundation

Version 3.0B introduces the approved Version 3 Event Engine foundation without replacing production league systems.

The permanent hierarchy is:

```text
Organization -> Community -> Series -> Event -> Season -> Round -> Game
```

The Organization layer owns one or more Communities. A Community owns player identity, global career, global automation, and all Event Engine data for that community.

The Current League is seeded as the default Event:

```text
event-current-league
```

During the migration window, missing event scope resolves to:

```text
event-current-league
season-current-league
round-current-league
```

The foundation creates only these sheets:

- Events
- Event Templates
- Event Participants
- Event Seasons
- Event Rounds

Existing endpoints continue to operate through legacy league data. Future Version 3 milestones will make statistics, automation, achievements, Player Intelligence, Hall of Fame, and deep links Event-aware by extending their existing services with explicit scope rather than creating parallel implementations.

## Engineering Rules

Engineering Rule #1:

Reuse existing services. Prefer extending Identity, Formatting, Integrity, Automation, Statistics, Achievements, Player Intelligence, and Deep Linking instead of introducing parallel systems.

Engineering Rule #2:

No new top-level architectural concept may be introduced without updating:

- `docs/Architecture.md`
- `docs/APIContracts.md`
- `docs/ProjectStructure.md`
- `docs/TechnicalDebt.md`
- `docs/ReleaseChecklist.md`

## Engineering Gates

Every release must satisfy four permanent gates:

- Architecture Gate: reuse existing services, avoid duplicate business logic, and fit the approved Version 3 architecture.
- Compatibility Gate: preserve API contracts, existing URLs, existing player data, and legacy behavior.
- Performance Gate: preserve the Performance Budget, avoid unnecessary requests, and avoid Apps Script regressions.
- Quality Gate: pass lint, build, Apps Script validation, documentation updates, release checklist updates, and technical debt documentation.

Version 3.0C adds Event Migration Validation to prove the Event Engine default scope produces identical results to the legacy League model before production migration.

## Community Command Center

Version 3.1 introduces the authenticated Community Command Center as the first player-facing Event Engine experience.

It answers:

```text
What should I do today?
```

The Community Command Center reuses:

- Portal Identity and League Identity for the authenticated player.
- Event Engine for Current League event scope.
- Season Command Center for opponent tracking, deadlines, promotion/relegation, and schedule state.
- Existing Notifications, News, Streams, Army Lists, Deep Links, and Formatting services.

It does not create a parallel scheduling, standings, statistics, automation, or identity system.

Until Event Migration is completed, active Event data resolves through the Current League Event:

```text
event-current-league
```

Version 6.0 makes Event scope operational while preserving the hierarchy:

```text
Organization -> Community -> Series -> Event -> Season -> Round -> Game
```

Games now resolve through Event ID. Missing Event IDs remain backward-compatible and read as `event-current-league`.

Existing services are extended rather than duplicated:

- Standings pass event scope into the existing registry statistics updater.
- Scheduling passes event scope into the existing Season Command Center context.
- Match requests store Event ID in the existing Scheduling Requests sheet.
- Frontend Event selectors consume the existing `events` endpoint.

Aggregate `all` and `lifetime` scopes are read modes for historical statistics and do not create new data stores.

Version 3.1.1 refines the Community Command Center into a player workflow surface.

It adds:

- Today mission briefing.
- Event switcher.
- My Remaining Games with league progress.
- What Should I Do Next recommendations.
- Nudge Engine recommendations grounded in existing league data.

The Nudge Engine is not a separate automation or statistics system. It is a Community Command Center subsystem that derives participation nudges from Season Command Center progress, Event Engine state, player army list state, community activity, and promotion/relegation position.

Every nudge includes:

- Priority.
- Reason.
- Suggested action.
- Deep link.

If the existing production services do not provide enough evidence for a useful recommendation, the Nudge Engine returns `Not enough information yet.`

Version 4.3 presents the authenticated Dashboard as the Player Home Dashboard. It is a presentation refinement of the existing Community Command Center aggregate, not a new dashboard service.

The Player Home Dashboard answers:

```text
What should I do next?
```

It uses the existing `communityCommandCenter` payload plus additive scheduling request fields to show:

- Player greeting, current league, division, record, week, and league completion.
- Highest priority action derived from pending match requests, suggested remaining opponents, and existing next actions.
- Upcoming accepted matches and pending scheduling requests.
- Season progress, remaining opponents, actionable notifications, league activity, quick actions, and evidence-based motivation.

It does not add a new Event Engine concept, scheduling system, standings calculation, notification system, or identity lookup. All league data continues to use permanent `leaguePlayer` identity. Display names remain presentation-only.

Version 4.4 adds League Personality as a presentation layer over the same data.

League Personality generates:

- Dynamic hero messages from pending requests, remaining games, scheduling overlap, current week, or existing intelligence.
- League headlines from commissioner news, submitted game results, achievements, progress, and promotion status.
- Featured matches from accepted scheduling requests, recommended remaining opponents, or latest submitted battles.
- Season story timeline entries from current week, latest results, commissioner news, and progress.
- Spotlight cards from achievements, latest battle reports, and remaining opponents.
- Rivalry summaries from repeated submitted head-to-head games.

This layer must never fabricate statistics. If the required source data is missing, the card is omitted or displays an explicit empty state. Version 4.4 does not add backend endpoints, change API contracts, alter league calculations, or create a new notification system.

Version 5.0.1 adds Performance Excellence hardening. It does not introduce product functionality or new backend services. The performance layer consists of:

- Immediate dashboard loading-state hero paint for better perceived LCP.
- Browser-native network hints for known external origins.
- Passive browser-local Real User Monitoring for Core Web Vitals, route transitions, resource counts, and transfer sizes.
- Offscreen render deferral through supported CSS `content-visibility`.
- Idle scheduling for non-critical profile activity writes.

RUM is surfaced only in Commissioner Diagnostics and does not send a new telemetry request or alter existing API contracts.

## Event Lifecycle Controls

Version 3.1.2 adds commissioner-facing Event Lifecycle Controls on top of the existing Event Engine foundation.

The lifecycle system operates existing Event Engine records. It does not introduce a new event model.

Supported stages:

```text
Planning -> Registration Open -> Registration Closed -> Roster Locked -> Schedule Generated -> Active -> Midseason -> Final Week -> Awards -> Archived
```

Lifecycle transitions:

- Update the existing `Events` row lifecycle stage, status, registration state, and timestamp.
- Synchronize related `Event Seasons` and `Event Rounds` status fields.
- Publish one `eventLifecycleTransition` Automation event through the existing Automation Center.
- Write an immutable row to the `Event Lifecycle Audit` sheet.
- Refresh event and operations caches.

Commissioners can advance lifecycle stages and perform safe rollbacks from the Commissioner Dashboard. Assistant Commissioners may view lifecycle health, warnings, automation status, Discord status, and audit history but cannot change lifecycle state.

Version 3.1.2.1 adds self-healing lifecycle validation. The lifecycle service validates Event stage, status, registration, schedule readiness, participants, awards readiness, and archive state before allowing transitions. Invalid states are returned as health issues with problem, reason, impact, recommended action, repair action, and blocking status. Repairs reuse `eventLifecycleTransition` with `direction=repair`, write the same audit log, publish the same automation event, and invalidate the same caches.

## Event Experience Separation

Version 6.0.4 separates Event Engine data from Event Experience presentation.

The Event Engine answers:

```text
What Event is this?
What type is it?
What lifecycle, registration, participants, rounds, and scoped data belong to it?
```

The Event Experience layer answers:

```text
Which portal experience should players and Commissioners see for this Event Type?
```

Current experience mapping:

- `League` -> League Event Home, League standings, Match Finder, division rankings, promotion, relegation, and League statistics.
- `Team Tournament` -> Tournament header, registration, teams, pairings, team standings, results, news, quick actions, and tournament operations.

Non-League Events must not render League-specific standings, promotion, relegation, division rankings, or remaining League games. Future Event types should add purpose-built experiences behind the same Event Experience Router rather than filtering League pages by `eventId`.
