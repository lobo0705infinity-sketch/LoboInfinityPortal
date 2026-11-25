"""Add the shared order panel and Army Spawner bootstrap to an approved map owner."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOADER = (ROOT / "table-tools.lua").read_text().rstrip()
MOUNT = " local function mount()\n  if not deployed()or not loboLifeToken or not loboLifeAlive()then return end\n"
CALL = "  ensureTableTools()\n"


def add_to_owner(script):
    if "LOBO_STANDARD_VERSION=1" not in script:
        return script
    if LOADER in script and MOUNT + CALL in script:
        return script
    if script.count(MOUNT) != 1 or "local function ensureTableTools()" in script:
        raise ValueError("Unrecognized table-tool bootstrap or map controls")
    return script.replace(MOUNT, LOADER + "\n" + MOUNT + CALL)
