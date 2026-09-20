# Profile and mobility audit corrections

The September 20 audit found four defects: Climbing Plus whole-order vertical travel omitted Climb + Move; included companions/operators were skipped because their options were disabled for standalone selection; tactical +1SD checks treated any legal team as Level 2; and inherited display weapons contaminated exact loadouts.

This revision:
- Uses Climb + second MOV for Climbing Plus vertical travel, with Motorcycle/Aerial restrictions retained. Mobility index and scenario versions advance to v2.
- Traverses included options recursively from selectable loadouts, detects missing references, and handles cycles without duplicate profiles. Adds 388 exact profiles: 13,554 total, 13,534 rated, 16 without MOV, four unresolved Terrain specifications.
- Shares one list-level Fireteam check between bot and portal: matching units/composition terms, legal capacity, chart member limits, required members, same combat group, and a qualifying subset containing the rated model. This remains potential performance; it does not assert an active tabletop Fireteam.
- Retains FTO restrictions and excludes Peripheral profiles from inherited linked eligibility. The 85/15 cohort contains 13,534 normal and 3,614 linked profiles.
- Overlays official exact loadout weapons and Fireteam memberships on saved portal lists. The bot and future canonical enrichment also use exact official weapon references when available.
- Keeps Gunfighter raw scores and the approved 85/15 formula unchanged. Percentiles are regenerated against the corrected cohorts.

Generated data comes from the complete 58-faction official capture used for the original mobility catalog (Army versions 7.26246.158/.159). Rebuild in order: build-mobility-catalog.mjs, build-profile-audit-catalog.mjs, mobility:build, mobile-gunfighter:build. Both capture-based scripts accept the official capture JSON path; the mobility catalog builder additionally takes its output path.

Regression coverage: Climb + Move, prohibited climbing, recursive/cyclic companion inclusion, mixed versus matching Duos, repeated identical loadouts, member limits, required members, target-specific capacity, combat-group separation, exact Vertigo weapon repair and Crabbot linked exclusion. Existing full-catalog score/fingerprint checks and bot/portal tactical parity remain in place.

Rules: https://infinitythewiki.com/Climbing_Plus ; https://infinitythewiki.com/Fireteam_Bonuses ; https://infinitythewiki.com/Fireteams:_Basic_Rules
