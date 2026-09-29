# PR 34 story-engine release visual waiver

Authorized on 2026-09-29 for this release only.

## Waived checks

- The `/profile` visual surfaces and their approved baselines:
  `my-profile-desktop-dashboard`, `my-profile-edit-profile`,
  `my-profile-competitive-coaching`, `my-profile-advanced-analytics`, and
  `my-profile-mobile-dashboard`.
- The `/commissioner` visual fixture's `Automation` and `System` marker checks
  and its approved `commissioner-sidebar-desktop` baseline comparison.

## Reason

Those fixtures predate the snapshot-native public shell and current
commissioner authentication flow. On the protected PR preview, `/profile`
correctly resolves through the snapshot-native shell, where that legacy route
is not present, and `/commissioner` correctly renders the current commissioner
login/setup state rather than the obsolete authenticated fixture. The failures
therefore do not exercise the battle-story change.

## Checks not waived

- Protected-preview production contract and promotion eligibility.
- Game and army-list submission page rendering.
- Commissioner login rendering.
- Battle Report story rendering.
- Canonical game submission, army-list decoding, story generation, and Discord
  delivery order.
- Discord delivery deduplication.
- Apps Script deployment identity and active version verification.
- Post-promotion production fingerprint, route, story, and backend verification.

The obsolete visual fixtures must be updated separately after this release.
