# The Dig access repair, 24 November 2026

Updates only Research Annex East, Central Survey Annex, Civic Corner West, Tenement South and Central Ruined Block in the general and Winners Round 4 setups. Preserves original transforms, textures, furniture, unrelated geometry and controls.

The renderer adds optional map-name text in the original LOBO header slot. The rendered buttons are identical before and after. Unchanged maps retain the previous exact renderer; validation accepts those two exact header variants during migration.

`build.py` patches original OBJ groups and retains material UVs. `compact.py` losslessly deduplicates OBJ references. `verify.py` compares rendered buttons, checks unrelated objects, compiles Lua and exercises controls. `package.py` builds the Windows installer from Go sources, using the current published R14 collection as the fallback. `test_installer.py` checks clean installation and merging into an existing collection, including preservation of the other 103 maps and existing save files.

Public mesh revision: 4c47230383fc12b04c745af1dbe93135a91fd065. Installer package: Lobo-The-Dig-Workshop-Update-R2.zip.

Tests simulate TTS APIs; no native TTS or Steam publication is claimed. Geometry render is for local inspection only.

## R3 correction

R2 could import an already-deployed battlefield from the newest local save. R3 always uses the clean included approved collection. It never imports local session objects, globals, or UI. Regression tests include a saved unrelated battlefield and stale controller. Existing saves remain untouched. Building assets and all map control buttons are unchanged.
