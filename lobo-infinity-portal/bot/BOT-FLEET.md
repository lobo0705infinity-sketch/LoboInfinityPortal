# Bot fleet and consolidation record

Verified on 2026-10-07 UTC using Railway production configuration and repository source.

| Component | Hosting and source | Responsibility | Decision |
|---|---|---|---|
| Lobo’s Little Helper | Railway `LoboInfinityPortal`, `Dockerfile.bot`, `bot/lobos-little-helper.mjs` | Army/TTS tools; rules/missions; combat comparisons; availability/game requests; map/workshop monitoring; help/reports | Keep as the primary interactive bot |
| Portal announcement publisher | Apps Script `backend/DiscordApi.gs` and `backend/AutomationApi.gs`; Vercel `api/automation-queue-worker.mjs` invokes the queue | League games, achievements, news, season events and recaps | Keep the queue and webhook delivery; this is a publisher, not a second Railway bot |
| Other Discord bot accounts and webhooks | `/admin bots` live inventory | Their functions and ownership must be verified individually | No account is proven redundant from deployment configuration alone |

Railway exposes one project, one bot service, one running replica and one 5 GB persistent volume at `/data`. The GitHub account exposes the populated LoboInfinityPortal repository and an empty private LoboInfinityLeague repository. No second owned bot service or bot implementation was found in those sources. This finding does not establish the absence of bots hosted elsewhere or third-party bots in Discord.

The main bot already owns the list, combat, reference and scheduling functions. Portal announcement delivery retains its existing queue, game-story ordering, retry state, commissioner controls and backend configuration. Moving only its display identity would not move the underlying delivery responsibility or retire a hosted service.

## Live discovery

`/admin bots` returns `bot-inventory.json` privately to members with Manage Server. Optional `refresh:True` rescans. The inventory runs once at worker startup and persists under `/data/bot-inventory`; `BOT_INVENTORY_PATH` provides a local override.

Sources: cached bot members; managed bot roles with exact member lookups; up to ten pages of REST member listing; guild webhook metadata; and a bounded sample of recent messages in readable text channels. It does not request additional Gateway intents or expand permissions. A denied REST member list falls back to roles and sampled publishers. The report distinguishes verified current members from accounts seen only in message history.

Reports retain names, IDs, roles, elevated permissions and activity counts/timestamps, and exclude message text, embeds, attachment URLs, webhook URLs and webhook tokens. Startup logs provide the bot/webhook names and coverage needed for operational verification, without raw upstream errors or credential-bearing objects.

## Retirement criteria

A replacement must have verified functions, owner-controlled hosting/configuration, preserved state and schedules, and tested delivery. A name match, broad permission, or quiet recent-message sample is not proof of redundancy. No bot account, webhook, role, credential, volume or automation job is removed automatically by discovery.

Checks: `scripts/bot-inventory-check.mjs` verifies bot/webhook separation, permissions, denied-source fallbacks, coverage, bounded scanning, secret exclusion, persistence, simultaneous refresh deduplication and the manager-only grouped command. The check runs in the production image.

Discord application webhook replies and follow-ups are counted under their bot account rather than as separate webhook publishers.
