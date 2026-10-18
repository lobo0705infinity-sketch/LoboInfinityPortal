"""Verify shipped SET_ bags against the normal Infinity stage's placement contract."""

import json
from pathlib import Path
import runpy
import struct
import sys
import zipfile

repair = runpy.run_path(str(Path(__file__).with_name("repair-map-alignment.py")))
angle, positions = repair["angle"], repair["positions"]
ROOT = Path(__file__).resolve().parent.parent


def f32(value):
    return struct.unpack("<f", struct.pack("<f", value))[0]


def stage_test(bags, receiver):
    """Execute the unmodified Workshop Stage logic with mocked TTS physics/storage.

    The only syntax translation is TTS's != extension to standard Lua's ~=.
    This exercises extraction, alignment retries, busy clearing and map removal.
    It does not render assets or run live TTS physics.
    """
    from lupa import LuaRuntime

    runtime = LuaRuntime(unpack_returned_tuples=True)
    runtime.globals().float32 = f32
    runtime.execute("""
        WORLD={};VARS={hld=0};MESSAGES={};CALLBACKS={};PRINTS={}
        Global={getVar=function(k) return VARS[k] end,setVar=function(k,v) VARS[k]=v end}
        function print(s) table.insert(PRINTS,s) end
        function broadcastToAll(s) table.insert(MESSAGES,s) end
        function getAllObjects() return {} end
        function getObjectFromGUID(id) return WORLD[id] end
        self={guid='2d647a',getPosition=function() return {0,1,0} end}
        function mockBag(id,source,ids)
            local bag={guid=id,name='Bag',getGUID=function() return id end}
            local name='SET_test'
            bag.getName=function() return name end
            bag.setName=function(s) name=s end
            bag.getLuaScript=function() return source end
            bag.getObjects=function()
                local result={};for _,guid in ipairs(ids) do table.insert(result,{guid=guid}) end
                return result
            end
            bag.lock=function() end;bag.setScale=function() end;bag.setPosition=function() end
            bag.destruct=function() WORLD[id]=nil end
            bag.takeObject=function(t)
                local obj={guid=t.guid,resting=true,name='Custom_Model'}
                local p={0,0,0};local r={0,0,0}
                obj.getPosition=function() return p end
                obj.getRotation=function() return r end
                obj.setPosition=function(v) p={float32(v[1]),float32(v[2]),float32(v[3])} end
                obj.setRotation=function(v) r={float32(v[1]%360),float32(v[2]%360),float32(v[3]%360)} end
                obj.getName=function() return '' end
                obj.lock=function() end;obj.setScale=function() end
                obj.destruct=function() WORLD[obj.guid]=nil end
                WORLD[obj.guid]=obj
                table.insert(CALLBACKS,function() _G[t.callback](obj) end)
            end
            WORLD[id]=bag
            return bag
        end
    """)
    source = Path(receiver).read_text().replace("!=", "~=")
    assert 'print("Failed Alignment.")' in source
    assert 'math.abs(r[1]-a) < 0.0005' in source
    runtime.execute(source)
    runtime.execute("self.call=function(fn) _G[fn]() end")
    globals_ = runtime.globals()
    results = []
    for bag in bags:
        runtime.execute("WORLD={};VARS={hld=0};MESSAGES={};CALLBACKS={};PRINTS={};cb=nil;bb=nil;sid=nil;zz=0")
        ids = [o["GUID"] for o in bag["ContainedObjects"]]
        mocked = globals_.mockBag(bag["GUID"], bag["LuaScript"], runtime.table_from(ids))
        globals_.onCollisionEnter(runtime.table_from({"collision_object": mocked}))
        runtime.execute("for _,callback in ipairs(CALLBACKS) do callback() end;CALLBACKS={}")
        max_frames = len(ids) * 115 + 30
        for frames in range(max_frames):
            if globals_.cb is None:
                break
            globals_.update()
        else:
            raise AssertionError(f"Stage stuck busy: {bag['Nickname']}")
        failures = sum(text == "Failed Alignment." for _, text in globals_.PRINTS.items())
        assert globals_.VARS.hld == 0
        for obj in bag["ContainedObjects"]:
            placed = globals_.WORLD[obj["GUID"]]
            assert placed is not None
            values = positions(bag)[obj["GUID"]]
            p, r = placed.getPosition(), placed.getRotation()
            assert all(abs(p[i + 1] - values[i]) < .0005 for i in range(3))
            if not failures:
                assert all(abs(r[i + 1] - values[i + 3]) < .0005 for i in range(3))
        globals_.btnTrash()
        assert all(globals_.WORLD[guid] is None for guid in ids), (bag["Nickname"], [(guid, [globals_.WORLD[guid].getPosition()[i] for i in range(1,4)]) for guid in ids if globals_.WORLD[guid] is not None])
        assert globals_.VARS.hld == 0
        results.append({"name": bag["Nickname"], "objects": len(ids), "alignmentFailures": failures, "frames": frames + 1})
    return results


def main():
    catalog = json.loads((ROOT / "shared/lobo-workshop-current.json").read_text())
    with zipfile.ZipFile(ROOT / "public/assets/maps/its18-20261015T064536Z/Lobo-ITS18-Revised-Maps.zip") as original:
        source = json.loads(original.read("Lobo-ITS18-Revised-Library.json"))
    source_bags = {o["GUID"]: o for o in source["ObjectStates"] if o.get("Name") == "Bag"}
    assert angle(-.18) == 359.82
    assert angle(360) == 0
    assert angle(-.000000003) == 0
    records = 0
    reserves = 0
    bags = []
    with zipfile.ZipFile(ROOT / ("public" + catalog["download"])) as archive:
        for entry in catalog["maps"]:
            path = ROOT / ("public" + entry["download"])
            assert archive.read(path.name) == path.read_bytes()
            saved_object = json.loads(path.read_text())
            assert len(saved_object["ObjectStates"]) == 1
            bag = saved_object["ObjectStates"][0]
            bags.append(bag)
            assert bag["Name"] == "Bag" and bag["GUID"] == entry["guid"]
            assert len(bag["ContainedObjects"]) == entry["objectCount"]
            assert bag["LuaScript"].endswith("\r\n")
            assert "\n" not in bag["LuaScript"].replace("\r\n", "")
            assert all(line.startswith("--") for line in bag["LuaScript"].splitlines())
            assert "createButton" not in bag["LuaScript"]
            original_bag = source_bags[bag["GUID"]]
            old = positions(original_bag)
            expected = repair["canonical_records"](original_bag)
            actual = positions(bag)
            assert set(actual) == set(old)
            assert {o["GUID"] for o in bag["ContainedObjects"]} == set(actual)
            for guid, values in actual.items():
                records += 1
                if expected[guid][:3] != old[guid][:3]:
                    reserves += 1
                    assert values[0] == 32 and abs(values[2]) <= 24
                assert all(abs(values[i] - expected[guid][i]) < .000001 for i in range(3))
                assert abs(values[0]) < 44 and abs(values[1]) < 26 and abs(values[2]) < 26
                for i in range(3, 6):
                    value = values[i]
                    assert 0 <= value < 360
                    assert abs(value - f32(value)) < .0005
                    assert abs((value - old[guid][i] + 180) % 360 - 180) <= .000051
            # Only rotation fields may change within scenery, including alternate states.
            normalized = json.loads(json.dumps(original_bag["ContainedObjects"]))
            for obj in normalized:
                repair["normalize_transforms"](obj)
            assert normalized == bag["ContainedObjects"]
    result = {"bags": len(bags), "placementRecords": records, "reserveTokensRelocated": reserves, "terrainAndAssetParity": True, "liveTtsVerified": False}
    if "--receiver" in sys.argv:
        receiver = sys.argv[sys.argv.index("--receiver") + 1]
        # First reproduce the bug, using the real loader and one signed-angle record.
        bad = json.loads(json.dumps(bags[0]))
        rows = bad["LuaScript"].splitlines()
        fields = rows[0].split(",")
        fields[4] = "-0.18"
        rows[0] = ",".join(fields)
        bad["LuaScript"] = "\r\n".join(rows) + "\r\n"
        baseline = stage_test([bad], receiver)
        assert baseline[0]["alignmentFailures"] > 0
        deployed = stage_test(bags, receiver)
        assert all(item["alignmentFailures"] == 0 for item in deployed)
        result.update(actualStageLuaExecuted=True, badRotationReproduced=True, deployClearCycles=len(deployed), alignmentFailures=0)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
