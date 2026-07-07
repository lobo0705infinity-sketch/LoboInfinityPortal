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
