# Lobo Infinity League Portal Deployment

## Purpose

This document defines the supported deployment workflow for the Lobo Infinity League Portal. The repository is the source of truth. Production must be deployable from a clean checkout without manually copying or deploying `dist`.

## Required Versions

- Node.js: `24.x`
- npm: `>=11`
- Vercel CLI: current stable via `npx vercel`
- Apps Script CLI: `clasp`

The repository includes `.nvmrc` with Node `24` and `package.json` engine metadata.

## Development Workflow

1. Pull the latest repository state.
2. Install dependencies.
3. Run the local development server.

```powershell
git pull
npm install
npm run dev
```

## Build Workflow

Run lint and production build before deployment.

```powershell
npm run lint
npm run build
```

The frontend build output is `dist`. `dist` is generated output and must not be the deployment source.

## Vercel Deployment

The normal deployment path is the guarded Vercel project build, not `--prebuilt`
and not `vercel deploy dist`. Run it from:

```text
C:\Users\19734\Documents\LoboInfinityLeague\.codex-deploy\release-safeguards-main\lobo-infinity-portal
```

```powershell
npm run release:deploy:guarded
```

Required Vercel project settings:

- Framework Preset: `Vite`
- Project: `lobo-infinity-portal`
- Root Directory: `lobo-infinity-portal`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js Version: `24.x`

The repository `vercel.json` also declares:

- `installCommand`: `npm install`
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- filesystem routes before the SPA rewrite from `/(.*)` to `/index.html`

The guarded deployment script explicitly assigns
`lobo-infinity-portal.vercel.app` to the new production deployment after Vercel
finishes. This is required because the normal domain is managed as a manual
alias, while Vercel automatically aliases only the team project domain.

The build regenerates `public/release-fingerprint.json` with the expected Git
commit. The post-deploy verifier fails the release if the normal alias, release
fingerprint, `/players` bundle, or `/faction-portraits/kosmoflot.png` static
asset does not match the new deployment.

A stray Vercel project named `dist` exists and must not be used for production.
Do not remove it without explicit approval. Removal command for later review:

```powershell
npx vercel project rm dist --scope lobo0705infinity-5309s-projects
```

## Apps Script Deployment

Apps Script backend files live in `backend`.

```powershell
cd backend
clasp push
clasp deploy -i AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng -d "Release description"
```

Use the existing deployment ID unless a release explicitly requires a replacement deployment.

## Clean Clone Verification

A deployable checkout must pass:

```powershell
git pull
npm install
npm run lint
npm run build
npx vercel deploy --prod
```

No manual `dist` deployment is part of the supported workflow.

## Rollback Procedure

Frontend rollback:

1. Identify the last healthy Vercel deployment in the Vercel dashboard or with `npx vercel ls`.
2. Promote or rollback to that deployment.

```powershell
npx vercel rollback <deployment-url-or-id>
```

Backend rollback:

1. Identify the previous Apps Script deployment version with `clasp deployments`.
2. Redeploy the known-good code or update the existing deployment to the known-good version from the Apps Script console.

## Notes

Do not deploy the local `dist` directory directly. That bypasses the project build pipeline and can create a separate Vercel project with different routing behavior.

## LTS Release Procedure

For Long-Term Support releases:

1. Complete the release checklist in `docs/ReleaseChecklist.md`.
2. Confirm `npm audit` has no vulnerabilities.
3. Confirm Apps Script syntax validation passes.
4. Deploy Apps Script using the existing production deployment ID.
5. Deploy frontend with the standard Vercel production command.
6. Verify production routes and critical APIs.
7. Tag the release in git.

LTS tags should use a clear version label, for example:

```powershell
git tag -a "v2.5.4-lts" -m "Version 2.5.4 LTS"
git push origin "v2.5.4-lts"
```
