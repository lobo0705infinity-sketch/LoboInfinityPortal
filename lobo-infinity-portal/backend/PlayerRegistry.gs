/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * PlayerRegistry.gs
 *
 *******************************************************/

const PLAYER = {

  NAME: 0,

  DIVISION: 1,

  ACTIVE: 2

};

function loadPlayers() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.PLAYERS);

  const data =
    sheet
      .getDataRange()
      .getValues();

  data.shift();

  return data;

}

function createPlayer(row) {

  return {

    player: row[PLAYER.NAME],

    division: row[PLAYER.DIVISION],

    active: row[PLAYER.ACTIVE] === true,

    games: 0,

    wins: 0,

    losses: 0,

    draws: 0,

    tp: 0,

    op: 0,

    vp: 0

  };

}

function buildPlayerRegistry() {

  const registry = {};

  loadPlayers()

    .forEach(function(row) {

      if (row[PLAYER.ACTIVE] !== true)
        return;

      const player =
        createPlayer(row);

      registry[player.player] = player;

    });

  return registry;

}

function testRegistry() {

  const registry =
    buildPlayerRegistry();

  Logger.log(registry);

}
