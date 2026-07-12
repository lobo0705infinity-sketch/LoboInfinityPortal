/*******************************************************
 * ArmyRegistry.gs
 *
 * Shared army-name canonicalization for stored game,
 * registration, army-list, stream, and analytics data.
 *******************************************************/

const ARMY_REGISTRY_ALIAS_MAP = {
  "pano": "PanOceania",
  "pan o": "PanOceania",
  "pan-o": "PanOceania",
  "vanilla pano": "PanOceania",
  "vanilla pan o": "PanOceania",
  "vanilla pan-o": "PanOceania",
  "vanilla panoceania": "PanOceania",
  "yj": "Yu Jing",
  "vanilla yj": "Yu Jing",
  "vanilla yu jing": "Yu Jing",
  "vanilla ariadna": "Ariadna",
  "haqq": "Haqqislam",
  "vanilla haqq": "Haqqislam",
  "vanilla haqqislam": "Haqqislam",
  "vanilla nomads": "Nomads",
  "ca": "Combined Army",
  "combined": "Combined Army",
  "vanilla ca": "Combined Army",
  "vanilla combined army": "Combined Army",
  "vanilla aleph": "ALEPH",
  "o12": "O-12",
  "o 12": "O-12",
  "vanilla o12": "O-12",
  "vanilla o 12": "O-12",
  "vanilla o-12": "O-12",
  "jsa": "Japanese Secessionist Army",
  "vanilla jsa": "Japanese Secessionist Army",
  "vanilla tohaa": "Tohaa",
  "shock army": "Shock Army of Acontecimento",
  "shock army acontecimento": "Shock Army of Acontecimento",
  "shock army of acontecimento": "Shock Army of Acontecimento",
  "acontecimento": "Shock Army of Acontecimento",
  "mrrf": "Force de Réponse Rapide Merovingienne",
  "merovingienne": "Force de Réponse Rapide Merovingienne",
  "usariadna": "USAriadna Ranger Force",
  "na2": "Non-Aligned Armies",
  "non aligned armies": "Non-Aligned Armies",
  "non-aligned armies": "Non-Aligned Armies"
};

function canonicalizeArmyName(value) {

  const raw =
    getArmyRegistryString(value);

  if (!raw)
    return "";

  const key =
    getArmyRegistryLookupKey(raw);

  return ARMY_REGISTRY_ALIAS_MAP[key] || raw;

}

function canonicalizeArmyParentFaction(value) {

  const raw =
    getArmyRegistryString(value);

  if (!raw)
    return "";

  const key =
    getArmyRegistryLookupKey(raw);

  switch (key) {

    case "pano":
    case "pan o":
    case "pan-o":
      return "PanOceania";

    case "yj":
      return "Yu Jing";

    case "ca":
    case "combined":
      return "Combined Army";

    case "o12":
    case "o 12":
      return "O-12";

    case "jsa":
      return "Japanese Secessionist Army";

    case "na2":
    case "non aligned armies":
      return "Non-Aligned Armies";

    default:
      return ARMY_REGISTRY_ALIAS_MAP[key] || raw;

  }

}

function getArmyRegistryString(value) {

  if (value === null || typeof value === "undefined")
    return "";

  return String(value).trim();

}

function getArmyRegistryLookupKey(value) {

  return getArmyRegistryString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}
