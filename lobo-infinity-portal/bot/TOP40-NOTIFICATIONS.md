# Top 40 matchup notifications

Lobo’s Little Helper checks the published Top 40 bracket once per minute. Only released, active games with two registered players, an assigned mission, an activation time, and a valid seven-day deadline qualify. Byes and conditional, pending or completed games never produce matchup pings.

The dedicated **scheduling** channel in the **Lobo’s Top 40** category is the default destination: guild `988549985836601414`, channel `1541851304228421794`, verified against the current Discord UI on October 31, 2026. Each message mentions only the two verified player accounts, and includes match number, bracket and round, mission, map, localized deadline and bracket/report links.

A scheduling check becomes due **72 hours after the match’s actual activation**, not three calendar midnights or a global round date. It asks whether the players have agreed a day/time and offers help contacting their opponent. It is sent only if their match remains active. A late first notice includes that question and records the day-three check as covered, avoiding two pings together after downtime.

The private `/data/top40-notifications.json` ledger persists account links and delivery receipts. A durable send intent, scoped Discord history search, deterministic nonce, serialized polling and atomic writes protect retries and restarts. Unreadable history or state defers the delivery instead of resetting it. One Railway replica owns this ledger.

## Account linking

Existing Aurora VII registrations explicitly link a portal player name to a Discord account. Those links can be reused after confirming the member is still in this guild. The private `TOP40_REGISTERED_DISCORD_CONTACTS` environment value supplies the Discord contacts entered on the original Top 40 signup form. It is matched exactly against Discord usernames, global names and current server names, only after a complete member listing and only when exactly one member matches. The signup contact records are not committed to this repository or exposed by the public status route. No player is identified from a fuzzy name or a similar nickname. Missing or conflicting identities suppress the affected match’s ping until Lobo confirms the accounts.

Owner-only commands, with private replies:

- `/top40 status` reports linked accounts, missing names and active-match monitoring.
- `/top40 role expected_count:<count>` creates the permission-free **Lobo top 40** role and assigns it to the current confirmed human accounts. It stops if the count has changed, reuses only an editable permission-free role with the exact name, preserves existing roles, and reports any failed assignments. Repeating it is safe; it does not automatically assign future account links.
- `/top40 link player:<exact portal name> account:<Discord user>` confirms an account on the persistent volume. Only registered Top 40 players and human guild members are accepted.
- `/top40 channel destination:<text channel>` changes the event notification destination.

`GET /top40/notifications` on the existing bot service exposes only operational counts and state; it never returns account IDs or private link records. This route is read-only and does not send messages.

Validation: `node scripts/top40-notifications-check.mjs` covers release gating, the exact 72-hour boundary, completed/pending/bye/reset suppression, both-recipient resolution, allowed mentions, concurrent polls, restart persistence, history failure, an uncertain send followed by recovery, late catch-up, corrupt-ledger safety and owner-only controls.
