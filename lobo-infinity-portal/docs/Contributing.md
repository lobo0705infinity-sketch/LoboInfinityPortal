# Contributing

The Lobo Infinity League Operating System is production software. Changes should be small, auditable, and tied to a release objective.

## Rules

- Do not redesign stable systems unless the release explicitly requires it.
- Do not use `displayName` for league data lookups.
- Use `leaguePlayer` for league identity.
- Preserve existing API contracts unless the frontend and backend are updated together.
- Do not commit secrets.
- Do not deploy prebuilt `dist` directories as a normal workflow.
- Do not remove data, generated history, or league records without commissioner approval.

## Local Workflow

```powershell
npm install
npm run lint
npm run build
```

Apps Script syntax validation:

```powershell
Get-ChildItem backend -Filter *.gs | ForEach-Object { Get-Content -Raw $_.FullName | node --check --input-type=commonjs }
```

## Review Checklist

- Does the change preserve Portal Identity and League Identity?
- Are all league lookups using permanent league player keys?
- Are new API fields documented?
- Does the release checklist still pass?
- Does the performance budget remain intact?
- Are commissioner-only actions still protected?

## Git Guidance

Use focused commits. Avoid mixing feature work with release cleanup. Do not revert unrelated working-tree changes unless explicitly asked.
