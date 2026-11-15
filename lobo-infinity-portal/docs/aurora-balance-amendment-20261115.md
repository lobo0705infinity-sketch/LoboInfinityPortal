# Aurora VII — balance amendment for review

Prepared 15 November 2026. Status: draft; no live campaign activation and no retrospective scoring changes.

This package addresses concentration of results, passive scoring, territorial ties and objective workload. It preserves faction identities and the separate territorial and Narrative contests. It does not promise equal outcomes between players of different skill.

## Campaign design retained

All territories start uncontrolled. There are no starting territory packages and no starting-package compensation points.

Faction-specific Doctrines and distinct territory-owner advantages remain. Harmony retains its restriction on Camouflaged State and +3 Discover. Ember retains its Super-Jump restriction. The approved Korin TAG eligibility rule remains: Terrain (Mountain) or Terrain (Total) is required. This scoring amendment does not redesign territory rules or bonuses.

## Adoption and authority

Choose the first affected Turn, announce the amendment to all factions before its decisions or games, and record `2026-11-balance` in that Turn's public briefing. The portal snapshots the revision when operations are prepared. Previously prepared Turns retain their original rules, including completed awards. Existing PDFs and faction briefs need an amendment notice naming that effective Turn; the amendment takes precedence only on the subjects it changes.

Do not change an active Turn's rules in response to its results. Publication rejects same-Turn activation, and operations rejects a different revision or priority between preparation and opening games. The selected revision and faction tie priority remain fixed after adoption. No messages are sent by this change.

The scoring and participation provisions below are implemented in the draft portal code. Objective difficulty review and the optional past-exposure review are commissioner procedures: they are not automatic calculations or a claim that existing games have been rebalanced.

## 1. Count five faction results, at most two per player

For each faction, each Campaign Turn and each location, count the best five eligible player results, subject to a maximum of two from one registered player. Each Vulnerable Territory is a location; the Narrative Mission is a separate location with the same cap. Eligibility still requires confirmation or commissioner approval, including the existing late/duplicate checks.

Order results by TP descending, OP descending, earlier original submission timestamp, then report ID. Greedily take results in that order while respecting both limits. Recalculate until resolution: a stronger later result can replace an earlier result. The two players in one report are evaluated independently. Correcting or rejecting a report recalculates selection. Freeze the selected results with the committed Turn outcome.

Counted TP and the OP from those same results feed Influence, support conversions, Infiltration comparisons, Narrative scoring and all campaign TP/OP tie-break totals. Apply separately earned support or Narrative bonuses afterwards; they do not occupy a result slot, create OP, or satisfy a requirement to play. For a campaign-end TP/OP tie-break, add each Turn's official counted totals under that Turn's own revision; do not retrospectively cap older Turns.

All legitimate games remain in battle history and personal performance statistics. Opponents remain free to replay one another; the caps still apply. Only counted results can supply game-based Secret Objective evidence under the amendment. An employer still cannot claim hired players' victories as its own.

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
- **Secret Objective:** a faction must play at least one of its own counted games that Turn. Where the requirement concerns a specific territory, its own relevant target participation must be verified as part of objective evidence.

These gates distinguish a successful operation from an outcome that happened without that faction participating. They do not require Tohaa to prove its support was the decisive point: that would punish useful cooperation whenever the beneficiary won comfortably.

## 3. Resolve territorial ties among the actual leaders

Compare Influence, then the faction's own counted OP. If all Influence is zero, retain the controller. With a positive tied leading score, retain the incumbent only if it is one of the tied leaders. Otherwise the tied faction appearing first in the public faction priority takes control.

Use the campaign's previously published random priority order if one exists. Otherwise draw all eleven factions once in public before the first amended Turn and publish the order. Do not let the GM choose the order or redraw it after seeing results. The portal requires every faction exactly once and locks the order after adoption.

Example: Ariadna and Yu Jing each have 10 Influence and 16 OP, while incumbent PanOceania has zero. PanOceania cannot retain the territory through this tie. The published priority selects between Ariadna and Yu Jing. If PanOceania also has 10/16, it retains as a tied leader.

Narrative complete ties remain unresolved. Infiltration complete ties still fail.

## 4. Retain faction-specific Doctrines

Keep each faction's existing Doctrine condition and the limits of one Doctrine VP per Turn and three for the campaign. The proposed common eight-TP-and-control alternative has been withdrawn. It is removed from the scoring engine and public rules.

A Doctrine being unavailable in a particular Turn is not automatically a design defect: circumstances are part of its identity. Review whether the vulnerability schedule repeatedly denies a faction any realistic opportunity across the campaign. Address a persistent problem through the calendar or an individually discussed revision to that faction's Doctrine. No replacement wording or guaranteed every-Turn scoring route is introduced by this draft.

## 5. Standardize Secret Objective effort

One active objective per faction; lock it before the Turn opens and before games. At most one completion per Turn, worth two VP, with the existing six-VP campaign maximum. Never assign an objective after seeing results. Older uncompleted objectives that are impossible under the new schedule or cap should be withdrawn with a recorded reason and replaced before play, without a VP penalty.

Use these assignment standards, keeping each faction's actual objective private:

| Objective type | Assignment standard |
|---|---|
| Battle performance | At most two counted wins; a diversity requirement may ask for two different opposing factions, not four |
| Territory operation | One named Vulnerable target, a specified capture/active-defence result, and at least five own counted TP there |
| Specialist operation | One legal declared target, the faction's normal successful-operation requirement and a concrete additional task feasible within two counted games |
| State objective | A reachable end-of-Turn state plus relevant own participation; no award solely for an inherited holding or somebody else's action |

The proposed revision to a four-opposing-faction victory objective is **two counted victories against two different opposing factions in one Turn**, still two VP. Do not revise it after the faction has begun playing that Turn.

Two wins and a territory capture are not statistically identical. Before assignment, the GM must check the actual vulnerable map, available opponents and active roster. Never assign an objective with no legal target. After resolution, record attempts, completions and games required by objective family; use that evidence to adjust the next campaign's pool rather than guessing that equal VP means equal difficulty.

The software enforces activation timing, one active assignment, one completion, participation and the six-VP cap. It still relies on commissioner review for the substantive objective condition.

## 6. Optional review of past vulnerability selections

Retain Turn-by-Turn announcements of the four Vulnerable Territories. Reducing surprise is not a fairness goal in itself; adapting to newly announced fronts is part of the campaign's strategic character. A full public calendar is not proposed for adoption.

If the GM wants to review access to territory contests, keep a record of which territories have already been Vulnerable and why. Use it to check for repeated protection or exposure, accounting for earned rewards and the narrative. The record can support review of completed Turns without revealing future selections. Different exposure counts alone do not prove unfairness, and this review creates no new fixed rotation or equal-exposure requirement.

## 7. Make capped scoring transparent

The existing TP formula is straightforward. This section proposes visibility into which results the new caps select; it is not a finding that the current TP formula is confusing.

The live TP schedule is authoritative: win 4, draw 2, loss 0; add one for at least five OP, and add one to a loser whose OP deficit is at most two. The older 3/1/0 fallback does not apply to this schedule. An 8–6 result is 5–2 TP.

Publish the exact reporting deadline and timezone. Extensions must be announced before the deadline. A later administrative approval may accept a documented timely game/report affected by an outage or correct an existing report; it is not permission to play a new game after close. Record the reason and apply the same standard to every faction. The portal retains explicit commissioner approval for late records; factual eligibility still needs review.

Show the rules revision, raw battle history, each side's counted/excluded reason, counted faction totals, and the resolved public outcome. Keep hidden targets, contracts and objective details private. At Turn end, report active players, retained players from the preceding Turn, faction scoring slots filled and the largest individual's share of counted TP. Label a player with no report as inactive in that period, not permanently lost, and compare equal-length periods.

Do not add an undisclosed handicap for Lobo or any other player. Apply caps and eligibility rules uniformly. Strong play should matter; extra availability should have a bounded campaign effect.

## Validation and rollout

The draft adds automated scenarios for capped selection, replacement after correction/rejection, twenty perfect wins by one player, independent sides of a report, location/Turn separation, late/duplicate gates, the participation checks, territorial ties, preservation of faction-specific Doctrine conditions, objective limits, frozen legacy rules and consistency between live totals and private resolution.

Deployment order is backend first, then frontend. Run the existing Aurora game, operations, registration and publication checks, plus the new balance checks. Verify the amendment in an isolated practice campaign before publishing the effective Turn. Publish the final amendment notice and the current Turn briefing, reissue affected objective wording before play, and then open the new Turn. The stored briefing source now links to the active revision, and its obsolete NA2 rules are corrected to match the October guide. Existing Discord messages and guide PDFs have not been rewritten or sent by this draft; they need the effective-Turn amendment notice at adoption.
