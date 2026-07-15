# Operation Facelift 2.5
# Operator Badge Assets

Version: 1.0

Status: APPROVED

Artwork Reference:
operator-badge-concept-v1.png

---

# Purpose

Defines every visual asset used by the Operator Badge System.

---

# Base Frame

Asset

operator-badge-frame.svg

Purpose

Shared tactical military frame.

Used by every faction.

---

# Faction Core

One SVG per preferred faction.

Examples

- Operations Subsection
- Steel Phalanx
- Bakunin
- Corregidor
- Tunguska
- Hassassin Bahram
- Ramah Taskforce
- PanOceania
- WinterFor
- Kosmoflot
- Morats
- Combined Army
- O-12
- Starmada
- JSA
- Druze
- Ikari
- Spiral Corps
- Torchlight Brigade

Only the center artwork changes.

---

# Achievement Rings

Supported

- League Champion
- Tournament Champion
- Veteran
- Hall of Fame
- Commissioner

Rings are data-driven.

---

# Competitive Home Plate

Supported values

- Main Man
- Proving Grounds A
- Proving Grounds B
- Casual Player

---

# Rank Module

Displays

Current Rank

Examples

#1

#4

#12

Uses live standings.

---

# Typography

Hero

Bebas Neue

Labels

Rajdhani

Body

Inter

Statistics

Inter Bold

---

# Colors

Use DesignSystem.md.

Faction accent colors apply only to the faction core.

Frame colors remain identical across every faction.

---

# Tactical Frame

Characteristics

- Hexagonal
- Industrial
- Metallic
- Cyan edge lighting
- Gunmetal construction
- Angular geometry

---

# Effects

Allowed

- Glow
- Hover
- Selection highlight

Maximum animation

200 ms

No decorative animation.

---

# Responsive

Desktop

256 px

Tablet

192 px

Mobile

128 px

---

# Accessibility

Expose

- Player Name
- Preferred Faction
- Competitive Home
- Rank
- Classification

---

# Performance

SVG preferred.

Single reusable component.

No duplicate assets.

No duplicate rendering.

---

# Future Assets

Reserved

operator-badge-frame-v2.svg

champion-ring.svg

veteran-ring.svg

commissioner-ring.svg

hall-of-fame-ring.svg

animated-ring.svg

Do not implement until a future release.

---

# Version 1.0 Features

- Shared tactical frame
- Dynamic faction core
- Dynamic achievement rings
- Dynamic rank module
- Dynamic competitive home
- Portal-wide reuse