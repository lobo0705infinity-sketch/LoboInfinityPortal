/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * RecordsApi.gs
 *
 * Hall of Fame, records, and comparison API endpoints.
 *******************************************************/

const HALL_OF_FAME_LIMIT = 10;
const HALL_OF_FAME_SNAPSHOT_TTL_SECONDS = 900;
const HALL_OF_FAME_SCHEMA_VERSION = "2.5.4.1";

function getRecords(e) {

  const context =
    buildEventAnalyticsContext(e);

  if (!context.isLeague)
    return jsonOutput({
      success: true,
      eventId: context.eventId,
      event: context.event,
      records:
        buildEventAnalyticsRecords(
          getEventAnalyticsResults(context.eventId),
          getEventAnalyticsTeamStandings(context)
        )
    });

  if (context.gameType !== "league")
    return jsonOutput({
      success: true,
      records:
        getEventAnalyticsGameTypeRecords(context)
    });

  const games =
    getAllRecentGameObjectsForEvent(
      context.eventId,
      context.gameType
    );

  return jsonOutput({
    success: true,
    records:
      getLeagueRecords(
        games
      )
  });

}

function getHallOfFame(e) {

  const context =
    buildEventAnalyticsContext(e);

  if (!context.isLeague)
    return jsonOutput(
      getEventAnalyticsHallOfFame(context)
    );

  const snapshot =
    getHallOfFameSnapshot();

  return jsonOutput(snapshot);

}

function getHallOfFameSnapshot() {

  const cached =
    getCachedHallOfFameSnapshot();

  if (cached)
    return cached;

  const context =
    buildHallOfFameContext();

  const standings =
    context.standings;

  const records =
    getLeagueRecords(
      context.games
    );

  const careers =
    buildHallOfFameCareers(
      standings,
      context
    );

  const snapshot = {
    success: true,
    leaders: {
      tournamentPoints:
        getHallOfFameLeaders(
          standings,
          "tp"
        ),
      objectivePoints:
        getHallOfFameLeaders(
          standings,
          "op"
        ),
      victoryPoints:
        getHallOfFameLeaders(
          standings,
          "vp"
        ),
      wins:
        getHallOfFameLeaders(
          standings,
          "wins"
        ),
      games:
        getHallOfFameLeaders(
          standings,
          "games"
        )
    },
    records: records,
    careerLeaders:
      buildHallOfFameCareerLeaders(
        careers
      ),
    recordBook:
      buildHallOfFameRecordBook(
        context.games,
        standings,
        careers,
        records
      ),
    leagueHistory:
      buildLeagueHistoryTimeline(
        standings,
        records
      ),
    seasonHistory:
      context.seasonHistory,
    playerCareers:
      careers.slice(0, HALL_OF_FAME_LIMIT)
  };

  cacheHallOfFameSnapshot(snapshot);

  return snapshot;

}

function buildHallOfFameContext() {

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(
    registry
  );

  const displayNames =
    buildHallOfFameDisplayNameMap(
      registry
    );

  const games =
    getAllRecentGameObjects();

  const achievementsByPlayer =
    buildHallOfFameAchievementIndex(
      getAllHallOfFameAchievementRecords()
    );

  const armyListCounts =
    buildHallOfFameArmyListCountIndex(
      typeof getArmyListObjects === "function"
        ? getArmyListObjects()
        : []
    );

  const standings =
    getHallOfFameStandingsFromRegistry(
      registry,
      displayNames
    );

  const seasonHistory =
    buildSeasonHistoryCards();

  return {
    registry: registry,
    displayNames: displayNames,
    games: games,
    achievementsByPlayer: achievementsByPlayer,
    armyListCounts: armyListCounts,
    standings: standings,
    seasonHistory: seasonHistory
  };

}

function buildHallOfFameCareers(standings, context) {

  return standings
    .map(function(player) {

      const achievements =
        getHallOfFameIndexedRecords(
          context.achievementsByPlayer,
          player.player
        );

      const unlockedAchievements =
        achievements.filter(function(achievement) {
          return achievement.unlocked;
        });

      const achievementPoints =
        unlockedAchievements.reduce(function(total, achievement) {
          return total + (Number(achievement.points) || 0);
        }, 0);

      const seasons =
        getPlayerSeasonHistory(
          player,
          context
        );

      const awards =
        unlockedAchievements.filter(function(achievement) {
          return achievement.commissionerAward;
        }).length;

      return {
        player: player.player,
        displayName:
          player.displayName ||
          getHallOfFameDisplayName(
            context,
            player.player
          ),
        division: player.division,
        rank: Number(player.rank) || 0,
        games: Number(player.games) || 0,
        wins: Number(player.wins) || 0,
        losses: Number(player.losses) || 0,
        winPercentage:
          getHallOfFameWinPercentage(player),
        tp: Number(player.tp) || 0,
        op: Number(player.op) || 0,
        vp: Number(player.vp) || 0,
        achievementPoints: achievementPoints,
        seasonsPlayed: seasons.length,
        promotions:
          countCareerEvents(
            seasons,
            "Promotion"
          ),
        relegations:
          countCareerEvents(
            seasons,
            "Relegation"
          ),
        championships:
          countCareerEvents(
            seasons,
            "Champion"
          ),
        awards: awards,
        achievements: unlockedAchievements.length,
        seasons: seasons,
        hallOfFameEntries: [],
        timeline:
          buildPlayerLegacyTimeline(
            player,
            seasons,
            unlockedAchievements
          )
      };

    })
    .sort(function(a, b) {

      if (b.achievementPoints !== a.achievementPoints)
        return b.achievementPoints - a.achievementPoints;

      if (b.tp !== a.tp)
        return b.tp - a.tp;

      return a.player.localeCompare(b.player);

    });

}

function buildHallOfFameCareerLeaders(careers) {

  return {
    championships:
      getCareerLeaders(careers, "championships"),
    promotions:
      getCareerLeaders(careers, "promotions"),
    winPercentage:
      getCareerLeaders(careers, "winPercentage"),
    achievementPoints:
      getCareerLeaders(careers, "achievementPoints"),
    communityAwards:
      getCareerLeaders(careers, "awards"),
    seasonsPlayed:
      getCareerLeaders(careers, "seasonsPlayed")
  };

}

function getCareerLeaders(careers, key) {

  return careers
    .filter(function(career) {
      return Number(career[key]) > 0;
    })
    .slice()
    .sort(function(a, b) {
      if (Number(b[key]) !== Number(a[key]))
        return Number(b[key]) - Number(a[key]);
      return b.games - a.games;
    })
    .slice(0, HALL_OF_FAME_LIMIT);

}

function buildHallOfFameRecordBook(games, standings, careers, records) {

  return [
    buildRecordBookItem("Highest VP Ever", records.highestScoringGame),
    buildRecordBookItem("Highest OP Ever", records.largestOPMargin),
    buildRecordBookItem("Largest Victory", records.largestVPMargin),
    buildRecordBookItem("Smallest Victory", records.closestGame),
    buildRecordBookItem("Longest Win Streak", getRecordBookCareerLeader(careers, "wins")),
    buildRecordBookItem("Longest Losing Streak", getRecordBookCareerLeader(careers, "losses")),
    buildRecordBookItem("Most Played Opponent", getMostPlayedOpponentRecord(games)),
    buildRecordBookItem("Most Played Mission", getMostPlayedMissionRecord(games)),
    buildRecordBookItem("Most Played Faction", getMostPlayedFactionRecord(games)),
    buildRecordBookItem("Most Promotions", getRecordBookCareerLeader(careers, "promotions")),
    buildRecordBookItem("Fastest Championship", getRecordBookCareerLeader(careers, "championships")),
    buildRecordBookItem("Most Seasons Played", getRecordBookCareerLeader(careers, "seasonsPlayed")),
    buildRecordBookItem("Most Games Played", getHallOfFameLeaders(standings, "games")[0]),
    buildRecordBookItem("Most Achievement Points", getRecordBookCareerLeader(careers, "achievementPoints"))
  ].filter(function(item) {
    return item.value !== "";
  });

}

function buildRecordBookItem(title, record) {

  if (!record)
    return {
      title: title,
      value: "",
      holder: "",
      story: ""
    };

  return {
    title: title,
    value:
      getHallOfFameRecordValue(record),
    holder:
      record.player ||
      record.winner ||
      record.name ||
      record.faction ||
      "",
    story:
      record.story ||
      buildRecordBookStory(record)
  };

}

function getHallOfFameRecordValue(record) {

  if (record.value !== undefined)
    return String(record.value);

  if (record.vp !== undefined)
    return String(record.vp);

  if (record.op !== undefined)
    return String(record.op);

  if (record.tp !== undefined)
    return String(record.tp);

  if (record.games !== undefined)
    return String(record.games);

  if (record.wins !== undefined)
    return String(record.wins);

  if (record.achievementPoints !== undefined)
    return String(record.achievementPoints);

  if (record.seasonsPlayed !== undefined)
    return String(record.seasonsPlayed);

  if (record.championships !== undefined)
    return String(record.championships);

  if (record.promotions !== undefined)
    return String(record.promotions);

  return "";

}

function buildRecordBookStory(record) {

  const holder =
    record.player ||
    record.name ||
    record.winner ||
    record.faction ||
    "League record";

  return holder + " holds this career record.";

}

function getRecordBookCareerLeader(careers, key) {

  const leader =
    getCareerLeaders(careers, key)[0];

  if (!leader)
    return null;

  const record = {};
  Object.keys(leader).forEach(function(field) {
    record[field] = leader[field];
  });
  record.value = leader[key];
  record.story =
    leader.player +
    " leads the league with " +
    leader[key] +
    " " +
    key +
    ".";

  return record;

}

function getMostPlayedOpponentRecord(games) {

  const pairs = {};

  games.forEach(function(game) {
    const players =
      [
        getHallOfFameString(game.winner),
        getHallOfFameString(game.loser)
      ].sort();

    if (players[0] === "" || players[1] === "")
      return;

    const key =
      players.join(" vs ");

    pairs[key] =
      (pairs[key] || 0) + 1;
  });

  return getNameCountRecord(pairs, "rivalry");

}

function getMostPlayedMissionRecord(games) {

  const missions = {};

  games.forEach(function(game) {
    const mission =
      getHallOfFameString(game.mission);
    if (mission !== "")
      missions[mission] =
        (missions[mission] || 0) + 1;
  });

  return getNameCountRecord(missions, "mission");

}

function getMostPlayedFactionRecord(games) {

  const factions = {};

  games.forEach(function(game) {
    [
      game.winnerFaction,
      game.loserFaction
    ].forEach(function(faction) {
      const name =
        getHallOfFameString(faction);
      if (name !== "")
        factions[name] =
          (factions[name] || 0) + 1;
    });
  });

  return getNameCountRecord(factions, "faction");

}

function getNameCountRecord(counts, type) {

  const sorted =
    Object.keys(counts)
      .map(function(name) {
        return {
          name: name,
          type: type,
          games: counts[name],
          story:
            name +
            " is the most-played " +
            type +
            " with " +
            counts[name] +
            " games."
        };
      })
      .sort(function(a, b) {
        return b.games - a.games;
      });

  return sorted[0] || null;

}

function buildLeagueHistoryTimeline(standings, records) {

  const timeline = [
    {
      id: "league-founded",
      type: "League Founded",
      title: "Lobo Infinity League begins",
      body: "The league history system is preserving official results, records, and player careers.",
      timestamp: getHallOfFameToday()
    }
  ];

  getHallOfFameLeaders(standings, "tp")
    .slice(0, 3)
    .forEach(function(leader, index) {
      timeline.push({
        id: "champion-signal-" + leader.player,
        type: index === 0 ? "Season Champion" : "Historic Ranking",
        title: leader.player + " leads " + leader.division,
        body: leader.player + " has " + leader.tp + " TP, " + leader.op + " OP, and " + leader.vp + " VP.",
        timestamp: getHallOfFameToday(),
        relatedPlayer: leader.player
      });
    });

  Object.keys(records)
    .forEach(function(key) {
      const record =
        records[key];
      if (!record || !record.story)
        return;
      timeline.push({
        id: "record-" + key,
        type: "Major Record",
        title: key,
        body: record.story,
        timestamp: record.date || getHallOfFameToday(),
        relatedPlayer: record.winner || record.name || ""
      });
    });

  return timeline
    .slice(0, 20);

}

function buildSeasonHistoryCards() {

  const archive =
    getSeasonArchiveRowsSafe();

  if (archive.length === 0)
    return [
      {
        season: "Current Season",
        division: "League-wide",
        finalRank: "",
        record: "",
        tp: 0,
        op: 0,
        vp: 0,
        movement: "In progress",
        achievementsEarned: 0,
        armyListsSubmitted: 0,
        specialAwards: 0,
        details: "No completed season archive has been recorded yet."
      }
    ];

  return archive
    .map(function(row, index) {
      return {
        season:
          "Archived Season " +
          (archive.length - index),
        division: "League-wide",
        finalRank: "",
        record: "",
        tp: 0,
        op: 0,
        vp: 0,
        movement: getHallOfFameString(row.operation),
        achievementsEarned: 0,
        armyListsSubmitted: 0,
        specialAwards: 0,
        date: row.date,
        details: row.snapshot
      };
    });

}

function getPlayerSeasonHistory(player, context) {

  return [
    {
      season: "Current Season",
      division: player.division,
      finalRank: Number(player.rank) || 0,
      record:
        (Number(player.wins) || 0) +
        "-" +
        (Number(player.losses) || 0),
      tp: Number(player.tp) || 0,
      op: Number(player.op) || 0,
      vp: Number(player.vp) || 0,
      movement:
        getPlayerSeasonMovement(player),
      achievementsEarned: 0,
      armyListsSubmitted:
        getPlayerArmyListCount(
          player.player,
          context
        ),
      specialAwards: 0
    }
  ];

}

function getPlayerSeasonMovement(player) {

  const division =
    getHallOfFameString(player.division).toLowerCase();

  const rank =
    Number(player.rank) || 0;

  if (division.indexOf("main") === -1 && rank > 0 && rank <= 2)
    return "Promotion";

  if (division.indexOf("main") !== -1 && rank >= 7)
    return "Relegation Watch";

  if (rank === 1)
    return "Champion";

  return "Stable";

}

function getPlayerArmyListCount(playerName, context) {

  if (!context || !context.armyListCounts)
    return 0;

  const normalized =
    getHallOfFameString(playerName).toLowerCase();

  return context.armyListCounts[normalized] || 0;

}

function buildPlayerLegacyTimeline(player, seasons, achievements) {

  const timeline = [];

  seasons.forEach(function(season) {
    timeline.push({
      type: "Season",
      title: season.season + " in " + season.division,
      body: season.record + ", " + season.tp + " TP, " + season.op + " OP, " + season.vp + " VP.",
      timestamp: season.date || getHallOfFameToday()
    });
  });

  achievements
    .slice(0, 8)
    .forEach(function(achievement) {
      timeline.push({
        type: "Achievement",
        title: achievement.name,
        body: achievement.description,
        timestamp: achievement.dateEarned || getHallOfFameToday()
      });
    });

  return timeline;

}

function getSeasonArchiveRowsSafe() {

  try {
    const sheet =
      SpreadsheetApp
        .getActive()
        .getSheetByName(CONFIG.SHEETS.SEASON_ARCHIVE);

    if (!sheet)
      return [];

    const values =
      sheet
        .getDataRange()
        .getValues();

    if (values.length <= 1)
      return [];

    values.shift();

    return values
      .filter(function(row) {
        return getHallOfFameString(row[0]) !== "";
      })
      .map(function(row) {
        return {
          date: formatHallOfFameDate(row[0]),
          operation: getHallOfFameString(row[1]),
          snapshot: getHallOfFameString(row[2])
        };
      });
  }
  catch (err) {
    return [];
  }

}

function getAllHallOfFameAchievementRecords() {

  if (typeof getAchievementsSheet !== "function")
    return [];

  try {
    const sheet =
      getAchievementsSheet();

    const values =
      sheet
        .getDataRange()
        .getValues();

    if (values.length <= 1)
      return [];

    const headers =
      values.shift();

    const columns =
      getAchievementColumns(headers);

    return values
      .map(function(row) {
        return buildAchievementRecord(row, columns);
      })
      .filter(function(record) {
        return record.player !== "";
      });
  }
  catch (err) {
    return [];
  }

}

function buildHallOfFameAchievementIndex(records) {

  const index = {};

  records.forEach(function(record) {
    const key =
      getHallOfFameString(record.player)
        .toLowerCase();

    if (key === "")
      return;

    if (!index[key])
      index[key] = [];

    index[key].push(record);
  });

  return index;

}

function buildHallOfFameArmyListCountIndex(lists) {

  const index = {};

  lists.forEach(function(list) {
    if (!list.approved)
      return;

    const key =
      getHallOfFameString(list.player)
        .toLowerCase();

    if (key === "")
      return;

    index[key] =
      (index[key] || 0) + 1;
  });

  return index;

}

function buildHallOfFameDisplayNameMap(registry) {

  const map = {};

  Object.keys(registry)
    .forEach(function(playerName) {
      const player =
        registry[playerName];

      map[player.player] =
        player.displayName ||
        player.player;
    });

  return map;

}

function getHallOfFameIndexedRecords(index, playerName) {

  const key =
    getHallOfFameString(playerName)
      .toLowerCase();

  return index[key] || [];

}

function getHallOfFameDisplayName(context, playerName) {

  if (!context || !context.displayNames)
    return getHallOfFameString(playerName);

  const normalized =
    getHallOfFameString(playerName)
      .toLowerCase();

  for (const player in context.displayNames) {
    if (player.toLowerCase() === normalized)
      return context.displayNames[player] || player;
  }

  return getHallOfFameString(playerName);

}

function countCareerEvents(seasons, pattern) {

  return seasons.filter(function(season) {
    return getHallOfFameString(season.movement)
      .indexOf(pattern) !== -1;
  }).length;

}

function getHallOfFameWinPercentage(player) {

  const games =
    Number(player.games) || 0;

  if (games === 0)
    return 0;

  return Math.round(
    ((Number(player.wins) || 0) / games) * 1000
  ) / 10;

}

function getHallOfFameToday() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );

}

function formatHallOfFameDate(value) {

  if (Object.prototype.toString.call(value) === "[object Date]")
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  return getHallOfFameString(value);

}

function getHallOfFameString(value) {

  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  ).trim();

}

function getCachedHallOfFameSnapshot() {

  try {
    const cached =
      CacheService
        .getScriptCache()
        .get(
          getHallOfFameSnapshotCacheKey()
        );

    return cached
      ? JSON.parse(cached)
      : null;
  }
  catch (err) {
    return null;
  }

}

function cacheHallOfFameSnapshot(snapshot) {

  try {
    CacheService
      .getScriptCache()
      .put(
        getHallOfFameSnapshotCacheKey(),
        JSON.stringify(snapshot),
        HALL_OF_FAME_SNAPSHOT_TTL_SECONDS
      );
  }
  catch (err) {
    Logger.log(
      "Hall of Fame snapshot cache skipped: " +
      err
    );
  }

}

function getHallOfFameSnapshotCacheKey() {

  const version =
    typeof getPortalCacheVersion === "function"
      ? getPortalCacheVersion()
      : "1";

  return "hall-of-fame-snapshot:" + HALL_OF_FAME_SCHEMA_VERSION + ":" + version;

}

function getPlayerComparison(e) {

  return getEventAnalyticsComparison(e);

}

function getLeaguePlayerComparison(e) {

  const leftName =
    getComparisonParameter(
      e,
      "left"
    );

  const rightName =
    getComparisonParameter(
      e,
      "right"
    );

  if (
    !leftName ||
    !rightName
  )
    return jsonOutput({
      success: false,
      error: "Missing comparison players."
    });

  const registry =
    buildPlayerRegistry();

  const leftPlayer =
    findRegisteredPlayer(
      registry,
      leftName
    );

  const rightPlayer =
    findRegisteredPlayer(
      registry,
      rightName
    );

  if (
    !leftPlayer ||
    !rightPlayer
  )
    return jsonOutput({
      success: false,
      error: "One or both players could not be found."
    });

  updateRegistryStatistics(
    registry
  );

  const leftStanding =
    getPlayerStanding(
      registry,
      leftPlayer
    );

  const rightStanding =
    getPlayerStanding(
      registry,
      rightPlayer
    );

  return jsonOutput({
    success: true,
    players: [
      buildComparisonPlayer(
        leftPlayer,
        leftStanding
      ),
      buildComparisonPlayer(
        rightPlayer,
        rightStanding
      )
    ],
    headToHead:
      getComparisonHeadToHead(
        leftPlayer.player,
        rightPlayer.player
      )
  });

}

function getHallOfFameStandings() {

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(
    registry
  );

  return getHallOfFameStandingsFromRegistry(
    registry,
    getPlayerDisplayNameMap()
  );

}

function getHallOfFameStandingsFromRegistry(registry, displayNames) {

  return [
    getStandingsDivisionConfig("main"),
    getStandingsDivisionConfig("pga"),
    getStandingsDivisionConfig("pgb")
  ].flatMap(function(config) {

    if (!config)
      return [];

    const rows =
      buildDivisionTable(
        registry,
        config.label
      );

    return rows
      .slice(1)
      .map(function(row) {

        const player =
          row[CONFIG.STANDINGS.PLAYER];

        return {
          division: config.label,
          player: player,
          displayName:
            displayNames[player] ||
            player,
          rank: row[CONFIG.STANDINGS.RANK],
          games: row[CONFIG.STANDINGS.GAMES],
          wins: row[CONFIG.STANDINGS.WINS],
          losses: row[CONFIG.STANDINGS.LOSSES],
          tp: row[CONFIG.STANDINGS.TP],
          op: row[CONFIG.STANDINGS.OP],
          vp: row[CONFIG.STANDINGS.VP]
        };

      });

  });

}

function getHallOfFameLeaders(
  standings,
  key
) {

  return standings
    .slice()
    .sort(function(a, b) {

      if (b[key] !== a[key])
        return b[key] - a[key];

      if (b.tp !== a.tp)
        return b.tp - a.tp;

      if (b.op !== a.op)
        return b.op - a.op;

      if (b.vp !== a.vp)
        return b.vp - a.vp;

      return a.player.localeCompare(
        b.player
      );

    })
    .slice(0, HALL_OF_FAME_LIMIT);

}

function getComparisonParameter(
  e,
  key
) {

  if (
    !e ||
    !e.parameter ||
    !e.parameter[key]
  )
    return "";

  return String(e.parameter[key])
    .trim();

}

function buildComparisonPlayer(
  player,
  standing
) {

  return {
    name: player.player,
    displayName:
      player.displayName ||
      player.player,
    division: player.division,
    rank: standing.rank,
    games: standing.games,
    wins: standing.wins,
    losses: standing.losses,
    tp: standing.tp,
    op: standing.op,
    vp: standing.vp,
    favoriteFaction:
      FAVORITEFACTION(
        player.player
      ),
    favoriteMission:
      FAVORITEMISSION(
        player.player
      ),
    bestMission:
      PLAYERBESTMISSION(
        player.player
      ),
    bestFaction:
      BESTFACTION(
        player.player
      )
  };

}

function getComparisonHeadToHead(
  leftName,
  rightName
) {

  const games =
    getLeagueData()
      .filter(function(game) {

        const player =
          String(
            game[CONFIG.ENGINE.PLAYER]
          ).trim();

        const opponent =
          String(
            game[CONFIG.ENGINE.OPPONENT]
          ).trim();

        return (
          (
            player === leftName &&
            opponent === rightName
          ) ||
          (
            player === rightName &&
            opponent === leftName
          )
        );

      });

  const leftWins =
    games.filter(function(game) {

      return (
        String(
          game[CONFIG.ENGINE.PLAYER]
        ).trim() === leftName &&
        game[CONFIG.ENGINE.RESULT] === "W"
      );

    }).length;

  const rightWins =
    games.filter(function(game) {

      return (
        String(
          game[CONFIG.ENGINE.PLAYER]
        ).trim() === rightName &&
        game[CONFIG.ENGINE.RESULT] === "W"
      );

    }).length;

  return {
    games: games.length / 2,
    leftWins: leftWins,
    rightWins: rightWins
  };

}
