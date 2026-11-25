"""Upgrade saved map controls in place without regenerating a map's terrain or other scripts."""
import argparse
import json
from pathlib import Path
import re

from mission_links import assignment
from patch_maps import bags, walk

ROOT = Path(__file__).resolve().parent
REVISION = "lobo-standard-20261125-missionlinks"
OLD_REVISION = "lobo-standard-20261118-v1"
META = re.compile(r'^LOBO_STANDARD_META=JSON.decode\((".*")\)$', re.M)
EMBED = re.compile(r'^local loboLifeBrokerData=(".*")$', re.M)
LEGACY_PANEL = re.compile(r'^ local function missionPanel\(\).*?(?=^ local function mount\(\))', re.M | re.S)
LINK = (ROOT / "mission-link.lua").read_text()

def dumps(data):
    return json.dumps(data, ensure_ascii=True, separators=(",", ":"))

def broker(script):
    old = "(groups.mission[1]or groups.fallbackmission[1])"
    if script.count(old) == 2:
        script = script.replace(old, "groups.fallbackmission[1]")
    elif script.count("'Mission',groups.fallbackmission[1]") != 2:
        raise ValueError("Unrecognized Mission button routing")
    return script.replace(OLD_REVISION, REVISION)

def control(script, bag):
    def embedded(match):
        obj = json.loads(json.loads(match[1]))
        obj["LuaScript"] = broker(obj["LuaScript"])
        return "local loboLifeBrokerData=" + json.dumps(dumps(obj))
    script = EMBED.sub(embedded, script)
    if re.search(r"^LOBO_UI_BROKER_VERSION=", script, re.M):
        script = broker(script)
    script = script.replace(OLD_REVISION, REVISION)
    match = META.search(script)
    if match:
        info = json.loads(json.loads(match[1]))
        if info["map"] != bag["GUID"]:
            raise ValueError(f"Map and owner disagree: {bag['Nickname']}")
        ident, url = assignment(bag, info.get("mission", ""))
        info.update(revision=REVISION, missionGeistId=ident, missionUrl=url)
        info.pop("missionText", None)
        script = META.sub(lambda _: "LOBO_STANDARD_META=JSON.decode("+json.dumps(dumps(info))+")", script)
        if LEGACY_PANEL.search(script):
            script = LEGACY_PANEL.sub(lambda _: LINK, script)
        if LINK not in script:
            raise ValueError(f"Unrecognized mission handler: {bag['Nickname']}")
        script = script.replace(" local missionReaders={}\n", "")
    return script

def update(data, *, play_table=False):
    setups = list(bags(data))
    changed = []
    for bag in setups:
        if play_table and not any(META.search(obj.get("LuaScript", "")) for obj in walk(bag)):
            continue
        owners = 0
        for obj in walk(bag):
            old = obj.get("LuaScript", "")
            if not old:
                continue
            owners += bool(META.search(old))
            new = control(old, bag)
            if old != new:
                obj["LuaScript"] = new
                changed.append((bag["GUID"], obj["GUID"], old, new))
        if owners != 1:
            raise ValueError(f"Expected one Mission owner for {bag['Nickname']}, got {owners}")
    # Ready-to-play saves can also include deployed copies of the terrain and a live broker.
    for top in data.get("ObjectStates", []):
        if top.get("Name") == "Bag":
            continue
        for obj in walk(top):
            old = obj.get("LuaScript", "")
            if not old or not (EMBED.search(old) or META.search(old) or "LOBO_UI_BROKER_VERSION=" in old):
                continue
            match = META.search(old)
            bag = {}
            if match:
                info = json.loads(json.loads(match[1]))
                bag = {"GUID": info["map"], "Nickname": info["title"]}
            obj["LuaScript"] = control(old, bag)
    return setups, changed

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--play-table", action="store_true", help="Also accept unrelated base-mod scenery bags")
    args = p.parse_args()
    save = json.loads(args.input.read_bytes())
    update(save, play_table=args.play_table)
    args.output.write_text(dumps(save))
