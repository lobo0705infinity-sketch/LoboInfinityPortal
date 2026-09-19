
const LIF_FORMS = Object.freeze({
  VERSION: "1.0.0",
  RESPONSE_SPREADSHEET_NAME: "Lobo Infinity Form Responses",
  TARGET_SHEET: "Form Responses",
  IMPORT_LOG_SHEET: "Google Forms Import Log",
  PROPERTIES: Object.freeze({
    TARGET_SPREADSHEET_ID: "LIF_TARGET_SPREADSHEET_ID",
    RESPONSE_SPREADSHEET_ID: "LIF_RESPONSE_SPREADSHEET_ID",
    LEAGUE_FORM_ID: "LIF_LEAGUE_FORM_ID",
    TEAM_FORM_ID: "LIF_TEAM_FORM_ID",
    CASUAL_FORM_ID: "LIF_CASUAL_FORM_ID",
    TOP40_FORM_ID: "LIF_TOP40_FORM_ID",
    JOIN_FORM_ID: "LIF_JOIN_FORM_ID"
  }),
  TYPES: Object.freeze({ LEAGUE: "league", TEAM: "team-tournament", CASUAL: "casual", TOP40: "top-40", JOIN: "join-community" }),
  FORM_TITLES: Object.freeze({
    LEAGUE: "Lobo Infinity League Game Submission",
    TEAM: "Lobo Infinity Team Tournament Game Submission",
    CASUAL: "Lobo Infinity Casual Game Submission",
    TOP40: "Lobo's American Top 40 — Game Submission",
    JOIN: "Join the Lobo Infinity Community"
  }),
  FIELDS: Object.freeze({
    EVENT_ID: "Event ID", DIVISION: "Division", ROUND: "Round", TEAM: "Team",
    OPPONENT_TEAM: "Opponent Team", TABLE: "Table", MISSION: "Mission",
    PLAYER: "Player", OPPONENT: "Opponent", PLAYER_FACTION: "Player Faction",
    OPPONENT_FACTION: "Opponent Faction", PLAYER_ARMY_CODE: "Player Army Code",
    OPPONENT_ARMY_CODE: "Opponent Army Code", PLAYER_TP: "Player Tournament Points",
    OPPONENT_TP: "Opponent Tournament Points", PLAYER_OP: "Player Objective Points",
    OPPONENT_OP: "Opponent Objective Points", PLAYER_VP: "Player Victory Points",
    OPPONENT_VP: "Opponent Victory Points", GAME_RESULT: "Game Result",
    FIRST_TURN: "First Turn", BEST_MOMENT: "Best Moment", NOTES: "Optional Notes",
    PLAYER_HANDLE: "Player Name / Handle"
  }),
  CANONICAL_HEADERS: Object.freeze([
    "Timestamp", "Division", "Date", "Mission", "Player 1", "Player 2",
    "Player 1 TP", "Player 2 TP", "Player 1 OP", "Player 2 OP",
    "Player 1 VP", "Player 2 VP", "First Turn", "Winning Faction",
    "Losing Faction", "Best Moment", "Event ID", "Game Type", "Game Result",
    "Player 1 Army Code", "Player 2 Army Code", "Winner Army List ID",
    "Loser Army List ID"
  ]),
  IMPORT_LOG_HEADERS: Object.freeze([
    "Response Key", "Form Type", "Imported At", "Target Row", "Status", "Message"
  ])
});

function lifGetProperties_() {
  return PropertiesService.getScriptProperties();
}

function lifRequireProperty_(key) {
  const value = String(lifGetProperties_().getProperty(key) || "").trim();
  if (!value) throw new Error("Missing required script property: " + key);
  return value;
}
