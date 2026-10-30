# Aurora VII public campaign area

Public entry: `/campaign/aurora-vii`. Commissioner publication: `/commissioner/aurora-vii`.

The Player Guide and Territory & Terrain Guide supply the public reference content, twelve territory identities and VP values, the ordinary mission rotation, and 24 terrain reference images. The GM Guide is not copied into the repository or website. No unreleased narrative mission, event table, private objective table, faction briefing, or ending is embedded in the client bundle.

Campaign operations now maintains a private, auditable commissioner ledger for control, faction systems, objectives, Doctrines, rewards and Credits. See `aurora-operations.md` for the private Discord DM workflow and Turn resolution. The separate public bulletin accepts only approved public results and current announcements. Public state is stored separately from the portal's immutable league/tournament snapshots, so scheduled portal refreshes do not overwrite campaign announcements.

Before the first publication, the site displays unannounced state, not invented controllers, deadlines, zero standings, or an active Turn. To prepare a Turn, publish its deadline with timezone, exactly four Vulnerable Territories, approved map state, current Event rules, the released Narrative Mission and its public sheet link, approved Campaign VP and TP/OP totals, and the current public chapter. Link an existing published Narrative Campaign event if campaign battle reports should appear. Only that event's games are displayed.

Authentication uses the existing commissioner session verifier. The API rejects unknown fields at every level, future chapter Turn numbers, invalid links, unsupported factions and territories, and stale revisions. All fields on the publication screen are public. Private GM records belong in the protected operations panel and must never be copied into the public bulletin fields.

Run `node tests/aurora-publication-check.mjs` and the normal `npm run build:vercel` release checks. Terrain images are extracted exclusively from the supplied public territory guide; the planetary map comes from the public player guide. Assets use a versioned path so future replacements do not conflict with immutable asset caching.

## Faction decisions and mercenary rules

The public Player Rules explain the Faction Commander/deputy decision process and briefly state that Conquest factions, Tohaa and Combined Army can hire NA2. Contract terms, Credit rules, support calculations and services belong in individual faction guides, not the public rules page. Factions select their own representatives and tell Lobo privately by Discord DM; Lobo records their Commander/deputy in protected campaign operations. The public bulletin never publishes private selections. Commanders seek consensus, make the final call by the GM deadline when needed, and submit one official set of faction decisions. Players remain free to choose legal games; rules judgments and scoring remain with the GM.

All eight Conquest factions, Tohaa and Combined Army may hire NA2 from six-Credit campaign treasuries. Current balances, bids, accepted terms and purchases stay in the protected operations ledger, outside public publication state. The GM reviews and commits the server-calculated support and contract outcome; raw reported TP/OP remain earned game totals. Do not copy the GM guide, combined tracking workbook, sample private briefings or master archive into public assets.

## Campaign location selection

Players may agree to play in one of the current Turn’s Vulnerable Territories or the active Narrative Mission. If they cannot agree, both secretly bid Command Tokens and reveal simultaneously.

- Different bids: the higher bidder loses the number of Command Tokens they bid and chooses the location. The lower bidder keeps their Command Tokens.
- Equal bids: both players lose the number of Command Tokens they bid, then roll off. The die-roll winner chooses the location.

For a territory battle, then make a separate Face-to-Face roll; the winner chooses one of the Turn’s two ordinary missions. A Narrative game uses the active Narrative Mission sheet. Campaign location selection does not assign a particular tabletop terrain layout.


## Territory video guides and rules revisions

Published territory guides are mapped by territory ID in `src/config/auroraTerritoryVideos.ts`. The campaign overview lists only published guides; each matching territory and Workshop location page offers a click-to-load YouTube privacy-enhanced player and an external YouTube link. Preview artwork is served locally from `public/assets/aurora-vii/videos-20261028/`, so no player is loaded until the visitor chooses playback. Add a guide only after verifying its published channel title and video ID.

Written rules remain authoritative and are shared by territory, location, mission, and Player Rules pages through `shared/aurora-territory-rules.json`. The rules PDF and revision date are linked alongside them. The 28 October 2026 Sulfur Basin correction adds Immunity (Enhanced), Immunity (BTS), and Fireteam protection; Protected Crossing now grants one friendly trooper Terrain (Total) at scenario start for the scenario. The PDF reflects the same text.

After building, run `npm run test:aurora-territory-videos` with Playwright Chromium installed (or `CAMPAIGN_TEST_CHROMIUM` pointing to a compatible executable). It checks all twelve territory pages, the eight published links, player activation/closure, mobile layout, corrected Sulfur rules across the territory and both Workshop locations, Player Rules, and the PDF download.

## Aerial territory exceptions - 30 October 2026

Azure Coast excludes Aerial troopers from gaining or ignoring water-based Total Cover, including through Terrain (Aquatic) or Terrain (Total). Sulfur Basin excludes personal and provided Fireteam protection through an Aerial trooper's Terrain (Total); another listed Immunity or another qualifying Fireteam member still protects it. Protected Crossing grants the skill normally but does not override this exception. The shared rules feed territory, location and Player Rules pages and server-generated map text. The linked PDF uses the same revision. Published territory videos are unchanged.

The Player/GM guides and bot faction-briefing source do not restate these benefits. The separate current Ariadna briefing PDF repeats Azure Coast's water rule and is updated privately alongside the rules PDF. The bot's official N5/FAQ/ITS rules corpus contains no Aurora territory rules; campaign exceptions remain in the shared campaign reference, not the official rules corpus.
