# Aurora VII — adopted scoring amendment

Adopted 15 November 2026. Effective from Turn 1 in the portal. At adoption, the portal had no published Turn and no recorded campaign games. Existing stored publications and prepared Turns, if any, retain their original revision; there are no retrospective scoring changes.

This amendment bounds scoring contributions, adds the Hidden Hand threshold, resolves territorial ties and makes counted results visible. It preserves faction identities and the separate territorial and Narrative contests. It does not promise equal outcomes between players of different skill.

## Campaign design retained

All territories start uncontrolled. There are no starting territory packages and no starting-package compensation points.

Faction-specific Doctrines and distinct territory-owner advantages remain. Harmony retains its restriction on Camouflaged State and +3 Discover. Ember retains its Super-Jump restriction. The approved Korin TAG eligibility rule remains: Terrain (Mountain) or Terrain (Total) is required. Individual territory effects and owner benefits are unchanged. From Turn 3, the approved preparation rules limit an owner to active advantages in up to two vulnerable territories.

## Adoption and authority

The public Player Rules announce revision `2026-11-balance` before Turn 1. New campaign publications start with this revision and the fixed tie priority below. Include the amendment in every Turn briefing before decisions or games. The portal snapshots the revision when operations are prepared. Previously prepared Turns retain their original rules, including completed awards. The public Player Rules are the amendment notice. This amendment takes precedence over older PDFs and faction briefs only on the subjects it changes.

Do not change an active Turn's rules in response to its results. Publication rejects same-Turn activation, and operations rejects a different revision or priority between preparation and opening games. The selected revision and faction tie priority remain fixed after adoption. No messages are sent by this change.

The scoring provisions below are enforced by the portal. Secret Objective requirements, territory rules, faction Doctrines and Turn-by-Turn vulnerability announcements are retained.

## 1. Count five faction results, at most two per player

For each faction, each Campaign Turn and each location, count the best five eligible player results, subject to a maximum of two from one registered player. Each Vulnerable Territory is a location; the Narrative Mission is a separate location with the same cap. Eligibility still requires confirmation or commissioner approval, including strict on-time submission and duplicate checks.

Order results by TP descending, OP descending, earlier original submission timestamp, then report ID. Greedily take results in that order while respecting both limits. Recalculate until resolution: a stronger later result can replace an earlier result. The two players in one report are evaluated independently. Correcting or rejecting a report recalculates selection. Freeze the selected results with the committed Turn outcome.

Counted TP and the OP from those same results feed Influence, support conversions, Infiltration comparisons, Narrative scoring and all campaign TP/OP tie-break totals. Apply separately earned support or Narrative bonuses afterwards; they do not occupy a result slot, create OP, or satisfy a requirement to play. For a campaign-end TP/OP tie-break, add each Turn's official counted totals under that Turn's own revision; do not retrospectively cap older Turns.

All legitimate games remain in battle history and personal performance statistics. Opponents remain free to replay one another; the caps still apply. Any valid game can supply game-based Secret Objective evidence under its written conditions, whether or not its TP/OP are selected by the scoring cap. An employer still cannot claim hired players' victories as its own.

### Worked example

| Player | Raw TP results at one location | Results counted | Counted TP |
|---|---|---|---:|
| A | 5, 5, 5, 5, 5 | Best two | 10 |
| B | 4, 4 | Both | 8 |
| C | 4 | One | 4 |
| **Faction** | **8 results / 37 raw TP** | **5 results** | **22** |

A alone cannot fill all five slots. Twenty perfect wins from A still contribute 10 TP at this location. Three active players can fill five slots; a faction with two active players can fill four. This reduces the effect of unlimited activity but does not eliminate differences in skill, roster size or opponent availability. A player can still contribute at several locations, and extra attempts can improve which results make the best five. The cap bounds counted impact rather than eliminating every benefit of additional play. Before a new campaign, aim for at least three realistically active players per faction; registration totals alone do not establish that. A full five-result allocation contains at most two results from one player; that is not a guarantee that their share of TP is at most 40%.

## 2. Require participation for rewards

- **Tohaa:** the declared outcome must occur and Tohaa must earn at least five counted territorial TP at its selected target. Hired support cannot meet this personal faction threshold. Its existing conversion from own TP to support is unchanged.
- **Combined Army:** at least one of its own counted target games is required before an Infiltration can succeed. The existing comparison and complete-tie failure rules remain.
- **Narrative winner:** at least one of the faction's own counted Narrative games is required. Bonus-only factions are ineligible; determine the winner among eligible factions.
- **Successful defence:** the controller must earn at least one of its own counted TP at that territory. Another faction's activity does not make a passive hold an active defence.

These gates distinguish a successful operation from an outcome that happened without that faction participating. They do not require Tohaa to prove its support was the decisive point: that would punish useful cooperation whenever the beneficiary won comfortably.

## 3. Resolve territorial ties among the actual leaders

Compare Influence, then the faction's own counted OP. If all Influence is zero, retain the controller. With a positive tied leading score, retain the incumbent only if it is one of the tied leaders. Otherwise the tied faction appearing first in the public faction priority takes control.

The priority was drawn once on 15 November 2026 before any portal Turn or games and is published with this amendment:

**ALEPH → Haqqislam → Nomads → Yu Jing → Tohaa → NA2 → JSA → Ariadna → PanOceania → O-12 → Combined Army.**

Only factions eligible for territorial control can win a territorial tie. The full eleven-faction ordering is retained for the fixed public record. Do not redraw or reorder it after seeing results. The portal validates and locks the order.

Draw record: the system generated one random 256-bit seed, `fadf3f2e584aff403f79a0469e42b56a30d986e67919ceb99d1c8b02b75af013`. Sort the hexadecimal SHA-256 digest of `seed + newline + canonical faction name` in ascending order. The seed and result are committed in `shared/aurora-rules-adoption.mjs`; the release test reproduces the order.

Example: Ariadna and Yu Jing each have 10 Influence and 16 OP, while incumbent PanOceania has zero. PanOceania cannot retain the territory through this tie. The published priority selects between Ariadna and Yu Jing. If PanOceania also has 10/16, it retains as a tied leader.

Narrative complete ties remain unresolved. Infiltration complete ties still fail.

## 4. Retain faction-specific Doctrines

Keep each faction's existing Doctrine condition and the limits of one Doctrine VP per Turn and three for the campaign. The proposed common eight-TP-and-control alternative has been withdrawn. It is removed from the scoring engine and public rules.

A Doctrine being unavailable in a particular Turn is not automatically a design defect: circumstances are part of its identity. Review whether the vulnerability schedule repeatedly denies a faction any realistic opportunity across the campaign. Address a persistent problem through the calendar or an individually discussed revision to that faction's Doctrine. No replacement wording or guaranteed every-Turn scoring route is introduced.

## 5. Secret Objectives follow their written conditions

One active objective per faction; assign before games. At most one completion per Turn, worth two VP, with the existing six-VP campaign maximum. Never assign an objective after seeing results or change its requirements after play begins.

There is no additional blanket requirement to play a game in the active Turn. Objectives expressly checking existing holdings or Infiltrations can qualify through earlier progress. Any valid game can fulfil a game-based objective according to its written conditions, even when that result is excluded by the scoring cap. Later changes to the counted pool do not invalidate otherwise valid objective evidence. An employer cannot claim hired players' victories as its own.

An objective requiring a successful Hidden Hand operation still requires that operation to succeed, including the five own counted target TP threshold. This is the Hidden Hand condition, not a separate objective-participation rule.

The software enforces the global pre-game assignment lock, exact-Turn adjudication, expiry on resolution, retained reissue history, no repeat of completed objectives, one completion and the six-VP cap. From Turn 3, failed assignments receive the private two-option choice with a designated deadline default. The commissioner reviews the actual requirement and evidence. No assigned objective has been rewritten.

## 6. Vulnerability announcements

Continue announcing the four Vulnerable Territories Turn by Turn. From Turn 3, resolve mandatory/exclusion rewards, then the trailing Conquest faction’s nomination, and publish all four together. This does not introduce a full advance calendar or fixed rotation.

## 7. Make capped scoring transparent

The existing TP formula is straightforward. The portal shows which results the caps select; it is not a finding that the current TP formula is confusing.

The live TP schedule is authoritative: win 4, draw 2, loss 0; add one for at least five OP, and add one to a loser whose OP deficit is at most two. The older 3/1/0 fallback does not apply to this schedule. An 8–6 result is 5–2 TP.

Publish the exact reporting deadline and timezone before games. Once games open, freeze it. Late reports do not count and cannot be approved. Timely records may still be corrected or reviewed; confirmation verifies a report, while the scoring cap determines inclusion.

Show the rules revision, raw battle history, each side's counted/excluded reason, counted faction totals, and the resolved public outcome. Keep hidden targets, contracts and objective details private.

Do not add an undisclosed handicap for Lobo or any other player. Apply caps and eligibility rules uniformly. Strong play should matter; extra availability should have a bounded campaign effect.

## Validation and rollout

Automated checks cover scenarios for capped selection, replacement after correction/rejection, twenty perfect wins by one player, independent sides of a report, location/Turn separation, late/duplicate gates, the participation checks, territorial ties, preservation of faction-specific Doctrine conditions, objective limits, frozen legacy rules and consistency between live totals and private resolution.

Deploy the backend and frontend from the same reviewed release and verify both before opening campaign play. Run the existing Aurora game, operations, registration and publication checks, plus the new balance checks. Verify the amendment in an isolated practice campaign. The live portal publishes the adopted rules before Turn 1; publish that Turn's normal territory and mission briefing, retain the written objective conditions, and then open play. The stored briefing source now links to the active revision, and its obsolete NA2 rules are corrected to match the October guide. The 16 November consolidation updates the Player, GM, Special Rules and Terrain guides and embeds the operative rules in the stored briefing bodies. Existing Discord messages are not changed or sent. See `aurora-turn3-release-20261116.md` for the complete preparation procedure.
