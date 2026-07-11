/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * StandingsApi.gs
 *
 * Live standings API endpoint.
 *******************************************************/

function getStandings(e) {

  const divisionConfig =
    getStandingsDivisionConfig(
      e &&
      e.parameter &&
      e.parameter.division
    );

  if (!divisionConfig)
    return jsonOutput({
      success: false,
      error: "Unknown division."
    });

  return jsonOutput(
    buildEventStandingsResponse(
      divisionConfig,
      e &&
      e.parameter &&
      e.parameter.eventId
    )
  );

}

function buildStandingsResponse(divisionConfig, dashboardContext) {

  return buildEventStandingsResponse(
    divisionConfig,
    EVENT_ENGINE_DEFAULT_EVENT_ID,
    dashboardContext
  );

}

function buildEventStandingsResponse(divisionConfig, eventId, dashboardContext) {

  let timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.resolveLeagueEventScope"
    );

  const resolvedEventId =
    resolveLeagueEventScope(eventId);

  endDashboardEndpointSubStage(
    "dashboard.standings.resolveLeagueEventScope",
    timer,
    {
      eventId: eventId || "",
      resolvedEventId: resolvedEventId
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.buildPlayerRegistry"
    );

  const registry =
    dashboardContext &&
    dashboardContext.playerRegistry
      ? clonePlayerRegistry(
          dashboardContext.playerRegistry
        )
      : buildPlayerRegistry();

  endDashboardEndpointSubStage(
    "dashboard.standings.buildPlayerRegistry",
    timer,
    {
      players: Object.keys(registry).length
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.updateRegistryStatistics"
    );

  updateRegistryStatistics(
    registry,
    resolvedEventId
  );

  endDashboardEndpointSubStage(
    "dashboard.standings.updateRegistryStatistics",
    timer,
    {
      players: Object.keys(registry).length
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.buildDivisionTable"
    );

  const rows =
    buildDivisionTable(
      registry,
      divisionConfig.label
    );

  endDashboardEndpointSubStage(
    "dashboard.standings.buildDivisionTable",
    timer,
    {
      division: divisionConfig.label,
      rows: rows.length
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.rowsToObjects"
    );

  const standings =
    standingsRowsToObjects(
      rows,
      resolvedEventId,
      dashboardContext
    );

  endDashboardEndpointSubStage(
    "dashboard.standings.rowsToObjects",
    timer,
    {
      rows: rows.length,
      standings: standings.length
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.eventSnapshot"
    );

  const eventSnapshot =
    getStandingsEventSnapshot(
      resolvedEventId,
      dashboardContext
    );

  endDashboardEndpointSubStage(
    "dashboard.standings.eventSnapshot",
    timer,
    {
      resolvedEventId: resolvedEventId
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.summary"
    );

  const summary =
    buildStandingsSummary(
      standings
    );

  endDashboardEndpointSubStage(
    "dashboard.standings.summary",
    timer,
    {
      standings: standings.length
    }
  );

  return {
    success: true,
    eventId: resolvedEventId,
    event: eventSnapshot,
    division: divisionConfig.key,
    divisionLabel: divisionConfig.label,
    standings: standings,
    summary: summary
  };

}

function standingsRowsToObjects(rows, eventId, dashboardContext) {

  let timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.displayNameMap"
    );

  const displayNames =
    dashboardContext &&
    dashboardContext.playerDisplayNames
      ? dashboardContext.playerDisplayNames
      : getPlayerDisplayNameMap();

  endDashboardEndpointSubStage(
    "dashboard.standings.displayNameMap",
    timer,
    {
      names: Object.keys(displayNames).length
    }
  );

  timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.loop.rowsToObjects"
    );

  const objects =
    rows
    .slice(1)
    .map(function(row) {

      const player =
        row[CONFIG.STANDINGS.PLAYER];

      return {
        eventId:
          eventId ||
          EVENT_ENGINE_DEFAULT_EVENT_ID,
        rank: row[CONFIG.STANDINGS.RANK],
        player: player,
        displayName:
          displayNames[player] ||
          player,
        games: row[CONFIG.STANDINGS.GAMES],
        wins: row[CONFIG.STANDINGS.WINS],
        losses: row[CONFIG.STANDINGS.LOSSES],
        tp: row[CONFIG.STANDINGS.TP],
        op: row[CONFIG.STANDINGS.OP],
        vp: row[CONFIG.STANDINGS.VP]
      };

    });

  endDashboardEndpointSubStage(
    "dashboard.standings.loop.rowsToObjects",
    timer,
    {
      rows: rows.length,
      objects: objects.length
    }
  );

  return objects;

}

function getStandingsEventSnapshot(resolvedEventId, dashboardContext) {

  if (
    resolvedEventId === "all" ||
    resolvedEventId === "lifetime"
  )
    return null;

  if (
    dashboardContext &&
    dashboardContext.eventEngineSnapshot
  ) {
    const snapshot =
      dashboardContext.eventEngineSnapshot;

    const event =
      snapshot
        .events
        .filter(function(item) {
          return item.id === resolvedEventId;
        })[0];

    if (event)
      return event;

    return getCurrentLeagueEventSnapshot(
      snapshot
    );
  }

  return typeof getEventByIdSnapshot === "function"
    ? getEventByIdSnapshot(resolvedEventId) ||
      getCurrentLeagueEventSnapshot()
    : null;

}

function buildStandingsSummary(standings) {

  const timer =
    startDashboardEndpointSubStage(
      "dashboard.standings.loop.summary"
    );

  let gamesPlayed = 0;
  let activePlayers = 0;

  standings.forEach(function(player) {

    gamesPlayed +=
      Number(player.games) || 0;

    if ((Number(player.games) || 0) > 0)
      activePlayers++;

  });

  endDashboardEndpointSubStage(
    "dashboard.standings.loop.summary",
    timer,
    {
      standings: standings.length
    }
  );

  return {
    leader:
      standings.length > 0
        ? standings[0]
        : null,
    players: standings.length,
    gamesPlayed: Math.floor(gamesPlayed / 2),
    activePlayers: activePlayers
  };

}

function getStandingsDivisionConfig(value) {

  const key =
    value
      ? String(value).toLowerCase()
      : "main";

  switch (key) {

    case "main":
      return {
        key: "main",
        label: CONFIG.DIVISIONS.MAIN_MAN
      };

    case "pga":
      return {
        key: "pga",
        label: CONFIG.DIVISIONS.PGA
      };

    case "pgb":
      return {
        key: "pgb",
        label: CONFIG.DIVISIONS.PGB
      };

    default:
      return null;

  }

}
