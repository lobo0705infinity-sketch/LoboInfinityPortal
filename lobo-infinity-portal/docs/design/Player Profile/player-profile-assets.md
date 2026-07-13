# Operation Facelift 2.0
# Player Profile Assets

Version: 2.1

Status: APPROVED

Artwork Reference:
player-profile-concept-v2.1.png

---

# Purpose

This document defines every visual asset used by the Player Profile.

It is the authoritative reference for:

- Hero artwork
- Player portrait
- Typography
- Colors
- Tactical cards
- Charts
- Icons
- Motion
- Shared assets

Business logic is documented separately.

---

# Hero Artwork

## Asset

player-profile-concept-v2.1.png

## Purpose

Primary Player Profile hero.

Represents the player's official Infinity career dossier.

The artwork establishes atmosphere.

The player remains the focal point.

---

## Usage

Display

Full width

Responsive

Lazy loaded

Maintain composition.

Do not crop the player portrait or identity panel.

---

# Player Portrait

Portrait is the primary identity element.

Current implementation

Placeholder artwork.

Future support

Portal avatar

Commissioner-approved artwork

Portrait requirements

Square

Minimum

256 × 256

Circular presentation inside tactical frame.

---

# Classification Badges

Approved badges

- Casual Player
- League Player
- Tournament Player
- New Player
- Veteran
- Commissioner

Badges are computed automatically.

Never manually assigned.

Multiple badges may appear simultaneously.

---

# Typography

## Hero

Bebas Neue

Weight

700

Desktop

56 px

Tablet

44 px

Mobile

32 px

---

## Section Headers

Rajdhani

600

24 px

---

## Card Titles

Rajdhani

18 px

---

## Body

Inter

16 px

---

## Labels

Inter

13 px

Uppercase

Letter spacing

0.08 em

---

## Statistics

Inter Bold

40 px

Used for

Rank

TP

VP

Games

Win Rate

---

# Color Palette

Use DesignSystem.md.

Background

#050608

Panels

#121A24

HUD Cyan

#4CC9F0

Command Red

#B2122A

Warning Amber

#F2B632

Success Green

#5FE38A

Primary Text

#F4F6F8

Secondary Text

#AAB7C2

Muted

#7E8B95

No additional primary colors.

---

# Tactical Card

Every Player Profile section uses the shared Tactical Card.

Appearance

Gunmetal

Thin cyan border

Angular corners

Soft glow

Low elevation

24 px padding

No Bootstrap styling.

---

# Charts

Supported

Performance Radar

Faction Usage

Season Snapshot

Charts should match the tactical HUD aesthetic.

No bright gradients.

No decorative animation.

---

# Icons

Use the shared tactical icon library.

Examples

Profile

Matches

Achievements

Army

Faction

Rivals

Statistics

Media

Activity

All icons use the same visual language.

---

# Buttons

Primary

Command Red

Secondary

Gunmetal

Outline

HUD Cyan

Hover

Glow

Pressed

Darken 8%

Transition

200 ms

---

# Activity Feed

Every activity row contains

Icon

Timestamp

Headline

Summary

Primary Action

Compact presentation.

Newest first.

---

# Achievements

Display

Badge

Name

Rarity

Unlock Date

Progress

Future support

Animated unlock

Display case

Season ribbons

---

# Hero Overlay

Display

Player Name

Player Title

Classification Badges

Player Quote

Current Season

The player portrait remains the dominant element.

---

# Effects

Allowed

Fade

Glow

Slide

HUD Grid

Scanline

Not Allowed

Particles

Heavy bloom

Lens flare

Decorative animation

Effects support immersion.

---

# Mobile

Hero compresses.

Identity remains first.

Classification badges wrap.

Cards stack vertically.

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

# Performance

Hero artwork

Lazy loaded

Charts

Reuse existing data

No duplicate calculations

No additional API calls

No startup bundle increase

---

# Future Assets

Reserved

player-banner-v3.webp

player-portrait-frame.svg

achievement-ribbons.svg

career-timeline.svg

faction-radar.svg

Do not reference until added to the repository.

---

# Version 2.1 Improvements

Compared to Version 2.0

- Official player classification badges
- Cleaner identity hierarchy
- Stronger tactical dossier presentation
- Improved charts
- Better achievement presentation
- Dedicated activity feed
- Better responsive layout
- Greater emphasis on player identity