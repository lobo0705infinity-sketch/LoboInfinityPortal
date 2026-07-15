# Operation Facelift 3.0
# Battle Report
# Implementation Notes

Version: 1.0

Status: APPROVED

Artwork Reference:
battle-report-concept-v1.png

---

# Purpose

Implement the Battle Report exactly as approved.

This is a presentation release.

Do not modify gameplay logic.

Do not modify battle report calculations.

---

# Scope

Modify:

Battle Report only.

Do not modify:

- Dashboard
- Player Profile
- Players
- Hall of Fame
- Standings
- Commissioner
- Submit Game
- Team Tournament

---

# Architecture

Preserve:

- Event Engine
- Authentication
- Routing
- Smart Cache
- Analytics
- Firestore
- Apps Script

No backend changes.

No API changes.

No new repositories.

---

# Live Data Policy

Never hardcode:

- Winner
- Loser
- Mission
- Score
- Timeline
- TP
- OP
- VP
- Army
- Battle Highlight
- Verification
- Stream

Everything comes from existing production data.

---

# Data Binding Matrix

| Component | Production Source |
|-----------|-------------------|
| Winner | Battle Report |
| Loser | Battle Report |
| Mission | Battle Report |
| Timeline | Battle Report Timeline |
| Battle Highlight | Best Moment |
| Army Lists | Existing Army Lists |
| Mission Objectives | Mission Data |
| Battlefield Conditions | Mission Data |
| Verification | Report Verification |
| Stream | Existing Stream Repository |

Reuse existing production APIs.

No duplicate API requests.

---

# Operator Badge

Replace all player portraits with the shared:

OperatorBadge

component.

Do not implement another badge.

Reuse the shared component.

---

# Winner / Draw Support

Support:

Winner

↓

Loser

AND

Draw

When a draw occurs:

- No winner banner
- No defeated banner
- Equal presentation for both players

---

# Timeline

Reuse existing report timeline.

If no timeline exists:

Generate only from existing report milestones.

Do not fabricate events.

---

# Battle Highlight

Reuse existing Best Moment.

Display:

Battle Highlight

If unavailable:

"No Battle Highlight submitted."

---

# Stream Panel

If a linked stream exists:

Display.

Otherwise:

Hide the panel.

Do not render empty placeholders.

---

# Verification

Display only verified information.

Do not fabricate verifier data.

Hide unavailable fields.

---

# Typography

Use DesignSystem.md.

No additional fonts.

---

# Colors

Use DesignSystem.md.

Winner

HUD Cyan

Loser

Command Red

Draw

Warning Amber

---

# Motion

Allowed

- Fade
- Glow
- Slide

Maximum

200 ms

No decorative animation.

---

# Mobile

Winner panel stacks.

Army lists stack.

Timeline collapses.

Operator Badges scale responsively.

No horizontal scrolling.

---

# Accessibility

Maintain WCAG AA.

Keyboard navigation.

Icons require labels.

Timeline entries require text.

---

# Performance

No backend changes.

No startup request increase.

No duplicate calculations.

Reuse existing APIs.

Lazy-load embedded media.

Reuse OperatorBadge.

---

# Validation

Verify:

Desktop

Tablet

Mobile

Winner

Draw

Battle Highlight

Timeline

Army Lists

Mission Objectives

Verification

Operator Badge

Accessibility

Performance

---

# Release Gates

Must pass

- npm run lint
- npm run build
- Battle Report regression tests
- Responsive validation
- Accessibility validation
- Performance validation

No startup bundle regression.

---

# Definition of Done

✓ Matches battle-report-concept-v1.png

✓ Uses OperatorBadge

✓ Uses DesignSystem.md

✓ Uses live production data

✓ Supports wins

✓ Supports draws

✓ Responsive

✓ Accessible

✓ Performance maintained

✓ No placeholder values remain

---

# Engineering Principle

Every Battle Report should feel like an official O-12 After Action Report.

Presentation changes only.

No gameplay logic changes.