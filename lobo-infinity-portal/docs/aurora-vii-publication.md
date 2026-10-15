# Aurora VII public campaign area

Public entry: `/campaign/aurora-vii`. Commissioner publication: `/commissioner/aurora-vii`.

The Player Guide and Territory & Terrain Guide supply the public reference content, twelve territory identities and VP values, the ordinary mission rotation, and 24 terrain reference images. The GM Guide is not copied into the repository or website. No unreleased narrative mission, event table, private objective table, faction briefing, or ending is embedded in the client bundle.

The campaign Sheet remains the canonical arithmetic record. The GM resolves control, faction systems, objectives, Doctrines, and rewards manually. The commissioner publication screen accepts only approved public results and current announcements; it does not resolve campaign outcomes or alter the Sheet. Public state is stored separately from the portal's immutable league/tournament snapshots, so scheduled portal refreshes do not overwrite campaign announcements.

Before the first publication, the site displays unannounced state, not invented controllers, deadlines, zero standings, or an active Turn. To prepare a Turn, publish its deadline with timezone, exactly four Vulnerable Territories, approved map state, current Event rules, the released Narrative Mission and its public sheet link, approved Campaign VP and TP/OP totals, and the current public chapter. Link an existing published Narrative Campaign event if campaign battle reports should appear. Only that event's games are displayed.

Authentication uses the existing commissioner session verifier. The API rejects unknown fields at every level, future chapter Turn numbers, invalid links, unsupported factions and territories, and stale revisions. All fields on the publication screen are public. Private GM records are maintained elsewhere and must never be imported into this screen.

Run `node tests/aurora-publication-check.mjs` and the normal `npm run build:vercel` release checks. Terrain images are extracted exclusively from the supplied public territory guide; the planetary map comes from the public player guide. Assets use a versioned path so future replacements do not conflict with immutable asset caching.

## Faction decisions and mercenary rules

The public Player Rules explain the Faction Commander/deputy decision process and briefly state that Conquest factions, Tohaa and Combined Army can hire NA2. Contract terms, Credit rules, support calculations and services belong in individual faction guides, not the public rules page. Factions select their own representatives and tell the GM privately; the portal does not assign commander permissions or publish private selections. Commanders seek consensus, make the final call by the GM deadline when needed, and submit one official set of faction decisions. Players remain free to choose legal games; rules judgments and scoring remain with the GM.

All eight Conquest factions, Tohaa and Combined Army may hire NA2 from six-Credit campaign treasuries. Current balances, bids, accepted terms and purchases stay outside public publication state. Mercenary support and contract outcomes are manually resolved by the GM; raw reported TP/OP remain earned game totals. Do not copy the GM guide, combined tracking workbook, sample private briefings or master archive into public assets.
