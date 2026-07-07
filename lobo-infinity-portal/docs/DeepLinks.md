# Deep Links

Version 2.5.2 introduces permanent deep links for Discord, automation, and future Open Graph support.

## Purpose

Discord messages should take users directly to the relevant League Operating System page. Links should never require navigating through the homepage first.

## Canonical Routes

| Event | Route | Current Destination |
| --- | --- | --- |
| Game Submitted | `/game/{gameId}` | Match Details |
| Player | `/player/{leaguePlayer}` | Player Profile |
| Career | `/career/{leaguePlayer}` | Player Profile career sections |
| Achievement | `/achievement/{achievementId}` | My Profile achievements |
| Hall of Fame | `/hall-of-fame` | Hall of Fame |
| Faction | `/faction/{faction}` | Faction Profile |
| Mission | `/mission/{mission}` | Mission Profile |
| Season | `/season/{season}` | Standings |
| Weekly Report | `/weekly-report` | Standings |
| News | `/news/{newsId}` | Commissioner News |
| Stream | `/stream/{streamId}` | Streamed Games |
| Army List | `/army-list/{listId}` | Army List Vault |

Existing plural routes remain supported:

- `/games/{gameId}`
- `/players/{leaguePlayer}`
- `/factions/{faction}`
- `/missions/{mission}`
- `/army-lists`
- `/streams`
- `/news`

## Backend Service

`DeepLinkApi.gs` owns canonical link generation.

Automation and Discord should call:

`buildDeepLink(type, data)`

The returned object includes:

- `type`
- `path`
- `url`
- `title`
- `description`
- `previewImage`

Do not manually build portal URLs in event services.

## Discord Behavior

Discord embeds should include:

- Title
- Summary
- One relevant statistic where available
- Direct deep link

Examples:

- Match result links to `/game/{gameId}`.
- Achievement links to `/achievement/{achievementId}`.
- Player of the Week links to `/player/{leaguePlayer}`.
- Promotion links to `/career/{leaguePlayer}`.
- Hall of Fame links to `/hall-of-fame`.
- Weekly Report links to `/weekly-report`.

## Browser Support

Deep links are SPA routes handled by React Router and Vercel fallback routing. They support:

- Bookmarking
- Browser refresh
- Direct navigation
- Discord desktop
- Discord mobile
- Mobile browsers

## Open Graph Preparation

`RouteMeta` updates client-side metadata:

- Document title
- Description
- Canonical URL
- Open Graph title
- Open Graph description
- Preview image placeholder

Future server-rendered Open Graph images can reuse the same deep-link service and route matrix.
