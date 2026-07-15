# Operation Facelift 3.0
# Battle Report Assets

Version: 1.0

Status: APPROVED

Artwork Reference:
battle-report-concept-v1.png

---

# Purpose

Defines every visual asset used by the Battle Report.

Business logic is documented separately.

---

# Hero Artwork

Asset

battle-report-concept-v1.png

Purpose

Mission dossier header.

The hero establishes atmosphere.

The report data remains the primary focus.

---

# Mission Banner

Display

Mission Name

League

Division

Round

Date

Verification Status

Mission Classification

Examples

League

Tournament

Casual

Verified

Pending

---

# Winner Panel

Uses the shared OperatorBadge component.

Display

Operator Badge

Player Name

Preferred Army

Rank

Tournament Points

Victory Points

Winner indicator

---

# Loser Panel

Uses the shared OperatorBadge component.

Display

Operator Badge

Player Name

Preferred Army

Rank

Tournament Points

Victory Points

Defeated indicator

---

# Draw Panel

Supported.

Replace Winner / Defeated with

DRAW

Both Operator Badges displayed equally.

No winner highlighting.

---

# Scoreboard

Primary

Objective Points

Secondary

Tournament Points

Victory Points

Winning score receives tactical emphasis.

---

# Timeline

Timeline entries contain

Time

Icon

Title

Description

Scrollable.

---

# Career Highlight

Display

Battle Highlight

Submitted Best Moment

If unavailable

"No Battle Highlight submitted."

---

# Army Lists

Display

Operator Badge

Army

SWC

Points

List Summary

Future

Army List Vault link.

---

# Mission Objectives

Display

Objective

Completed

Failed

Not Attempted

Status icons only.

---

# Battlefield Conditions

Display

Terrain

Visibility

Weather

Special Conditions

Hazards

Only existing production data.

---

# Stream / VOD

Display only if available.

Embedded thumbnail

Watch button

Provider

Hide panel if unavailable.

---

# Verification Panel

Display

Reported By

Verified By

Date

Status

No verification

Hide verifier row.

---

# Navigation

Bottom navigation

Previous Battle

Back to Reports

Next Battle

Uses existing routing.

---

# Typography

Hero

Bebas Neue

Section Headers

Rajdhani

Body

Inter

Statistics

Inter Bold

Use DesignSystem.md.

---

# Color Palette

Use DesignSystem.md.

Winner

HUD Cyan

Loser

Command Red

Draw

Warning Amber

---

# Tactical Cards

All panels use the shared Tactical Card component.

No page-specific variants.

---

# Motion

Allowed

Fade

Glow

Slide

Maximum

200 ms

---

# Accessibility

WCAG AA

Keyboard navigation

Screen reader labels

Icons require text alternatives.

---

# Performance

Reuse existing APIs.

No duplicate calculations.

No backend changes.

Lazy-load media.

---

# Future Assets

Reserved

battle-header.webp

mission-badge.svg

timeline-icons.svg

verification-stamp.svg

Do not implement until future releases.

---

# Version 1.0 Features

Mission dossier

Operator Badges

Winner / Loser panels

Draw support

Battle Timeline

Battle Highlight

Army Lists

Mission Objectives

Battlefield Conditions

Verification panel

Responsive layout