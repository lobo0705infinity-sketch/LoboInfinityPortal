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
22,770 individually written stories.

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
  turn, and mission objective action. A mission frame supplies crossfire,
  role actions, and alternative win, loss, and draw endings; each army
  supplies a crew description and tactical approach. Game ID chooses an
  incident deterministically.
- Rendering requires both decoded lists linked unambiguously to that game,
  an eligible roster model for the hero role, and the actual player/result
  fields. For **Critical Intervention** and **Double Bind**, the game record
  does not store attacker/defender assignment or selected mode. Those two
  mission templates remain available for editorial inspection, but the
  runtime refuses to invent setup and explains that limitation to the user.
- The engine runs in local TypeScript without paid model APIs or a deploy.

## What the checks establish

The engine test covers 22,770 canonical mission/matchup keys, four incidents
and three hero roles: **273,240 structurally checked compositions**. It
verifies mission-objective anchors, authored precedence, list linkage,
ambiguous lists, mirror matchups, and 792 synthetic
mission/incident/role/result renders. These are *possible template
compositions*, not 273,240 approved or individually written stories. Because
two missions need unreported setup, only 20 mission families are eligible for
runtime generation with the current game records; all 22 remain in the
synthetic template check.

The reproducible 110-scene editorial sample has five scenes per mission,
including a mirror and all three roles across the sample. It contains 88
different middle paragraphs, 40–63 words per paragraph, and a maximum
within-mission middle-paragraph trigram Jaccard overlap of 0.236. That
lexical measure does not prove plot originality. Repeated mission frames and
faction descriptions remain easy to recognize across a reading session.
See the [review and ten actual samples](game-story-engine-editorial-review.md).

The next editorial gate is an independent, blinded comparison with authored
stories for natural prose, plot variety, faction voice, version accuracy, and
whether a generated narrative could be mistaken for a factual account of
unreported moves. The engine test cannot grant that approval. Keep
`STORY_CATALOG.md` at 1,300 written stories and keep the draft PR unmerged
until there is an explicit decision on generated coverage.

## Verification

From `lobo-infinity-portal`:

```bash
npm run test:game-story-engine
npm run test:game-stories
npm run test:game-center
node --experimental-strip-types scripts/sample-generated-game-stories.mts
```

`npm run test:game-stories:complete` still requires 22,770 individually
authored entries. A successful engine check does not change this gate.
