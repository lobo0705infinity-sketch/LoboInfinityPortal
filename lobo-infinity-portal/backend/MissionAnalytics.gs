/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * MissionAnalytics.gs
 *
 * VERSION 3.0
 * PART 1
 *
 *******************************************************/


/*******************************************************
 * Sheet Header
 *******************************************************/
const MISSION_ANALYTICS_HEADER = [[

  "Mission",
  "Games",
  "Avg Winner TP",
  "Avg Winner OP",
  "Avg Winner VP",
  "First Player Wins",
  "Top 3 Winning Factions"

]];


/*******************************************************
 * Build Registry
 *******************************************************/
function buildMissionRegistry(){

  return {};

}


/*******************************************************
 * Create Mission
 *******************************************************/
function createMission(name){

  return {

    mission: name,

    games: 0,

    winnerTP: 0,

    winnerOP: 0,

    winnerVP: 0,

    firstPlayerWins: 0,

    factions: {}

  };

}


/*******************************************************
 * Create Faction Record
 *******************************************************/
function createMissionFaction(){

  return {

    wins: 0,

    losses: 0,

    draws: 0

  };

}


/*******************************************************
 * Update Registry
 *******************************************************/
function updateMissionRegistry(registry, scopedGames){

  const games =
    scopedGames || getLeagueData();

  games.forEach(function(game){

    const mission =
      game[CONFIG.ENGINE.MISSION];

    if(!mission)
      return;

    if(!registry[mission]){

      registry[mission] =
        createMission(mission);

    }

    const record =
      registry[mission];

    const faction =
      canonicalizeArmyName(
        game[CONFIG.ENGINE.FACTION]
      );

    if(!faction)
      return;

    if(!record.factions[faction]){

      record.factions[faction] =
        createMissionFaction();

    }

    switch(game[CONFIG.ENGINE.RESULT]){

      case "W":

        record.games++;

        record.winnerTP +=
          Number(
            game[CONFIG.ENGINE.TP]
          ) || 0;

        record.winnerOP +=
          Number(
            game[CONFIG.ENGINE.OP]
          ) || 0;

        record.winnerVP +=
          Number(
            game[CONFIG.ENGINE.VP]
          ) || 0;

        record.factions[faction].wins++;

        if(
          game[
            CONFIG.ENGINE.FIRST_TURN
          ] === "Yes"
        ){

          record.firstPlayerWins++;

        }

        break;

      case "L":

        record.factions[faction].losses++;

        break;

      case "D":

        record.games++;

        record.factions[faction].draws++;

        break;

    }

  });

}

/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * MissionAnalytics.gs
 *
 * VERSION 3.0
 * PART 2
 *
 *******************************************************/


/*******************************************************
 * Top Three Winning Factions
 *******************************************************/
function getTopThreeWinningFactions(factions){

  const list =
    Object.entries(factions);

  list.sort(function(a,b){

    if(b[1].wins !== a[1].wins)
      return b[1].wins - a[1].wins;

    if(a[1].losses !== b[1].losses)
      return a[1].losses - b[1].losses;

    return a[0].localeCompare(b[0]);

  });

  return list
    .slice(0,3)
    .map(function(entry){

      return (
        entry[0] +
        " (" +
        entry[1].wins +
        "-" +
        entry[1].losses +
        (
          entry[1].draws > 0
            ? "-" + entry[1].draws
            : ""
        ) +
        ")"
      );

    })
    .join(", ");

}


/*******************************************************
 * Round
 *******************************************************/
function roundMission(value){

  return Math.round(value * 100) / 100;

}


/*******************************************************
 * Build Output Rows
 *******************************************************/
function buildMissionAnalyticsRows(registry){

  const missions =
    Object.values(registry);

  missions.sort(function(a,b){

    return a.mission.localeCompare(b.mission);

  });

  const rows = [...MISSION_ANALYTICS_HEADER];

  missions.forEach(function(mission){

    const avgWinnerTP =
      mission.games === 0
        ? 0
        : roundMission(
            mission.winnerTP /
            mission.games
          );

    const avgWinnerOP =
      mission.games === 0
        ? 0
        : roundMission(
            mission.winnerOP /
            mission.games
          );

    const avgWinnerVP =
      mission.games === 0
        ? 0
        : roundMission(
            mission.winnerVP /
            mission.games
          );

    rows.push([

      mission.mission,

      mission.games,

      avgWinnerTP,

      avgWinnerOP,

      avgWinnerVP,

      mission.firstPlayerWins,

      getTopThreeWinningFactions(
        mission.factions
      )

    ]);

  });

  return rows;

}


/*******************************************************
 * Write Sheet
 *******************************************************/
function writeMissionAnalytics(rows){

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(
        CONFIG.SHEETS.MISSION_ANALYTICS
      );

  if(!sheet){

    throw new Error(
      "Mission Analytics sheet not found."
    );

  }

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
 * Rebuild
 *******************************************************/
function rebuildMissionAnalytics(){

  Logger.log(
    "Building Mission Analytics..."
  );

  const registry =
    buildMissionRegistry();

  updateMissionRegistry(
    registry
  );

  const rows =
    buildMissionAnalyticsRows(
      registry
    );

  writeMissionAnalytics(
    rows
  );

  Logger.log(
    "Mission Analytics Complete."
  );

}


/*******************************************************
 * Test
 *******************************************************/
function testMissionAnalytics(){

  clearLeagueData();

  loadLeagueData();

  rebuildMissionAnalytics();

}
