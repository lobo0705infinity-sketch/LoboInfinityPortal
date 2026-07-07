/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * HomeApi.gs
 *
 * Aggregated dashboard payload.
 *******************************************************/

function getHome() {

  const dashboard =
    JSON.parse(
      getDashboard().getContent()
    );

  const recentGames =
    JSON.parse(
      getRecentGames().getContent()
    );

  const news =
    JSON.parse(
      getCommissionerNews().getContent()
    );

  const settings =
    JSON.parse(
      getSettings().getContent()
    );

  const streams =
    JSON.parse(
      getStreams().getContent()
    );

  const armyLists =
    JSON.parse(
      getArmyLists().getContent()
    );

  return jsonOutput({
    success: true,
    dashboard: dashboard,
    recentGames: recentGames.games || [],
    news: news.news || [],
    intelligence: null,
    records: {},
    hallOfFame: null,
    settings: settings.settings || {},
    streams: streams.streams || [],
    armyLists: armyLists.lists || [],
    armyListCommunity: armyLists.community || {},
    quickStats: {
      games: dashboard.gamesPlayed || 0,
      activePlayers: dashboard.activePlayers || 0,
      recentGames: (recentGames.games || []).length,
      streams: (streams.streams || []).length,
      news: (news.news || []).length,
      armyLists: (armyLists.lists || []).length
    }
  });

}
