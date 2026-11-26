"""Add the shared order panel and Army Spawner bootstrap to an approved map owner."""
from pathlib import Path
from army_sideboards import canonical_loader, upgrade_owner

ROOT = Path(__file__).resolve().parent
LOADER = canonical_loader()
MOUNT = " local function mount()\n  if not deployed()or not loboLifeToken or not loboLifeAlive()then return end\n"
CALL = "  ensureTableTools()\n"


def add_to_owner(script):
    if "LOBO_STANDARD_VERSION=1" not in script:
        return script
    if "local function ensureTableTools()" in script:
        updated=upgrade_owner(script)
        if "local function ensureButton(side,source)" not in updated or MOUNT + CALL not in updated:
            raise ValueError("Unrecognized existing table tool bootstrap")
        return updated
    if LOADER in script and MOUNT + CALL in script:
        return script
    if script.count(MOUNT) != 1 or "local function ensureTableTools()" in script:
        raise ValueError("Unrecognized table-tool bootstrap or map controls")
    return script.replace(MOUNT, LOADER + "\n" + MOUNT + CALL)
