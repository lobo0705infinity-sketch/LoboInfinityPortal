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
  "oss": "Operations Subsection",
  "operations": "Operations Subsection",
  "operations subsection of the sss": "Operations Subsection",
  "steel": "Steel Phalanx",
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
  "bakunin": "Bakunin Jurisdictional Command",
  "corregidor": "Corregidor Jurisdictional Command",
  "tunguska": "Tunguska Jurisdictional Command",
  "morats": "Morat Aggression Force",
  "morat": "Morat Aggression Force",
  "shasvastii": "Shasvastii Expeditionary Force",
  "mrrf": "Force de Réponse Rapide Merovingienne",
  "merovingienne": "Force de Réponse Rapide Merovingienne",
  "usariadna": "USAriadna Ranger Force",
  "na2": "Non-Aligned Armies",
  "non aligned armies": "Non-Aligned Armies",
  "non-aligned armies": "Non-Aligned Armies"
};

const ARMY_REGISTRY_PARENT_MAP = {
  "PanOceania": "PanOceania",
  "Military Orders": "PanOceania",
  "Kestrel Colonial Force": "PanOceania",
  "Neoterra Capitaline Army": "PanOceania",
  "Shock Army of Acontecimento": "PanOceania",
  "Svalarheima Winter Force": "PanOceania",
  "Varuna Immediate Reaction Division": "PanOceania",
  "Yu Jing": "Yu Jing",
  "Imperial Service": "Yu Jing",
  "Invincible Army": "Yu Jing",
  "White Banner": "Yu Jing",
  "Ariadna": "Ariadna",
  "Caledonian Highlander Army": "Ariadna",
  "Force de Réponse Rapide Merovingienne": "Ariadna",
  "Kosmoflot": "Ariadna",
  "Tartary Army Corps": "Ariadna",
  "USAriadna Ranger Force": "Ariadna",
  "Haqqislam": "Haqqislam",
  "Hassassin Bahram": "Haqqislam",
  "Qapu Khalqi": "Haqqislam",
  "Ramah Taskforce": "Haqqislam",
  "Nomads": "Nomads",
  "Bakunin Jurisdictional Command": "Nomads",
  "Corregidor Jurisdictional Command": "Nomads",
  "Tunguska Jurisdictional Command": "Nomads",
  "Combined Army": "Combined Army",
  "Morat Aggression Force": "Combined Army",
  "Next Wave": "Combined Army",
  "Onyx Contact Force": "Combined Army",
  "Shasvastii Expeditionary Force": "Combined Army",
  "ALEPH": "ALEPH",
  "Operations Subsection": "ALEPH",
  "Steel Phalanx": "ALEPH",
  "O-12": "O-12",
  "Starmada": "O-12",
  "Torchlight Brigade": "O-12",
  "Japanese Secessionist Army": "Japanese Secessionist Army",
  "Oban": "Japanese Secessionist Army",
  "Shindenbutai": "Japanese Secessionist Army",
  "Tohaa": "Tohaa",
  "Dashat Company": "Non-Aligned Armies",
  "Druze Bayram Security": "Non-Aligned Armies",
  "Foreign Company": "Non-Aligned Armies",
  "Ikari Company": "Non-Aligned Armies",
  "Spiral Corps": "Non-Aligned Armies",
  "StarCo": "Non-Aligned Armies",
  "White Company": "Non-Aligned Armies"
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

  return getCanonicalArmyParentFaction(value);

}

function getCanonicalArmyParentFaction(value) {

  const canonical =
    canonicalizeArmyName(value);

  if (!canonical)
    return "";

  return ARMY_REGISTRY_PARENT_MAP[canonical] || canonical;

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
