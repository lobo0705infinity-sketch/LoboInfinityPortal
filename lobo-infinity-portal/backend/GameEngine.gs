/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * GameEngine.gs
 *
 *******************************************************/

const FORM = {

  TIMESTAMP: 0,

  DIVISION: 1,

  DATE: 2,

  MISSION: 3,

  PLAYER1: 4,

  PLAYER2: 5,

  P1TP: 6,

  P2TP: 7,

  P1OP: 8,

  P2OP: 9,

  P1VP: 10,

  P2VP: 11,

  FIRSTTURN: 12,

  WINNINGFACTION: 13,

  LOSINGFACTION: 14,

  MOMENT: 15,

  EVENT_ID: 16

};

function getFormResponses() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.FORM);

  const values =
    sheet
      .getDataRange()
      .getValues();

  values.shift();

  return values;

}

function writeSheet(sheetName, rows) {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(sheetName);

  sheet.clearContents();

  if (rows.length === 0)
    return;

  sheet
    .getRange(
      1,
      1,
      rows.length,
      rows[0].length
    )
    .setValues(rows);

}

function validateGame(row) {

  if (!row[FORM.PLAYER1])
    return false;

  if (!row[FORM.PLAYER2])
    return false;

  if (row[FORM.PLAYER1] === row[FORM.PLAYER2])
    return false;

  return true;

}

function determineWinner(row) {

  const p1TP = Number(row[FORM.P1TP]) || 0;
  const p2TP = Number(row[FORM.P2TP]) || 0;

  const p1OP = Number(row[FORM.P1OP]) || 0;
  const p2OP = Number(row[FORM.P2OP]) || 0;

  const p1VP = Number(row[FORM.P1VP]) || 0;
  const p2VP = Number(row[FORM.P2VP]) || 0;

  if (p1TP !== p2TP)
    return p1TP > p2TP ? 1 : 2;

  if (p1OP !== p2OP)
    return p1OP > p2OP ? 1 : 2;

  if (p1VP !== p2VP)
    return p1VP > p2VP ? 1 : 2;

  return 0;

}

function getGameEngineHeaders() {

  return [[
    "Division",
    "Date Played",
    "Mission",
    "Player",
    "Opponent",
    "Result",
    "TP",
    "OP",
    "VP",
    "Faction",
    "First Turn",
    "Event ID"
  ]];

}

function getGameAnalyticsHeaders() {

  return [[
    "Date Played",
    "Division",
    "Mission",
    "Winner",
    "Loser",
    "Winning Faction",
    "Losing Faction",
    "Winner TP",
    "Loser TP",
    "Winner OP",
    "Loser OP",
    "Winner VP",
    "Loser VP",
    "Best Moment",
    "First Turn Winner",
    "Event ID"
  ]];

}

function buildPlayerRow(row, playerNumber, winner) {

  const playerIsOne = playerNumber === 1;

  const player =
    playerIsOne
      ? row[FORM.PLAYER1]
      : row[FORM.PLAYER2];

  const opponent =
    playerIsOne
      ? row[FORM.PLAYER2]
      : row[FORM.PLAYER1];

  const tp =
    Number(
      playerIsOne
        ? row[FORM.P1TP]
        : row[FORM.P2TP]
    ) || 0;

  const op =
    Number(
      playerIsOne
        ? row[FORM.P1OP]
        : row[FORM.P2OP]
    ) || 0;

  const vp =
    Number(
      playerIsOne
        ? row[FORM.P1VP]
        : row[FORM.P2VP]
    ) || 0;

  let result = "D";

  if (winner !== 0) {

    if (winner === playerNumber)
      result = "W";
    else
      result = "L";

  }

  let faction = "";

  // IMPORTANT:
  // Keep faction information even if the game is a draw.

  if (playerIsOne) {

    faction =
      winner === 2
        ? row[FORM.LOSINGFACTION]
        : row[FORM.WINNINGFACTION];

  } else {

    faction =
      winner === 1
        ? row[FORM.LOSINGFACTION]
        : row[FORM.WINNINGFACTION];

  }

  return [

    row[FORM.DIVISION],

    row[FORM.DATE],

    row[FORM.MISSION],

    player,

    opponent,

    result,

    tp,

    op,

    vp,

    faction,

    playerIsOne
      ? row[FORM.FIRSTTURN] === "Player 1"
          ? "Yes"
          : "No"
      : row[FORM.FIRSTTURN] === "Player 2"
          ? "Yes"
          : "No"
    ,
    getGameEngineEventId(row)

  ];

}


function buildGameEngineRows(formRows) {

  const rows = getGameEngineHeaders();

  formRows.forEach(function(row){

    if(!validateGame(row))
      return;

    const winner =
      determineWinner(row);

    rows.push(
      buildPlayerRow(
        row,
        1,
        winner
      )
    );

    rows.push(
      buildPlayerRow(
        row,
        2,
        winner
      )
    );

  });

  return rows;

}

function buildAnalyticsRow(row, winner) {

  const draw = winner === 0;

  let winnerPlayer = "";
  let loserPlayer = "";

  let winnerFaction = "";
  let loserFaction = "";

  let winnerTP = 0;
  let loserTP = 0;

  let winnerOP = 0;
  let loserOP = 0;

  let winnerVP = 0;
  let loserVP = 0;

  let firstTurnWinner = "Draw";

  if (!draw) {

    if (winner === 1) {

      winnerPlayer = row[FORM.PLAYER1];
      loserPlayer = row[FORM.PLAYER2];

      winnerFaction = row[FORM.WINNINGFACTION];
      loserFaction = row[FORM.LOSINGFACTION];

      winnerTP = Number(row[FORM.P1TP]) || 0;
      loserTP = Number(row[FORM.P2TP]) || 0;

      winnerOP = Number(row[FORM.P1OP]) || 0;
      loserOP = Number(row[FORM.P2OP]) || 0;

      winnerVP = Number(row[FORM.P1VP]) || 0;
      loserVP = Number(row[FORM.P2VP]) || 0;

      firstTurnWinner =
        row[FORM.FIRSTTURN] === "Player 1"
          ? "Yes"
          : "No";

    } else {

      winnerPlayer = row[FORM.PLAYER2];
      loserPlayer = row[FORM.PLAYER1];

      winnerFaction = row[FORM.WINNINGFACTION];
      loserFaction = row[FORM.LOSINGFACTION];

      winnerTP = Number(row[FORM.P2TP]) || 0;
      loserTP = Number(row[FORM.P1TP]) || 0;

      winnerOP = Number(row[FORM.P2OP]) || 0;
      loserOP = Number(row[FORM.P1OP]) || 0;

      winnerVP = Number(row[FORM.P2VP]) || 0;
      loserVP = Number(row[FORM.P1VP]) || 0;

      firstTurnWinner =
        row[FORM.FIRSTTURN] === "Player 2"
          ? "Yes"
          : "No";

    }

  }

  return [

    row[FORM.DATE],

    row[FORM.DIVISION],

    row[FORM.MISSION],

    winnerPlayer,

    loserPlayer,

    winnerFaction,

    loserFaction,

    winnerTP,

    loserTP,

    winnerOP,

    loserOP,

    winnerVP,

    loserVP,

    row[FORM.MOMENT],

    firstTurnWinner,

    getGameEngineEventId(row)

  ];

}

function getGameEngineEventId(row) {

  if (
    row &&
    row.length > FORM.EVENT_ID &&
    String(row[FORM.EVENT_ID] || "").trim() !== ""
  )
    return String(row[FORM.EVENT_ID]).trim();

  return EVENT_ENGINE_DEFAULT_EVENT_ID;

}
function buildGameAnalyticsRows(formRows) {

  const rows = getGameAnalyticsHeaders();

  formRows.forEach(function(row){

    if(!validateGame(row))
      return;

    const winner =
      determineWinner(row);

    rows.push(
      buildAnalyticsRow(
        row,
        winner
      )
    );

  });

  return rows;

}
