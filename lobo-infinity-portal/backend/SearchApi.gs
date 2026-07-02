/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * SearchApi.gs
 *
 * Consolidated global search data endpoint.
 *******************************************************/

function getSearchData() {

  return jsonOutput({
    success: true,
    players: getSearchPlayers(),
    factions: buildFactionApiSummaries(),
    missions: buildMissionApiSummaries(),
    games: getAllRecentGameObjects()
      .slice(0, RECENT_GAMES_LIMIT)
  });

}

function getSearchPlayers() {

  return [
    buildStandingsResponse(
      getStandingsDivisionConfig("main")
    ),
    buildStandingsResponse(
      getStandingsDivisionConfig("pga")
    ),
    buildStandingsResponse(
      getStandingsDivisionConfig("pgb")
    )
  ];

}
