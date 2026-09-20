# Optional Mobile Gunfighter ranking

Mobile Gunfighter is an opt-in 85/15 comparison. Existing Gunfighter, ARO, close-combat and Mobility scores remain separate.

For each exact sectorial/unit/group/option/physical-form key with valid combat and Mobility scores, normalize the raw Gunfighter rating against a fixed anchor: `min(100, max(0, Gunfighter ÷ 50 × 100))`. The combined score is `0.85 × anchored Gunfighter + 0.15 × raw Mobility`. A Gunfighter rating of 50 therefore maps to 100, and higher ratings remain capped at 100. Gunfighter and Mobility percentiles are retained as informational context only; they do not affect the combined score. The result is not a win probability. It is sorted at full precision and displayed to one decimal place.

The initial catalog includes 13,146 normal and 3,606 linked exact profiles. Exact sectorial entries are retained as in the approved comparison report; repeated sectorial availability affects percentile distributions. Missing entries, unresolved movement and forms without MOV do not receive zero scores or borrow ratings from another form. Combined lookup requires an exact five-part key, including the group.

## Use

- Discord: `/inf-list army-code:<code> mobile-gunfighter:true`. Omitting the option retains the existing output. The text command retains its existing behavior.
- Army Intelligence (both public snapshot and full page): enable **Show Mobile Gunfighter ranking (85/15)** below the Mobility cards. Choose **Non-linked** or **Linked +1SD potential**. The shared catalog is downloaded only after enabling the view.

Each card shows the combined score, original and anchored Gunfighter scores, raw Mobility score, and informational cohort percentiles. Portal cards include submitted weapons to distinguish loadouts.

The bot lists up to four profiles per state. Its linked section requires a catalog linked state and sufficient compatible submitted profiles under the existing Fireteam eligibility checks. It remains potential performance: an active legal Fireteam is required. The portal's linked comparison shows catalog potential and explicitly does not assert that the selected lists form active legal Fireteams.

## Regeneration and verification

Run `npm run mobile-gunfighter:build` after changing either source catalog. The shared projection is `src/data/mobile-gunfighter.json`. Its fingerprint includes both source fingerprints, weights, coverage, keys and records. The bot rejects an opted-in render if source fingerprints disagree. The production build gate runs `npm run test:mobile-gunfighter`, which checks source fingerprints and rating parity.

Tests cover the fixed Gunfighter anchor and cap, manually calculated raw blends, percentile metadata, independent states, exact form/faction matching, absent linked states, default-off behavior, slash-option propagation, Fireteam filtering, unchanged classifications and rendered markup. Browser image layout and a real Discord command invocation are separate from the automated markup test.

The anchored formula prevents cohort compression from making modest Gunfighter ratings look elite merely because many profiles cluster lower in the distribution. Keep this as an optional preference-weighted view, not the default Gunfighter ranking.
