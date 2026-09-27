# Composed battle-story pilot

This branch experiments with a local, deterministic fallback for mission and
matchup combinations that do not have an individually written story. It does
not change the existing 1,300 written entries, the highlight-first rule, the
roster-linked hero selector, or the authored-completeness release gate.

## What it does

- The browser checks a submitted highlight, the inline catalog, and the
  appropriate mission shard before composing a missing matchup.
- A missing matchup draws from two linked incidents per mission, a physical
  scene frame for that mission, and a crew and tactical style for each of the
  45 active armies. Mission frames set the approach, crossfire, distinct role
  actions, and endings. Game ID chooses an incident; a hero role is selected
  only when a decoded, game-linked roster has an eligible model.
- The existing renderer supplies player names, the actual roster-selected
  model, and the appropriate win, loss, or draw ending.
- It runs entirely in local TypeScript. There is no model call, API key,
  external fee, or deploy step.
- The engine test validates all 22,770 canonical combinations for each of
  three hero roles and both incidents with the existing structural quality
  checker; it also checks remote-authored precedence and roster linkage.

## Editorial limit

**This is a pilot, not 22,770 independently written stories.** Forty-four
curated incident seeds are recombined with army descriptions and mission
frames. The automated check catches malformed stories, but it cannot prove
that a combination has a fresh plot, accurate faction character, or natural
prose. Passing the engine check must never increment STORY_CATALOG.md's
written-story count.

## Editorial sample, 27 September 2026

`node --experimental-strip-types scripts/sample-generated-game-stories.mts`
emits 110 reproducible JSONL scenes across all 22 missions: 22 mirror
matchups, 37 objective, 37 gunfighting, and 36 close-combat roles, with all
three endings attached to each. Both incident variants appear for each mission.
The scene paragraphs in this sample run from 42 to 63 words.

The mission frames remove several sampled setting clashes, including a
network trace across the B-Pong court, checkpoint signs on a bridge, and a
loading platform inside a ration corridor. Some objectives now stop at the
critical decision so a loss or draw can follow without reversing an already
completed rescue or transmission. Compared with individually authored scenes
in the mission shards, the prose still lacks distinct turns for most pairs.
Only **44 of the 110 middle paragraphs are distinct**; the incident library is
the editorial bottleneck. This sample is a reproducible review aid, not a
statistical proof of acceptable story quality.

Before changing the release gate or using this in production, expand the
incident library, review a blinded sample with a human editor against the
authored stories, and measure near-duplicate plots within each mission.
Review rendered mirror games, all three outcomes, and games with incomplete
or ambiguous lists. The draft PR and authored-completeness release gate stay
in place through that review.

## Verification

From lobo-infinity-portal:

- npm run test:game-story-engine
- npm run test:game-stories
- npm run test:game-center

The existing npm run test:game-stories:complete continues to require 22,770
**individually authored** mission/matchup entries. It is intentionally
unchanged until there is an explicit editorial decision to accept generated
coverage as a different completion criterion.
