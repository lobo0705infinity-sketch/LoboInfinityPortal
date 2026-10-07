# Lobo’s Little Helper command groups

The first organization release adds grouped commands alongside every existing command. The second release adds compact responses, private detail views and connected actions. Combat formulas and rating formats are unchanged.

| Task | Grouped command | Existing command |
|---|---|---|
| Analyse an army | `/list analyse` | `/inf-list`, `!!inf-list` |
| Generate three mission-guided options | `/list build` | `/build-list` |
| Generate a random legal army | `/list random` | `/random-list` |
| Print a model identification sheet | `/list identify` | `/inf-id` |
| Compare two profiles | `/combat matchup` | `/matchup` |
| Find ARO counters | `/combat counters` | `/aro-counter` |
| Set/read/remove recurring availability | `/play availability set/show/clear` | `/availability set/show/clear` |
| Post/close a one-off game request | `/play find now/close` | `/find-game now/close` |
| Review incorrect-answer reports | `/admin reports` | `/bot-reports` |
| Inventory server bots and webhook publishers | `/admin bots` | — |

`/rules` and `/mission` remain direct reference commands. `/mission` uses the `scenario` input.

`/help` opens an ephemeral guide with Army Lists, Combat, Game Reference and Find a Game buttons. Server managers also see Server Tools. The report-review command remains restricted to Manage Server, with the permission checked again when invoked.

Grouped commands reuse the current handlers and their options, autocomplete, rate/concurrency limits, deferred replies, downloads and error handling. Reports record the grouped name and nested options selected by the user. Availability and urgent requests still use the existing stores and scheduling feed.

Registration creates or updates only the five new names: list, combat, play, help and admin. It does not bulk-replace or delete existing commands. Repeated starts avoid writes when the registered definitions match.

Army analysis initially shows legality, points/SWC, a short rating summary, the readable army image and the TTS JSON download. Tactical Brief, Ratings (including `rating-explanations.txt`), Classifieds (all 20 cards) and TTS Notes open privately. Create ID Sheet reuses the submitted army code.

Build still returns three options with summaries and TTS downloads. Each option has Build Notes, Classifieds, TTS Notes, Analyse This List and Create ID Sheet. Random armies have Army Roster, Classifieds and TTS Notes plus the same connected actions. Matchup results have separate counter buttons for Model 1 and Model 2, using the exact selected profiles.

Detail buttons expire after seven days. Their snapshots survive worker restarts on the persistent volume. Other server members can open a public result privately; private-message results remain restricted to the original requester. Connected actions defer privately, reuse existing handlers and allow at most two concurrent button actions. Reports refer to the specific detail view or connected action, including its original message link.

Existing command names have no removal date in this release.

Checks: `node scripts/grouped-commands-check.mjs` exercises SDK option resolution, dispatch, autocomplete, three-list output, scheduling, permissions, help navigation, report inputs and additive/idempotent registration. It also runs in Dockerfile.bot.

Second-release checks: `node scripts/response-details-check.mjs` covers cached downloads, reporting, permissions, expiry, connected actions and concurrency, and runs in Dockerfile.bot.

`/admin bots` downloads a private inventory for the current server. `refresh:True` rescans; otherwise a saved report no older than one hour is used. Manage Server is checked when invoked. The worker also inventories at startup. Managed bot roles and REST member listing identify accounts, while webhook metadata and up to 50 recent messages in each of 30 readable text channels identify publishers. It uses existing permissions and marks unavailable sources or partial coverage. No message text, webhook token, or webhook URL is saved. This command does not modify roles, bot membership, webhook names, or automation settings.
