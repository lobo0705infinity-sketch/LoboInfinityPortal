/*******************************************************
 * LOBO INFINITY LEAGUE
 * Canonical Mission Registry
 *******************************************************/

const CANONICAL_MISSIONS = [
  "Area of Interest",
  "Akial Interference",
  "B-Pong",
  "Corporate Appropriation",
  "Critical Intervention",
  "Crossing Lines",
  "Evacuation",
  "Hardlock",
  "Last Launch",
  "Outbreak",
  "Provisioning",
  "Annihilation",
  "Battleground",
  "Cutthroat",
  "Superiority",
  "Uplink Center"
];

function getCanonicalMissionName(value) {

  const key =
    normalizeCanonicalMissionKey(value);

  for (let index = 0; index < CANONICAL_MISSIONS.length; index++) {
    if (normalizeCanonicalMissionKey(CANONICAL_MISSIONS[index]) === key)
      return CANONICAL_MISSIONS[index];
  }

  return "";

}

function isCanonicalMission(value) {

  return getCanonicalMissionName(value) !== "";

}

function getCanonicalMissions() {

  return CANONICAL_MISSIONS.slice();

}

function normalizeCanonicalMissionKey(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

}
