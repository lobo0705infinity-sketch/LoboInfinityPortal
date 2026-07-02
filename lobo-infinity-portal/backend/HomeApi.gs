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

  const intelligence =
    JSON.parse(
      getIntelligence().getContent()
    );

  const hallOfFame =
    JSON.parse(
      getHallOfFame().getContent()
    );

  const settings =
    JSON.parse(
      getSettings().getContent()
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
    intelligence: intelligence,
    records: intelligence.records || {},
    hallOfFame: hallOfFame,
    settings: settings.settings || {},
    armyLists: armyLists.lists || [],
    armyListCommunity: armyLists.community || {}
  });

}
