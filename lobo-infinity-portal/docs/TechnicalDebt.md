# Technical Debt

Version 2.5.4 LTS documents known technical debt without implementing new feature work.

## High Priority

### Reliability Queue Persistence Limits

Description: Version 3.4 stores lightweight background job metadata, snapshot metadata, reliability history, and reliability audit entries in Apps Script properties.

Reason: This avoids Google Sheets schema changes during a reliability release, but Script Properties are not a long-term high-volume queue store.

Estimated impact: Medium as operational history grows.

Suggested future release: 3.5 Reliability Storage Hardening.

### Automated Reliability Contract Tests

Description: Platform Health and Recovery Center actions are permission-gated and currently verified through release checks instead of authenticated CI contract tests.

Reason: The release does not introduce new credential automation for Commissioner-only Apps Script mutations.

Estimated impact: Medium.

Suggested future release: 3.5 Operations CI.

### Public Event Directory

Description: Version 3.1 ships the authenticated Community Command Center, but the broader public Current Events, Upcoming Events, and Completed Events directory remains unimplemented.

Reason: The release scope prioritizes the daily authenticated player command center and avoids event migration or new public event surfaces.

Estimated impact: Medium.

Suggested future release: 3.1.x or 3.2, depending on Event Migration sequencing.

### Event-Specific Workflow Destinations

Description: Version 3.1.1 supports event switching and workflow nudges, but non-league event detail pages still resolve to placeholder routes until future Event Dashboard work begins.

Reason: The release scope improves the authenticated player workflow without implementing Event Dashboard, Campaign Dashboard, Tournament registration, or public Event Directory pages.

Estimated impact: Medium.

Suggested future release: 3.2 or 3.4, depending on Event Migration and Event Automation sequencing.

### Event Lifecycle Transition Contract Tests

Description: Version 3.1.2 adds Event Lifecycle Controls, but automated authenticated contract tests for transition and rollback mutations are not available in CI.

Reason: Lifecycle changes require Commissioner authentication and mutate production Event Engine sheets, so release verification uses syntax/build checks, unauthenticated permission checks, and manual Commissioner operation checks.

Estimated impact: Medium.

Suggested future release: 3.2 API Contract Testing.

### Organization Persistence

Description: Version 3.0D freezes Organization as the architectural parent above Community, but runtime persistence still begins at the Event Engine foundation sheets introduced in Version 3.0B.

Reason: 3.0D is a documentation baseline release only. Implementing Organization persistence would change backend behavior and is intentionally deferred until a future release requires multiple communities or operating groups.

Estimated impact: Medium.

Suggested future release: Future multi-community expansion.

### Engineering Rule #2 Enforcement

Description: Engineering Rule #2 is documented, but there is no automated CI check requiring Architecture, APIContracts, ProjectStructure, TechnicalDebt, and ReleaseChecklist updates when a top-level concept changes.

Reason: Governance is currently enforced through release process and review.

Estimated impact: Medium.

Suggested future release: 3.1 Release Automation.

### Event Engine Scope Migration

Description: Version 3.0B installs Event Engine foundation sheets and default scope resolution, but historical Game Engine rows are not migrated to explicit `eventId`, `seasonId`, and `roundId` columns yet.

Reason: Production data migration is intentionally deferred until the foundation can be audited and previewed.

Estimated impact: High for Version 3.1+ event-aware statistics.

Suggested future release: 3.1 Event Scope Migration.

### Event Migration Production Contract Tests

Description: Version 3.0C adds backend validation tooling, but automated CI cannot currently execute authenticated Apps Script validation against production with stable credentials.

Reason: Release validation still depends on deployed Apps Script reachability and authenticated operations access.

Estimated impact: Medium.

Suggested future release: 3.1 CI Contract Validation.

### Apps Script Cold Start Measurement

Description: Direct Apps Script endpoint timing is intermittently blocked from the current sandbox, which limits release-time measurement confidence.

Reason: Performance claims need repeatable production measurement.

Estimated impact: High for future performance releases.

Suggested future release: 2.5.5 Performance Observability.

### Hall of Fame Observability

Description: Hall of Fame has optimized snapshot caching, but endpoint-level telemetry is not exposed in a dedicated performance report.

Reason: The page is historically expensive and should remain watched.

Estimated impact: High if league history grows quickly.

Suggested future release: 2.5.5 Performance Observability.

### Search Index Precomputation

Description: Search data is loaded lazily, but the backend still assembles the index from live service reads.

Reason: Larger leagues may make search generation slower.

Estimated impact: Medium to high as data grows.

Suggested future release: 2.6 Search and Navigation Hardening.

## Medium Priority

### Accessibility Pass

Description: The portal has accessible labels in key areas, but it has not had a complete WCAG audit.

Reason: Keyboard navigation, focus visibility, and screen reader flow should be verified across every page.

Estimated impact: Medium.

Suggested future release: 2.6 Accessibility.

### Mobile Visual QA

Description: Mobile responsive rules exist, but automated screenshot regression tests are not installed.

Reason: Visual regressions are hard to catch with lint/build only.

Estimated impact: Medium.

Suggested future release: 2.6 Mobile QA.

### Apps Script Integration Tests

Description: Apps Script syntax validation exists, but there is no automated contract test suite for deployed API responses.

Reason: API contract mismatches can reach production.

Estimated impact: Medium.

Suggested future release: 2.5.5 API Contract Testing.

### Season Command Center Contract Tests

Description: Version 2.6 documents the `seasonCommandCenter` and `seasonAvailability` contracts, but there is no automated deployed-response contract test for authenticated players.

Reason: The endpoint is authenticated and player-specific, so release validation currently combines build-time TypeScript normalization with manual signed-in verification.

Estimated impact: Medium.

Suggested future release: 2.6.1 API Contract Testing.

### Bundle Analysis Automation

Description: Bundle sizes are manually read from Vite output.

Reason: Performance budgets should fail automatically when exceeded.

Estimated impact: Medium.

Suggested future release: 2.5.5 CI Budget Checks.

### Dependency Patch Updates

Description: `npm outdated` reports patch/minor candidates: `vite` 8.1.2 to 8.1.3, `typescript-eslint` 8.62.1 to 8.63.0, and `@types/node` 24.13.2 with newer major type definitions available.

Reason: LTS should avoid unnecessary upgrades, but routine maintenance should keep tooling current.

Estimated impact: Low to medium.

Suggested future release: 2.5.5 Maintenance.

## Low Priority

### CSS Organization

Description: Most styling is centralized in `src/App.css`.

Reason: The file is large and harder to audit, though stable.

Estimated impact: Low.

Suggested future release: 2.7 CSS Maintenance.

### README Historical Context

Description: README now reflects production setup, but release history remains spread across docs.

Reason: New maintainers may benefit from a concise changelog.

Estimated impact: Low.

Suggested future release: 2.6 Documentation Polish.

### Generated Reference Artifacts

Description: Historical Apps Script reference clones and screenshot folders exist in the working tree.

Reason: They may be useful for audit history but should be reviewed before committing or deleting.

Estimated impact: Low.

Suggested future release: Repository cleanup after LTS tag.
