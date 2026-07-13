# Operation Facelift 2.0
# Player Profile Implementation Notes

Version: 2.1

Status: APPROVED

Artwork Reference:
player-profile-concept-v2.1.png

---

# Purpose

This document defines the engineering requirements for implementing Player Profile Version 2.1.

The objective is to faithfully reproduce the approved Player Profile design while preserving all existing functionality.

This is a presentation release.

It is NOT an architecture release.

---

# Scope

Modify:

Player Profile only.

Do not modify:

- Dashboard
- Battle Reports
- Standings
- Hall of Fame
- Community
- Submit Game
- Commissioner
- Team Tournament

Player Profile presentation only.

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

The approved concept artwork contains illustrative values only.

Every visual component must bind to existing production data.

Never hardcode:

- Player name
- Rank
- Record
- TP
- OP
- VP
- Win %
- Factions
- Missions
- Rivals
- Achievements

The concept defines layout only.

Production data defines content.

---

# Data Binding Matrix

| Component | Existing Production Source |
|------------|----------------------------|
| Player Identity | Player Profile API |
| Display Name | Player Profile |
| Classification Badges | Player Classification Model |
| Current League | Event Registration |
| Current Tournament | Event Registration |
| Season Snapshot | Player Statistics |
| Match History | Recent Games API |
| Achievements | Achievement API |
| Faction Breakdown | Analytics API |
| Rivals | Rival Statistics |
| Activity Feed | Player Activity |
| Army Lists | Existing Army List Repository |

No duplicate API requests.

---

# Player Classification

Use the approved classification model.

Automatically determine:

- Casual Player
- League Player
- Tournament Player
- New Player
- Veteran
- Commissioner

Do not create stored status fields.

Derive dynamically from existing data.

---

# Hero Section

Use:

player-profile-concept-v2.1.png

as the visual reference.

The player portrait and identity are the focal point.

Hero artwork must remain lazy-loaded.

---

# Navigation

Profile navigation is internal only.

Do not modify application routing.

Do not create additional routes.

Navigation scrolls to sections already present on the page.

---

# Tactical Cards

All sections use the shared Tactical Card component.

Do not create page-specific card implementations.

Reuse the shared component defined by DesignSystem.md.

---

# Performance Overview

Reuse existing analytics.

Do not invent player ratings.

If an analytic does not exist:

Leave the component visually present but bind only to existing production values.

Do not fabricate statistics.

---

# Recent Matches

Reuse the existing Battle Report list.

Do not create another query.

Each row links to the existing Battle Report page.

Display:

- Date
- Opponent
- Mission
- Result
- TP
- VP

No duplicate calculations.

---

# Rivals

Reuse the existing rivalry calculations.

Do not recompute head-to-head statistics.

---

# Achievements

Reuse the existing Achievement API.

No changes to unlock logic.

Presentation only.

---

# Activity Feed

Reuse existing player activity.

Do not create another feed.

Display newest first.

---

# Typography

Use DesignSystem.md.

No additional fonts.

Maintain the approved hierarchy.

---

# Colors

Use DesignSystem.md.

No page-specific palette.

---

# Motion

Allowed

- Fade
- Slide
- Glow
- Section reveal

Maximum duration

200 ms

No decorative animation.

---

# Mobile

Maintain complete functionality.

Hero compresses.

Cards stack.

Navigation becomes horizontal.

Charts resize responsively.

No horizontal scrolling.

---

# Accessibility

Maintain WCAG AA.

Keyboard navigation.

Visible focus indicators.

Charts require textual summaries.

Icons require labels.

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

Player data

Achievements

Recent matches

Rival statistics

Classification badges

Live production data

No placeholder values remain.

---

# Release Gates

Must pass:

- npm run lint
- npm run build
- Player Profile regression tests
- Responsive validation
- Accessibility validation
- Performance validation

No startup bundle regression.

---

# Definition of Done

Player Profile Version 2.1 is complete when:

✓ Matches player-profile-concept-v2.1.png

✓ Uses DesignSystem.md

✓ Uses Tactical Card component

✓ Uses live production data

✓ Uses approved player classifications

✓ Preserves routing

✓ Preserves authentication

✓ Preserves Event Engine

✓ Responsive

✓ Accessible

✓ Performance maintained

✓ No placeholder values remain

---

# Engineering Principle

The Player Profile is the definitive player dossier for the portal.

It should present the player's history, achievements, identity, and performance using the shared visual language established by Dashboard v2.1.

Every enhancement must strengthen identity, readability, and immersion without altering existing portal functionality.