# Aurora VII game submission

A registered player submits one game for both participants at `/campaign/aurora-vii/submit`. Names and factions are read from the registration ledger. The form uses the announced Turn, four Vulnerable Territories and mission rotation; the active Narrative Mission is selected automatically. Map/terrain, notes, army codes and HTTPS photo links are optional.

Both OP scores are reviewed before submission. TP uses win 4, draw 2, loss 0; +1 at 5+ OP; +1 for losing by 1–2 OP. The server recomputes scores rather than trusting browser-supplied TP or factions.

The saved game provides a copyable verification link. A Discord DM is attempted after durable storage; disabled DMs cannot undo the submission. The link opens the review screen after Discord sign-in, and only the registered opponent or commissioner can confirm. Confirmation is bound to the latest game revision.

Players request corrections instead of editing records. The commissioner’s existing Aurora publication screen includes games, totals and private claims. Corrections retain old values and explanations, invalidate prior confirmation and notify the opponent again. The commissioner can override, reject duplicates or authorize late results. Potential duplicate submissions remain excluded until reviewed, allowing legitimate repeat battles to be approved. Previously announced Turn snapshots allow late requests without revealing future material.

Secret-objective claims are separate, visible only to the claimant and commissioner. They never appear in opponent responses, public totals or game notifications. Claim approval does not automatically award VP. Control, faction systems, doctrines and all Campaign VP remain manual commissioner decisions.

Private games are stored on the existing single-replica Railway volume at `/data/aurora-vii-games.json`. Writes serialize, fsync and rename atomically. Corrupt storage fails closed. Confirmed submission totals are separate from GM-published bulletin totals and ordinary portal game records. Narrative TP/OP never contributes to territorial totals. No map display changes are included.

Checks: `npm run test:aurora-games`, `npm run test:aurora-registration`, production build, and `node scripts/aurora-games-browser-check.mjs`. The browser check uses an isolated temporary ledger and simulated identities; it sends no real messages and writes no production games.
