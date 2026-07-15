# Operation Facelift 2.5
# Operator Badge System
# Implementation Notes

Version: 1.0

Status: APPROVED

Artwork Reference:
operator-badge-concept-v1.png

---

# Purpose

Implement one reusable React component named:

OperatorBadge

This component becomes the single visual identity component used throughout the portal.

---

# Scope

Build the OperatorBadge component.

Phase 1 integrates it into:

- Player Profile only

No other pages are modified during this release.

---

# Architecture

One component.

No duplicate implementations.

Future pages import:

<OperatorBadge player={player} />

---

# Live Data

Never hardcode:

- Faction
- Rank
- Division
- Competitive Home
- Achievement Rings

Everything comes from existing production data.

---

# Data Sources

Preferred Faction

↓

Player Profile

Competitive Home

↓

Player Classification

Rank

↓

Standings

Achievement Rings

↓

Existing Achievement / Championship data

Classification Badges

↓

Player Classification model

No additional API requests.

---

# Competitive Home

Priority

Main Man

↓

Proving Grounds A

↓

Proving Grounds B

↓

Casual Player

Never display Community.

---

# Faction Core

Use preferred faction.

If unavailable

↓

Neutral tactical core.

Never leave the center blank.

---

# Achievement Rings

Automatically enabled.

No manual assignment.

Support

- League Champion
- Tournament Champion
- Veteran
- Hall of Fame
- Commissioner

---

# Rank

Always display the current live rank.

Never historical rank.

---

# Component Consumers

Future releases will reuse this component in:

- Dashboard
- Players
- Hall of Fame
- Standings
- Battle Reports
- Team Tournament
- Search
- Hover Cards

Phase 1 implements Player Profile only.

---

# Accessibility

Expose:

- Player Name
- Preferred Faction
- Competitive Home
- Rank

Screen-reader friendly.

---

# Motion

Allowed

- Glow
- Hover
- Selection

Maximum

200 ms

---

# Performance

SVG preferred.

Lazy load assets where appropriate.

Single implementation.

No duplicate rendering.

No startup bundle regression.

---

# Validation

Verify:

Desktop

Tablet

Mobile

Preferred Faction

Competitive Home

Rank

Classification

Achievement Rings

Player without faction

Player without achievements

Player with multiple achievements

---

# Release Gates

Must pass

- npm run lint
- npm run build
- Responsive validation
- Accessibility validation
- Performance validation

No startup bundle regression.

---

# Definition of Done

✓ One reusable OperatorBadge component exists.

✓ Player Profile uses OperatorBadge.

✓ Live production data only.

✓ Responsive.

✓ Accessible.

✓ Performance maintained.

No page-specific implementations.