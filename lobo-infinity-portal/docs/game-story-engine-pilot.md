# Composed battle-story pilot

**Editorial status: draft.** Mission objectives have been rebuilt against
[Infinity Geist](https://infinitygeist.com/) and the
[110-scene review](game-story-engine-editorial-review.md) no longer has the
previous court, gate, rescue, and disk plots standing in for scenario
objectives. An editor still needs to approve plot variety, faction voice, and
actual-game fit before generated scenes could count as release coverage.

This branch experiments with a local, deterministic fallback when a mission
and army matchup has no individually written story. It does not alter the
1,300 authored entries, submitted highlights, or the release requirement for
22,770 individually written stories. The legacy authored entries pass a
structural gate, but an objective-text audit flagged all 1,300 for editorial
review: it requires the scenario stake in the scene and all three endings.
This is triage, **not** proof that every legacy story is incorrect. Existing
authored stories continue to take priority in routing, so this pilot cannot
be merged until their treatment is decided.

## Source and scope

[`generatedStoryScenarios.ts`](../src/data/generatedStoryScenarios.ts) records
the direct mission URL and scenario season for all 22 missions, plus four
distinct plot incidents and three endings per mission. These pages were
reviewed on **27 September 2026** on Infinity Geist build
`geist-v2-20260924190254`: 20 ITS 18 missions, the ITS 16 **Panic Room**,
and [**Dead Man's Switch**, by Lobo](https://infinitygeist.com/mission/cm_lobo_dead_mans_switch).
Source URLs point to live pages, so this build and review date document the
provenance; they do not guarantee those pages will stay the same. The plots
use core objectives and avoid disputed point totals when scenario editions
differ. Older game records do not identify which edition was played.

- The browser first checks a submitted highlight, the inline catalog, and
  the appropriate mission shard. A missing matchup can use the engine.
- Four concrete incidents per mission establish the opening, complication,
  turn and mission objective action. Incident-specific beats supply the stake,
  firefight and open-ended consequence. A mission frame supplies
  role actions, and alternative win, loss, and draw endings; each army
  supplies a crew description, maneuver, defensive response, follow-through,
  and outcome beat. The 21 other mission frames use mission-neutral army
  methods bound to four short mission-specific tactical referents: an advance,
  a diversion, a defensive position and a continuation. This keeps the army's
  choice attached to the contested location while avoiding a verbatim ranger,
  escort or cordon sentence in every scenario. The incident turns, objective
  actions and endings remain mission-specific. Game ID chooses an incident
  deterministically.
- The Area of Interest pilot additionally accepts `location` and `weather`
  tags. It selects tags deterministically when omitted and rejects explicit
  incompatible combinations. No weather effects (`none`) is valid everywhere.
  The location changes cover, approach and scored ground; the weather changes
  the opening, obstruction and closing beat. With `none`, these beats use the
  exposed approach and opposing fire without describing weather. A distinct
  maneuver, defense, continuation, win beat, and draw beat for each of the 45
  active armies now changes the contest and all three endings. Eight role-action
  patterns still group armies by broad tactical style. Other missions use
  army-specific tactics without inheriting the relay's panel or switch.
  They do not use these location and weather tags. Game records do not
  contain table location or weather; these are fictional scene settings.

| Area of Interest location | Allowed weather tags |
| --- | --- |
| Relay courtyard, freight depot, rooftop terrace, forest, mountain | None, rain, fog, crosswind, snow |
| Desert | None, crosswind |
| Jungle | None, rain, fog |

The 30 compatible combinations rule out desert rain and jungle snow in both
explicit previews and automatic selection. The `none` tag is not treated as
sunshine or another weather effect.
- Rendering requires both decoded lists linked unambiguously to that game,
  an eligible roster model for the hero role, and the actual player/result
  fields. Mirror games can select either linked player's eligible actor, with
  the ending bound to that player's actual result. For an Outbreak objective
  action, the selected model must be an eligible Doctor, Paramedic, or
  Specialist Operative. Evacuation selects a Specialist who can CivEvac;
  permanent restrictions in the decoded profile exclude REMs, VHs,
  Impetuous troops, and Peripherals. The roster does not establish whether
  a trooper was in a Fireteam or coordinated order during the game. If no
  eligible actor exists, the report identifies that limitation instead of
  claiming the lists are still being decoded. The final rendered paragraphs
  obey the 40–75 word bound; long display names fall back to player handles.
  **Akial Interference** needs the two drawn public Common Classified
  cards; **Critical Intervention** needs attacker/defender assignment; and
  **Double Bind** needs the chosen objective set. Those three mission templates
  remain available for editorial inspection, but the
  runtime refuses to invent setup and explains that limitation to the user.
- The engine runs in local TypeScript without paid model APIs or a deploy.

## What the checks establish

The engine test covers 22,770 canonical mission/matchup keys, four incidents
and three hero roles: **273,240 structurally checked compositions**. It
verifies mission-objective anchors, authored precedence, list linkage,
ambiguous lists, mirror matchups, and 792 synthetic
mission/incident/role/result renders. These are *possible template
compositions*, not 273,240 approved or individually written stories. Because
three missions need unreported setup, only 19 mission families are eligible for
runtime generation with the current game records; all 22 remain in the
synthetic template check.

The reproducible 110-scene editorial sample has five scenes per mission,
including a mirror and all three roles across the sample. It contains 110
different middle paragraphs, 42–67 words per paragraph, and a maximum
within-mission middle-paragraph trigram Jaccard overlap of 0.184. Sentence
order varies for independent opening and confrontation beats; the incident
turn precedes the hero action and its consequence. In a fresh seeded
110-scene review packet, 19 of 1,064 sentence appearances are exact repeats
after excluding one deliberately reversed case per mission; a second seed
also showed 19 of 1,064. The same first seed had 159 repeats before the
mission-specific tactical referents were introduced. The remaining shared
lines occur mainly when a mission reuses a role action or when Area of Interest
samples happen to select the same setting and weather. Short references to
the objective can still repeat within an individual story; the 88 included
scenes had 425 repeated three-word sequences within scenes, compared with 352
before this change. Neither count establishes plot originality or editorial
quality. The ending rewrite removed the stock “prevailed” and “ended level”
lines, but mission and faction distinctions still require human review.
The 45 Area and 45 mission-neutral method sets distinguish army tactics in
every mission, but neither set establishes original plots for every pair.
The methods are fictional extrapolations from broad faction themes described by
[Corvus Belli](https://infinityuniverse.com/en), including its descriptions of
[Tohaa coordination](https://infinityuniverse.com/en/news/tohaa-combat-force-repack-alpha)
and [Next Wave sabotage](https://infinityuniverse.com/en/factions/combined-army/next-wave).
They must not imply that a particular unit or action occurred in a recorded
match. Every mission template has hero-win, hero-loss and draw endings with
mission-specific stakes and faction-specific resolution beats; the result
in the game record chooses which one appears. Since game records expose
aggregate points without an objective-by-objective ledger, the ending does
not claim a particular console, token, or patient was secured solely because
the side won.
See the [review and eleven actual samples](game-story-engine-editorial-review.md).

The next editorial gate is an independent generated-only review for natural
prose, plot variety, faction voice, version accuracy, and whether a generated
narrative could be mistaken for a factual account of unreported moves. The
legacy authored stories do not provide a valid mission-fidelity comparison.
The engine test cannot grant that approval. Keep
`STORY_CATALOG.md` at 1,300 written stories and keep the draft PR unmerged
until there is an explicit decision on generated coverage.

The reproducible `scripts/prepare-story-editorial-review.mts` creates a
110-scene review set: five per mission, including a same-incident faction
reversal, mirror matchup, all four incidents, and all three hero roles.
Akial Interference, Critical Intervention and Double Bind remain preview-only. The review packet
openly identifies all scenes as generated; reviewers are blinded to generator
implementation and configuration. A separate private configuration file makes
selection reproducible. Two independent readers should score every story.
The new-story batch ingestion applies an additional mission-objective gate;
the legacy audit is available via `scripts/audit-legacy-story-objectives.mts`.
Neither review nor test changes the authored count or establishes that a
fictional scene occurred in a recorded game.

[Corvus Belli's September 24 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september)
is reflected in the Dig's console analysis before neutralization and the
reviewer's checks for Player Tokens, Double Bind's Engineer/GizmoKit antenna
repairs, and Crossing Lines. The pilot does not simulate Player Tokens.
Crossing Lines has no HVT or Classified Deck in the updated scenario. The
Double Bind runtime remains withheld while the chosen objective set is missing
from public game records; Akial remains withheld without the drawn cards.
The generated Dig and Crossing Lines scenes are also withheld for games
dated September 24 or earlier, or with no usable date: the public feed does
not say whether a game on the publication day used the revised rules.
The older authored catalog and submitted player highlights retain priority.

## Verification

From `lobo-infinity-portal`:

```bash
npm run test:game-story-engine
npm run test:game-stories
npm run test:game-center
node --experimental-strip-types scripts/sample-generated-game-stories.mts
node --experimental-strip-types scripts/prepare-story-editorial-review.mts --output-dir ../story-editorial-review
node --experimental-strip-types scripts/audit-legacy-story-objectives.mts --output ../legacy-story-objective-audit.csv
```

`npm run test:game-stories:complete` still requires 22,770 individually
authored entries. A successful engine check does not change this gate.
