/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * PlayerAnalytics.gs
 *
 * VERSION 2.0
 * PART 1
 *
 *******************************************************/


/*******************************************************
 * Sheet Header
 *******************************************************/

const PLAYER_ANALYTICS_HEADER = [[

  "Player",
  "Division",
  "Games",
  "Wins",
  "Losses",
  "TP",
  "Avg TP",
  "OP",
  "Avg OP",
  "VP",
  "Avg VP",
  "Most Played Mission",
  "Most Played Faction"

]];


/*******************************************************
 * Build Registry
 *******************************************************/

function buildPlayerAnalyticsRegistry(){

  const registry =
    buildPlayerRegistry();

  Object.values(registry).forEach(function(player){

    player.missions = {};

    player.factions = {};

  });

  return registry;

}


/*******************************************************
 * Update Registry
 *******************************************************/

function updatePlayerAnalyticsRegistry(registry){

  const games =
    getLeagueData();

  games.forEach(function(game){

    const player =
      registry[
        game[CONFIG.ENGINE.PLAYER]
      ];

    if(!player)
      return;

    player.games++;

    switch(game[CONFIG.ENGINE.RESULT]){

      case "W":
        player.wins++;
        break;

      case "L":
        player.losses++;
        break;

      default:
        player.draws++;
        break;

    }

    player.tp +=
      Number(
        game[CONFIG.ENGINE.TP]
      ) || 0;

    player.op +=
      Number(
        game[CONFIG.ENGINE.OP]
      ) || 0;

    player.vp +=
      Number(
        game[CONFIG.ENGINE.VP]
      ) || 0;

    const mission =
      game[
        CONFIG.ENGINE.MISSION
      ];

    if(mission){

      player.missions[mission] =
        (player.missions[mission] || 0) + 1;

    }

    const faction =
      game[
        CONFIG.ENGINE.FACTION
      ];

    if(faction){

      player.factions[faction] =
        (player.factions[faction] || 0) + 1;

    }

  });

}


/*******************************************************
 * Most Common Value
 *******************************************************/

function getMostCommonValue(values){

  let winner = "";

  let highest = 0;

  Object.keys(values).forEach(function(key){

    if(values[key] > highest){

      highest = values[key];

      winner = key;

    }

  });

  return winner;

}


/*******************************************************
 * Sort Players
 *******************************************************/

function sortPlayers(players){

  const divisionOrder = {

    "Main Man": 1,

    "Proving Grounds A": 2,

    "Proving Grounds B": 3

  };

  players.sort(function(a,b){

    const divA =
      divisionOrder[a.division] || 999;

    const divB =
      divisionOrder[b.division] || 999;

    if(divA !== divB)
      return divA - divB;

    if(b.wins !== a.wins)
      return b.wins - a.wins;

    if(b.tp !== a.tp)
      return b.tp - a.tp;

    if(b.op !== a.op)
      return b.op - a.op;

    if(b.vp !== a.vp)
      return b.vp - a.vp;

    return a.player.localeCompare(b.player);

  });

}


/*******************************************************
 * Round
 *******************************************************/

function roundPlayer(value){

  return Math.round(value * 100) / 100;

}

/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * PlayerAnalytics.gs
 *
 * VERSION 2.0
 * PART 2
 *
 *******************************************************/


/*******************************************************
 * Build Output Rows
 *******************************************************/
function buildPlayerAnalyticsRows(registry){

  const players =
    Object.values(registry);

  sortPlayers(players);

  const rows = [...PLAYER_ANALYTICS_HEADER];

  players.forEach(function(player){

    const avgTP =
      player.games === 0
        ? 0
        : roundPlayer(player.tp / player.games);

    const avgOP =
      player.games === 0
        ? 0
        : roundPlayer(player.op / player.games);

    const avgVP =
      player.games === 0
        ? 0
        : roundPlayer(player.vp / player.games);

    rows.push([

      player.player,

      player.division,

      player.games,

      player.wins,

      player.losses,

      player.tp,

      avgTP,

      player.op,

      avgOP,

      player.vp,

      avgVP,

      getMostCommonValue(
        player.missions
      ),

      getMostCommonValue(
        player.factions
      )

    ]);

  });

  return rows;

}


/*******************************************************
 * Write Player Analytics
 *******************************************************/
function writePlayerAnalytics(rows){

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(
        CONFIG.SHEETS.PLAYER_ANALYTICS
      );

  if(!sheet)
    throw new Error(
      "Player Analytics sheet not found."
    );

  sheet.clearContents();

  sheet
    .getRange(
      1,
      1,
      rows.length,
      rows[0].length
    )
    .setValues(rows);

}


/*******************************************************
 * Rebuild Player Analytics
 *******************************************************/
function rebuildPlayerAnalytics(){

  Logger.log(
    "Building Player Analytics..."
  );

  const registry =
    buildPlayerAnalyticsRegistry();

  updatePlayerAnalyticsRegistry(
    registry
  );

  const rows =
    buildPlayerAnalyticsRows(
      registry
    );

  writePlayerAnalytics(
    rows
  );

  Logger.log(
    "Player Analytics Complete."
  );

}


/*******************************************************
 * Test
 *******************************************************/
function testPlayerAnalytics(){

  clearLeagueData();

  loadLeagueData();

  rebuildPlayerAnalytics();

}