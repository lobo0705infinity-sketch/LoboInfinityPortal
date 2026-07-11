/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * Dashboard.gs
 *
 * Dashboard and leader API response builders.
 *******************************************************/

function getDashboard() {

  const dashboardStart =
    startDashboardEndpointSubStage(
      "dashboard.total"
    );

  let timer =
    startDashboardEndpointSubStage(
      "dashboard.spreadsheet.getActiveSpreadsheet"
    );

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  endDashboardEndpointSubStage(
    "dashboard.spreadsheet.getActiveSpreadsheet",
    timer,
    {
      method: "SpreadsheetApp.getActiveSpreadsheet"
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.sheetLookup.mainMan"
    );

  const standings =
    ss.getSheetByName(CONFIG.SHEETS.MAIN_MAN);

  endDashboardEndpointSubStage(
    "dashboard.sheetLookup.mainMan",
    timer,
    {
      sheet: CONFIG.SHEETS.MAIN_MAN
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.sheetLookup.factionAnalytics"
    );

  const factions =
    ss.getSheetByName(CONFIG.SHEETS.FACTION_ANALYTICS);

  endDashboardEndpointSubStage(
    "dashboard.sheetLookup.factionAnalytics",
    timer,
    {
      sheet: CONFIG.SHEETS.FACTION_ANALYTICS
    }
  );

  if (!standings) {

    return jsonOutput({
      success: false,
      error: "Main Man Standings not found."
    });

  }

  timer =
    startDashboardEndpointSubStage(
      "dashboard.context.build"
    );

  const dashboardContext =
    buildDashboardRequestContext();

  endDashboardEndpointSubStage(
    "dashboard.context.build",
    timer,
    {
      players:
        Object.keys(dashboardContext.playerRegistry).length,
      events:
        dashboardContext.eventEngineSnapshot.events.length,
      templates:
        dashboardContext.eventEngineSnapshot.templates.length,
      seasons:
        dashboardContext.eventEngineSnapshot.seasons.length,
      rounds:
        dashboardContext.eventEngineSnapshot.rounds.length
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.read.mainManStandings"
    );

  const values =
    standings
      .getRange(2, 1, standings.getLastRow() - 1, 8)
      .getValues();

  endDashboardEndpointSubStage(
    "dashboard.read.mainManStandings",
    timer,
    {
      sheet: CONFIG.SHEETS.MAIN_MAN,
      rows: values.length,
      columns: 8
    }
  );

  const leader =
    values[0] || [];

  let gamesPlayed = 0;
  let activePlayers = 0;
  const mainManStandings = [];

  timer =
    startDashboardEndpointSubStage(
      "dashboard.loop.mainManStandings"
    );

  values.forEach(function(r) {

    gamesPlayed +=
      Number(r[CONFIG.STANDINGS.GAMES]);

    if (Number(r[CONFIG.STANDINGS.GAMES]) > 0)
      activePlayers++;

    mainManStandings.push({
      rank: r[CONFIG.STANDINGS.RANK],
      player: r[CONFIG.STANDINGS.PLAYER],
      displayName:
        getDashboardPlayerDisplayName(
          dashboardContext,
          r[CONFIG.STANDINGS.PLAYER]
        ),
      games: r[CONFIG.STANDINGS.GAMES],
      wins: r[CONFIG.STANDINGS.WINS],
      losses: r[CONFIG.STANDINGS.LOSSES],
      tp: r[CONFIG.STANDINGS.TP],
      op: r[CONFIG.STANDINGS.OP],
      vp: r[CONFIG.STANDINGS.VP]
    });

  });

  endDashboardEndpointSubStage(
    "dashboard.loop.mainManStandings",
    timer,
    {
      rows: values.length
    }
  );

  gamesPlayed =
    Math.floor(gamesPlayed / 2);

  let topFaction = "";

  if (factions && factions.getLastRow() > 1) {

    timer =
      startDashboardEndpointSubStage(
        "dashboard.read.factionAnalytics"
      );

    const topFactionValue =
      factions
        .getRange(2, 1, 1, 1)
        .getValue();

    endDashboardEndpointSubStage(
      "dashboard.read.factionAnalytics",
      timer,
      {
        sheet: CONFIG.SHEETS.FACTION_ANALYTICS,
        rows: 1,
        columns: 1
      }
    );

    topFaction =
      topFactionValue || "";

  }

  timer =
    startDashboardEndpointSubStage(
      "dashboard.calculation.leagueOverview"
    );

  const leagueOverview =
    buildLeagueOverview(
      dashboardContext
    );

  endDashboardEndpointSubStage(
    "dashboard.calculation.leagueOverview",
    timer,
    {}
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.lookup.leaderDisplayName"
    );

  const leaderDisplayName =
    getDashboardPlayerDisplayName(
      dashboardContext,
      leader[CONFIG.STANDINGS.PLAYER]
    );

  endDashboardEndpointSubStage(
    "dashboard.lookup.leaderDisplayName",
    timer,
    {}
  );

  endDashboardEndpointSubStage(
    "dashboard.total",
    dashboardStart,
    {}
  );

  return jsonOutput({
    success: true,
    leader: {
      rank: leader[CONFIG.STANDINGS.RANK],
      player: leader[CONFIG.STANDINGS.PLAYER],
      displayName: leaderDisplayName,
      games: leader[CONFIG.STANDINGS.GAMES],
      wins: leader[CONFIG.STANDINGS.WINS],
      losses: leader[CONFIG.STANDINGS.LOSSES],
      tp: leader[CONFIG.STANDINGS.TP],
      op: leader[CONFIG.STANDINGS.OP],
      vp: leader[CONFIG.STANDINGS.VP]
    },
    topFaction: topFaction,
    gamesPlayed: gamesPlayed,
    activePlayers: activePlayers,
    mainManStandings: mainManStandings,
    leagueOverview: leagueOverview
  });

}

function buildLeagueOverview(dashboardContext) {

  const cachedOverview =
    readDashboardLeagueOverviewCache();

  if (cachedOverview) {
    recordDashboardLeagueOverviewCache(
      "hit",
      cachedOverview
    );

    return cachedOverview;
  }

  let timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.main"
    );

  const main =
    buildStandingsResponse({
      key: "main",
      label: CONFIG.DIVISIONS.MAIN_MAN
    }, dashboardContext);

  endDashboardEndpointSubStage(
    "dashboard.standings.main",
    timer,
    {
      division: CONFIG.DIVISIONS.MAIN_MAN
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.pga"
    );

  const pga =
    buildStandingsResponse({
      key: "pga",
      label: CONFIG.DIVISIONS.PGA
    }, dashboardContext);

  endDashboardEndpointSubStage(
    "dashboard.standings.pga",
    timer,
    {
      division: CONFIG.DIVISIONS.PGA
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.pgb"
    );

  const pgb =
    buildStandingsResponse({
      key: "pgb",
      label: CONFIG.DIVISIONS.PGB
    }, dashboardContext);

  endDashboardEndpointSubStage(
    "dashboard.standings.pgb",
    timer,
    {
      division: CONFIG.DIVISIONS.PGB
    }
  );

  const divisions = [
    main,
    pga,
    pgb
  ];

  let totalLeagueGames = 0;
  let totalActivePlayers = 0;

  timer =
    startDashboardEndpointSubStage(
      "dashboard.loop.leagueOverviewSummary"
    );

  divisions.forEach(function(division) {

    totalLeagueGames +=
      division.summary.gamesPlayed;

    totalActivePlayers +=
      division.summary.players;

  });

  endDashboardEndpointSubStage(
    "dashboard.loop.leagueOverviewSummary",
    timer,
    {
      divisions: divisions.length
    }
  );

  const overview = {
    divisions: divisions.map(function(division) {

      return {
        division: division.division,
        divisionLabel: division.divisionLabel,
        players: division.summary.players,
        gamesPlayed: division.summary.gamesPlayed,
        activePlayers: division.summary.activePlayers
      };

    }),
    totalLeagueGames: totalLeagueGames,
    totalActivePlayers: totalActivePlayers
  };

  writeDashboardLeagueOverviewCache(
    overview
  );

  recordDashboardLeagueOverviewCache(
    "miss",
    overview
  );

  return overview;

}

function readDashboardLeagueOverviewCache() {

  try {
    const cached =
      CacheService
        .getScriptCache()
        .get(getDashboardLeagueOverviewCacheKey());

    return cached
      ? JSON.parse(cached)
      : null;
  }
  catch (err) {
    return null;
  }

}

function writeDashboardLeagueOverviewCache(overview) {

  try {
    CacheService
      .getScriptCache()
      .put(
        getDashboardLeagueOverviewCacheKey(),
        JSON.stringify(overview),
        21600
      );
  }
  catch (err) {
    Logger.log(
      "Dashboard league overview cache write skipped: " +
      err
    );
  }

}

function invalidateDashboardLeagueOverviewCache() {

  try {
    CacheService
      .getScriptCache()
      .remove(getDashboardLeagueOverviewCacheKey());
  }
  catch (err) {
    Logger.log(
      "Dashboard league overview cache invalidation skipped: " +
      err
    );
  }

}

function getDashboardLeagueOverviewCacheKey() {

  return [
    "dashboardLeagueOverview:v1",
    typeof EVENT_ENGINE_SNAPSHOT_CACHE_KEY === "undefined"
      ? "eventEngineSnapshot:v1"
      : EVENT_ENGINE_SNAPSHOT_CACHE_KEY,
    typeof PLAYER_REGISTRY_CACHE_KEY === "undefined"
      ? "playerRegistry:v1"
      : PLAYER_REGISTRY_CACHE_KEY,
    typeof getPortalCacheVersion === "function"
      ? getPortalCacheVersion()
      : "1"
  ].join(":");

}

function recordDashboardLeagueOverviewCache(status, overview) {

  const timer =
    startDashboardEndpointSubStage(
      "dashboard.calculation.leagueOverview.cache"
    );

  endDashboardEndpointSubStage(
    "dashboard.calculation.leagueOverview.cache",
    timer,
    {
      cache: status,
      divisions:
        overview &&
        overview.divisions
          ? overview.divisions.length
          : 0
    }
  );

}

function buildDashboardRequestContext() {

  const registry =
    buildPlayerRegistry();

  return {
    eventEngineSnapshot:
      getEventEngineSnapshot(),
    playerRegistry:
      registry,
    playerDisplayNames:
      buildPlayerDisplayNameMapFromRegistry(
        registry
      )
  };

}

function getDashboardPlayerDisplayName(dashboardContext, playerName) {

  const normalizedName =
    getPlayerRegistryString(playerName);

  if (normalizedName === "")
    return "";

  const map =
    dashboardContext &&
    dashboardContext.playerDisplayNames
      ? dashboardContext.playerDisplayNames
      : getPlayerDisplayNameMap();

  const normalizedLower =
    normalizedName.toLowerCase();

  for (const player in map) {

    if (player.toLowerCase() === normalizedLower)
      return map[player] || player;

  }

  return normalizedName;

}

function startDashboardEndpointSubStage(stageName) {
  if (
    typeof API_PIPELINE_CONTEXT === "undefined" ||
    !API_PIPELINE_CONTEXT ||
    API_PIPELINE_CONTEXT.action !== "dashboard"
  )
    return 0;

  return Date.now();
}

function endDashboardEndpointSubStage(stageName, startTime, details) {
  if (
    typeof API_PIPELINE_CONTEXT === "undefined" ||
    !API_PIPELINE_CONTEXT ||
    API_PIPELINE_CONTEXT.action !== "dashboard" ||
    !startTime ||
    typeof recordApiPipelineSubStage !== "function"
  )
    return;

  recordApiPipelineSubStage(
    stageName,
    startTime,
    details || {}
  );
}

function getLeader() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(CONFIG.SHEETS.MAIN_MAN);

  if (!sheet)
    return jsonOutput({
      success: false,
      error: "Standings sheet not found."
    });

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length < 2)
    return jsonOutput({
      success: false,
      error: "No standings."
    });

  const l = values[1];

  return jsonOutput({
    success: true,
    rank: l[CONFIG.STANDINGS.RANK],
    player: l[CONFIG.STANDINGS.PLAYER],
    displayName:
      getPlayerDisplayName(
        l[CONFIG.STANDINGS.PLAYER]
      ),
    games: l[CONFIG.STANDINGS.GAMES],
    wins: l[CONFIG.STANDINGS.WINS],
    losses: l[CONFIG.STANDINGS.LOSSES],
    tp: l[CONFIG.STANDINGS.TP],
    op: l[CONFIG.STANDINGS.OP],
    vp: l[CONFIG.STANDINGS.VP]
  });

}
