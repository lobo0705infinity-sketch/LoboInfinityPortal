# API Contracts

API contracts are strict. Frontend normalization in `src/services/api.ts` requires the fields documented here.

## Event Engine Foundation

Version 3.0B introduces Event Engine foundation APIs without changing existing endpoint contracts.

The frozen Version 3 hierarchy is:

```text
Organization -> Community -> Series -> Event -> Season -> Round -> Game
```

Version 3.0D does not add or rename API fields. The Organization layer is an architectural parent above Community. Future APIs that expose Organization scope must preserve backward compatibility and must update this document before implementation.

### Events

Action:

`GET action=events`

Response:

```json
{
  "success": true,
  "community": {},
  "series": [],
  "currentEvent": {},
  "events": []
}
```

Required `event` fields:

- `id`
- `communityId`
- `seriesId`
- `templateId`
- `name`
- `description`
- `type`
- `lifecycleStage`
- `status`
- `owner`
- `commissioners`
- `startDate`
- `endDate`
- `registration`
- `participants`
- `rules`
- `scoringModel`
- `standingsModel`
- `automation`
- `discord`
- `achievements`
- `history`
- `archive`
- `createdAt`
- `updatedAt`

Version 6.0 uses these Event records as the selector source for event-aware standings and scheduling views.

### Event

Action:

`GET action=event&eventId=event-current-league`

If `eventId` is omitted, the backend resolves to `event-current-league`.

Response:

```json
{
  "success": true,
  "event": {}
}
```

### Event Templates

Action:

`GET action=eventTemplates`

Response:

```json
{
  "success": true,
  "templates": []
}
```

Required template fields:

- `id`
- `name`
- `description`
- `eventType`
- `version`
- `active`
- `rules`
- `scoringModel`
- `standingsModel`
- `roundModel`
- `automation`
- `discord`
- `achievements`
- `registration`
- `permissions`
- `defaultTimeline`
- `defaultNotifications`
- `createdAt`
- `updatedAt`

### Event Seasons

Action:

`GET action=eventSeasons&eventId=event-current-league`

Response:

```json
{
  "success": true,
  "eventId": "event-current-league",
  "seasons": []
}
```

### Event Rounds

Action:

`GET action=eventRounds&eventId=event-current-league&seasonId=season-current-league`

Response:

```json
{
  "success": true,
  "eventId": "event-current-league",
  "seasonId": "season-current-league",
  "rounds": []
}
```

### Event Lifecycle

Action:

`GET action=eventLifecycle&eventId=event-current-league`

Authentication:

Requires operations view permission.

Response:

```json
{
  "success": true,
  "lifecycle": {
    "event": {},
    "currentStage": "Active",
    "status": "Active",
    "registration": "Registration Closed",
    "participants": 30,
    "rounds": 1,
    "currentSeason": "Current League Season",
    "currentRound": "Current League",
    "health": {},
    "validation": {
      "healthScore": 100,
      "overallStatus": "Healthy",
      "color": "Green",
      "blockingIssues": [],
      "issues": [],
      "repairable": 0
    },
    "warnings": [],
    "nextTransition": {},
    "rollback": {},
    "automation": {},
    "discord": {},
    "auditLog": []
  }
}
```

## Multi-Event Read Scope

Version 6.0 adds optional `eventId` query parameters to existing read contracts.

If omitted, the backend resolves to:

```text
event-current-league
```

Supported aggregate scopes:

```text
all
lifetime
```

### Event-Aware Standings

Action:

`GET action=standings&division=main&eventId=event-current-league`

Response adds:

```json
{
  "success": true,
  "eventId": "event-current-league",
  "event": {},
  "division": "main",
  "divisionLabel": "Main Man",
  "standings": [],
  "summary": {}
}
```

Each standings row may include `eventId`. Existing row fields are unchanged.

### Event-Aware Scheduling Center

Action:

`GET action=schedulingCenter&eventId=event-current-league`

Response adds:

```json
{
  "success": true,
  "scheduling": {
    "eventId": "event-current-league",
    "event": {}
  }
}
```

Scheduling request records include `eventId`. Missing stored values resolve to Current League.

### Event-Aware Match Finder

Action:

`GET action=matchFinder&eventId=event-current-league`

The payload remains structurally compatible and is filtered to the selected Event.

## Event Registration

Version 6.0.2 adds Event Engine-owned registration APIs. Registration is scoped by `eventId` and uses the `Event Participants` sheet as the source of truth.

## Event Home

Version 6.0.3 adds an Event Home composition API.

Action:

`GET action=eventHome&eventId=event-august-2026-team-tournament`

Response:

```json
{
  "success": true,
  "home": {
    "event": {},
    "registration": {},
    "currentRound": {},
    "rounds": [],
    "statistics": {},
    "timeline": [],
    "news": [],
    "quickActions": [],
    "playerStatus": {},
    "navigation": []
  }
}
```

The endpoint is user-aware because `playerStatus` and current-player registration may differ by authenticated user. Do not serve it from a public shared cache.

### Registration Read

Action:

`GET action=eventRegistration&eventId=event-august-2026-team-tournament`

Response:

```json
{
  "success": true,
  "registration": {
    "eventId": "event-august-2026-team-tournament",
    "eventName": "August 2026 Team Tournament",
    "eventType": "Team Tournament",
    "status": "Registration Open",
    "registrationOpen": true,
    "registeredCount": 0,
    "waitlistCount": 0,
    "teamCount": 0,
    "currentPlayer": null,
    "registrations": [],
    "teams": [],
    "freeAgents": [],
    "captains": []
  }
}
```

### Register For Event

Action:

`POST action=registerForEvent`

Authentication:

Requires a logged-in league player.

Request:

```json
{
  "eventId": "event-august-2026-team-tournament",
  "discord": "Lobo0705",
  "preferredTeam": "OnlyPans",
  "teamName": "OnlyPans",
  "captain": "true",
  "freeAgent": "false",
  "faction": "Nomads",
  "notes": "Available all rounds"
}
```

### Withdraw Registration

Action:

`POST action=withdrawEventRegistration`

Authentication:

Requires the registered player. Registration must still be open.

### Manage Registration

Action:

`POST action=manageEventRegistration`

Authentication:

Requires operations permission.

Commissioners may update status, assign teams, promote waitlisted players, or remove registrations by setting participant status.

### Export Registrations

Action:

`POST action=exportEventRegistrations`

Authentication:

Requires operations view permission.

## Commissioner Event Manager

Version 6.0.3 adds Event Manager APIs for Commissioner operations.

### Event Manager Read

Action:

`GET action=eventManager&eventId=event-august-2026-team-tournament`

Authentication:

Requires operations view permission.

Response:

```json
{
  "success": true,
  "manager": {
    "currentEvent": {},
    "selectedEvent": {},
    "events": [],
    "registration": {},
    "participants": [],
    "teams": [],
    "pairings": [],
    "rounds": [],
    "quickActions": [],
    "diagnostics": {}
  }
}
```

### Event Manager Mutations

Authentication:

Requires Commissioner season-control permission.

Actions:

- `POST action=eventManagerEvent`
- `POST action=eventManagerRegistration`
- `POST action=eventManagerLifecycle`
- `POST action=eventManagerCurrentEvent`
- `POST action=eventManagerParticipant`
- `POST action=eventManagerTeam`
- `POST action=eventManagerPairing`

These endpoints update existing Event Engine, Event Participants, and Team Tournament sheets. They do not create a separate League or Tournament manager.

## Team Tournament Experience

Version 6.0.1 adds Team Tournament endpoints on top of the Event Engine. These endpoints do not replace existing league APIs.

### Team Tournament Read

Action:

`GET action=teamTournament&eventId=event-august-2026-team-tournament`

If `eventId` is omitted, the backend resolves to the default Team Tournament Event.

Response:

```json
{
  "success": true,
  "tournament": {
    "event": {},
    "status": "Planning",
    "currentRound": {},
    "registeredTeams": 0,
    "completedMatches": 0,
    "upcomingPairings": [],
    "latestResults": [],
    "news": [],
    "quickActions": [],
    "teams": [],
    "pairings": [],
    "standings": []
  }
}
```

### Team Tournament Player Registration

Action:

`POST action=teamTournamentRegister`

Authentication:

Requires a logged-in league player.

Request:

```json
{
  "eventId": "event-august-2026-team-tournament",
  "teamName": "Lobo Command"
}
```

The mutation writes an Event Participant row scoped to the Team Tournament Event.

### Team Management

Action:

`POST action=teamTournamentTeam`

Authentication:

Requires operations permission.

Request:

```json
{
  "eventId": "event-august-2026-team-tournament",
  "teamId": "team-lobo-command",
  "teamName": "Lobo Command",
  "captain": "Lobo",
  "players": "Lobo, Chainsaw",
  "factionRestrictions": "",
  "logoUrl": "",
  "discordContact": "@captain",
  "status": "Registered"
}
```

### Pairing Management

Action:

`POST action=teamTournamentPairing`

Authentication:

Requires operations permission.

Request:

```json
{
  "eventId": "event-august-2026-team-tournament",
  "roundId": "round-august-2026-team-tournament-1",
  "round": "Round 1",
  "teamA": "Lobo Command",
  "teamB": "Wolfpack",
  "playerPairings": "Lobo vs Chainsaw",
  "status": "Scheduled",
  "results": ""
}
```

### Team Invitations

Action:

`POST action=teamTournamentInvitation`

Authentication:

Requires Commissioner season-control permission.

Request:

```json
{
  "eventId": "event-august-2026-team-tournament",
  "teamName": "Lobo Command",
  "player": "FlashPulse",
  "status": "Pending",
  "message": "Join the Round 1 roster."
}
```

### Tournament Result Reporting

Action:

`POST action=teamTournamentResult`

Authentication:

Requires an authenticated league member.

Request:

```json
{
  "eventId": "event-august-2026-team-tournament",
  "round": "Round 1",
  "teamA": "Lobo Command",
  "teamB": "Wolfpack",
  "player": "Lobo",
  "opponent": "Chainsaw",
  "tournamentPoints": "7-3",
  "objectivePoints": "41-28",
  "victoryPoints": "180-123",
  "winningFaction": "Nomads",
  "firstTurn": "Lobo",
  "bestMoment": "Critical objective swing."
}
```

### Tournament Round Lifecycle

Action:

`POST action=teamTournamentRound`

Authentication:

Requires Commissioner season-control permission.

Updates the existing Event lifecycle/status fields for tournament round operations. It does not create a separate tournament lifecycle engine.

Team Tournament mutations invalidate the `events` cache group so the dashboard, rosters, pairings, and standings refresh from the same event-scoped source.

## Event Lifecycle Mutations

Required lifecycle fields:

- `event`
- `currentStage`
- `status`
- `registration`
- `participants`
- `rounds`
- `startDate`
- `endDate`
- `currentSeason`
- `currentRound`
- `health`
- `validation`
- `warnings`
- `nextTransition`
- `rollback`
- `automation`
- `discord`
- `auditLog`
- `supportedStages`

Action:

`POST action=eventLifecycleTransition`

Authentication:

Requires Commissioner-level `runSeasonControl` permission.

Accepted fields:

- `eventId`
- `direction`: `advance`, `rollback`, or `repair`
- `reason`
- `repairAction` when `direction=repair`

Transition behavior:

- Updates existing Event Engine rows.
- Blocks unsafe advances when lifecycle validation reports blocking issues.
- Applies self-healing repairs when `direction=repair`.
- Publishes `eventLifecycleTransition` through the Automation Center.
- Writes `Event Lifecycle Audit`.
- Refreshes event and operations caches.

Validation issue fields:

- `id`
- `severity`
- `problem`
- `reason`
- `impact`
- `recommendedAction`
- `repairAction`
- `repairLabel`
- `targetStage`
- `blocksTransition`

### Migration Tooling

The migration endpoints are read-only in Version 3.0B and require operations permission.

- `eventMigrationAudit`
- `eventMigrationPreview`
- `eventMigrationReport`
- `eventMigrationRollback`
- `eventMigrationValidation`

Version 3.0B and 3.0C do not migrate historical production data automatically.

### Event Migration Validation

Action:

`GET action=eventMigrationValidation`

Authentication:

Requires operations view permission.

Response:

```json
{
  "success": true,
  "validation": {
    "eventScope": {},
    "summary": {},
    "comparisons": [],
    "migrationPreview": {},
    "migrationAudit": {},
    "migrationReport": {},
    "rollbackPlan": {},
    "historicalGames": {}
  }
}
```

Required comparison fields:

- `subsystem`
- `legacyResult`
- `eventResult`
- `match`
- `status`
- `legacyHash`
- `eventHash`

Required `summary` fields:

- `total`
- `passed`
- `failed`
- `status`
- `durationMs`

## Season Command Center

Action:

`GET action=seasonCommandCenter`

Authentication:

Requires Google authentication. The frontend sends `authToken` and `oauthClientId`.

Response:

```json
{
  "success": true,
  "seasonCommand": {
    "player": {},
    "progress": {},
    "opponents": [],
    "nextOpponents": [],
    "deadlines": {},
    "promotion": {},
    "divisionStatus": [],
    "leagueActivity": {},
    "availability": {},
    "commissioner": {}
  }
}
```

Required `player` fields:

- `player`
- `displayName`
- `division`
- `rank`
- `games`
- `wins`
- `losses`
- `tp`
- `op`
- `vp`

Required `progress` fields:

- `gamesRequired`
- `gamesCompleted`
- `gamesRemaining`
- `opponentsCompleted`
- `opponentsRemaining`
- `midseasonProgress`
- `seasonProgress`
- `completionPercentage`

Required `opponents[]` fields:

- `player`
- `displayName`
- `rank`
- `games`
- `status`
- `gameId`
- `lastResult`
- `availability`

Opponent `status` values:

- `Already Played`
- `Scheduled`
- `Not Played`

Required `availability` fields:

- `player`
- `status`
- `preferredDays`
- `preferredTimes`
- `notes`
- `updatedAt`

Required `promotion` fields:

- `currentRank`
- `promotionZone`
- `safe`
- `relegationZone`
- `projectedFinish`
- `gamesNeeded`
- `magicNumber`
- `status`

## Season Availability

Action:

`POST action=seasonAvailability`

Authentication:

Requires Google authentication.

Accepted fields:

- `status`
- `preferredDays`
- `preferredTimes`
- `notes`

Returns:

The same `seasonCommandCenter` payload after saving.

## Community Command Center

Action:

`GET action=communityCommandCenter`

Authentication:

Requires Google authentication. The frontend sends `authToken` and `oauthClientId`.

Response:

```json
{
  "success": true,
  "commandCenter": {
    "welcome": {},
    "activeEvents": [],
    "opponentTracker": {},
    "today": [],
    "nextActions": [],
    "communityActivity": {},
    "matchRequests": {
      "incoming": [],
      "outgoing": [],
      "upcoming": []
    },
    "nudgeEngine": [],
    "eventSwitcher": [],
    "promotion": {},
    "schedule": {},
    "intelligence": [],
    "quickActions": []
  }
}
```

The endpoint is player-specific and must not be treated as a public cached startup request.

Required `welcome` fields:

- `displayName`
- `leaguePlayer`
- `playerDisplayName`
- `currentRank`
- `currentDivision`
- `currentRecord`
- `currentWeek`
- `leagueCompletion`
- `currentLeague`
- `currentActiveEvents`

Required `activeEvents[]` fields:

- `eventId`
- `name`
- `type`
- `status`
- `gamesRemaining`
- `completionPercentage`
- `primaryAction`
- `statusDetail`
- `link`

Required `opponentTracker` fields:

- `completed`
- `remaining`
- `suggested`
- `progress`

Required opponent fields:

- `player`
- `displayName`
- `division`
- `status`
- `rank`
- `gamesCompleted`
- `lastActivity`
- `availability`
- `quickMessage`
- `suggestedPriority`
- `reason`

Required `opponentTracker.progress` fields:

- `gamesCompleted`
- `gamesRequired`
- `gamesRemaining`
- `completionPercentage`

Required `matchRequests` fields:

- `incoming`
- `outgoing`
- `upcoming`

Each array contains normalized scheduling request objects from the existing Scheduling Requests contract. `incoming` contains pending requests awaiting the authenticated player, `outgoing` contains pending requests sent by the authenticated player, and `upcoming` contains accepted matches for the authenticated player.

Required `today[]` and `nextActions[]` fields:

- `label`
- `priority`
- `link`

Required `nudgeEngine[]` fields:

- `category`
- `priority`
- `reason`
- `suggestedAction`
- `deepLink`

Required `eventSwitcher[]` fields:

- `eventId`
- `label`
- `type`
- `status`
- `active`
- `link`

Required `schedule` fields:

- `gamesRemaining`
- `deadlines`
- `upcomingEventDates`
- `currentRound`

## Compatibility Rules

- Existing API actions are unchanged.
- Season Command Center derives league identity from `leaguePlayer`.
- Player display names are presentation-only.
- Availability is stored separately from league identity and standings.
- Missing `eventId`, `seasonId`, and `roundId` resolve to the Current League Event during the Version 3 migration window.
- New top-level architectural concepts require API contract review and documentation updates before implementation.
- Community Command Center extends existing Event Engine and Season Command Center contracts without changing legacy dashboard, standings, profile, Hall of Fame, notification, or automation responses.
- Event Lifecycle Controls extend existing Event Engine, Automation Center, Discord, and Commissioner Dashboard contracts without changing public Event Engine reads.

## Platform Reliability

Version 3.4 adds operational reliability APIs without changing player, Event Engine, lifecycle, integrity, automation, authentication, or Google Sheets contracts.

## Data Provider Contract

Version 7.0 introduces a frontend Data Access Layer. Version 7.1 adds the
Firestore provider. Page-level contracts remain unchanged: pages consume
repositories, and providers satisfy the same repository interfaces.

Provider selection is controlled by `VITE_DATA_PROVIDER`:

- `google`: existing Apps Script and Google Sheets contracts.
- `firestore`: Firestore repository implementation.
- `dual`: Google primary reads with Firestore comparison diagnostics.
- `mock`: fixture provider.

Firestore initialization writes managed schema metadata to `settings/schema`
and creates required collection markers. This does not alter existing Apps
Script API contracts.

Version 7.1.1 adds Firestore Bootstrap diagnostics. Bootstrap performs
environment validation, SDK initialization, Firestore read/write probes, schema
verification, seed verification, and startup fallback reporting through the DAL
diagnostics surface. No Apps Script endpoint or player-facing API contract is
changed.

Version 7.2 adds Firestore Migration Verification through Commissioner
Diagnostics. The verifier compares repository read outputs from Google Sheets
and Firestore, records differences, and computes readiness without changing
Apps Script endpoints, repository signatures, or player-facing response shapes.

Version 7.3.2 adds Firestore Security Rules. Firestore rules consume Firebase
Auth custom claims for the existing portal role model. No page-level API
contract changes are introduced, and Google Sheets remains the production
provider until explicit cutover.

Version 7.3.3 adds client-side Identity Service diagnostics. It does not change
Apps Script endpoint signatures. The existing `session` response remains the
authoritative identity payload and is compared against Firebase Authentication
claims for Firestore readiness.

### Reliability Dashboard

Action:

`GET action=reliability`

Permission:

Operations view permission.

Response:

```json
{
  "success": true,
  "reliability": {
    "version": "3.4",
    "generatedAt": "",
    "frontendVersion": "",
    "appsScriptVersion": "",
    "snapshots": [],
    "jobs": [],
    "cache": {},
    "health": {},
    "history": [],
    "audit": [],
    "recoveryActions": [],
    "cacheActions": []
  }
}
```

Required snapshot fields:

- `id`
- `label`
- `generatedAt`
- `durationMs`
- `version`
- `dependencies`
- `status`
- `recordCount`
- `ageMinutes`
- `error`

Required job fields:

- `id`
- `type`
- `status`
- `queuedAt`
- `startedAt`
- `completedAt`
- `durationMs`
- `retries`
- `requestedBy`
- `error`

### Reliability Action

Action:

`POST action=reliabilityAction`

Permission:

Commissioner cache-management permission.

Parameters:

- `reliabilityAction`
- `target`

Supported `reliabilityAction` values:

- `queueJob`
- `processNextJob`
- `rebuildSnapshot`
- `rebuildAllSnapshots`
- `invalidateCache`
- `rebuildCache`
- `clearExpiredCache`

Response:

Same contract as `GET action=reliability`.

Reliability actions must write reliability audit entries and must not bypass existing Event Lifecycle, Integrity, Automation, OAuth, or Commissioner permission behavior.

## Community Scheduling

Version 4.0 adds authenticated scheduling APIs without changing game, standings, identity, Event Engine, lifecycle, integrity, automation, or notification-state contracts.

Version 4.0.1 keeps the same response schema for backward compatibility, but the player-facing scheduling workflow is online-only. Physical venue fields such as `location`, `homeStore`, `city`, `maxTravelDistance`, and `preferredLocations` are deprecated presentation fields and should not be used for recommendations or new UI.

### Scheduling Center

Action:

`GET action=schedulingCenter`

Permission:

Authenticated league player.

Response:

```json
{
  "success": true,
  "scheduling": {
    "currentSeason": "",
    "player": {},
    "availability": {},
    "progress": {},
    "opponents": [],
    "completedOpponents": [],
    "remainingOpponents": [],
    "recommendations": [],
    "requests": {},
    "seasonProgress": {},
    "activity": [],
    "commissioner": {},
    "quickActions": []
  }
}
```

### Match Finder

Action:

`GET action=matchFinder`

Permission:

Authenticated league player.

Response:

```json
{
  "success": true,
  "matchFinder": {
    "currentSeason": "",
    "player": {},
    "availability": {},
    "recommendations": [],
    "pendingRequests": [],
    "upcomingMatches": [],
    "progress": {}
  }
}
```

### Scheduling Mutations

Actions:

- `POST action=schedulingAvailability`
- `POST action=createSchedulingRequest`
- `POST action=respondSchedulingRequest`

All mutations require an authenticated league player. Scheduling request responses require the signed-in player to be a participant or an authorized operations user.

`createSchedulingRequest` requires `opponent`, `proposedDate`, and `proposedTime`. `message` is optional. `location` remains accepted for legacy compatibility but is ignored by the online league workflow.

### Calendar Export

Action:

`GET action=schedulingCalendar&requestId={id}`

Response:

```json
{
  "success": true,
  "calendar": {
    "filename": "",
    "ics": ""
  }
}
```

### Commissioner Scheduling

Action:

`GET action=commissionerScheduling`

Permission:

Operations view permission.

Returns division completion, players behind schedule, inactive players, outstanding matchups, reminder candidates, and current scheduling requests.
