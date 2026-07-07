# Development Setup

## Requirements

- Node.js `24.x`
- npm `>=11`
- Vercel CLI through `npx`
- clasp authenticated to the Google Apps Script project

The repository includes `.nvmrc` for Node selection.

## Install

```powershell
npm install
```

## Environment

Optional local file:

```text
.env.local
```

Supported frontend variable:

```text
VITE_GOOGLE_CLIENT_ID=<public OAuth client id>
```

The OAuth client ID is public configuration. Do not store client secrets in the repository.

## Run Checks

```powershell
npm run lint
npm run build
```

Apps Script syntax validation:

```powershell
Get-ChildItem backend -Filter *.gs | ForEach-Object { Get-Content -Raw $_.FullName | node --check --input-type=commonjs }
```

## Local Frontend

```powershell
npm run dev
```

The local frontend still calls the production Apps Script URL unless `src/services/api.ts` is intentionally changed for a development target.

## Apps Script

Run clasp commands from `backend`:

```powershell
cd backend
clasp push
clasp deployments
```

Production deployment ID:

`AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng`
