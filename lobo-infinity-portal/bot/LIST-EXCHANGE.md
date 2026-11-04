# Private game list exchange

One exchange belongs to one game. Reports supported: League, Top 40, Team
Tournament, Casual, and live Aurora VII campaign games.

## Player flow

1. Player A runs `/list game create opponent:@opponent army-code:<your own code or link>
   game-name:Top 40 W2` in the shared server. The bot atomically creates the game
   with A's list already saved and privately confirms **Game created**.
2. LLH DMs Player B: A has created the named game, its `LLH-…` code and the join
   command. If the DM fails, A's private confirmation includes the code and
   instructions to pass it along. No Army codes appear in setup notifications.
3. Player B runs `/list game join game:LLH-… army-code:<your own code or link>`
   in the same server. Only the invited Discord account can join. Joining
   atomically saves B's list and locks both, with no separate ready step.
   B privately sees **Game submitted**; A receives a DM that both players are
   ready. Failed DM delivery is reported in B's private confirmation.
   LLH uses each account's linked portal name, without manual name entry or
   guessing Discord display names. Unlinked/conflicting accounts need Lobo to
   correct their link. Duplicate joins cannot replace a list or notify twice.
4. Enter **LLH Game Code** when reporting. Leave the two Army Code fields blank
   in Google Forms or native League/Tournament/Casual forms: the backend obtains
   the committed codes from LLH without returning them to the submitter.
5. After the accepted report, LLH DMs each opponent's full code in a text
   attachment, plus an Infinity Army link for codes under 1000 characters.
   Polling runs every minute. Aurora also waits for opponent confirmation and
   any required late/duplicate approvals.

`/list game status` privately retrieves the opponent's list after release if
DMs are closed. Before release it shows submission/ready status only.
`/list game cancel` works before locking and removes submitted codes from that
cancelled record. Use a new exchange for each rematch.

Games created before the invitation flow retain `/list game submit` and
`/list game ready`. Each legacy submission resets both ready confirmations.
New invited games use only create/join to save and lock their lists.

## Storage and recovery

The private ledger is `/data/llh-list-exchanges.json` on the Railway volume (or
`RAILWAY_VOLUME_MOUNT_PATH`). It uses serialized mutations, atomic rename,
file/directory fsync and file mode 0600. Unreadable existing data fails closed.
Use the existing single worker replica with this file store.

Canonical results atomically store their exchange code and report timestamp in
trailing columns 29–30. Public projections omit these fields. Public campaign
activity also omits exchange codes. Pre-game submissions never enter the
community army-list vault.

The machine-only receipt API checks the existing worker credential and returns
no army codes. LLH checks the exact code, both names, a report timestamp after
locking, accepted status, and campaign Discord identities. Missing, conflicting,
early or mismatched receipts keep both lists private. Canonical reports reject
reusing a game code on another canonical game.

Release and recipient deliveries are durable. Before a DM retry, LLH covers
message history back to the first attempt and uses a stable nonce. Incomplete
history defers delivery. Replayed reports do not recreate deliveries.

## Rollout

1. Deploy the reviewed Apps Script files, preserving the existing deployment
   identity. Verify its existing `ARMY_INTELLIGENCE_WORKER_TOKEN` Script Property.
2. Add that same existing secret as `ARMY_INTELLIGENCE_WORKER_TOKEN` on Railway,
   plus `LIST_EXCHANGE_API_URL` with the Apps Script web-app `/exec` URL. Do not
   commit credentials. Railway already has `/data` and one replica.
   `VITE_API_URL` is an alternative URL variable.
3. Deploy LLH and the portal. Startup adds `/list game` to `/list`. Commands
   return a setup-pending response until receipt verification is configured.
4. Run `installListExchangeFormFields()` once in Apps Script. It updates the
   four existing game Forms in place: one optional **LLH Game Code** text
   question and conditional Army Code requirements. Question IDs, destinations
   and other requirements remain intact. Without a code, backend validation
   still requires both lists. The installer is safe to repeat. Do not run the
   destructive League/Team form-rebuild routines for this rollout.
5. Smoke-test with two designated accounts: create, join, verify pre-report
   privacy, report/confirm, verify both DMs, then retry. Live Google Forms and
   production Discord delivery are not exercised by the offline tests.

## Validation

`npm run test:list-exchange` covers create/join SDK routing, invitation DMs,
closed-DM fallbacks, automatic locking, concurrent joins, ownership/server boundaries,
missing lists, ready reset, locking, wrong/early/unconfirmed/duplicate reports,
atomic storage, machine authentication, restart/crash-after-send recovery,
closed DMs, long-code attachments, campaign acceptance and corrupt storage.
Existing bot, campaign, canonical, bracket and Form regression checks also apply.

## Invitation recovery

Creation names the selected Discord recipient and records the DM message ID and time. Discord acceptance does not confirm the recipient read it. Both participants can inspect the invitation receipt with `/list game status game:LLH-…`. The invited opponent can run `/list game status` without a code to privately list pending invitations in that server, including older games. The creator can use the **Resend invitation** button or `/list game resend game:LLH-…` while the game is open, at most once per minute. Failed DMs leave the saved game available; share its code or use the pending invitation lookup. Portal player-name matching ignores case, leading/trailing spaces and repeated internal whitespace.
