# Troubleshooting

## Google Sign-In Does Not Complete

Check:

- `VITE_GOOGLE_CLIENT_ID` or Settings sheet `googleOAuthClientId`.
- Browser console for `action=session` errors.
- Apps Script `AuthApi.gs` token verification.
- OAuth client authorized origins.

Expected session payload includes:

- `email`
- `displayName`
- `leaguePlayer`
- `leagueDivision`

## Authenticated User Is Guest

Check:

- `authToken` is sent by `src/services/api.ts`.
- `oauthClientId` is sent.
- Apps Script deployment serving production contains current `AuthApi.gs`.
- Users sheet contains the Google Email.
- Players sheet maps Google Email to a permanent Player.

## League Data Belongs To The Wrong Player

League queries must use `leaguePlayer`, not Google `displayName`.

Check:

- `AuthContext.tsx`
- `src/services/api.ts`
- Page request parameters
- Backend player lookup functions

## Hall Of Fame Shows API Contract Errors

Check:

- `backend/RecordsApi.gs` response shape.
- `src/services/api.ts` Hall of Fame normalizers.
- Required fields on `HallOfFameLeader` and `HallOfFameCareer`, especially `rank`.
- Hall of Fame schema cache key in `CacheApi.gs`.

## Discord Messages Do Not Send

Check:

- Discord Config sheet `enabled`.
- Webhook URL is valid.
- Automation event type is enabled.
- Destination rule includes Discord.
- Automation Queue for failed or retrying items.
- Discord Automation Log for masked webhook, status, and response.

## Vercel Build Cannot Find Vite

Check:

- `vite` is in `devDependencies`.
- Vercel project root is repository root.
- Install command is `npm install`.
- Build command is `npm run build`.
- Output directory is `dist`.

## Apps Script Push Fails

Run clasp from `backend`, not the repository root:

```powershell
cd backend
clasp push
```

## Cache Appears Stale

Use Commissioner cache controls where available. If an API contract changes, add schema versioning to the relevant cache key so stale incompatible payloads are bypassed.
