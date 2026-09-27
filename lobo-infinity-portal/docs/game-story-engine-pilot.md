# Composed battle-story pilot

This branch experiments with a local, deterministic fallback for mission and
matchup combinations that do not have an individually written story. It does
not change the existing 1,300 written entries, the highlight-first rule, the
roster-linked hero selector, or the authored-completeness release gate.

## What it does

- The browser checks a submitted highlight, the inline catalog, and the
  appropriate mission shard before composing a missing matchup.
- A missing matchup draws from four linked incidents per mission, a physical
  scene frame for that mission, and a crew and tactical style for each of the
  45 active armies. Mission frames set the approach, crossfire, distinct role
  actions, and endings. The two original incidents use that frame for their
  action and aftermath; the two new incidents include their own role actions,
  aftermath, reaction, closing, and outcome-specific endings. Game ID chooses
  an incident deterministically; a hero role is selected
  only when a decoded, game-linked roster has an eligible model.
- The existing renderer supplies player names, the actual roster-selected
  model, and the appropriate win, loss, or draw ending.
- It runs entirely in local TypeScript. There is no model call, API key,
  external fee, or deploy step.
- The engine test validates all 22,770 canonical combinations for each of
  three hero roles and four incidents (273,240 scenes) with the existing
  structural quality checker. It also checks authored precedence, roster
  linkage and ambiguity, and rendered mirror games and outcomes.

## Editorial limit

**This is a pilot, not 22,770 independently written stories.** Eighty-eight
curated incident seeds are recombined with army descriptions and mission
frames. The automated check catches malformed stories, but it cannot prove
that a combination has a fresh plot, accurate faction character, or natural
prose. Passing the engine check must never increment STORY_CATALOG.md's
written-story count.

## Editorial sample, 27 September 2026

`node --experimental-strip-types scripts/sample-generated-game-stories.mts`
emits 110 reproducible JSONL scenes across all 22 missions: 22 mirror
matchups, 37 objective, 37 gunfighting, and 36 close-combat roles, with all
  three endings attached to each. All four incident variants appear for each
mission. The scene paragraphs in this sample run from 42 to 64 words.

The mission frames remove several sampled setting clashes, including a
network trace across the B-Pong court, checkpoint signs on a bridge, and a
loading platform inside a ration corridor. Some objectives now stop at the
critical decision so a loss or draw can follow without reversing an already
completed rescue or transmission. Compared with individually authored scenes
in the mission shards, the prose still lacks distinct turns for most pairs.
**88 of 110 middle paragraphs are distinct**: each mission contributes four
different incident complications, with the fifth sample reusing one. All 110
openings vary by incident and army, while all 110 final paragraphs vary by
incident, role, and army. The highest within-mission Jaccard overlap for
three-word runs in the four sampled middle paragraphs is 0.240, for Dead
Man's Switch. This lexical measure catches shared phrasing but cannot detect
two incidents with the same underlying plot. Read all three possible endings
against each incident: a tentative hero action can lead coherently to a win,
loss, or draw. The sample is a reproducible review aid, not a statistical proof
of acceptable story quality.

The next decision needs a human editor to compare a blinded selection of
generated scenes with individually written ones for natural prose, faction
voice, mission evidence, and plot originality. The structural checker and
word overlap cannot make that judgment. If generated coverage becomes an
accepted release criterion, specify and approve a separate gate; leave the
current authored-completeness gate intact. The pilot remains a draft PR until
that decision.

## Verification

From lobo-infinity-portal:

- npm run test:game-story-engine
- npm run test:game-stories
- npm run test:game-center

The existing npm run test:game-stories:complete continues to require 22,770
**individually authored** mission/matchup entries. It is intentionally
unchanged until there is an explicit editorial decision to accept generated
coverage as a different completion criterion.
