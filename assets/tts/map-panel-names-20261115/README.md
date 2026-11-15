# Map names on every Infinity control panel

Adds each loaded map's name below the Map Controls heading and to its collapsed tab across the approved 104-setup collection. All 162 controllers and eight existing drawer variants are patched without changing their control behavior or assets.

The input is the Aurora VII RC1 installer from commit `76b7102294bb70133361625f3297e80852d6ec7e`. General map names come from its current bag labels; Top 40 names are linked to their matching general maps. This preserves the newer Vanta Customs Yard and Veyra Gate names.

Download the installer in `release/`, extract the entire ZIP, run `INSTALL.cmd`, and load **Lobo Infinity Maps - All 104 Map Names on Controls - RC1**. After checking it in TTS, update Workshop item **3719263238** through Upload > Workshop Upload > Update Workshop.

Live TTS import, fresh-cache loading, multiplayer and Windows installer execution have not been tested; this is a release candidate. Steam Workshop publication has not been performed automatically.

## Reproduce

Requires Python 3, Pillow and Lupa. Extract the baseline installer to BASELINE. Run:

```sh
python3 scripts/build.py BASELINE CATALOG_JSON PACKAGE
python3 scripts/validate.py BASELINE/Workshop-Save.json PACKAGE/Workshop-Save.json CHECKS
python3 scripts/verify-assets.py BASELINE/all-assets-validation.json PACKAGE/assets-validation.json
python3 scripts/package-release.py PACKAGE CHECKS release
```

The catalogue is `lobo-infinity-portal/shared/lobo-workshop-current.json`; the saved map-bag labels take precedence over stale catalogue names. The installer copies the ready save and verifies its checksum. No hosted assets are added or repointed.

See `release/VALIDATION.md` and `release/Map-Name-Coverage.csv` for exact coverage and verification.
