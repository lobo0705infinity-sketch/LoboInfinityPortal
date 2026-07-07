# API

The production frontend calls Google Apps Script at:

`https://script.google.com/macros/s/AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng/exec`

All public reads use `GET` with an `action` parameter. Mutations use `POST` with an `action` field and authenticated user credentials when required.

## Authentication Parameters

Authenticated requests include:

- `authToken`: Google Identity Services ID token.
- `oauthClientId`: OAuth client ID used by the frontend.

Apps Script verifies the token and maps Google Email to the permanent League Player through the Players sheet.

## Core Read Actions

- `session`: authenticated portal session.
- `settings`: portal configuration.
- `dashboard`: dashboard critical path.
- `recentGames`: recent game list.
- `standings`: division standings.
- `players`: player directory.
- `player`: player profile by permanent league player.
- `factions`: faction summaries.
- `faction`: faction profile.
- `missions`: mission summaries.
- `mission`: mission profile.
- `timeline`: league timeline.
- `notifications`: authenticated notifications.
- `armyLists`: army list vault.
- `records`: record engine.
- `hallOfFame`: Hall of Fame snapshot.
- `intelligence`: league intelligence.
- `searchData`: global search index.
- `streams`: streamed games.
- `automation`: automation center data.
- `integrity`: league integrity report.
- `communityCommandCenter`: authenticated Community Command Center payload for the signed-in league player.
- `seasonCommandCenter`: authenticated Season Command Center payload for the signed-in league player.
- `events`: Event Engine event list and current default event.
- `event`: single Event Engine event.
- `eventTemplates`: reusable Event Template definitions.
- `eventSeasons`: seasons for an event.
- `eventRounds`: rounds for an event or season.
- `eventLifecycle`: operations-gated Event Lifecycle Control payload.
- `reliability`: operations-gated Platform Health payload for Commissioners. Returns snapshot status, job queue status, cache health, recovery actions, reliability audit entries, and performance history.

## Commissioner Actions

Commissioner and Assistant Commissioner operations are permission-gated in Apps Script. Sensitive operations require Commissioner permission.

Examples:

- `operations`
- `automationRun`
- `automationPause`
- `automationResume`
- `automationRetryFailed`
- `integrityRepair`
- `clearCache`
- `refreshCache`
- `eventMigrationAudit`
- `eventMigrationPreview`
- `eventMigrationReport`
- `eventMigrationRollback`
- `eventMigrationValidation`
- `eventLifecycleTransition`
- `reliabilityAction`

## Platform Reliability Actions

Version 3.4 adds a Commissioner-gated reliability action endpoint.

`POST action=reliabilityAction`

Parameters:

- `reliabilityAction`: one of `queueJob`, `processNextJob`, `rebuildSnapshot`, `rebuildAllSnapshots`, `invalidateCache`, `rebuildCache`, or `clearExpiredCache`.
- `target`: snapshot ID, cache group ID, job type, or `next`.

The response preserves the read contract used by `action=reliability`:

- `success`
- `reliability.version`
- `reliability.generatedAt`
- `reliability.snapshots`
- `reliability.jobs`
- `reliability.cache`
- `reliability.health`
- `reliability.history`
- `reliability.audit`
- `reliability.recoveryActions`
- `reliability.cacheActions`

All reliability actions require Commissioner cache-management permission and create reliability audit entries.

## Event Engine Actions

Version 3.0B adds Event Engine foundation actions without changing legacy API behavior.

- `events`: public read. Ensures Event Engine foundation sheets exist and returns community metadata, series metadata, Current League, and all events.
- `event`: public read. Returns one event. Missing `eventId` resolves to Current League.
- `eventTemplates`: public read. Returns reusable event templates such as League Season, Army Roulette, Team Tournament, Aurora VII Campaign, Escalation League, and Narrative Weekend.
- `eventSeasons`: public read. Returns seasons for an event. Missing `eventId` resolves to Current League.
- `eventRounds`: public read. Returns rounds for an event or season. Missing event scope resolves to Current League.
- `eventMigrationAudit`, `eventMigrationPreview`, `eventMigrationReport`, `eventMigrationRollback`: operations-gated read-only migration tooling. These endpoints do not mutate historical game data.
- `eventMigrationValidation`: operations-gated read-only validation. Compares legacy outputs to Event Engine default-scope outputs for standings, statistics, Hall of Fame, achievements, intelligence, timeline, automation, notifications, Discord events, army lists, recent games, deep links, career, promotion, and relegation.
- `eventLifecycle`: operations-gated read. Returns the Event Lifecycle card payload, validation report, repair actions, and audit log for the requested Event.
- `eventLifecycleTransition`: commissioner-only mutation. Advances, safely rolls back, or repairs an Event lifecycle stage, publishes an Automation event, writes the lifecycle audit log, and refreshes caches.

## Season Command Center Actions

- `communityCommandCenter`: authenticated read. Returns the signed-in player's Community Command Center aggregate, including welcome context, Today mission briefing, active events, event switcher, opponent tracker, Nudge Engine, next actions, community activity, promotion tracker, schedule, intelligence summary, and quick actions. The lookup key is `leaguePlayer`, never Google display name.
- `seasonCommandCenter`: authenticated read. Returns the signed-in player's season progress, opponent tracker, promotion tracker, deadline status, availability, division status, and commissioner summary. The lookup key is `leaguePlayer`, never Google display name.
- `seasonAvailability`: authenticated mutation. Updates the signed-in player's match availability metadata in the Season Availability sheet and returns the refreshed `seasonCommandCenter` payload.

## Response Contract

Every successful API response includes:

- `success: true`
- Action-specific payload fields

Errors return:

- `success: false`
- `error`

Frontend normalization in `src/services/api.ts` is strict for required fields. Backend changes must preserve existing field names unless the frontend normalizer is updated in the same release.

## Caching

Apps Script caches public read actions through `CacheApi.gs`. Frontend GET responses are cached in-memory for five minutes. POST requests clear the frontend cache.

Hall of Fame uses an additional schema-versioned snapshot cache so optimized payloads remain compatible with the frontend contract.
