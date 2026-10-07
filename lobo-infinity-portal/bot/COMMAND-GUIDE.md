# Lobo’s Little Helper command groups

The first organization release adds grouped commands alongside every existing command. No generators, combat formulas, ratings formats or output attachments are changed.

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

`/rules` and `/mission` remain direct reference commands. `/mission` uses the `scenario` input.

`/help` opens an ephemeral guide with Army Lists, Combat, Game Reference and Find a Game buttons. Server managers also see Server Tools. The report-review command remains restricted to Manage Server, with the permission checked again when invoked.

Grouped commands reuse the current handlers and their options, autocomplete, rate/concurrency limits, deferred replies, downloads and error handling. Reports record the grouped name and nested options selected by the user. Availability and urgent requests still use the existing stores and scheduling feed.

Registration creates or updates only the five new names: list, combat, play, help and admin. It does not bulk-replace or delete existing commands. Repeated starts avoid writes when the registered definitions match.

The response redesign, connected action buttons and retirement of duplicate command names are later stages. Existing command names have no removal date in this release.

Checks: `node scripts/grouped-commands-check.mjs` exercises SDK option resolution, dispatch, autocomplete, three-list output, scheduling, permissions, help navigation, report inputs and additive/idempotent registration. It also runs in Dockerfile.bot.
