# Composed battle-story pilot

**Editorial status: draft.** Mission objectives have been rebuilt against
[Infinity Geist](https://infinitygeist.com/) and the
[110-scene review](game-story-engine-editorial-review.md) no longer has the
previous court, gate, rescue, and disk plots standing in for scenario
objectives. An editor still needs to approve plot variety, faction voice, and
actual-game fit before generated scenes could count as release coverage.

This branch experiments with a local, deterministic generator for every
supported mission and army matchup without a submitted-game highlight. It
does not alter the 1,300 historical entries, submitted highlights, or the
release requirement for 22,770 individually written stories. The historical
entries pass a
structural gate, but an objective-text audit flagged all 1,300 for editorial
review: it requires the scenario stake in the scene and all three endings.
This is triage, **not** proof that every historical story is incorrect. The
1,300 entries are excluded from pilot runtime routing and cannot mask the
generator in game reports. Submitted-game highlights retain priority. The
pilot remains draft pending its editorial and release decisions.

The older rows are pinned by their story-content hashes in
`scripts/game-story-legacy-baseline.json`. The ordinary catalog check grants
its older structural gate only to those exact versions. Any new or changed
row must also pass the hero's own action and mission-objective gates. The
complete release check applies both gates to *all* entries, including the
legacy rows; it currently fails as expected. This prevents the baseline from
silently expanding as the catalog is written.

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

- The browser first checks a submitted highlight and then composes a scene
  locally for a supported matchup. It does not load the inline historical
  catalog or a mission shard.
- Four concrete incidents per mission establish the opening, complication,
  turn and mission objective action. Incident-specific beats supply the stake,
  firefight and open-ended consequence. A mission frame supplies
  role actions, and alternative win, loss, and draw endings; each army
  supplies a crew description, maneuver, defensive response, follow-through,
  and outcome beat. The 21 other mission frames use mission-neutral army
  methods bound to four short mission-specific tactical referents: an advance,
  a diversion, a defensive position and a continuation. The referents for
  diversions and defensive positions are now *places*, so a guard cannot be
  described as standing "at the guard." Missions involving a moving objective
  rotate six authored tactical decisions for each army. The opposing crew
  can defend or counterattack; later incidents also use alternate gunfighting
  and close-combat actions tied to the mission. Each army now has three
  authored closing choices, while broad tactical styles have four ways to
  introduce the advance and defense. The mission outcome can lead with the
  specific incident rather than opening every report with the same mission
  claim; eleven gunfighting lines that reused the same guard-covering phrase
  were revised for their scenarios. The selected objective hero
  directly attempts its mission action. Win, loss and draw endings return to
  the incident's obstacle without claiming a specific unreported objective
  succeeded. Incidents can override a role action when the mission sequence
  changes its subject: Last Launch, for example, first needs an ID download
  and only later can describe an ID bearer. Game ID chooses an incident
  deterministically.
- Every scenario declares that the game feed supplies only an aggregate result.
  Composition checks all three endings for claimed objective completion and
  checks Area of Interest outcomes for unverified control of a particular
  relay or switch. Dead Man’s Switch and Last Launch incidents explicitly
  declare whether the Quantum Core or ID Token has a bearer. Corporate
  Appropriation incidents declare whether the prototype is at the cradle,
  moving on the lift, or trapped under the transport. The moving scenes
  override tactical places and role actions; the composer rejects a current
  bearer before pickup and rejects references to an abandoned cradle.
- The Area of Interest pilot additionally accepts `location` and `weather`
  tags. It selects tags deterministically when omitted and rejects explicit
  incompatible combinations. No weather effects (`none`) is valid everywhere.
  The location changes cover, approach and scored ground; the weather changes
  the opening, obstruction and closing beat. Each of the four incidents has
  its own setting and weather observation for shared tags. With `none`, these
  beats use the exposed approach and opposing fire without describing weather. A distinct
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
  All 22 mission families now render with linked eligible rosters. The public
  feed does not name **Akial Interference**'s drawn Common Classified cards,
  identify **Critical Intervention**'s attacker, or report **Double Bind**'s
  selected objective set. Akial scenes leave card identities unnamed;
  Critical Intervention's hero contests the Server Room, an objective shared
  by attacker and defender, while an unnamed attacker pursues the Data Pack;
  Double Bind scenes show the antenna and nearby zone without identifying
  which plan scored. These fictional events do not reconstruct the missing
  match setup.
- The engine runs in local TypeScript without paid model APIs or a deploy.

## What the checks establish

The engine test covers 22,770 canonical mission/matchup keys, four incidents
and three hero roles: **273,240 compositions checked structurally and against
the declared scene-fact constraints**. It
verifies mission-objective anchors, submitted-highlight precedence, historical
catalog exclusion, list linkage,
ambiguous lists, mirror matchups, and 792 synthetic
mission/incident/role/result renders. These are *possible template
compositions*, not 273,240 approved or individually written stories. The test
also injects false objective control, a premature bearer, and wrong prototype
locations to ensure the runtime guard rejects them. This does not catch every
possible semantic contradiction or certify prose originality. All 22 mission
families can render at runtime when a supported mission edition, two
unambiguous decoded lists, and an eligible hero exist. For the three missions
with missing setup, stories use shared mission elements and leave the actual
card, attacker assignment, and selected plan unstated.

The reproducible 110-scene editorial sample has five scenes per mission,
including one deliberate faction reversal, a mirror and all three roles.
Sentence order varies for independent opening and confrontation beats; an
incident's turn precedes the hero action and consequence. The current tests
check four distinct tactical decisions per mission from each of the 45 armies’ six choices outside
Area of Interest, three endings, the objective hero's active attempt, and
four environmental observations for each Area of Interest weather tag.
The generator still composes reusable phrases; tactical ideas and short
word sequences can recur across missions even when the location noun changes.
Fresh seeded packets and automated checks do not establish originality or
editorial quality. Objective-status checks also reject some known unsupported
scoring premises; they cannot infer a complete objective ledger from a match.
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
See the [current editorial review](game-story-engine-editorial-review.md).

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
Akial Interference, Critical Intervention and Double Bind have live, setup-neutral routes. The review packet
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
Double Bind does not assign the unknown selected objective set; Akial names
no specific drawn cards. Critical Intervention does not assign the attacking
side to a recorded player.
The generated Dig, Double Bind, and Crossing Lines scenes are also withheld for games
dated September 24 or earlier, or with no usable date: the public feed does
not say whether a game on the publication day used the revised rules.
Submitted player highlights retain priority; the historical matchup catalog
is excluded from pilot runtime routing.

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
