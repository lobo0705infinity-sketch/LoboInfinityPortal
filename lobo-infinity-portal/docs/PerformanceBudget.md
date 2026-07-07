# Performance Budget

Version 2.5.3 must preserve the Version 2.5.1 performance model.

## Budgets

- Initial JavaScript bundle: no significant increase without documented justification.
- Startup API requests: no increase.
- Apps Script calls on first render: no increase.
- Dashboard first useful data: under 2 seconds outside Apps Script cold starts.
- Cached navigation: under 300 ms from frontend cache.
- Global Search, Quick Jump, and Notifications: no startup fetches.
- Mobile layout: no horizontal page scroll at common phone and tablet widths.

## Version 2.5.3 Baseline

Measured before the mobile responsive pass from the existing production build output:

- Initial JavaScript bundle: `index-DqQk5YWH.js`, 303,426 bytes.
- CSS bundle: `index-o6hikK7L.css`, 95,338 bytes.
- Startup API request model: unchanged from Version 2.5.1.
- Apps Script startup model: unchanged from Version 2.5.1.

## Version 2.5.3 Changes

The mobile release uses CSS-first responsive behavior:

- Fixed bottom mobile navigation.
- Mobile search overlay.
- Mobile notification and profile overlays.
- Touch target improvements.
- Cardified tables on small screens.
- Safer mobile form controls.
- Safe-area padding for mobile browsers.

The only TypeScript change adds route metadata to existing navigation links so CSS can prioritize common mobile destinations.

## Required Release Measurements

Record after every build:

- Initial JavaScript bundle size.
- Largest route chunk.
- CSS bundle size.
- Number of startup API requests.
- Number of Apps Script calls before first interaction.
- Any added dependency or bundle growth justification.

## Version 2.5.3 Budget Result

- Initial JavaScript bundle after mobile pass: `index-CyL9TfKC.js`, 303,442 bytes.
- JavaScript delta: +16 bytes.
- CSS bundle after mobile pass: `index-BpIbo3Ir.css`, 100,116 bytes.
- CSS delta: +4,778 bytes.
- Startup API requests: unchanged.
- Apps Script calls before first interaction: unchanged.

## Version 2.5.4 LTS Budget Result

Version 2.5.4 LTS preserves the 2.5.4.1 build budget:

- Initial JavaScript bundle: `index-D6U2Uyck.js`, 303,442 bytes.
- CSS bundle: `index-BpIbo3Ir.css`, 100,116 bytes.
- Hall of Fame route chunk: `HallOfFame-BwPoBYjk.js`, 11,547 bytes.
- Startup API request model: unchanged.
- Authentication request model: unchanged.
- Dashboard critical path: unchanged.

No package upgrades or new dependencies were introduced during the LTS pass.
- Justification: CSS growth implements the mobile application shell, safe-area handling, mobile overlays, touch targets, and responsive table/form behavior without new dependencies, new route code, or new API calls.

## Version 2.5.4 Hall of Fame Budget

Version 2.5.4 is allowed to optimize Hall of Fame internals, but must not increase unrelated startup cost.

Before optimization:

- Hall of Fame cold load target problem: approximately 20-25 seconds reported.
- Initial JavaScript budget: unchanged from Version 2.5.3.
- Startup API requests: unchanged.
- Authentication path: unchanged.
- Dashboard path: unchanged.

After optimization:

- Hall of Fame backend builds a request-local indexed context.
- Hall of Fame snapshots are cached with the portal cache version.
- Frontend renders primary Hall of Fame content first and hydrates secondary sections after first paint.
- No new API requests are introduced.
- No new dependencies are introduced.

Build measurements:

- Initial JavaScript bundle: `index-D6U2Uyck.js`, 303,442 bytes.
- Initial JavaScript delta from Version 2.5.3: 0 bytes.
- CSS bundle: `index-BpIbo3Ir.css`, 100,116 bytes.
- CSS delta from Version 2.5.3: 0 bytes.
- Hall of Fame route chunk: `HallOfFame-BwPoBYjk.js`, 11,547 bytes.
- Hall of Fame route chunk delta from Version 2.5.3: approximately +363 bytes.
- Startup API requests: unchanged.
- Apps Script calls before first interaction: unchanged.
