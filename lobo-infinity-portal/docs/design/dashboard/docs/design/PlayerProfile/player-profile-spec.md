# Operation Facelift 2.0
# Player Profile Design Specification

Version: 1.0

Status: APPROVED

Artwork Reference:
player-profile-concept-v1.png

---

# Purpose

The Player Profile is the centerpiece of the Lobo Infinity Portal.

The Dashboard answers:

"What is happening?"

The Player Profile answers:

"Who is this player?"

The page should feel like opening the official military dossier of an Infinity operative.

It should communicate:

- Identity
- Career
- Performance
- Reputation
- History

within seconds.

---

# Design Philosophy

The Player Profile is a military intelligence file.

Visual inspiration:

- O-12 personnel dossier
- ALEPH tactical records
- Military personnel database
- Classified intelligence report

The interface should feel:

Professional

Military

Premium

Data-rich

Highly organized

The player is the focus.

Artwork provides atmosphere.

Statistics provide value.

---

# Information Hierarchy

Every profile follows:

Hero

↓

Identity

↓

Career Summary

↓

Performance

↓

Achievements

↓

Battle History

↓

Timeline

Users should immediately understand:

Who the player is.

How experienced they are.

How successful they have been.

---

# Hero Banner

Purpose

Establish atmosphere.

Provide player identity.

Height

Desktop

400 px

Tablet

320 px

Mobile

220 px

Background

player-profile-concept-v1.png

Lazy loaded.

Responsive.

---

# Hero Content

Display:

Player Name

Division

Current Rank

Current League

Current Tournament

Career Record

Current Win Streak

Longest Win Streak

Lifetime Games

These values already exist.

No new calculations.

---

# Identity Panel

Display:

Display Name

Preferred Army

Current Army

Profile Visibility

Discord Name

Member Since

Current Status

These represent the player's identity.

---

# Career Summary

Large tactical summary cards.

Display:

Overall Record

League Record

Tournament Record

Casual Record

Games Played

Win Percentage

Draw Percentage

Tournament Points

Objective Points

Victory Points

Use existing calculations.

---

# Performance Panels

Display:

Favorite Army

Best Army

Most Recent Army

Favorite Mission

Best Mission

Most Recent Mission

Parent faction displayed beneath army.

Canonical army remains primary.

---

# Recent Battles

Scrollable panel.

Each entry:

Date

Opponent

Mission

Result

Score

Battle Report shortcut

Maximum:

10 entries.

Reuse existing APIs.

---

# Achievement Panel

Display:

Unlocked Achievements

Achievement Progress

Next Achievement

Completion %

Support rarity colors:

Common

Rare

Epic

Legendary

No functionality changes.

Presentation only.

---

# Career Timeline

Display important milestones.

Examples:

Joined League

First Victory

Promotion

Tournament Champion

100 Games

Current Season

Timeline is chronological.

Scrollable.

Future-ready.

---

# Statistics Overview

Present:

Win %

Games

Draws

Tournament Points

Objective Points

Victory Points

Most Played Mission

Most Played Army

Faction Performance

High information density.

---

# Layout

Desktop

Hero

↓

Identity + Career Summary

↓

Performance + Achievements

↓

Recent Battles

↓

Timeline

Tablet

Two-column layout.

Mobile

Single column.

---

# Tactical Cards

Use the shared Tactical Card component.

Defined in:

DesignSystem.md

Maintain consistent styling.

---

# Navigation

No changes.

Use existing navigation.

Player Profile remains part of:

Community

↓

Players

---

# Buttons

Retain functionality.

Update styling only.

Primary

Command Red

Secondary

HUD Cyan

---

# Animations

Allowed

Fade

Slide

Glow

Hover

Timeline reveal

Maximum duration

200 ms

---

# Typography

Hero

Bebas Neue

Player Name

48 px

Section Headers

Rajdhani

24 px

Body

Inter

16 px

Statistics

Inter Bold

Large numbers.

Easy to scan.

---

# Color Palette

Use DesignSystem.md

Do not redefine colors.

---

# Mobile

Hero compresses.

Identity remains visible.

Career Summary appears before Recent Battles.

No horizontal scrolling.

---

# Accessibility

WCAG AA

Keyboard navigation

Visible focus

High contrast

Readable typography

---

# Performance

Reuse existing APIs.

No new backend.

No new calculations.

No duplicate requests.

Hero artwork lazy-loaded.

No startup bundle regression.

---

# Definition of Done

Player Profile is complete when:

✓ Matches approved concept artwork

✓ Uses approved typography

✓ Uses Tactical Card component

✓ Displays existing data only

✓ Preserves all functionality

✓ Responsive

✓ Accessible

✓ No backend changes

✓ Performance maintained

---

# Long-Term Vision

The Player Profile should become the player's Infinity résumé.

A player should be proud to share their profile.

The page should feel like a living military dossier that grows over years of league participation.

This specification becomes the permanent reference for all future Player Profile development.