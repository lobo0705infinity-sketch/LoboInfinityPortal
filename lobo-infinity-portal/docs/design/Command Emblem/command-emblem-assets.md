# Operation Facelift 2.5
# Command Emblem Assets

Version: 1.0

Status: APPROVED

Artwork Reference:
command-emblem-concept-v1.png

---

# Purpose

This document defines every visual asset used by the Command Emblem System.

It is the authoritative reference for:

- Emblem frame
- Faction cores
- Achievement rings
- Rank indicators
- Classification badges
- Typography
- Colors
- Icons
- Motion

Business logic is documented separately.

---

# Design Philosophy

Every emblem shares one common military frame.

The frame never changes.

Only the center faction core and dynamic rings change.

This creates one recognizable visual language across the entire portal.

---

# Base Frame

Asset

command-emblem-frame.svg

Purpose

Shared military command badge.

Characteristics

- Hexagonal
- Industrial
- Metallic
- Cyan accent lighting
- Angular construction

Every faction uses this frame.

---

# Faction Core

Purpose

Represents the player's preferred faction.

One SVG per faction.

Examples

Operations Subsection

Hassassin Bahram

PanOceania

Nomads

Morats

Combined Army

Yu Jing

Haqqislam

O-12

Ariadna

ALEPH

Tohaa

NA2

Future factions inherit the same template.

---

# Achievement Ring

Outer animated ring.

Represents long-term accomplishments.

Possible states

League Champion

Tournament Champion

Veteran

Hall of Fame

Commissioner

No Achievement

Ring is data-driven.

---

# Rank Module

Lower tactical module.

Displays

Current Rank

Examples

#1

#4

#10

Top 3 ranks may receive enhanced styling.

---

# Competitive Home Plate

Displays

Main Man

Proving Grounds A

Proving Grounds B

Casual Player

Presentation uses tactical military styling.

---

# Classification Badges

Shared Tactical Badge component.

Approved badges

League Player

Tournament Player

Casual Player

New Player

Veteran

Commissioner

Hall of Fame

Badges appear beneath the emblem.

---

# Typography

Hero

Bebas Neue

Labels

Rajdhani

Body

Inter

Rank

Inter Bold

No additional fonts.

---

# Color System

Use DesignSystem.md.

Additional faction accent colors may be used only within the faction core.

Frame colors remain consistent.

---

# Faction Accent Colors

Operations Subsection

White / Cyan

PanOceania

Blue

Nomads

Red

Hassassin Bahram

Crimson

Morats

Orange

Combined Army

Purple

Yu Jing

Gold

Ariadna

Green

O-12

Steel Blue

Haqqislam

Emerald

Only the faction core uses these accents.

---

# Icons

Use the shared tactical icon library.

No faction uses a different icon style.

All faction cores should appear as if manufactured by the same command network.

---

# Motion

Allowed

Glow

Pulse

Ring rotation (future)

Hover highlight

Selection glow

Maximum duration

200 ms

No decorative animation.

---

# Responsive

Desktop

256 px emblem

Tablet

192 px emblem

Mobile

128 px emblem

The emblem remains recognizable at every size.

---

# Accessibility

Every emblem requires:

Player Name

Faction

Competitive Home

Rank

Classification

Available to screen readers.

Do not communicate information by color alone.

---

# Performance

Preferred format

SVG

Fallback

WebP

No PNG assets in production.

Single reusable React component.

No duplicate faction implementations.

---

# Asset Inventory

Frame

command-emblem-frame.svg

Faction Cores

operations-subsection.svg

hassassin-bahram.svg

nomads.svg

morats.svg

combined-army.svg

panoceania.svg

...

Achievement Rings

league-ring.svg

tournament-ring.svg

veteran-ring.svg

commissioner-ring.svg

hall-of-fame-ring.svg

Rank Module

rank-module.svg

Player Plate

player-plate.svg

---

# Version 1.0 Features

Shared military frame

Unique faction cores

Dynamic achievement rings

Dynamic rank indicator

Reusable tactical badge component

Responsive scaling

Portal-wide reuse

---

# Future Assets

Reserved

animated-ring.svg

champion-crown.svg

season-ribbon.svg

mastery-stars.svg

retired-player-ring.svg

Do not implement until a future release.

---

# Success Criteria

Every player should have a visually unique identity while preserving a unified portal style.

The emblem should instantly communicate:

- Preferred Faction
- Competitive Home
- Rank
- Career Status

without requiring the player name.