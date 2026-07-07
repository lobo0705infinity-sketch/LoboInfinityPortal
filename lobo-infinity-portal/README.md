# Lobo Infinity League Operating System

The Lobo Infinity League Operating System is the production portal for league standings, player identity, profiles, achievements, automation, Hall of Fame history, commissioner operations, and Discord-driven league communication.

Version 2.5.4 is the first Long-Term Support baseline. It prioritizes stability, documentation, validation, and repeatable deployment over new feature work.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Google Apps Script
- Data store: Google Sheets
- Hosting: Vercel
- Deployment: `clasp` for Apps Script, Vercel CLI for frontend

## Quick Start

```powershell
npm install
npm run lint
npm run build
```

Apps Script commands run from `backend`:

```powershell
cd backend
clasp push
clasp deploy -i AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng -d "Release description"
```

Frontend production deployment runs from the repository root:

```powershell
npx.cmd --yes vercel deploy --prod
```

## Core Documentation

- [Architecture](docs/Architecture.md)
- [API](docs/API.md)
- [Deployment](docs/Deployment.md)
- [Development Setup](docs/DevelopmentSetup.md)
- [Project Structure](docs/ProjectStructure.md)
- [Performance](docs/Performance.md)
- [Performance Budget](docs/PerformanceBudget.md)
- [Release Checklist](docs/ReleaseChecklist.md)
- [Troubleshooting](docs/Troubleshooting.md)
- [Technical Debt](docs/TechnicalDebt.md)

## Production Rules

- Google Identity is presentation identity.
- League Identity is authoritative for league data.
- `leaguePlayer` is used for league lookups.
- `displayName` and player display names are presentation only.
- Discord webhook URLs and other secrets must never be exposed to public payloads.
- Apps Script deployment ID `AKfycbxBzo57XHrxiBy1EJq4f_VS026uTXnCYHSXrWT6c2uU__zSB2Dzeixx3rFHQahXQycCng` is the production backend.
