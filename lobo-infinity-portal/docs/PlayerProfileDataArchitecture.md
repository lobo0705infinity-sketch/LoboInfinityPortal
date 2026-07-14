# Player Profile Data Architecture

## Current Flow

The public Player Profile follows this path:

Google Sheets -> Apps Script `player` endpoint -> `PlayerProfileData` -> `PlayerProfileDossier` / `OperatorBadge`.

The Player Profile page must display assignment data as exposed by the Apps Script `player` endpoint. React may format empty values for display, but it must not decide whether a player is currently assigned to a league, division, or rank.

## Source Of Truth

| Field | Spreadsheet source | Sheet | Column | Apps Script | API field | TypeScript | React prop/component |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Current League | Active non-synthetic event registration | `Event Participants` joined to `Events` | `Event ID`, `Status`, `Registered At`, `Updated At`; `Events.Name` | `getRegisteredEventsForPlayer()` -> `buildPlayerProfileAssignment()` | `player.currentLeague` | `PlayerProfileData.currentLeague` | `PlayerProfileDossier` -> `ServiceRecord`, `SeasonSnapshot` |
| Division | Current active league assignment, with division label from player registry only when a real active league registration exists | `Players` | `Division` | `buildPlayerProfileAssignment()` | `player.division` | `PlayerProfileData.division` | `SeasonSnapshot`, hero identity |
| Competitive Home | Same assignment object as Division | `Players` | `Division` | `buildPlayerProfileAssignment()` | `player.competitiveHome` | `PlayerProfileData.competitiveHome` | `OperatorBadge`, hero ribbon, service record |
| Rank | Current division standings only when Division is assigned | `Players` + `Game Engine` | `Players.Division`; `Game Engine` TP/OP/VP columns | `getPlayerStanding()` or `getEmptyPlayerStanding()` | `player.rank` | `PlayerProfileData.rank` | `OperatorBadge`, tactical badges, `SeasonSnapshot` |
| Preferred Army | Official faction history for public player profile | `Game Engine` | Faction column | `FAVORITEFACTION()` | `player.favoriteFaction` | `PlayerProfileData.favoriteFaction` | `OperatorBadge` faction core / service record |
| Current Season | Same active league assignment as Current League | `Event Participants` joined to `Events` | `Event ID`; `Events.Name` | `buildPlayerProfileAssignment()` | `player.currentSeason` | `PlayerProfileData.currentSeason` | Available to profile consumers |
| Registered Events | Real active event registrations only | `Event Participants` joined to `Events` | `Event ID`, `Player`, `Display Name`, `Status`, `Registered At`, `Updated At` | `getRegisteredEventsForPlayer()` | `player.registeredEvents` | `PlayerProfileData.registeredEvents` | Activity, tournament label |
| Operator Badge | API assignment, rank, preferred army, achievements | Mixed: profile API fields plus achievements derived from career data | See above | `getPlayer()` | `player.*` | `PlayerProfileData` | `OperatorBadge` |
| Classification | API classification from real active registrations and official game totals | `Event Participants`, `Game Engine` | Registration columns; official game rows | `buildPlayerProfileClassifications()` | `player.classifications` | `PlayerProfileData.classifications` | Tactical badges, `OperatorBadge` |
| Career Status | API classification summary | Same as Classification | Same as Classification | `buildPlayerProfileCareerStatus()` | `player.careerStatus` | `PlayerProfileData.careerStatus` | `ServiceRecord` |

## Architectural Drift Found

| Drift | Why it existed | Decision |
| --- | --- | --- |
| Synthetic `event-current-league` participant rows were exposed as real player registrations. | Event Engine compatibility bootstrap creates default league participants from the legacy Players sheet. | Removed from `getRegisteredEventsForPlayer()` output when the row has blank `Registered At` and `Updated At`. |
| React inferred League Player / Casual Player from `registeredEvents`. | Added during presentation fixes to hide stale Main Man values. | Removed from public Player Profile. Classification now comes from Apps Script. |
| React filtered synthetic event IDs. | Symptom-level fix for compatibility registrations. | Removed from public Player Profile. Synthetic filtering now happens in Apps Script before API response. |
| React chose division, current league, competitive home, and rank independently. | Incremental UI fixes introduced separate helpers. | Consolidated to `buildPlayerProfileAssignment()` in Apps Script and direct React consumption of API fields. |
| Preferred army fallback appeared blank. | The Lobo fallback asset rendered dark-on-dark. | Kept existing Lobo fallback path and made the asset visible; React no longer returns `null` for an empty preferred army. |

## Duplicate Business Logic Removed

- Removed `getProfileClassifications()` from the frontend classification service.
- Removed public Player Profile helpers that inferred current division, current league, rank eligibility, and career status.
- Public Player Profile now sanitizes API classification strings only; it does not derive them.

## Remaining Technical Debt

- The Event Engine still contains the default `event-current-league` compatibility event for other portal workflows. It is now documented as compatibility data and is not exposed as a public player registration without real registration timestamps.
- Public player profiles do not currently join to `Users.Role`, so `Commissioner` classification is only authoritative on authenticated user/profile paths unless a backend player-to-user identity join is added.
- My Profile still has authenticated-user classification logic tied to `Users` and profile statistics. It should be migrated to the same backend-owned classification contract in a separate authenticated profile API cleanup.
