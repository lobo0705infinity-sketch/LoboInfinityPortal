# Operation Facelift 2.0
# Player Profile Design Specification

Version: 2.1

Status: APPROVED

Artwork Reference:
player-profile-concept-v2.1.png

---

# Purpose

The Player Profile is the player's permanent career dossier.

It is the most personal page in the portal.

Where the Dashboard answers:

"What is happening?"

The Player Profile answers:

"Who is this player?"

It should feel like opening an official Infinity personnel file.

---

# Primary Design Goals

The Player Profile should immediately communicate:

- Identity
- Experience
- Current Season
- Career Performance
- Achievements
- Recent Activity
- Playing Style

Every section should answer a player question.

No section exists simply to display data.

---

# Information Hierarchy

Every profile follows this order:

Hero Identity

↓

Status & Classification

↓

Season Snapshot

↓

Performance Overview

↓

Army & Faction Analytics

↓

Achievements

↓

Recent Matches

↓

Rivals

↓

Activity Feed

The most important information must be visible without excessive scrolling.

---

# Hero Identity

Purpose

Establish player identity.

Display:

Player Portrait

Display Name

Player Title

Location (optional)

Joined Date

Player Quote (optional)

Current Classification Badges

Examples

League Player

Tournament Player

Casual Player

New Player

Veteran

Commissioner

Badges are automatically derived.

Never manually assigned.

---

# Player Classifications

Use the approved portal classification model.

Examples

League Player

Tournament Player

Casual Player

New Player

Veteran

Commissioner

Multiple badges may be displayed simultaneously.

---

# Player Level

Display

Current Level

XP Progress

Next Level

The Level system is visual only for Version 2.1.

If no XP system exists yet, preserve the layout using placeholder calculations that can later bind to production.

Do not implement XP logic in this release.

---

# Season Snapshot

Purpose

Summarize current season performance.

Display

Win–Loss–Draw

Win Rate

Tournament Points

Objective Points

Victory Points

Current Division

Current Rank

Current Season

Games Played

Reuse existing production statistics.

No duplicate calculations.

---

# Navigation

Provide quick navigation within the profile.

Sections

Overview

Match History

Statistics

Factions

Army Lists

Achievements

Rivals

Activity Feed

Notes & Media

Navigation is internal to the profile page.

No routing changes.

---

# Performance Overview

Purpose

Summarize playstyle.

Display

Performance Radar

Playstyle Summary

Strengths

Areas for Improvement

The radar chart is presentation only.

If analytics already exist, bind them.

Otherwise retain the component as future-ready.

---

# Faction Breakdown

Display

Most Played Armies

Usage %

Parent Factions

Win %

Charts should reuse existing analytics.

No backend changes.

---

# Achievements

Display

Earned Achievements

Locked Achievements

Progress

Recent Unlock

Rarity

Common

Rare

Epic

Legendary

Reuse the existing achievement system.

---

# Recent Matches

Display

Opponent

Mission

Result

TP

VP

Date

Battle Report shortcut

Maximum

10 matches.

Scrollable.

Reuse existing APIs.

---

# Rivals

Display

Head-to-head records.

Top rivals.

Current record.

Reuse existing rivalry calculations.

---

# Activity Feed

Display

Achievements

Battle Reports

Army Lists

Streams

League activity

Newest first.

No duplicate queries.

---

# Mobile

Identity remains at the top.

Season Snapshot follows.

Navigation becomes horizontal.

Cards stack vertically.

No horizontal scrolling.

Maintain complete functionality.

---

# Tactical Cards

Every section uses the shared Tactical Card component.

Defined by:

DesignSystem.md

Do not create page-specific card styles.

---

# Typography

Hero

Bebas Neue

Player Name

56 px

Section Headings

Rajdhani

24 px

Body

Inter

16 px

Statistics

Inter Bold

Large values remain highly legible.

---

# Color Palette

Use DesignSystem.md.

Do not introduce page-specific colors.

---

# Motion

Allowed

Fade

Glow

Slide

Section reveal

Maximum duration

200 ms

No decorative animation.

---

# Accessibility

Maintain WCAG AA.

Visible keyboard focus.

Readable typography.

Icons require text.

Charts require textual summaries.

---

# Performance

No backend changes.

No API additions.

No duplicate calculations.

Reuse existing analytics.

Lazy-load hero artwork.

Maintain startup bundle budget.

---

# Definition of Done

Player Profile Version 2.1 is complete when:

✓ Matches player-profile-concept-v2.1.png

✓ Uses DesignSystem.md

✓ Uses Tactical Card component

✓ Displays live production data

✓ Uses approved player classifications

✓ Preserves existing functionality

✓ Responsive

✓ Accessible

✓ Performance maintained

---

# Success Criteria

A player should feel proud to share this page.

The Player Profile should feel less like a statistics page and more like an official Infinity career dossier that grows over years of participation.

It should become the centerpiece of the Lobo Infinity Portal.