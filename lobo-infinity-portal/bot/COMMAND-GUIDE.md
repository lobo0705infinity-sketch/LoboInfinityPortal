# Lobo’s Little Helper command groups

`/kill lobo` posts the looping dramatic Lobo death GIF in the current channel with **TELL EVERYONE I DIED COOL.** Everyone can use it; it has no player, game or moderation effects. The animation is bundled with the worker and uploaded as a Discord attachment.

Grouped commands replace the nine legacy slash-menu entries listed below. Compact responses, private detail views and connected actions reuse the existing handlers. Combat formulas and rating formats are unchanged.

| Task | Grouped command | Retired slash command |
|---|---|---|
| Analyse an army | `/list analyse` | `/inf-list` |
| Generate three mission-guided options | `/list build` | `/build-list` |
| Generate a random legal army | `/list random` | `/random-list` |
| Print a model identification sheet | `/list identify` | `/inf-id` |
| Exchange lists after a game report | `/list game create/join/status/cancel` | — |
| Compare two profiles | `/combat matchup` | `/matchup` |
| Find ARO counters | `/combat counters` | `/aro-counter` |
| Set/read/remove recurring availability | `/play availability set/show/clear` | `/availability set/show/clear` |
| Post/close a one-off game request | `/play find now/close` | `/find-game now/close` |
| Review incorrect-answer reports | `/admin reports` | `/bot-reports` |
| Inventory server bots and webhook publishers | `/admin bots` | — |

`/list build` refreshes its search on every use. Across three options it searches for a TAG and a capable active combat Lieutenant, subject to faction availability, required models, points and mission checks. A linked Lieutenant qualifies only when its legal Fireteam is present. Active Lieutenant options identify whether Chain of Command is available.

Alternatives must change at least a third of their smaller combat core (unit types, ignoring loadouts and copies) and pass a whole-roster difference check. Required unit types are excluded from the core comparison. If the search cannot find three distinct options or include a requested strategic choice, the initial response says so; it does not pad the set with near-identical lists. Recent-result memory is bounded and resets when the bot restarts.

`/rules` and `/mission` remain direct reference commands. `/mission` uses the `scenario` input.

`/list game create` takes the opponent's Discord account, your own `army-code` and a `game-name`. LLH saves your list and DMs the opponent a game code. The invited account uses `/list game join game:LLH-… army-code:…` in the same server to save their own list and automatically lock both. LLH privately confirms each action and DMs the creator when the opponent joins. If a DM fails, the private response explains how to continue. Enter the code when reporting; the existing accepted-report exchange remains unchanged. The older submit/ready commands remain available for games created before this flow.

`/help` opens an ephemeral guide with Army Lists, Combat, Game Reference and Find a Game buttons. Server managers also see Server Tools. The report-review command remains restricted to Manage Server, with the permission checked again when invoked.

Grouped commands reuse the current handlers and their options, autocomplete, rate/concurrency limits, deferred replies, downloads and error handling. Reports record the grouped name and nested options selected by the user. Availability and urgent requests still use the existing stores and scheduling feed.

Registration creates or updates list, combat, play, help and admin before retiring the nine explicitly superseded slash commands in guild and global scope. Only this application’s registrations are touched; unrelated commands remain. Removal is verified by fetching the live registrations again. Repeated starts avoid writes when definitions match and never recreate the retired entries.

Army analysis initially shows legality, points/SWC, a short rating summary, the readable army image and the TTS JSON download. Tactical Brief, Ratings (including `rating-explanations.txt`), Classifieds (all 20 cards) and TTS Notes open privately. Create ID Sheet reuses the submitted army code.

Build still returns three options with summaries and TTS downloads. Each option has Build Notes, Classifieds, TTS Notes, Analyse This List and Create ID Sheet. Random armies have Army Roster, Classifieds and TTS Notes plus the same connected actions. Matchup results have separate counter buttons for Model 1 and Model 2, using the exact selected profiles.

Detail buttons expire after seven days. Their snapshots survive worker restarts on the persistent volume. Other server members can open a public result privately; private-message results remain restricted to the original requester. Connected actions defer privately, reuse existing handlers and allow at most two concurrent button actions. Reports refer to the specific detail view or connected action, including its original message link.

Message-prefix commands have been removed; use `/list analyse` to analyse an army. Internal legacy handler names are preserved for grouped routes and connected buttons.

Checks: `node scripts/grouped-commands-check.mjs` exercises SDK option resolution, dispatch, autocomplete, three-list output, scheduling, permissions, help navigation, report inputs and additive/idempotent registration. It also runs in Dockerfile.bot. `node scripts/legacy-command-retirement-check.mjs` checks scoped deletion, replacement requirements, ownership, verification failures and idempotence.

Second-release checks: `node scripts/response-details-check.mjs` covers cached downloads, reporting, permissions, expiry, connected actions and concurrency, and runs in Dockerfile.bot.

`/admin bots` downloads a private inventory for the current server. `refresh:True` rescans; otherwise a saved report no older than one hour is used. Manage Server is checked when invoked. The worker also inventories at startup. Managed bot roles and REST member listing identify accounts, while webhook metadata and up to 50 recent messages in each of 100 readable text channels identify publishers. It uses existing permissions and marks unavailable sources or partial coverage. No message text, webhook token, or webhook URL is saved. This command does not modify roles, bot membership, webhook names, or automation settings.

Discord application webhook replies and follow-ups are counted under their bot account rather than as separate webhook publishers.

The bot inventory also lists delivery jobs, owners, schedules, channels and map-watcher checkpoint status. Portal maintenance cadence is labeled as declared in source; live Apps Script triggers have not been queried. Map/workshop announcements keep their checkpoint on the Railway persistent volume and wait if previous Discord posts cannot be checked.
