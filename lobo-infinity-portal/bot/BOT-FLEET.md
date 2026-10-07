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

## Delivery ownership and schedule audit

| Job | Owner | Trigger / cadence | Duplicate-delivery control |
|---|---|---|---|
| List, combat, reference and scheduling commands | Lobo’s Little Helper | User command or connected button | Each grouped command delegates to its existing handler; aliases do not create a second scheduled job |
| Map and workshop updates | Lobo’s Little Helper | Startup, then every six hours by default | Resource checkpoint on the Railway volume; channel markers recognize prior successful sends; history-read failure defers delivery |
| Daily availability board | Lobo’s Little Helper | Check every five minutes; due at 07:00 Europe/Warsaw by default, configurable | Daily marker in Discord history; a failed history check prevents posting |
| One-off game requests | Lobo’s Little Helper | User action | Requests remain player-controlled rather than a second daily announcement schedule |
| League announcements and generated game stories | Portal Automation Queue / webhook publisher | League events, commissioner actions, queued maintenance | Queue IDs and delivery logs; submitted games wait for generated stories |
| Army Intelligence and automation queue maintenance | Apps Script clock → existing Vercel workers | Thirty-minute interval declared by installer code | Existing maintenance worker path; installed trigger inventory has not been verified live |
| Older commissioner announcement job | Apps Script `runDiscordAutomationJob` | Explicit commissioner invocation; daily/weekly/monthly selection | Shares the Discord delivery service; no automatic trigger for this function is established by this source audit |

The webhook publisher observed in Discord is named **Lobo League OS**. Its webhook configuration is not readable with the helper's current permissions. The queue-to-webhook mapping above is established by repository source, and does not claim a verified live webhook token or installed Apps Script trigger list.

The Vercel configuration contains no cron entry for these maintenance workers. Apps Script's installer owns the declared thirty-minute clock. Portal game announcements also have a direct-send guard, so the older direct `announceDiscordGameSubmitted` path cannot announce a submitted game before its story is ready. These paths have distinct functions; no duplicate automated job across the two publishers was proven.

The previous map-watcher state file lived in the container's temporary directory and was lost on deployment. `resourceStatePath()` now selects `rules-resource-watcher.json` on `RAILWAY_VOLUME_MOUNT_PATH`, preserves an explicit `INFINITY_RESOURCES_STATE_PATH` override, and retains the local fallback outside Railway. The watcher advances its checkpoint only after delivery succeeds. Map/workshop history failures now defer the check instead of treating the channel as empty.

`/admin bots` includes delivery owners, cadence, channel selection and the local map checkpoint status. The backend job records are explicitly source mappings, not live Apps Script status. No schedule, role, webhook, or commissioner setting is changed by reporting.

Production deployment triggers are scoped to the bot Dockerfile, bot sources, scripts, data, shared config/data, package manifests and Docker ignore files. Portal-only frontend/backend/API edits do not rebuild the Discord worker.

Validation includes `scripts/delivery-jobs-check.mjs` and `scripts/rules-resource-watcher-check.mjs`, now run in the production image. Tests exercise persistent state selection, failure without checkpoint advancement, partial delivery followed by a retry without a duplicate, restart state reuse and secret-free job reporting.
