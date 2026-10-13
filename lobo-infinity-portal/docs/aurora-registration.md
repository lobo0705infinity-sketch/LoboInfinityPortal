# Aurora VII league registration

Portal: `/campaign/aurora-vii/register`. The portal displays live count-only
availability and helps the player choose a faction. Registration completes in
Lobo's Discord server with `/aurora register faction:<choice> player:<portal name>`.
The Discord interaction provides the verified account identity; no typed Discord
ID or username is trusted and no additional OAuth credentials are required.

Allowed factions are PanOceania, Yu Jing, O-12, Combined Army, NA2, Tohaa, JSA,
Ariadna, ALEPH and Haqqislam. Nomads and sectorial entries are not registration
choices. Players register under a parent faction.

Each faction initially has five places. When all ten factions reach the current
limit, the limit permanently increases by five. This repeats without an overall
player cap. A withdrawal releases one place but never lowers an unlocked tier.
One Discord account and one normalized player name can register once. Changing
factions requires `/aurora withdraw` followed by another registration, subject to
the current capacity. `/aurora status` privately reports the account's signup.

The bot creates ten roles named `Aurora VII — <Faction>` in the configured Lobo
guild only. Roles have no permission grants and are not mentionable by default.
The bot needs Manage Roles and must be above these roles in the hierarchy. If
existing campaign role names are ambiguous, privileged or unmanageable, signup
fails closed until the commissioner resolves it.

## Runtime ownership and failure recovery

The existing Railway bot service has exactly one replica and its `/data` volume.
`/data/aurora-vii-registrations.json` is the authoritative private signup ledger,
separate from the GM's campaign scoring sheet. Its path can be overridden by
`AURORA_REGISTRATION_PATH` for tests. The service serializes signup mutations and
uses fsynced atomic replacements. An unreadable or corrupt file is never silently
replaced. Do not scale this service to multiple writers; migrate to transactional
shared storage before adding replicas. Include the ledger in volume backups.

Registration is persisted as pending before role assignment. Pending places count
towards the limit. Failed role requests are retried every minute and on restart.
Repeating the same signup reuses the reservation. Role requests are idempotent;
only successful assignment marks the record assigned. A player can withdraw a
pending place too. Withdrawal removes the role before deleting the ledger record;
if deletion fails, the role is restored where possible and the record stays.

The Railway HTTP listener binds `PORT` or 8080 and exposes only
`GET /aurora-vii/registration`. It publishes faction counts, the current limit and
availability. It has no write API and never publishes names or Discord IDs. The
Vercel endpoint `/api/aurora-registration` validates and projects this count-only
response. It returns 503 when live counts are unavailable; the portal disables
the handoff controls instead of treating unavailable counts as empty factions.
The bot rechecks current capacity for every signup even if portal counts are old.

The registration UI adds no Discord announcements or messages to other members.
Command confirmations and status responses are private to the invoking player.

## Private faction channels

The bot also creates one `Aurora VII — Factions` category and ten text channels
named with the faction IDs. This requires Manage Channels as well as Manage Roles.
The category denies View Channel to @everyone. Each text channel has exactly
three overwrites: @everyone denied View Channel, the bot account allowed access,
and its matching campaign faction role allowed viewing, posting and history.
Other faction roles have no access grant. Server owners and administrators retain
Discord's normal permission bypass. Registration/withdrawal changes the role and
therefore channel access automatically. No separate per-player overwrite is used.

Setup retries once a minute and verifies actual Discord overwrites before marking
`channelsReady`. It reuses existing channels in that category and repairs extra
access grants. A missing channel-management permission does not block league
registration. Only the campaign category and channels are reconciled.

## Verification

`npm run test:aurora-registration` checks concurrency at capacity, duplicate
identities and names, exact faction choices, all tier transitions through 20,
restarts, withdrawals, corrupt-ledger safety, public projection privacy, role
creation permissions, retry recovery, and Discord server scoping. The check runs
in both Vercel and bot builds and uses only temporary storage and mocked Discord.

## Faction briefing publication

Commissioner-approved briefings are published as one embed in each matching
private faction text channel and pinned after Discord read-back verification.
The ten drafts cover current motivations, scoring and coordination; they do not
reveal future story or assign Secret Objectives. Each publication has its own
private volume checkpoint and bot-authored marker. The existing Ariadna checkpoint
and exact approved wording are reused. Manage Messages is required to pin an
unpinned post. Missing permission leaves the existing post pending and is retried
each minute without reposting. Completed publication does not override later
moderator edits or unpins. Public status contains only completion flags and
Discord links, never briefing text.
