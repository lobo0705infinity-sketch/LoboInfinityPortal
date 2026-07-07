# API Contracts

API contracts are strict. Frontend normalization in `src/services/api.ts` requires the fields documented here.

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
