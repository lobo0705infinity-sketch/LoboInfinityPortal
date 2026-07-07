# API Contracts

API contracts are strict. Frontend normalization in `src/services/api.ts` requires the fields documented here.

## Event Engine Foundation

Version 3.0B introduces Event Engine foundation APIs without changing existing endpoint contracts.

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

### Migration Tooling

The migration endpoints are read-only in Version 3.0B and require operations permission.

- `eventMigrationAudit`
- `eventMigrationPreview`
- `eventMigrationReport`
- `eventMigrationRollback`

Version 3.0B does not migrate historical production data automatically.

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

## Compatibility Rules

- Existing API actions are unchanged.
- Season Command Center derives league identity from `leaguePlayer`.
- Player display names are presentation-only.
- Availability is stored separately from league identity and standings.
- Missing `eventId`, `seasonId`, and `roundId` resolve to the Current League Event during the Version 3 migration window.
