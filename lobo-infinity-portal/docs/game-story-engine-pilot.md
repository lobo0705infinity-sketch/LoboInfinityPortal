# Composed battle-story pilot

This branch experiments with a local, deterministic fallback for mission and
matchup combinations that do not have an individually written story. It does
not change the existing 1,300 written entries, the highlight-first rule, the
roster-linked hero selector, or the authored-completeness release gate.

## What it does

- The browser checks a submitted highlight, the inline catalog, and the
  appropriate mission shard before composing a missing matchup.
- A missing matchup draws from two linked incidents per mission and a voice
  for each of the 45 active armies. It varies by game ID and selects a hero
  role only if a decoded, game-linked roster has an eligible model.
- The existing renderer supplies player names, the actual roster-selected
  model, and the appropriate win, loss, or draw ending.
- It runs entirely in local TypeScript. There is no model call, API key,
  external fee, or deploy step.
- The engine test validates all 22,770 canonical combinations for each of
  three hero roles and both incidents with the existing structural quality
  checker; it also checks remote-authored precedence and roster linkage.

## Editorial limit

**This is a pilot, not 22,770 independently written stories.** Forty-four
curated incident seeds are recombined with army descriptions and role actions.
The automated check catches malformed stories, but it cannot prove that a
combination has a fresh plot, accurate faction character, or natural prose.
Sample scenes still repeat structural wording, and some generic army movements
need mission-specific alternatives. Passing the engine check must never
increment STORY_CATALOG.md's written-story count.

Before changing the release gate or using this in production, expand the
incident library, pair faction behavior with the mission's physical setting,
review a varied blind sample against the authored stories, and measure
near-duplicate scenes within each mission. Include mirror pairings, each hero
role, all three outcomes, and games with incomplete or ambiguous lists.

## Verification

From lobo-infinity-portal:

- npm run test:game-story-engine
- npm run test:game-stories
- npm run test:game-center

The existing npm run test:game-stories:complete continues to require 22,770
**individually authored** mission/matchup entries. It is intentionally
unchanged until there is an explicit editorial decision to accept generated
coverage as a different completion criterion.
