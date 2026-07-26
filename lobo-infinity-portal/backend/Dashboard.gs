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
      "dashboard.standings.mainMan"
    );

  const mainManResponse =
    buildStandingsResponse(
      getStandingsDivisionConfig("main"),
      dashboardContext
    );

  endDashboardEndpointSubStage(
    "dashboard.standings.mainMan",
    timer,
    {
      eventId: mainManResponse.eventId,
      rows: mainManResponse.standings.length
    }
  );

  const leader =
    mainManResponse.summary.leader || {};

  const mainManStandings =
    mainManResponse.standings;

  const gamesPlayed =
    mainManResponse.summary.gamesPlayed;

  const activePlayers =
    mainManResponse.summary.activePlayers;

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

  endDashboardEndpointSubStage(
    "dashboard.total",
    dashboardStart,
    {}
  );

  return jsonOutput({
    success: true,
    leader: {
      rank: leader.rank || 0,
      player: leader.player || "",
      displayName: leader.displayName || leader.player || "",
      games: leader.games || 0,
      wins: leader.wins || 0,
      losses: leader.losses || 0,
      draws: leader.draws || 0,
      tp: leader.tp || 0,
      op: leader.op || 0,
      vp: leader.vp || 0
    },
    topFaction: topFaction,
    gamesPlayed: gamesPlayed,
    activePlayers: activePlayers,
    mainManStandings: mainManStandings,
    leagueOverview: leagueOverview
  });

}

function getDashboardStandingsColumnCount() {
  return Math.max.apply(
    null,
    Object.keys(CONFIG.STANDINGS).map(function(key) {
      return CONFIG.STANDINGS[key];
    })
  ) + 1;
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

  const dashboardContext =
    buildDashboardRequestContext();

  const response =
    buildStandingsResponse(
      getStandingsDivisionConfig("main"),
      dashboardContext
    );

  const leader =
    response.summary.leader;

  if (!leader)
    return jsonOutput({
      success: false,
      error: "No standings."
    });

  return jsonOutput({
    success: true,
    rank: leader.rank,
    player: leader.player,
    displayName: leader.displayName,
    games: leader.games,
    wins: leader.wins,
    losses: leader.losses,
    draws: leader.draws,
    tp: leader.tp,
    op: leader.op,
    vp: leader.vp
  });

}
