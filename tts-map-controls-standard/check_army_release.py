"""Verify the Army spawner reached through the active Workshop installer and portal exports."""
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from army_sideboards import REVISION, check
from test_army_sideboards import army_import, run_launcher

APP = Path(__file__).resolve().parents[1] / "lobo-infinity-portal"
PUBLIC = APP / "public"

def public_file(url):
    path = (PUBLIC / url.lstrip("/")).resolve()
    if not path.is_relative_to(PUBLIC.resolve()):
        raise ValueError("Asset outside the portal")
    return path

def digest(data):
    return hashlib.sha256(data).hexdigest()

def installer_payload(installer):
    with zipfile.ZipFile(installer) as archive:
        if "Files/payload.zip" in archive.namelist():
            return archive.read("Files/payload.zip")
        spec = json.loads(archive.read("Files/download-manifest.json"))
        assert spec["parts"] and all(Path(n).name == n for n in spec["parts"])
        payload = b"".join((installer.parent / name).read_bytes() for name in spec["parts"])
        assert digest(payload) == spec["sha256"], "Installer payload checksum"
        return payload

def verify_release():
    current = json.loads((APP / "shared/lobo-workshop-current.json").read_bytes())
    inventory = json.loads(public_file(current["releaseInventory"]).read_bytes())
    settings = inventory["tableTools"]
    assert settings["armyLauncherRevision"] == REVISION
    manifest = json.loads(public_file(settings["armyReleaseManifest"]).read_bytes())
    assert re.fullmatch(r"[a-zA-Z0-9_-]+", manifest["directory"])
    assert re.fullmatch(r"[0-9a-f]{40}", manifest["commit"])
    parts = [public_file(f"/assets/maps/{manifest['directory']}/army-spawner-{i}.txt").read_bytes() for i in range(1, 5)]
    assert [len(part) for part in parts] == manifest["sizes"]
    with zipfile.ZipFile(io.BytesIO(installer_payload(public_file(current["installer"])))) as payload:
        collection = json.loads(payload.read("Workshop-Save.json"))
        owners = check(collection, require_room=True)
        assert owners == len(inventory["maps"]) > 0
        for name in payload.namelist():
            if name.endswith(".json") and name != "Workshop-Save.json":
                save = json.loads(payload.read(name))
                if isinstance(save, dict) and "ObjectStates" in save:
                    check(save, require_room="play" in name.lower())
    rows = inventory["maps"] + inventory.get("standalone", [])
    published = json.loads((APP / "shared/lobo-map-controls-releases.json").read_bytes())
    assert published == {row["guid"]: row["download"] for row in rows}, "Map pages use an older download index"
    with zipfile.ZipFile(public_file(current["download"])) as archive:
        packed = sorted(digest(archive.read(name)) for name in archive.namelist() if name.endswith(".json"))
    assert packed == sorted(row["sha256"] for row in rows), "Map bag download and individual exports differ"
    for row in rows:
        raw = public_file(row["download"]).read_bytes()
        assert digest(raw) == row["sha256"], row["download"]
        assert check(json.loads(raw)) == 1, row["guid"]
    launcher = next(obj["LuaScript"] for obj in collection["ObjectStates"]
                    if "LoboArmyLauncherBlue" in obj.get("Tags", []))
    spawner = run_launcher(manifest, [part.decode() for part in parts], launcher)
    profiles = army_import(spawner)
    print(f"Verified both sideboards, {owners} Workshop setups, {len(rows)} map exports and {profiles} Shadowcrow profiles.")

if __name__ == "__main__":
    verify_release()
