"""Build normal-Infinity drop-zone bags with canonical, loader-safe rotations."""

import argparse
import copy
import json
import math
from pathlib import Path
import re
import zipfile

from map_markings import repair_markings, install_markings


DEPLOYMENT = "Deployment: take this bag into the normal Infinity mod and drop it onto its map deployment spot."
MAT_SCALE = 24  # Original 48-inch tile geometry; the apparent inset was a drawn outline.


def angle(value):
    value = float(value)
    if not math.isfinite(value):
        raise ValueError("Non-finite map rotation")
    # Match native Stage exports' hundredth-degree precision. Unity leaves
    # negative Euler values within ~0.00573 degrees of zero negative on readback;
    # simply wrapping -0.0014 to 359.9986 therefore does not round-trip.
    return round(value % 360, 2) % 360


def positions(bag):
    script = bag.get("LuaScript", "")
    # Native SET_ bags store one GUID and six numbers per CRLF-delimited comment.
    rows = [line[2:].split(",") for line in script.splitlines() if re.match(r"^--[0-9a-f]{6},", line)]
    if rows:
        result = {}
        for row in rows:
            if len(row) != 7 or row[0] in result:
                raise ValueError("Invalid or duplicate map placement record")
            result[row[0]] = list(map(float, row[1:]))
        return result
    # Convert the previous button-based loader without changing its authored positions.
    match = re.search(r'local POS=JSON.decode\(("(?:\\.|[^"\\])*")\)', script)
    if not match:
        raise ValueError(f"No placement records: {bag.get('Nickname')}")
    return json.loads(json.loads(match[1]))


def normalize_transforms(obj):
    if not isinstance(obj, dict):
        return
    transform = obj.get("Transform", {})
    for key in ("rotX", "rotY", "rotZ"):
        if key in transform:
            transform[key] = angle(transform[key])
    for key in ("ContainedObjects", "ChildObjects"):
        for child in obj.get(key, []):
            normalize_transforms(child)
    for state in obj.get("States", {}).values():
        normalize_transforms(state)


def canonical_records(bag):
    records = positions(bag)
    for obj in bag.get("ContainedObjects", []):
        values = records[obj["GUID"]]
        # The Stage's Clear Map intentionally ignores |z| >= 26. Keep reserve
        # mission pieces outside the 48-inch play area but inside its clear zone.
        if abs(values[2]) >= 26:
            reserve = obj.get("Name") == "Custom_Assetbundle" and re.match(
                r"^(?:Data Pack|ID Token |Hyperthermal Tech |Supply Box )", obj.get("Nickname", ""))
            if not reserve or abs(values[0]) > 24 or abs(values[2]) > 30:
                raise ValueError(f"Unexpected object outside Stage clear area: {obj['GUID']}")
            values[0], values[2] = 32.0, values[0]
        values[3:] = [angle(v) for v in values[3:]]
    return records


def repair_bag(bag):
    records = canonical_records(bag)
    install_markings(bag, records)
    objects = bag.get("ContainedObjects", [])
    if set(records) != {o["GUID"] for o in objects}:
        raise ValueError(f"Placement/inventory mismatch: {bag.get('Nickname')}")
    lines = []
    for obj in objects:
        values = records[obj["GUID"]]
        if len(values) != 6 or not all(math.isfinite(float(v)) for v in values):
            raise ValueError("Invalid placement values")
        values = [float(v) for v in values[:3]] + [angle(v) for v in values[3:]]
        lines.append("--" + obj["GUID"] + "," + ",".join(f"{v:.6f}" for v in values))
    bag["LuaScript"] = "\r\n".join(lines) + "\r\n"
    bag["LuaScriptState"] = ""
    bag.pop("AttachedButtons", None)
    description = re.sub(r"\n*(?:Deployment:.*|Use LOAD MAP / RETRACT MAP\.)", "", bag.get("Description", ""))
    bag["Description"] = description.rstrip() + "\n\n" + DEPLOYMENT
    for obj in objects:
        normalize_transforms(obj)
        calibrate_mat(obj, records[obj['GUID']])
    return bag


def calibrate_mat(obj, position):
    # Preserve original mat geometry; correct the scaled drawing overlay instead.
    repair_markings(obj)


def repair_table(table):
    count = 0
    for obj in table.get("ObjectStates", []):
        if obj.get("Name") == "Bag" and obj.get("Nickname", "").startswith("SET_"):
            repair_bag(obj)
            count += 1
    if not count:
        raise ValueError("No SET_ map bags found")
    return count


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def build_portal(root, destination):
    catalog_path = root / "shared/lobo-workshop-current.json"
    catalog = json.loads(catalog_path.read_text())
    # Rebuild the active collection, including newer Satellite replacements.
    # Falling back to the original 2026-10-15 export would restore old terrain.
    source_zip = root / ("public" + catalog["download"])
    if not source_zip.is_file():
        source_zip = root / "public/assets/maps/its18-20261015T064536Z/Lobo-ITS18-Revised-Maps.zip"
    with zipfile.ZipFile(source_zip) as source:
        library_name = ("Lobo-ITS18-Drop-Zone-Library.json" if "Lobo-ITS18-Drop-Zone-Library.json" in source.namelist()
                        else "Lobo-ITS18-Revised-Library.json")
        table = json.loads(source.read(library_name))
    bags = {o["GUID"]: o for o in table["ObjectStates"] if o.get("Name") == "Bag"}
    output = root / "public/assets/maps" / destination
    output.mkdir(parents=True, exist_ok=True)
    archive_files = []
    for entry in catalog["maps"]:
        bag = repair_bag(bags[entry["guid"]])
        bag["Locked"] = False
        bag["Transform"].update(posX=0, posY=2, posZ=0, rotX=0, rotY=0, rotZ=0)
        path = output / (entry["slug"] + ".json")
        write_json(path, {"ObjectStates": [bag]})
        archive_files.append(path)
        entry["download"] = f"/assets/maps/{destination}/{path.name}"
    # The collection remains a game save; individual downloads are Saved Objects bags.
    table["LuaScript"] = ""
    table["LuaScriptState"] = ""
    table["SaveName"] = "Lobo ITS18 | Drop-zone maps | Alignment fixed"
    library_path = output / "Lobo-ITS18-Drop-Zone-Library.json"
    write_json(library_path, table)
    archive_files.append(library_path)
    readme = output / "README.txt"
    readme.write_text(
        "LOBO ITS18 MAPS - ALIGNMENT REPAIR\n\n"
        "Individual JSONs: close TTS, copy the chosen JSON into Documents/My Games/Tabletop Simulator/Saves/Saved Objects, "
        "then start TTS, open the normal Infinity mod, use Objects > Saved Objects to spawn the bag, and drop it onto the map deployment spot.\n\n"
        "Collection JSON: copy Lobo-ITS18-Drop-Zone-Library.json into Documents/My Games/Tabletop Simulator/Saves, "
        "load it with Games > Save & Load, and right-click a map bag > Save Object. "
        "Open the normal Infinity mod and drop that saved bag onto its map deployment spot.\n\n"
        "Use the normal Infinity stage controls to clear the previous map. "
        "If an older map is already stuck busy, start from a fresh load of the normal Infinity mod.\n\n"
        "R6 removes the oversized gray perimeter and converts mission line widths into mat-local units. "
        "Original mat dimensions are retained. The exports use 0 <= angle < 360 and CRLF placement records. "
        "Terrain positions, GUIDs, mission contents and layouts are preserved. "
        "Spare mission tokens use a side tray within the Stage's clear area. "
        "Automated compatibility checks do not substitute for live TTS verification.\n"
    )
    archive_files.append(readme)
    archive = output / "Lobo-ITS18-Drop-Zone-Maps.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for path in archive_files:
            info = zipfile.ZipInfo(path.name, (2026, 10, 18, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            bundle.writestr(info, path.read_bytes())
    # The collection save is distributed inside the archive, not duplicated on hosting.
    library_path.unlink()
    catalog["download"] = f"/assets/maps/{destination}/{archive.name}"
    catalog["downloadRevision"] = "2026-10-18-marking-width-fix-r6"
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"Built {len(catalog['maps'])} drop-zone bags and collection: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--portal-root", type=Path)
    parser.add_argument("--destination", default="its18-markings-20261018-r6")
    parser.add_argument("--table", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.portal_root:
        build_portal(args.portal_root, args.destination)
    if args.table:
        if not args.output or args.table.resolve() == args.output.resolve():
            parser.error("--table requires a separate --output path")
        table = json.loads(args.table.read_text())
        count = repair_table(table)
        write_json(args.output, table)
        print(f"Repaired {count} bags: {args.output}")

