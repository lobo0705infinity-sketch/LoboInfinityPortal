# Operation Facelift 2.0
# Dashboard Implementation Notes

Version: 2.1

Status: APPROVED

Artwork Reference:
dashboard-concept-v2.1.png

---

# Purpose

This document defines the engineering requirements for implementing Dashboard Version 2.1.

The objective is to faithfully reproduce the approved design while preserving every existing feature of the Dashboard.

This is a presentation release.

It is NOT an architecture release.

---

# Scope

Modify:

Dashboard only.

Do not modify:

- Player Profile
- Battle Reports
- Community
- Standings
- Hall of Fame
- Submit Game
- Commissioner
- Team Tournament
- Shared routing

Dashboard presentation only.

---

# Architecture

Preserve:

- Event Engine
- Authentication
- Routing
- Smart Cache
- Firestore
- Apps Script
- Analytics
- Notification pipeline

No backend work.

No database changes.

No API contract changes.

---

# Live Data Policy

The approved Dashboard concept contains illustrative values only.

Every visual component must bind to existing production data.

Never hardcode:

- Player names
- Standings
- TP
- OP
- VP
- Missions
- Operations
- Streams
- Rank
- Division

Concept artwork defines layout only.

Production data defines content.

---

# Data Binding Matrix

| Dashboard Component | Existing Data Source |
|---------------------|---------------------|
| Season Status | League Status API |
| Season Progress | League Statistics |
| Reports Awaiting Approval | Existing Commissioner Queue |
| Live Streams | Streams API |
| Your Rank | Player Statistics |
| Your Division | Player Profile |
| Live Transmissions | Dashboard Activity Feed |
| Commander Overview | Current Leader API |
| Weekly Operations | League Operations |
| Community Intelligence | Dashboard Intelligence |

No duplicate requests.

---

# Navigation

Use the production navigation.

Do not invent new menu items.

Do not remove menu items.

Visual styling may change.

Navigation behavior must not.

---

# Hero

Use dashboard-concept-v2.1.png as the visual reference.

Requirements:

- Responsive
- Lazy-loaded
- Preserve composition
- Overlay live data
- No cropping of primary focal points

---

# Tactical Cards

All Dashboard cards use the shared Tactical Card component.

Do not create Dashboard-specific card implementations.

Reuse the shared component.

---

# Operational Status Row

Each card answers one player question.

Do not expose internal terminology.

Examples:

Preferred

Season Progress

Not

Games Required Pace

Preferred

Reports Awaiting Approval

Not

Pending Queue

Language should be player-friendly.

---

# Live Transmissions

Reuse existing Dashboard activity.

Do not create another feed.

Each transmission links to existing destinations.

No duplicate calculations.

---

# Weekly Operations

Read-only.

Uses commissioner-configured values.

Mission names come from canonical mission registry.

Map names are free-text.

No editing controls.

---

# Commander Overview

Reuse existing Current Leader data.

No local calculations.

No duplicate queries.

Display live values only.

---

# Community Intelligence

Reuse existing Dashboard summaries.

No additional backend work.

Compact presentation.

---

# Typography

Use DesignSystem.md.

No additional fonts.

No page-specific typography.

---

# Colors

Use DesignSystem.md.

No additional primary colors.

---

# Motion

Allowed

- Fade
- Glow
- Slide
- Scanline

Maximum duration

200 ms

No decorative animation.

---

# Mobile

Maintain complete functionality.

Hero compresses.

Cards stack.

No horizontal scrolling.

Operational Status remains visible above the fold.

---

# Accessibility

Maintain WCAG AA.

Visible keyboard focus.

Readable typography.

Icons require text labels.

Do not communicate status using color alone.

---

# Performance Budget

Startup requests

No increase

Backend requests

No increase

Duplicate calculations

None

Duplicate rendering

None

Hero artwork

Lazy-loaded

Startup bundle increase

Target: <5 KB gzip

---

# Validation

Verify:

Desktop

Tablet

Mobile

Responsive

Accessibility

Performance

Dashboard API contract

Live data binding

Navigation

No placeholder values remain.

---

# Release Gates

Must pass:

- npm run lint
- npm run build
- Dashboard regression tests
- Responsive validation
- Accessibility validation
- Performance validation

No startup bundle regression.

---

# Definition of Done

Dashboard Version 2.1 is complete when:

✓ Matches dashboard-concept-v2.1.png

✓ Uses DesignSystem.md

✓ Uses Tactical Card component

✓ Uses live production data

✓ Uses existing APIs only

✓ Preserves routing

✓ Preserves authentication

✓ Preserves Event Engine

✓ Responsive

✓ Accessible

✓ Performance maintained

✓ No placeholder values remain

---

# Engineering Principle

Dashboard Version 2.1 becomes the permanent reference implementation for Operation Facelift.

Every future page should inherit:

- Tactical hierarchy
- Typography
- Color system
- Card system
- Motion
- Information density

Dashboard establishes the visual language of the Lobo Infinity Portal.