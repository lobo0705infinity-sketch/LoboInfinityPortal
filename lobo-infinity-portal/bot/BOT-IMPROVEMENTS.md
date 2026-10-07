# Bot explanations and reports

- `/list analyse` offer `rating-explanations.txt` through the private Ratings button and images through Tactical Brief. Each model uses three short sections: Best use, What earns the rating, and What limits it. Entries show a relevant weapon range, global standing, measured Fireteam score changes and cross-role grades where available. CC uses the normal profile grade and names conditional score improvements without mixing comparison pools. Scores are not win probabilities; range modifiers are not matchup predictions.
- `/build-list` explains which S-grade combat or mission-specialist targets each option missed, remaining budget constraints and required models. The builder searches candidate lists; a missed target is not proof of infeasibility.
- List commands validate TTS object counts, combat groups and colors, camouflage states, decoys, numbered Holoprojector sets, GUIDs, script removal and asset reference syntax before attaching an export. `tts-validation.txt` includes all proxy/substitute notes. Asset URLs are not downloaded or guaranteed reachable by these checks.
- `/rules`, `/combat matchup`, `/list analyse`, `/list build` and `/list random` include **Report incorrect answer**. The button opens a reason/source form. Reports retain command inputs, text/embeds, text attachments, binary attachment names/sizes/SHA-256 fingerprints, reporter and source message link. The original Discord message retains the images and JSON files.
- Server managers (`Manage Server`) use the ephemeral `/bot-reports` command to download the last 25 reports for their own server. Ordinary members cannot read the queue. Repeated submissions by the same person for one answer are deduplicated.

Storage defaults to `/data/bot-feedback` on the Railway persistent volume; `BOT_FEEDBACK_PATH` overrides it for local testing. Unreported answer contexts expire after 30 days; submitted reports retain their context. No new provider credentials are needed.

Regression checks: `node scripts/bot-improvements-check.mjs`, `node scripts/tts-2d-export-check.mjs`, `node scripts/lobos-little-helper-check.mjs`, plus the Dockerfile's existing rules, list-generation and classified checks.

Detail snapshots default to `/data/bot-response-details` (`BOT_RESPONSE_PATH` locally), expire after seven days, and are pruned to a 512 MiB storage budget. Each snapshot is limited to 20 MiB. See COMMAND-GUIDE.md for the compact response and connected action behavior.
