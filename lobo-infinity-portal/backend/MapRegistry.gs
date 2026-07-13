/*******************************************************
 * LOBO INFINITY LEAGUE
 * Canonical Map Registry
 *******************************************************/

const CANONICAL_MAPS = [
  "Industrial Zone",
  "Orbital Relay",
  "Desert Outpost",
  "Research Facility",
  "Urban Sprawl",
  "Cargo Port",
  "Data Center",
  "Research Labs",
  "Power Station",
  "Spaceport",
  "Hab Block",
  "Military Depot",
  "Market District",
  "Comms Array",
  "Bio-Dome",
  "Transit Hub"
];

function getCanonicalMapName(value) {

  const key =
    normalizeCanonicalMapKey(value);

  for (let index = 0; index < CANONICAL_MAPS.length; index++) {
    if (normalizeCanonicalMapKey(CANONICAL_MAPS[index]) === key)
      return CANONICAL_MAPS[index];
  }

  return "";

}

function isCanonicalMap(value) {

  return getCanonicalMapName(value) !== "";

}

function getCanonicalMaps() {

  return CANONICAL_MAPS.slice();

}

function normalizeCanonicalMapKey(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

}
