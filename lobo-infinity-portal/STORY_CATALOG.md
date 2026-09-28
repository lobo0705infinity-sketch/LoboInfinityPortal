# Battle story catalog

The historical authored catalog belongs to one canonical mission and one unordered pair of active armies. The current registry has 22 missions and 45 active armies, so full authored coverage is 22 × 45 × 46 ÷ 2 = **22,770** stories. Mirror matchups count once. Do not fill missing entries by changing the names in one generic plot.

The draft story-engine pilot tries a written story for a concrete submitted-game highlight first, then generates a scene for every supported mission and matchup. **It never reads the 1,300 historical mission/matchup stories for game reports.** Both game-linked lists must be decoded to pick an eligible hero; unrelated lists cannot supply one. Known named characters use their proper names, while generic units get an article (for example, “the Raveneye”). The historical catalog remains on disk and has its own unfinished authored-story release gate; the pilot does not count generated scenes as individually written entries.

## Current checkpoint

- `src/data/gameHighlightStories.ts`: four individually written submitted moments (games 109, 114, 116, 117).
- `src/data/gameStoryCatalog.ts`: two individually written The Dig matchups, including game 105's Next Wave versus Operations Subsection.
- `public/game-stories/the-dig.json`: one hundred and eighteen more individually written The Dig matchups.
- `public/game-stories/dead-man-s-switch.json`: twenty individually written Dead Man's Switch matchups, for **40 of 22,770** mission-matchup stories in total.
- `public/game-stories/hardlock.json`: twenty individually written Hardlock matchups, for **60 of 22,770** mission-matchup stories in total.
- `public/game-stories/area-of-interest.json`: all one thousand and thirty-five individually written Area of Interest matchups.
- `public/game-stories/akial-interference.json`: one hundred and five individually written Akial Interference matchups.
- **Historical total: 1,300 of 22,770** individually written mission-matchup stories, excluded from the pilot's runtime story route.
- These 1,300 pass the historical structural check; all are flagged for separate mission-objective review. Their exact existing versions are pinned in `scripts/game-story-legacy-baseline.json`. Added or edited rows must pass the stronger actor-action and objective checks even while the catalog is incomplete.
- `src/services/gameStoryRouting.ts`: submitted-highlight-first routing, then local generated composition; no request for historical mission shards.
- Open reports waiting on submitted lists check newer public snapshots; once an additional list decodes and links to that game, the report reloads with the new pinned generation.
- `src/data/storyCharacters.json`: 201 named-character identities classified by the bundled official Army dataset; `npm run game-stories:characters` regenerates it. The Sāchā is classified as a unit type, so story text calls it “the Sāchā.”
- `scripts/game-story-catalog-check.mts`: pair uniqueness, hero selection, roster linking, character naming, authored highlight routing, and optional complete-catalog gate.
- `npm run test:game-stories:complete`: the release gate. It must pass before a production merge or deployment. Both the regular and Vercel prebuild scripts run it.

## Historical authored-catalog tooling (outside the pilot)

These batch-writing tools are part of the separate authored-catalog track. They are not inputs to the local story generator or needed to run its pilot.

`node --experimental-strip-types scripts/prepare-game-story-batch.mts --model MODEL --output .tmp/game-story-batch.jsonl` prepares one independent Responses API Batch request for each missing mission and pair. `--mission 'The Dig'` prepares one smaller historical-catalog batch and skips both the inline stories and the authored mission shard. The script only writes local request JSONL; it does not submit or bill for API requests. The actual model must be available in the project's API account, and a credential is required to run the batch. A model can write several stories with similar scenes even when their text differs, so generated content needs human sampling for plot and faction variety.

After a completed batch, `node --experimental-strip-types scripts/ingest-game-story-batch.mts --input PATH --dry-run` validates its response JSONL. Remove `--dry-run` to add valid historical catalog entries as JSON files under `public/game-stories/` and update `src/data/storyManifest.json`. The draft engine does not load these shards. The importer rejects duplicate keys, wrong missions or factions, missing roster hero tokens, short scenes, and result summaries. It does not substitute for editorial review. Run `npm run test:game-center`, `npm run test:game-stories:complete`, and the normal release checks after a final authored-catalog import.

The submitted-highlight collection also needs an editorial pass over the existing game notes. A concrete note can inspire its own written scene; vague notes (such as “Mad dice, great game”) go to the generator when its mission and version are supported.
