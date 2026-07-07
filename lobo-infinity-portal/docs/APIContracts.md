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
