/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * CommissionerNews.gs
 *
 * Commissioner news endpoint with live-data fallback.
 *******************************************************/

const NEWS_LIMIT = 8;

function getCommissionerNews() {

  const manualNews =
    getManualCommissionerNews();

  return jsonOutput({
    success: true,
    news:
      manualNews.length > 0
        ? manualNews
        : getGeneratedCommissionerNews()
  });

}

function getManualCommissionerNews() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.COMMISSIONER_NEWS);

  if (!sheet)
    return [];

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  const headers =
    values.shift()
      .map(function(header) {

        return String(header).trim();

      });

  const columns =
    getNewsColumns(headers);

  return values
    .map(function(row, index) {

      return buildNewsItem(
        row,
        index + 1,
        columns
      );

    })
    .filter(function(item) {

      return (
        item.title !== "" &&
        item.body !== ""
      );

    })
    .sort(function(a, b) {

      return (
        getRecentGameDate(b.date).getTime() -
        getRecentGameDate(a.date).getTime()
      );

    })
    .slice(0, NEWS_LIMIT);

}

function getGeneratedCommissionerNews() {

  const games =
    getAllRecentGameObjects();

  const standings =
    getLeagueIntelligenceStandings();

  const records =
    getLeagueRecords(
      games
    );

  const stories = [];
  const timestamp =
    getLeagueExperienceTimestamp();

  const latestGame =
    games[0];

  if (latestGame) {
    const latestResult =
      formatLeagueResult(latestGame);

    stories.push(
      buildGeneratedNewsArticle({
        id: 1001,
        title:
          latestResult.winner +
          " claims the latest result",
        body:
          latestResult.winner +
          " defeated " +
          latestResult.loser +
          " on " +
          latestResult.mission +
          " with a " +
          latestResult.op +
          " scoreline.",
        date: latestGame.date,
        relatedPlayer: latestGame.winner,
        relatedFaction: latestGame.winnerFaction,
        relatedMission: latestGame.mission,
        link: "/games/" + latestGame.id
      })
    );

  }

  const leader =
    getTopLeagueLeader(
      standings.divisions
    );

  if (leader)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1002,
        title:
          (leader.displayName || leader.player) +
          " sets the pace",
        body:
          (leader.displayName || leader.player) +
          " leads " +
          leader.division +
          " with " +
          formatTournamentScore(leader) +
          ", " +
          formatObjectiveScore(leader) +
          ", and " +
          formatVictoryScore(leader) +
          ".",
        date: timestamp,
        relatedPlayer: leader.player,
        link:
          "/players/" +
          encodeURIComponent(leader.player)
      })
    );

  const streak =
    getLeagueWinStreaks("W")[0];

  if (streak)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1003,
        title:
          (streak.displayName || streak.player) +
          " is running hot",
        body: streak.story,
        date: timestamp,
        relatedPlayer: streak.player,
        link:
          "/players/" +
          encodeURIComponent(streak.player)
      })
    );

  const blowout =
    records.largestVPMargin;

  if (blowout)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1004,
        title: "Records Engine flags a major result",
        body: blowout.story,
        date: blowout.date || timestamp,
        relatedPlayer: blowout.winner,
        relatedFaction: blowout.winnerFaction,
        relatedMission: blowout.mission,
        link: "/games/" + blowout.id
      })
    );

  const upset =
    getRecentUpsets(
      games,
      standings.rankMap
    )[0];

  if (upset)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1005,
        title: "Upset alert in " + upset.division,
        body: upset.story,
        date: upset.date || timestamp,
        relatedPlayer: upset.winner,
        relatedMission: upset.mission,
        link: "/games/" + upset.id
      })
    );

  const faction =
    getFactionMomentum(
      games
    )[0];

  if (faction)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1006,
        title:
          faction.faction +
          " momentum watch",
        body:
          faction.story +
          " Current trend: " +
          faction.trend +
          ".",
        date: timestamp,
        relatedFaction: faction.faction,
        link:
          "/factions/" +
          encodeURIComponent(faction.faction)
      })
    );

  const mission =
    getMissionTrends()[0];

  if (mission)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1007,
        title:
          mission.mission +
          " leads the mission meta",
        body: mission.story,
        date: timestamp,
        relatedMission: mission.mission,
        relatedFaction: mission.mostSuccessfulFaction,
        link:
          "/missions/" +
          encodeURIComponent(mission.mission)
      })
    );

  const promotion =
    getPromotionBattle(
      standings.divisions
    )[0];

  if (promotion)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1008,
        title: "Promotion race tightens",
        body: promotion.story,
        date: timestamp,
        relatedPlayer: promotion.player,
        link:
          "/players/" +
          encodeURIComponent(promotion.player)
      })
    );

  const relegation =
    getRelegationBattle(
      standings.divisions
    )[0];

  if (relegation)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1009,
        title: "Main Man danger zone update",
        body: relegation.story,
        date: timestamp,
        relatedPlayer: relegation.player,
        link:
          "/players/" +
          encodeURIComponent(relegation.player)
      })
    );

  if (stories.length === 0)
    stories.push(
      buildGeneratedNewsArticle({
        id: 1010,
        title: "League data is online",
        body: "The portal is connected to the live Lobo Infinity League sheets and waiting for the next reported result.",
        date: timestamp,
        link: "/"
      })
    );

  return stories
    .slice(0, NEWS_LIMIT);

}

function buildGeneratedNewsArticle(article) {

  return {
    id: article.id,
    title: article.title || "",
    body: article.body || "",
    date: article.date || getLeagueExperienceTimestamp(),
    link: article.link || "",
    relatedPlayer: article.relatedPlayer || "",
    relatedFaction: article.relatedFaction || "",
    relatedMission: article.relatedMission || ""
  };

}

function getTopLeagueLeader(divisions) {

  const leaders = [];

  for (const division in divisions) {

    if (
      divisions[division] &&
      divisions[division][0]
    )
      leaders.push({
        division: division,
        player: divisions[division][0].player,
        rank: divisions[division][0].rank,
        games: divisions[division][0].games,
        wins: divisions[division][0].wins,
        losses: divisions[division][0].losses,
        tp: divisions[division][0].tp,
        op: divisions[division][0].op,
        vp: divisions[division][0].vp
      });

  }

  leaders.sort(function(a, b) {

    if (b.tp !== a.tp)
      return b.tp - a.tp;

    if (b.op !== a.op)
      return b.op - a.op;

    if (b.vp !== a.vp)
      return b.vp - a.vp;

    return a.player.localeCompare(
      b.player
    );

  });

  return leaders[0] || null;

}

function getNewsColumns(headers) {

  return {
    title:
      getNewsColumn(
        headers,
        ["Title", "News Title", "Headline"]
      ),
    body:
      getNewsColumn(
        headers,
        ["Body", "Message", "Content", "Summary"]
      ),
    date:
      getNewsColumn(
        headers,
        ["Date", "Published", "Timestamp"]
      ),
    link:
      getNewsColumn(
        headers,
        ["Link", "Url", "URL"]
      ),
    relatedPlayer:
      getNewsColumn(
        headers,
        ["Related Player", "Player"]
      ),
    relatedFaction:
      getNewsColumn(
        headers,
        ["Related Faction", "Faction"]
      ),
    relatedMission:
      getNewsColumn(
        headers,
        ["Related Mission", "Mission"]
      )
  };

}

function getNewsColumn(headers, labels) {

  for (
    let index = 0;
    index < labels.length;
    index++
  ) {

    const column =
      headers.indexOf(labels[index]);

    if (column !== -1)
      return column;

  }

  return -1;

}

function buildNewsItem(row, sourceIndex, columns) {

  const rawDate =
    columns.date === -1
      ? ""
      : row[columns.date];

  const sortDate =
    getRecentGameDate(rawDate);

  return {
    id: sourceIndex,
    title:
      columns.title === -1
        ? ""
        : getRecentGameString(
            row[columns.title]
          ),
    body:
      columns.body === -1
        ? ""
        : getRecentGameString(
            row[columns.body]
          ),
    date:
      rawDate === ""
        ? ""
        : formatRecentGameDate(
            rawDate,
            sortDate
          ),
    link:
      columns.link === -1
        ? ""
        : getRecentGameString(
            row[columns.link]
          ),
    relatedPlayer:
      columns.relatedPlayer === -1
        ? ""
        : getRecentGameString(
            row[columns.relatedPlayer]
          ),
    relatedFaction:
      columns.relatedFaction === -1
        ? ""
        : getRecentGameString(
            row[columns.relatedFaction]
          ),
    relatedMission:
      columns.relatedMission === -1
        ? ""
        : getRecentGameString(
            row[columns.relatedMission]
          )
  };

}
