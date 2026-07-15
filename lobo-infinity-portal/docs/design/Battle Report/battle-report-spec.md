# Operation Facelift 3.0
# Battle Report Design Specification

Version: 1.0

Status: APPROVED

Artwork Reference:
battle-report-concept-v1.png

---

# Purpose

The Battle Report is the official After Action Report (AAR) of the Lobo Infinity League.

It transforms every completed game into a permanent mission dossier.

Players should feel they are opening an O-12 military report rather than a web page.

---

# Design Goals

Every Battle Report should immediately communicate:

- Mission
- Winner
- Loser
- Final Score
- Mission Story
- Key Moments
- Army Lists
- Tactical Conditions
- Objectives
- Verification Status

The page should feel like an official classified document.

---

# Information Hierarchy

Every Battle Report follows:

Mission Dossier

↓

Winner vs Loser

↓

Mission Summary

↓

Timeline

↓

Best Moment

↓

Army Lists

↓

Mission Objectives

↓

Battlefield Conditions

↓

Stream / VOD

↓

Verification

---

# Mission Dossier

Purpose

Establish the battle.

Display:

Mission Name

Division

League

Round

Date

Match ID

Verification Status

Classification

Example

Verified

League

Tournament

Casual

---

# Winner Panel

Display

Operator Badge

Player Name

Preferred Army

Current Rank

Tournament Points

Victory Points

Winner banner

Reuse existing production data.

---

# Loser Panel

Display

Operator Badge

Player Name

Preferred Army

Current Rank

Tournament Points

Victory Points

Defeated banner

Reuse existing production data.

---

# Scoreboard

Display

Objective Points

Tournament Points

Victory Points

Winner highlighted.

Support draws.

When a draw occurs:

Display

DRAW

instead of Winner / Defeated.

---

# Mission Summary

Display

Game Type

Deployment

First Turn

Time Limit

Special Rules

Mission Notes

Reuse existing report data.

---

# Timeline

Display chronological events.

Examples

Deployment

First Objective

Key Engagement

Critical Turn

Final Push

Mission Complete

Scrollable.

---

# Career Highlight

Replace "Best Moment".

Display

Career Highlight

or

Battle Highlight

Use submitted Best Moment.

If unavailable:

"No highlight submitted."

---

# Army Lists

Display both armies.

Include:

Army

SWC

Points

Lists

Links to Army List Vault (future)

---

# Battlefield Conditions

Display

Terrain

Visibility

Weather

Special Conditions

Mission Hazards

Only display data that exists.

---

# Mission Objectives

Display all objectives.

Each objective marked:

Completed

Failed

Not Attempted

Reuse production mission data.

---

# Stream / VOD

If a stream exists:

Display embedded thumbnail and link.

If no stream exists:

Hide panel.

Do not display an empty state.

---

# Verification

Display

Reported By

Verified By

Report Date

Verification Status

Only if verification exists.

---

# Navigation

Bottom navigation

Previous Battle

Back to Battle Reports

Next Battle

Reuse routing.

---

# Operator Badges

Replace player portraits with the shared Operator Badge component.

Use the same component implemented for Player Profile.

---

# Typography

Use DesignSystem.md.

---

# Color Palette

Use DesignSystem.md.

---

# Motion

Allowed

Fade

Glow

Slide

Maximum

200 ms

No decorative animation.

---

# Mobile

Winner panel stacks.

Timeline becomes collapsible.

Army lists stack vertically.

No horizontal scrolling.

---

# Accessibility

Maintain WCAG AA.

Keyboard navigation.

Text alternatives for icons.

---

# Performance

No backend changes.

No new API calls.

No duplicate calculations.

Reuse existing battle report data.

Lazy-load embedded media.

---

# Definition of Done

Battle Report Version 1.0 is complete when:

✓ Matches battle-report-concept-v1.png

✓ Uses Operator Badge

✓ Uses DesignSystem.md

✓ Uses live production data

✓ Supports wins and draws

✓ Responsive

✓ Accessible

✓ Performance maintained

---

# Success Criteria

Every completed game should feel like a permanent military record.

Players should want to share Battle Reports as the definitive record of their games.