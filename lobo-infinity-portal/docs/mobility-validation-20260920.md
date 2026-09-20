# Provisional mobility validation — 2026-09-20

Fixed MOV extraction: the Workshop parser previously passed strings such as `6-4` to `Number()`, producing null. It now returns a two-value array in inches and rejects malformed values.

The separate mobility catalog uses live official Army data, not the older Workshop movement values. Army game centimeters are converted at 2.5 per inch. Profile-local and option-local skills are preserved; disabled options are skipped. Jet Propulsion includes Super-Jump once. Jump and Super-Jump distance modifiers are resolved independently of Combat Jump.

## Formula

For MOV A–B: base = 4A+B; Super-Jump = 2A; Climbing Plus = 1.5A. When both are present, use the larger bonus plus half the smaller. Jet Propulsion adds A. Each inch of jump allowance beyond the standard +2 adds two points. No categorical Aerial bonus is used.

These are proposed raw scores, not probabilities or percentiles. No combat blend or production rendering is enabled. Terrain Total, silhouette, and motorcycle traits are retained for future terrain tests; their effects are not simulated. Other movement-related skills such as Dodge and deployment skills are not scored. Future route tests are still required before treating this as a comprehensive mobility benchmark.

## Coverage

- Official payloads: 58; versions: 7.26246.158, 7.26246.159.
- Enabled profile/option entries: 13166.
- Missing movement: 0.
- No MOV attribute: 16 (official `[-1,-1]`; Netrods, Imetrons, seed forms); left unranked.

## Highest scoring distinct unit forms

Duplicates across sectorials and options with identical movement scores are collapsed. Equal scores are ties.

| Unit/form | MOV | Raw score |
|---|---|---:|
| FIREBAT Attack Wing — FIREBAT | 8–2 | 60 |
| FĒIQUÁN Imperial Tactical Wing — FĒIQUÁN | 8–2 | 60 |
| GO-POD — GO-POD | 8–2 | 60 |
| HAYTHAM Aero-unit — HAYTHAM | 8–2 | 60 |
| REDEYE Close Air Support Squad — REDEYE | 8–2 | 60 |
| SKYHOUNDS, Combat and Recon Air Squadron — SKYHOUND | 8–2 | 60 |
| Tarksia Interception Wing — TARKSIA | 8–2 | 60 |
| ZEYBEK Aero-unit — ZEYBEK | 8–2 | 60 |
| GARUDA Tacbots — GARUDA | 8–2 | 58 |
| KYRA SHARMA, The  Iron Maiden of the Optimates — KYRA SHARMA FTO | 6–4 | 48 |
| ROADBOTS Highway Patrol — ROADBOT — HIGH MOBILITY FORM | 8–4 | 48 |
| SERAPHS, Armoured Cavalry of Military Order — SERAPH | 6–4 | 48 |
| JUGGERNAUTS, Armored Assault Cavalry — JUGGERNAUT | 8–2 | 46 |
| LÉI GŌNG, Invincibles Lord of Thunder — LÉI GŌNG | 6–2 | 46 |
| METEOR ZONDS — METEOR ZOND | 6–4 | 46 |

All eight Aerial units have MOV 8–2, S7, Super-Jump (+3 inches), Jet Propulsion and Terrain (Total), and tie at 60 without a forced ranking override.

## Reproduce

From `lobo-infinity-portal`:

```sh
node scripts/tts-workshop-profile-catalog-check.mjs
node scripts/mobility-rating-check.mjs
node scripts/build-mobility-catalog.mjs --api data/infinity-army/mobility-provisional-catalog.json.gz.b64
```

The saved catalog is gzip-compressed UTF-8 JSON encoded as base64, matching the existing catalog storage convention. Existing combat catalogs and the older Workshop catalog are unchanged; rebuilding that Workshop catalog requires its original save.

Rules references: https://infinitythewiki.com/Super-Jump, https://infinitythewiki.com/Jump, https://infinitythewiki.com/Climbing_Plus, https://infinitythewiki.com/Aerial.
