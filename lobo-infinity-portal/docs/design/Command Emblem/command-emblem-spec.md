# Operation Facelift 2.5
# Command Emblem System Specification

Version: 1.0

Status: APPROVED

Artwork Reference:
command-emblem-concept-v1.png

---

# Purpose

The Command Emblem System provides every player with a unique visual identity.

The emblem replaces generic profile avatars with a faction-inspired tactical badge that evolves throughout a player's career.

The system visually communicates:

- Preferred Faction
- Competitive Home
- League Status
- Tournament Status
- Career Progress
- Veteran Status
- Current Rank
- Championships

at a glance.

The emblem should become the signature visual identity of the Lobo Infinity Portal.

---

# Design Philosophy

The emblem is not a faction logo.

It is a military command badge inspired by a faction.

Every faction uses:

- identical outer construction
- identical proportions
- identical sizing

Only the center insignia and faction colors change.

This creates one unified visual language.

---

# Structure

Every emblem consists of five layers.

```
Achievement Ring

↓

Faction Ring

↓

Faction Core

↓

Rank Module

↓

Player Plate
```

---

# Faction Core

Purpose

Represents the player's preferred faction.

Examples

Operations Subsection

Hassassin Bahram

Nomads

PanOceania

Combined Army

Morats

The center changes.

Everything else remains consistent.

---

# Achievement Ring

Outer ring.

Represents long-term accomplishments.

Possible decorations

League Champion

Tournament Champion

Veteran

Hall of Fame

Commissioner

The ring evolves throughout the player's career.

---

# Rank Module

Displays current competitive rank.

Examples

#1

#4

#10

Displayed as a tactical military rank indicator.

No oversized typography.

---

# Player Plate

Lower plate.

Displays

Player Name

Preferred Faction

Optional.

May collapse on smaller layouts.

---

# Competitive Home

Display where the player currently competes.

Examples

Main Man

Proving Grounds A

Proving Grounds B

Casual Player

This replaces the former "Community" concept.

---

# Classification Badges

Separate from the emblem.

May display

League Player

Tournament Player

Casual Player

New Player

Veteran

Commissioner

Multiple badges permitted.

---

# Faction Variants

Each faction receives a unique center design.

Only the center changes.

Frame remains identical.

Examples

Operations Subsection

White

Cyan

AI geometry

---

Hassassin Bahram

Crimson

Blade motifs

Desert geometry

---

Nomads

Industrial

Red

Asymmetrical

---

PanOceania

Blue

Command shield

Military precision

---

Combined Army

Purple

Alien geometry

Organic shapes

---

Morats

Heavy armor

Aggressive

Industrial

---

# Usage

The Command Emblem replaces generic player icons throughout the portal.

Locations

Dashboard

Player Profile

Players page

Hall of Fame

Standings

Battle Reports

Tournament Rosters

Team Pages

Search Results

Hover Cards

Commander Overview

Only one implementation exists.

All pages reuse it.

---

# Responsive

Desktop

Large emblem

Player plate visible

Tablet

Medium emblem

Player plate optional

Mobile

Compact emblem

No loss of identity

---

# Accessibility

Every emblem requires:

Text alternative

Faction name

Player name

Rank

Status

Icons may not communicate information by color alone.

---

# Performance

SVG preferred.

Single reusable React component.

No raster images.

No duplicate implementations.

No page-specific versions.

---

# Future Expansion

Future support

Animated achievement rings

Season ribbons

Animated champion glow

Commissioner variants

Retired player variants

Faction mastery progression

These are out of scope for Version 1.0.

---

# Definition of Done

The Command Emblem System is complete when:

✓ Every faction has a unique center.

✓ Every emblem shares the same frame.

✓ Achievement rings are data driven.

✓ Rank indicator is dynamic.

✓ Player identity is instantly recognizable.

✓ One reusable component serves the entire portal.

✓ No duplicate implementations exist.

---

# Success Criteria

A player should be identifiable from the emblem alone.

Without reading text, another player should immediately recognize:

- preferred faction
- competitive home
- career accomplishments
- rank

The Command Emblem should become the signature visual identity of the Lobo Infinity Portal.