# Operation Facelift 2.0
# Player Profile Implementation Notes

Version: 1.0

Status: APPROVED

---

# Purpose

This document defines the engineering constraints for implementing the
Player Profile.

The objective is to implement the approved visual design without changing
existing functionality.

This is a presentation release.

Not an architecture release.

---

# Scope

Only the Player Profile page may be modified.

Do not redesign:

- Dashboard
- Battle Reports
- Standings
- Hall of Fame
- Community
- Submit Game
- League Operations
- Commissioner

Those pages have independent Operation Facelift releases.

---

# Backend

No Apps Script changes.

No Event Engine changes.

No Authentication changes.

No Firestore changes.

No API contract changes.

No Spreadsheet changes.

No Analytics changes.

---

# Data Sources

Reuse all existing Player Profile endpoints.

Continue using:

- Player Profile API
- Statistics API
- Achievements API
- Recent Games API
- Battle History API
- League Status API
- Tournament Status API

Do not introduce duplicate requests.

Do not introduce new endpoints.

---

# Routing

Preserve existing routing.

Player profiles must continue using the existing URL structure.

Do not rename routes.

Do not create aliases.

Do not change navigation.

---

# Hero Section

Replace the visual presentation only.

Reuse existing player identity data.

Display:

- Player Name
- Current Division
- Current League
- Current Tournament
- Career Record
- Current Streak
- Lifetime Games

Do not calculate any new values.

---

# Identity Panel

Reuse existing profile information.

Display:

- Display Name
- Discord Name
- Preferred Army
- Current Army
- Profile Visibility
- Member Since
- Current Status

Editing behavior remains unchanged.

Only styling changes.

---

# Career Summary

Reuse existing statistics.

Display:

- Overall Record
- League Record
- Tournament Record
- Casual Record

Support the new W-L-D format if draws exist.

Do not modify calculations.

---

# Performance Panels

Reuse existing analytics.

Display:

- Favorite Army
- Best Army
- Most Recent Army
- Favorite Mission
- Best Mission
- Most Recent Mission

Use canonical army names.

Display parent faction beneath the army.

Do not replace the army with the parent faction.

---

# Recent Battles

Reuse the existing Recent Games API.

Do not create another query.

Each battle entry links to the existing Battle Report page.

Display:

- Date
- Opponent
- Mission
- Result
- Score

No new calculations.

---

# Achievement Panel

Reuse the existing Achievement API.

Display:

- Earned Achievements
- Locked Achievements
- Achievement Progress
- Completion %

Support rarity colors.

No changes to unlock logic.

---

# Timeline

Timeline is presentation only.

Reuse existing milestone data.

Do not generate synthetic milestones.

Future milestone expansion should reuse this component.

---

# Tactical Cards

Every panel must use the shared Tactical Card component defined in:

DesignSystem.md

No custom card styles.

Maintain visual consistency with the Dashboard.

---

# Typography

Use typography defined in:

DesignSystem.md

Do not override fonts.

Do not introduce additional font families.

---

# Colors

Use only colors defined in:

DesignSystem.md

No page-specific palettes.

---

# Icons

Use the shared tactical icon library.

Do not introduce another icon style.

Icons must remain consistent across the application.

---

# Artwork

Use:

player-profile-concept-v1.png

as the approved design reference.

Future production artwork may replace placeholders.

Layout must remain consistent.

---

# Motion

Allowed:

- Fade
- Slide
- Hover Glow

Maximum animation duration:

200ms

No bouncing.

No spinning.

No decorative animations.

---

# Mobile

Maintain complete functionality.

Cards stack vertically.

Hero compresses.

Statistics remain readable.

Recent Battles remain scrollable.

No horizontal scrolling.

---

# Accessibility

Maintain WCAG AA compliance.

Maintain keyboard navigation.

Maintain visible focus indicators.

Maintain sufficient contrast.

Do not rely solely on color to convey status.

---

# Performance

No startup request increase.

No duplicate calculations.

No duplicate API calls.

No backend changes.

Hero artwork must be lazy-loaded.

Preserve existing performance budget.

---

# Engineering Rules

Reuse existing React components wherever practical.

Avoid creating duplicate implementations.

Prefer extending shared components over creating page-specific variants.

Preserve:

- Error handling
- Retry logic
- Cache behavior
- Loading states

---

# Validation

Verify:

Desktop

Tablet

Mobile

Authenticated users

Public profiles

Players with zero games

Players with many games

Players with achievements

Players without achievements

Verify all existing functionality remains unchanged.

---

# Release Gates

Implementation must pass:

- npm run lint
- npm run build
- Player Profile regression tests
- Accessibility audit
- Responsive audit
- Performance audit

No startup bundle regression.

---

# Definition of Done

The Player Profile implementation is complete when:

✓ Matches the approved concept artwork

✓ Matches player-profile-spec.md

✓ Uses Tactical Card components

✓ Uses DesignSystem.md

✓ Preserves existing APIs

✓ Preserves routing

✓ Preserves authentication

✓ Preserves functionality

✓ Responsive

✓ Accessible

✓ Performance maintained

Only then may the page be considered complete.

---

# Future Enhancements

Reserved for future Operation Facelift releases:

- Player avatars
- Animated achievement showcase
- Dynamic career graphs
- Collection cabinet
- Medal wall
- Seasonal ribbons

These are intentionally out of scope for Version 1.0.