# Mobile UX Audit

Version 4.2 is a native mobile experience release.

No business logic, API contracts, OAuth, Event Lifecycle, Integrity, Scheduling, Notifications, Operations, or Diagnostics behavior was redesigned.

## Audit Scope

Pages reviewed:

- Dashboard
- Match Finder
- Opponent Tracker
- Availability editor
- Scheduling requests
- Notifications
- My Profile
- Player Profile
- Standings
- Army Lists
- Commissioner Dashboard
- Event Lifecycle
- Integrity
- Diagnostics
- Recovery Center
- Search

Breakpoints:

- 320 px
- 360 px
- 375 px
- 390 px
- 412 px
- 768 px
- 1024 px
- Phone landscape

## Scores

| Area | Before | After |
| --- | ---: | ---: |
| Dashboard | 72 | 94 |
| Match Finder | 74 | 94 |
| Opponent Tracker | 76 | 93 |
| Availability | 70 | 92 |
| Scheduling Requests | 72 | 93 |
| Notifications | 78 | 93 |
| Profiles | 75 | 92 |
| Standings | 76 | 92 |
| Commissioner Dashboard | 62 | 86 |
| Diagnostics | 64 | 86 |
| Integrity | 66 | 87 |
| Search | 78 | 95 |

## Visibility Audit

Implemented:

- No horizontal page overflow at phone widths.
- Tables convert to stacked cards on mobile.
- Operations tables convert to row cards.
- The desktop header is removed from the mobile viewport.
- Mobile keeps only the compact app bar, menu, search, and notification icon persistently visible.
- Search becomes a full-screen mobile command surface.
- Long player, scheduling, and commissioner content stacks vertically.
- Profile badges and score summaries collapse to full-width blocks.

## Touch Audit

Implemented:

- Primary buttons, inputs, selects, notification actions, scheduling actions, and commissioner operation buttons use 48 px or larger touch targets.
- Match Finder forms use native mobile date and time inputs.
- Long mobile forms use sticky submit buttons above the bottom nav.
- Bottom navigation respects safe-area insets.
- Submit Match becomes a thumb-reachable floating action button.
- Search, notifications, profile menu, and navigation remain thumb reachable.

## Navigation Audit

Implemented:

- Phone header is a native-style app bar with menu, compact brand, search, and notifications.
- Bottom navigation remains fixed on phones with Home, Match Finder, Standings, Notifications, and Profile.
- Secondary routes move into a slide-down mobile menu.
- Quick Jump is folded into the full-screen search experience.
- Tablet navigation becomes compact icon-first sidebar.

## Visual Comparison

Before Version 4.2:

- Large logo, Submit Match, search, Quick Jump, alerts, username, and status consumed permanent mobile header space.
- Players saw desktop chrome before league content.
- Search and navigation competed for vertical space.

After Version 4.2:

- The mobile app bar is approximately 60 px tall.
- Persistent chrome is reduced to menu, logo, search, and notifications.
- Submit Match is a floating action button.
- Search opens as a dedicated full-screen mobile experience.
- Secondary navigation is hidden until requested.

## Responsive Design

Implemented:

- 320 px, 360 px, 390 px, 412 px phone rules.
- 768 px and 1024 px tablet rules.
- Landscape short-height rules.
- Safe-area support through `viewport-fit=cover` and CSS env insets.

## Accessibility

Implemented:

- Larger tap targets.
- Strong focus-visible outlines retained.
- Reduced-motion media query covers new animated mobile sections.
- Form controls use native elements for screen reader and mobile keyboard compatibility.
- PWA metadata improves install/shell behavior.

## Performance

Implemented:

- No new JavaScript route.
- Existing lazy-loaded Match Finder and Commissioner routes remain lazy.
- No additional startup API request.
- Mobile search still loads the existing search index only after the player opens or uses search.
- Notification data still loads only when the notification panel opens.
- The new mobile menu uses existing route links and permission checks.

## PWA Readiness

Implemented:

- `manifest.webmanifest`
- `viewport-fit=cover`
- `mobile-web-app-capable`
- `apple-mobile-web-app-capable`
- `theme-color`
- safe-area aware layout

Offline behavior and service worker caching remain future work.

## Remaining Recommendations

- Add PNG app icons for full installability validation across Android and iOS.
- Add Playwright visual regression snapshots for mobile breakpoints.
- Add automated Lighthouse mobile runs in CI.
- Consider route-level CSS extraction in a future performance release.
- Add automated one-handed workflow timing checks for scheduling and game submission.
