# Operation Facelift 2.0
# Dashboard Design Specification

Version: 2.1

Status: APPROVED

Artwork Reference:
dashboard-concept-v2.1.png

---

# Purpose

The Dashboard is the operational command center of the Lobo Infinity Portal.

It should communicate the current state of the league within five seconds.

Every visual element should answer one question:

- What is happening?
- What should I do next?
- What is my current status?
- What is happening in the community?

The Dashboard is not a collection of widgets.

It is a tactical command console.

---

# Primary Design Goal

The Dashboard should immediately feel like software operating inside the Infinity universe.

Visual priorities:

- Tactical
- Military
- Industrial
- Information dense
- Clean
- Premium

Lobo provides identity.

Infinity provides atmosphere.

League data remains the primary focus.

---

# Layout

The Dashboard is divided into six zones.

```
Hero Banner

↓

Operational Status Row

↓

Live Transmissions

Commander Overview

↓

Weekly Operations

Community Intelligence
```

Everything above this line should fit comfortably on a desktop display without excessive scrolling.

---

# Hero Banner

Purpose

Establish atmosphere.

Present the portal as:

LOBO COMMAND NETWORK

The artwork should depict an Infinity-style command bridge.

The artwork is decorative.

The operational information remains the focus.

---

## Height

Desktop

420 px

Tablet

320 px

Mobile

220 px

---

## Overlay

Display:

LOBO COMMAND NETWORK

Season

Week

Operational Status

Example

Season 1 • Week 11 of 20

Operational

Last Sync

Overlay remains live data.

---

# Operational Status Row

Replace generic dashboard statistics.

Every tile answers one question.

Cards

Season Status

Season Progress

Reports Awaiting Approval

Live Streams

Your Rank

Your Division

No ambiguous labels.

Every subtitle should be understandable by a first-time player.

---

# Season Status

Display

Operational

Current Season

Current Week

Example

Season 1 • Week 11

---

# Season Progress

Display

Percentage Complete

Games Completed

Games Remaining

Example

61%

16 of 26 Games Completed

---

# Reports Awaiting Approval

Commissioners

Pending approvals.

Players

Recently submitted reports.

The card adapts to user permissions.

---

# Live Streams

Display

Current live streams.

If none are live

Display

No Streams Live

rather than an empty panel.

---

# Your Rank

Always refers to the authenticated user.

Never the league leader.

Display

Current Rank

Division

Movement indicator (future)

---

# Your Division

Display

Division Name

Number of Players

League

---

# Live Transmissions

Purpose

Present real-time league intelligence.

Every transmission resembles an incoming command message.

Each entry contains

Time

Category

Headline

Mission

Result

Primary Action

Examples

Combat Report Received

Report Approved

Stream Started

Achievement Unlocked

Player Joined

Mission Rotation Updated

Each transmission uses an appropriate icon.

Maximum

10 entries.

Scrollable.

---

# Commander Overview

Purpose

Highlight the current league leader.

Display

Current Leader

Record

Tournament Points

Win Streak

Division

Favorite Army

Portrait placeholder

This panel represents the strongest current player.

---

# Weekly Operations

Purpose

Present the commissioner's current mission briefing.

Display

Mission Alpha

Mission Bravo

Maps

Remaining Days

Operations should resemble a military briefing.

Read only.

---

# Community Intelligence

Display

Most Active Player

Most Played Army

Most Played Mission

Featured Stream

Latest Achievement

Compact tactical summaries only.

---

# Navigation

Use existing production navigation.

Do not invent new menu items.

Presentation may change.

Behavior must not.

---

# Tactical Card Component

All Dashboard cards use the shared Tactical Card.

Appearance

Gunmetal

Thin cyan border

Angular corners

Low elevation

Soft glow

No Bootstrap appearance.

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

Large values remain highly legible.

---

# Color Palette

Use

DesignSystem.md

No page-specific colors.

---

# Motion

Allowed

Fade

Glow

Slide

Scanline

Maximum

200 ms

No decorative motion.

---

# Mobile

Hero compresses.

Operational cards wrap.

Live Transmissions remain immediately visible.

Commander Overview follows.

Weekly Operations follows.

No horizontal scrolling.

---

# Accessibility

Maintain WCAG AA.

Visible keyboard focus.

Readable typography.

Icons require text.

Do not communicate status using color alone.

---

# Performance

No backend changes.

No additional API requests.

No duplicate calculations.

Hero artwork lazy-loaded.

Maintain startup bundle budget.

---

# Definition of Done

Dashboard implementation is complete when

✓ Matches dashboard-concept-v2.1.png

✓ Uses live production data

✓ Uses Tactical Card component

✓ Uses DesignSystem.md

✓ Preserves existing functionality

✓ No placeholder values remain

✓ Responsive

✓ Accessible

✓ Performance maintained

---

# Success Criteria

A first-time visitor should immediately understand:

- League health
- Current progress
- Their personal status
- Current operations
- Current community activity

without needing to explore the rest of the application.

The Dashboard should feel like an operational command center rather than a statistics page.