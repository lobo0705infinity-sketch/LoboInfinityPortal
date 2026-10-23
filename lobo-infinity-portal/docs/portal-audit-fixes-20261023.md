# Portal audit corrections — October 23, 2026

- Active Mission & Map views resolve a layout within its mission and follow retired save indices to the current replacement. The Dig's retired Azure Circuit assignment now links to Old Quarter Excavation. Existing saved-report resolution and historical URLs remain unchanged. The source schedule is preserved; its retired labels are interpreted at display time rather than silently editing the commissioner's sheet.
- Army-list submissions read all canonical players from the public player snapshot, show display names, and retain canonical player values in the submitted payload. Directory loading failures show a retry action and disable submission until recovery.
- The Top 40 submission card stays visible. Its external form link becomes available only when the published tournament is active or a match has been released. Before launch it explains the November 1 start and match-release requirement. Publishing an active tournament does not itself open the Google Form: the organizer must also enable responses in Google Forms when releasing matches.
- Sitemap coverage follows the current map catalogues and tests unique canonical URLs instead of a fixed total. Navigation checks accommodate the current combined public navigation list.
- Responsive artwork caches each encoder recipe and source-image combination. Four derived benchmark catalogues cache their generated outputs using source data, local module dependencies, the lockfile and Node version. Cache bytes are checked before restoration; missing/corrupt entries rebuild. Cache storage lives under node_modules/.cache/lobo-generated-v1 so it can travel with the host's dependency build cache. Cold hosts rebuild normally. Existing benchmark, security and release tests remain enabled.

## Checks

`npm run test:portal-audit-fixes` checks mission replacement history, reporting readiness, cache hits, invalidation, corruption and output restoration, plus sitemap and navigation coverage.

After building, `npm run test:portal-audit-fixes:browser` checks canonical community-player selection, failed-directory retry, current mission bag links, closed/active tournament reporting, and mobile layout. It creates no real submissions. `CAMPAIGN_TEST_CHROMIUM` can point to a local Chromium executable.
