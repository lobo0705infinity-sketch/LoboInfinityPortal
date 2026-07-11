/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * SearchApi.gs
 *
 * Consolidated global search data endpoint.
 *******************************************************/

function getSearchData(e) {

  const context =
    buildEventAnalyticsContext(e);

  if (!context.isLeague)
    return jsonOutput(
      getEventAnalyticsSearchData(context)
    );

  return jsonOutput({
    success: true,
    players: getSearchPlayers(),
    factions: buildFactionApiSummaries(),
    missions: buildMissionApiSummaries(),
    games: getAllRecentGameObjects()
      .slice(0, RECENT_GAMES_LIMIT),
    armyLists: getArmyListObjects()
      .filter(function(list) {

        return list.approved;

      })
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
