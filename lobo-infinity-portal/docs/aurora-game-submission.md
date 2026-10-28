# Aurora VII game submission

A registered player submits one game for both participants at `/campaign/aurora-vii/submit`. Names and factions are read from the registration ledger. The form uses the announced Turn, four Vulnerable Territories and mission rotation; the active Narrative Mission is selected automatically. Map/terrain, notes, army codes and HTTPS photo links are optional.

Both OP scores are reviewed before submission. TP uses win 4, draw 2, loss 0; +1 at 5+ OP; +1 for losing by 1–2 OP. The server recomputes scores rather than trusting browser-supplied TP or factions.

The saved game provides a copyable verification link. A Discord DM is attempted after durable storage; disabled DMs cannot undo the submission. The link opens the review screen after Discord sign-in, and only the registered opponent or commissioner can confirm. Confirmation is bound to the latest game revision.

Players request corrections instead of editing records. The commissioner’s existing Aurora publication screen includes games, totals and private claims. Corrections retain old values and explanations, invalidate prior confirmation and notify the opponent again. The commissioner can override, reject duplicates or authorize late results. Potential duplicate submissions remain excluded until reviewed, allowing legitimate repeat battles to be approved. Previously announced Turn snapshots allow late requests without revealing future material.

Secret-objective claims are separate, visible only to the claimant and commissioner. They never appear in opponent responses, public totals or game notifications. Claim approval alone does not award VP. In protected Campaign operations, the commissioner links an approved claim to an assigned objective and records its capped reward. Control, faction systems, Doctrines and Campaign VP use the private, reviewed resolution workflow documented in `aurora-operations.md`.

Private games are stored on the existing single-replica Railway volume at `/data/aurora-vii-games.json`. Writes serialize, fsync and rename atomically. Corrupt storage fails closed. Confirmed submission totals are separate from GM-published bulletin totals and ordinary portal game records. Narrative TP/OP never contributes to territorial totals. No map display changes are included.

Checks: `npm run test:aurora-games`, `npm run test:aurora-registration`, production build, and `node scripts/aurora-games-browser-check.mjs`. The browser check uses an isolated temporary ledger and simulated identities; it sends no real messages and writes no production games.

## Campaign player experience

The Standings & Battles page and map use the same confirmed-game activity feed.
Battle cards show the public score record and link players to the authenticated
review/correction page. Narrative TP/OP remains separate. Live totals are not
added to the separately published GM checkpoint. Campaign VP and territory control
remain GM-published results, with live Conquest leaders marked provisional.

Before Turn 1, the overview prioritizes registration and explains when game
reporting opens. Player Rules include the TP calculation and an 8–6 OP example.
Mobile interior pages use a compact header and page selector; the map fits the
screen with activity markers and a full-size territory selector.

Commissioners can open the live registration form at
`/commissioner/aurora-vii/registration`, linked from campaign administration.
Commissioner authentication and player Discord registration remain distinct.

After building, run `scripts/aurora-campaign-experience-check.mjs` with
`CAMPAIGN_TEST_CHROMIUM` when a system Chromium is used. Its local fixture build
requires a non-secret `VITE_API_URL` such as `http://localhost/api/fixture`.
The test mocks commissioner authentication locally and checks actual temporary
ledger confirmation, battle history, narrative separation, failed refreshes,
mobile navigation/map selection and commissioner registration access. It sends
no production games, claims or Discord messages.

## Focused campaign layout

Aurora VII public routes use a compact campaign header and three primary links:
Campaign, Map and Results. Missions, rules, story, registration and commissioner
tools remain available under Information. My Games and the campaign-specific
primary action remain accessible in the header. The unrelated portal sidebar,
league navigation, generic game submission, breadcrumbs and mobile bottom bar
are omitted only on Aurora VII public routes; leaving the campaign restores them.

The overview combines one current status with a short briefing and map preview.
The map shows its selected territory and confirmed activity near the top; full
location descriptions and terrain guides are available on permanent territory
pages. Map options, narrative activity and supporting rules use disclosures.
Public battle history uses expandable rows, and hash links open the matching
confirmed record. Empty results use a single explanatory state. Campaign
scoring, confirmation, correction, privacy and commissioner controls are unchanged.

The experience check also verifies the focused shell, compact record rows,
320px phone layout, map position, guide access and portal navigation restoration.

Campaign games require opponents from different registered factions. Same-faction opponents are excluded from the form and rejected by the ledger for both Territory Battles and Narrative Missions, including late submissions. The commissioner cannot approve a same-faction result.

Public Map and Results activity checks run every five minutes while visible. Visibility changes within that interval do not trigger extra checks. Successful public activity is shared in Vercel’s CDN for 60 seconds; browser caching is disabled. Manual Refresh uses a fixed uncached refresh endpoint to get current results. Errors, game submissions, participant reviews, and private claims remain uncached. The portal snapshot schedule is unchanged.

## Campaign location selection

Players may agree to play in one of the current Turn’s Vulnerable Territories or the active Narrative Mission. If they cannot agree, both secretly bid Command Tokens and reveal simultaneously.

- Different bids: the higher bidder loses the number of Command Tokens they bid and chooses the location. The lower bidder keeps their Command Tokens.
- Equal bids: both players lose the number of Command Tokens they bid, then roll off. The die-roll winner chooses the location.

For a territory battle, then make a separate Face-to-Face roll; the winner chooses one of the Turn’s two ordinary missions. A Narrative game uses the active Narrative Mission sheet. Campaign location selection does not assign a particular tabletop terrain layout.


## Test reporting before Turn 1

Commissioner administration links to `/commissioner/aurora-vii/reporting-test`. It requires the normal commissioner session and works even when the live campaign is at Turn 0. The sample Turn and two sample players do not change the public campaign or real registration. Submit a practice result, review the computed TP, and use the generated verification link to open it as the practice opponent. The opponent can confirm or request a correction; **Test as → Practice commissioner** exposes the existing correction/review controls. Switch back to the opponent to confirm the corrected revision. The role switch is a commissioner-only simulation; it does not replace a real Discord authentication test.

Practice uses the same game store, validation, scoring, participant authorization, revisions and review components with a distinct storage instance at `<AURORA_GAMES_PATH>.practice.json` (default `/data/aurora-vii-games.json.practice.json`). No live publication or registration data is passed into practice actions, and no Discord delivery call is made. Public activity and operations read only the original live ledger. Practice writes retain commissioner authentication, same-origin checks, JSON size limits and no-store responses. Reset is enabled only on the practice store; the live store rejects reset.

Run `npm run test:aurora-games` for practice isolation and real-game regressions. Run `npm run test:aurora-reporting-practice:browser` after a fixture build using the same `CAMPAIGN_TEST_DIST` / `CAMPAIGN_TEST_CHROMIUM` options as the commissioner browser checks.
