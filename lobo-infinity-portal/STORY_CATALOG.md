# Battle story catalog

Each fallback battle story belongs to one canonical mission and one unordered pair of active armies. The current registry has 22 missions and 45 active armies, so full coverage is 22 × 45 × 46 ÷ 2 = **22,770** stories. Mirror matchups count once. Do not fill missing entries by changing the names in one generic plot.

The review tries a written story for a concrete player highlight first. When the highlight is missing or unusable, it looks for the mission and matchup story. A fallback story picks the highest-point model eligible for its written hero role from the submitted decoded army, and it waits for both game-linked lists before rendering. Unrelated lists must never supply a hero. Known named characters use their proper names; a generic unit gets an article (for example, “the Raveneye”).

## Current checkpoint

- `src/data/gameHighlightStories.ts`: four individually written submitted moments (games 109, 114, 116, 117).
- `src/data/gameStoryCatalog.ts`: two individually written The Dig matchups, including game 105's Next Wave versus Operations Subsection.
- `public/game-stories/the-dig.json`: fifty-eight more individually written The Dig matchups.
- `public/game-stories/dead-man-s-switch.json`: twenty individually written Dead Man's Switch matchups, for **40 of 22,770** mission-matchup stories in total.
- `public/game-stories/hardlock.json`: twenty individually written Hardlock matchups, for **60 of 22,770** mission-matchup stories in total.
- `public/game-stories/area-of-interest.json`: one thousand individually written Area of Interest matchups.
- **Total: 1,100 of 22,770** individually written mission-matchup stories.
- `src/services/gameStoryRouting.ts`: highlight-first routing and on-demand loading of generated mission shards.
- Open reports waiting on submitted lists check newer public snapshots; once an additional list decodes and links to that game, the report reloads with the new pinned generation.
- `src/data/storyCharacters.json`: 201 named-character identities classified by the bundled official Army dataset; `npm run game-stories:characters` regenerates it. The Sāchā is classified as a unit type, so story text calls it “the Sāchā.”
- `scripts/game-story-catalog-check.mts`: pair uniqueness, hero selection, roster linking, character naming, authored highlight routing, and optional complete-catalog gate.
- `npm run test:game-stories:complete`: the release gate. It must pass before a production merge or deployment. Both the regular and Vercel prebuild scripts run it.

## Authoring the remaining entries

`node --experimental-strip-types scripts/prepare-game-story-batch.mts --model MODEL --output .tmp/game-story-batch.jsonl` prepares one independent Responses API Batch request for each missing mission and pair. `--mission 'The Dig'` prepares one mission for a smaller pilot and skips both the inline stories and the authored mission shard. The script only writes local request JSONL; it does not submit or bill for API requests. The actual model must be available in the project's API account, and a credential is required to run the batch. A model can write several stories with similar scenes even when their text differs, so generated content needs human sampling for plot and faction variety.

After a completed batch, `node --experimental-strip-types scripts/ingest-game-story-batch.mts --input PATH --dry-run` validates its response JSONL. Remove `--dry-run` to add valid stories as JSON files under `public/game-stories/` and update `src/data/storyManifest.json`. The browser fetches only the mission file it needs. The importer rejects duplicate keys, wrong missions or factions, missing roster hero tokens, short scenes, and result summaries. It does not substitute for editorial review. Run `npm run test:game-center`, `npm run test:game-stories:complete`, and the normal release checks after the final import.

The submitted-highlight collection also needs an editorial pass over the existing game notes. A concrete note can inspire its own written scene; vague notes (such as “Mad dice, great game”) use the mission matchup fallback.
