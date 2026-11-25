"""Resolve an authored map assignment against the checked-in MissionGeist catalog."""
from functools import lru_cache
import json
from pathlib import Path
import re
import unicodedata

BASE = Path(__file__).resolve().parent
DIRECTORY = "https://infinitygeist.com/"
TOP40 = {
    "e1da22": "s18_data_harvest",
    "ca7100": "s18_corporate_appropriation", "3d6a97": "s18_superiority",
    "03c892": "s18_uplink_center", "8a1c29": "s18_the_dig", "f50418": "s18_area_of_interest",
    "a7c0c1": "s18_annihilation", "1e880b": "s18_provisioning", "bc0000": "s18_cutthroat",
    "bc00b7": "s18_battleground", "bc0117": "s18_neutralization", "bd0003": "s18_outbreak",
    "bc005f": "s18_hard_lock", "df2866": "s18_critical_intervention", "ff1100": "s18_double_bind",
}

def words(value):
    value = unicodedata.normalize("NFKD", value).casefold()
    return " ".join(re.findall(r"[a-z0-9]+", value))

@lru_cache(maxsize=1)
def catalog():
    rows = json.loads((BASE / "missiongeist-links.json").read_text())
    for identifier, row in rows.items():
        if row["url"] != DIRECTORY + "mission/" + identifier:
            raise ValueError(f"Invalid MissionGeist catalog URL for {identifier}")
    return rows

def assignment(bag, authored=""):
    title = words(bag["Nickname"].removeprefix("SET_"))
    rows = catalog()
    if "public terrain" in title and bag["GUID"] == "f5452f":
        return "", DIRECTORY
    if "top 40" in title:
        identifier = TOP40.get(bag["GUID"])
        if not identifier:
            raise ValueError(f"Assign a MissionGeist scenario to {bag['Nickname']}")
    else:
        match = re.match(r"its(\d+) (.*)", title)
        if match:
            choices = [key for key, row in rows.items() if key.startswith("s" + match[1] + "_")
                       and (" " + match[2] + " ").startswith(" " + words(row["name"]) + " ")]
        else:
            padded = " " + title + " "
            choices = []
            for key, row in rows.items():
                name = words(row["name"].removesuffix(" by Lobo"))
                if (" " + name + " " in padded or words(authored) == name) and not key.startswith("s18_"):
                    choices.append(key)
        if len(choices) != 1:
            raise ValueError(f"Expected one published mission for {bag['Nickname']}, got {choices}")
        identifier = choices[0]
    return identifier, rows[identifier]["url"]
