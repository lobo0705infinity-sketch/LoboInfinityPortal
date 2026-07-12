/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * FactionAnalytics.gs
 *
 * VERSION 2.0
 * PART 1
 *
 *******************************************************/


/*******************************************************
 * Sheet Header
 *******************************************************/
const FACTION_ANALYTICS_HEADER = [[

  "Faction",
  "Games",
  "Wins",
  "Losses",
  "Win %",
  "TP",
  "Avg TP",
  "OP",
  "Avg OP",
  "VP",
  "Avg VP"

]];


/*******************************************************
 * Build Registry
 *******************************************************/
function buildFactionRegistry(){

  return {};

}


/*******************************************************
 * Create Empty Faction
 *******************************************************/
function createFaction(name){

  return {

    faction: name,

    games: 0,

    wins: 0,

    losses: 0,

    tp: 0,

    op: 0,

    vp: 0

  };

}


/*******************************************************
 * Update Registry
 *******************************************************/
function updateFactionRegistry(registry, scopedGames){

  const games =
    scopedGames || getLeagueData();

  games.forEach(function(game){

    const faction =
      canonicalizeArmyName(
        game[CONFIG.ENGINE.FACTION]
      );

    if(!faction)
      return;

    if(!registry[faction]){

      registry[faction] =
        createFaction(faction);

    }

    const record =
      registry[faction];

    record.games++;

    switch(game[CONFIG.ENGINE.RESULT]){

      case "W":
        record.wins++;
        break;

      case "L":
        record.losses++;
        break;

    }

    record.tp +=
      Number(
        game[CONFIG.ENGINE.TP]
      ) || 0;

    record.op +=
      Number(
        game[CONFIG.ENGINE.OP]
      ) || 0;

    record.vp +=
      Number(
        game[CONFIG.ENGINE.VP]
      ) || 0;

  });

}


/*******************************************************
 * Sort Factions
 *******************************************************/
function sortFactions(factions){

  factions.sort(function(a,b){

    if(b.wins !== a.wins)
      return b.wins - a.wins;

    if(b.tp !== a.tp)
      return b.tp - a.tp;

    if(b.op !== a.op)
      return b.op - a.op;

    if(b.vp !== a.vp)
      return b.vp - a.vp;

    return a.faction.localeCompare(b.faction);

  });

}


/*******************************************************
 * Round
 *******************************************************/
function roundFaction(value){

  return Math.round(value * 100) / 100;

}
/*******************************************************
 *
 * LOBO INFINITY LEAGUE 3.0
 * FactionAnalytics.gs
 *
 * VERSION 2.0
 * PART 2
 *
 *******************************************************/


/*******************************************************
 * Build Output Rows
 *******************************************************/
function buildFactionAnalyticsRows(registry){

  const factions =
    Object.values(registry);

  sortFactions(factions);

  const rows = [...FACTION_ANALYTICS_HEADER];

  factions.forEach(function(faction){

    const winPct =
      faction.games === 0
        ? 0
        : roundFaction(
            (faction.wins / faction.games) * 100
          );

    const avgTP =
      faction.games === 0
        ? 0
        : roundFaction(
            faction.tp / faction.games
          );

    const avgOP =
      faction.games === 0
        ? 0
        : roundFaction(
            faction.op / faction.games
          );

    const avgVP =
      faction.games === 0
        ? 0
        : roundFaction(
            faction.vp / faction.games
          );

    rows.push([

      faction.faction,

      faction.games,

      faction.wins,

      faction.losses,

      winPct,

      faction.tp,

      avgTP,

      faction.op,

      avgOP,

      faction.vp,

      avgVP

    ]);

  });

  return rows;

}


/*******************************************************
 * Write Sheet
 *******************************************************/
function writeFactionAnalytics(rows){

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(
        CONFIG.SHEETS.FACTION_ANALYTICS
      );

  if(!sheet){

    throw new Error(
      "Faction Analytics sheet not found."
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
function rebuildFactionAnalytics(){

  Logger.log(
    "Building Faction Analytics..."
  );

  const registry =
    buildFactionRegistry();

  updateFactionRegistry(
    registry
  );

  const rows =
    buildFactionAnalyticsRows(
      registry
    );

  writeFactionAnalytics(
    rows
  );

  Logger.log(
    "Faction Analytics Complete."
  );

}


/*******************************************************
 * Test
 *******************************************************/
function testFactionAnalytics(){

  clearLeagueData();

  loadLeagueData();

  rebuildFactionAnalytics();

}
