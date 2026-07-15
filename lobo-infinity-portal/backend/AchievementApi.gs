/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * AchievementApi.gs
 *
 * Persistent achievement evaluation and award service.
 *******************************************************/

const ACHIEVEMENT_SHEET_HEADERS = [
  "Player",
  "Achievement ID",
  "Name",
  "Description",
  "Category",
  "Tier",
  "Icon",
  "Points",
  "Unlocked",
  "Date Earned",
  "Season Earned",
  "Visibility",
  "Automatic",
  "Commissioner Award",
  "Progress",
  "Requirement",
  "Source"
];

const ACHIEVEMENT_TIERS = {
  COMMON: "Common",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary"
};

const ACHIEVEMENT_VISIBILITY = {
  VISIBLE: "Visible",
  HIDDEN: "Hidden"
};

const ACHIEVEMENT_CACHE_VERSION = "v2";
const ACHIEVEMENT_PERFECT_CONTROL_ID = "hidden-perfect-control";

function getAchievements(e) {

  const parameters =
    getApiParameters(e);

  const requestedPlayer =
    getApiParameter(parameters, "player");

  if (requestedPlayer !== "")
    return jsonOutput({
      success: true,
      player: requestedPlayer,
      achievements:
        buildLeaguePlayerAchievements(requestedPlayer)
    });

  return requireApiPermission(e, "updateProfile", function(auth) {

    const leaguePlayer =
      getAuthString(getCanonicalPlayerFromUser(auth.user));

    if (leaguePlayer === "")
      return jsonOutput({
        success: false,
        error: "Authenticated user is not linked to a league player."
      });

    return jsonOutput({
      success: true,
      player: leaguePlayer,
      achievements:
        buildLeaguePlayerAchievements(leaguePlayer)
    });

  });

}

function awardAchievement(e) {

  return requireApiPermission(e, "runSeasonControl", function() {

    const parameters =
      getApiParameters(e);

    const player =
      getApiParameter(parameters, "player");

    const achievementId =
      getApiParameter(parameters, "achievementId") ||
      getApiParameter(parameters, "id");

    if (player === "" || achievementId === "")
      return jsonOutput({
        success: false,
        error: "Player and achievementId are required."
      });

    const definition =
      getAchievementDefinitionById(achievementId) ||
      buildCommissionerAchievementDefinition(parameters);

    const record =
      unlockAchievementForPlayer(
        player,
        definition,
        {
          progress: 100,
          source: "commissioner"
        }
      );

    invalidateAchievementCaches(player);

    return jsonOutput({
      success: true,
      achievement:
        normalizeAchievementPayload(
          definition,
          record,
          100
        )
    });

  });

}

function rebuildAchievements(e) {

  return requireApiPermission(e, "runSeasonControl", function() {

    const players =
      getAchievementLeaguePlayers();

    const results =
      players.map(function(player) {

        const achievements =
          buildLeaguePlayerAchievements(player);

        return {
          player: player,
          unlocked:
            achievements.filter(function(achievement) {
              return achievement.unlocked;
            }).length,
          visible: achievements.length
        };

      });

    invalidateAchievementCaches("");

    return jsonOutput({
      success: true,
      players: results
    });

  });

}

function repairPerfectControlAchievements() {

  const report =
    auditPerfectControlAchievements(true);

  invalidateAchievementCaches("");

  return report;

}

function auditPerfectControlAchievements(removeInvalid) {

  const rows =
    getPerfectControlAchievementRows();

  const invalidRows = [];

  const holders =
    rows.map(function(entry) {

      const objectiveGames =
        getAchievementPlayerObjectiveGames(entry.record.player);

      const perfectGame =
        objectiveGames.filter(function(game) {
          return game.objectivePoints === 10;
        })[0] || null;

      const highestGame =
        getHighestAchievementObjectiveGame(objectiveGames);

      const valid =
        Boolean(perfectGame);

      if (!valid)
        invalidRows.push(entry.row);

      const evidence =
        perfectGame || highestGame || {
          date: "",
          mission: "",
          objectivePoints: 0
        };

      return {
        player: entry.record.player,
        date: evidence.date,
        mission: evidence.mission,
        objectivePoints: evidence.objectivePoints,
        valid: valid,
        revoked: Boolean(removeInvalid && !valid)
      };

    });

  if (removeInvalid) {
    const sheet =
      getAchievementsSheet();

    invalidRows
      .sort(function(a, b) {
        return b - a;
      })
      .forEach(function(row) {
        sheet.deleteRow(row);
      });
  }

  return {
    success: true,
    achievementId: ACHIEVEMENT_PERFECT_CONTROL_ID,
    holders: holders,
    revoked: removeInvalid ? invalidRows.length : 0
  };

}

function buildLeaguePlayerAchievements(playerName) {

  const player =
    getAuthString(playerName);

  if (player === "")
    return [];

  const cached =
    getCachedAchievementPayload(player);

  if (cached)
    return cached;

  const definitions =
    getAchievementDefinitions();

  const metrics =
    buildAchievementMetrics(player);

  const records =
    getAchievementRecordsForPlayer(player);

  const recordMap =
    buildAchievementRecordMap(records);

  revokeInvalidPerfectControlAchievementForPlayer(
    player,
    metrics,
    recordMap
  );

  definitions.forEach(function(definition) {

    if (definition.automatic !== true)
      return;

    const evaluation =
      evaluateAchievementDefinition(
        definition,
        metrics
      );

    if (evaluation.unlocked)
      recordMap[definition.id] =
        unlockAchievementForPlayer(
          player,
          definition,
          {
            progress: evaluation.progress,
            source: evaluation.source
          }
        );

  });

  const payload =
    definitions
      .map(function(definition) {

        const evaluation =
          evaluateAchievementDefinition(
            definition,
            metrics
          );

        return normalizeAchievementPayload(
          definition,
          recordMap[definition.id],
          evaluation.progress
        );

      })
      .filter(function(achievement) {

        return (
          achievement.unlocked ||
          achievement.visibility !== ACHIEVEMENT_VISIBILITY.HIDDEN
        );

      })
      .sort(sortAchievementsForProfile);

  cacheAchievementPayload(
    player,
    payload
  );

  return payload;

}

function getRecentAchievementUnlocks(limit) {

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

  const records =
    values
      .map(function(row) {
        return buildAchievementRecord(row, columns);
      })
      .filter(function(record) {
        return (
          record.player !== "" &&
          record.id !== "" &&
          record.unlocked
        );
      })
      .sort(function(a, b) {
        return (
          getAchievementDate(b.dateEarned).getTime() -
          getAchievementDate(a.dateEarned).getTime()
        );
      });

  return records
    .slice(0, Number(limit) || 10);

}

function evaluateAchievementsForPlayer(playerName) {

  invalidateAchievementCaches(playerName);
  return buildLeaguePlayerAchievements(playerName);

}

function evaluateAchievementsForAllPlayers() {

  getAchievementLeaguePlayers()
    .forEach(function(player) {
      evaluateAchievementsForPlayer(player);
    });

}

function getAchievementDefinitions() {

  return [
    buildAchievementDefinition(
      "participation-first-game",
      "First Game",
      "Complete your first recorded league game.",
      "Participation",
      ACHIEVEMENT_TIERS.COMMON,
      "target",
      10,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 1);
      }
    ),
    buildAchievementDefinition(
      "participation-five-games",
      "Five Games",
      "Play five recorded league games.",
      "Participation",
      ACHIEVEMENT_TIERS.COMMON,
      "medal",
      20,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 5);
      }
    ),
    buildAchievementDefinition(
      "participation-ten-games",
      "Ten Games",
      "Play ten recorded league games.",
      "Participation",
      ACHIEVEMENT_TIERS.RARE,
      "shield",
      35,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 10);
      }
    ),
    buildAchievementDefinition(
      "participation-twenty-five-games",
      "Twenty-Five Games",
      "Play twenty-five recorded league games.",
      "Participation",
      ACHIEVEMENT_TIERS.EPIC,
      "chevrons",
      75,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 25);
      }
    ),
    buildAchievementDefinition(
      "participation-fifty-games",
      "Fifty Games",
      "Play fifty recorded league games.",
      "Participation",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "star",
      150,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 50);
      }
    ),
    buildAchievementDefinition(
      "participation-one-hundred-games",
      "One Hundred Games",
      "Play one hundred recorded league games.",
      "Participation",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "crown",
      300,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 100);
      }
    ),
    buildAchievementDefinition(
      "performance-first-victory",
      "First Victory",
      "Win your first recorded league game.",
      "Performance",
      ACHIEVEMENT_TIERS.COMMON,
      "sword",
      15,
      function(metrics) {
        return buildAchievementThreshold(metrics.wins, 1);
      }
    ),
    buildAchievementDefinition(
      "performance-five-wins",
      "Five Wins",
      "Win five recorded league games.",
      "Performance",
      ACHIEVEMENT_TIERS.RARE,
      "swords",
      40,
      function(metrics) {
        return buildAchievementThreshold(metrics.wins, 5);
      }
    ),
    buildAchievementDefinition(
      "performance-ten-wins",
      "Ten Wins",
      "Win ten recorded league games.",
      "Performance",
      ACHIEVEMENT_TIERS.EPIC,
      "flame",
      90,
      function(metrics) {
        return buildAchievementThreshold(metrics.wins, 10);
      }
    ),
    buildAchievementDefinition(
      "performance-twenty-wins",
      "Twenty Wins",
      "Win twenty recorded league games.",
      "Performance",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "trophy",
      200,
      function(metrics) {
        return buildAchievementThreshold(metrics.wins, 20);
      }
    ),
    buildAchievementDefinition(
      "performance-perfect-season",
      "Perfect Season",
      "Finish at least five recorded games without a loss.",
      "Performance",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "diamond",
      250,
      function(metrics) {
        return buildAchievementResult(
          metrics.games >= 5 && metrics.losses === 0,
          metrics.losses === 0
            ? buildAchievementProgress(metrics.games, 5)
            : 0,
          "season"
        );
      }
    ),
    buildAchievementDefinition(
      "performance-five-game-win-streak",
      "Five Game Win Streak",
      "Win five league games in a row.",
      "Performance",
      ACHIEVEMENT_TIERS.EPIC,
      "zap",
      100,
      function(metrics) {
        return buildAchievementThreshold(metrics.longestWinStreak, 5);
      }
    ),
    buildAchievementDefinition(
      "performance-ten-game-win-streak",
      "Ten Game Win Streak",
      "Win ten league games in a row.",
      "Performance",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "bolt",
      250,
      function(metrics) {
        return buildAchievementThreshold(metrics.longestWinStreak, 10);
      }
    ),
    buildAchievementDefinition(
      "performance-highest-op",
      "Highest OP",
      "Record a maximum objective score in a league game.",
      "Performance",
      ACHIEVEMENT_TIERS.RARE,
      "crosshair",
      40,
      function(metrics) {
        return buildAchievementThreshold(metrics.highestOP, 6);
      }
    ),
    buildAchievementDefinition(
      "performance-highest-tp",
      "Highest TP",
      "Record a maximum tournament point score in a league game.",
      "Performance",
      ACHIEVEMENT_TIERS.RARE,
      "flag",
      40,
      function(metrics) {
        return buildAchievementThreshold(metrics.highestTP, 5);
      }
    ),
    buildAchievementDefinition(
      "performance-highest-vp",
      "Highest VP",
      "Score at least 150 victory points in a league game.",
      "Performance",
      ACHIEVEMENT_TIERS.EPIC,
      "gauge",
      75,
      function(metrics) {
        return buildAchievementThreshold(metrics.highestVP, 150);
      }
    ),
    buildAchievementDefinition(
      "faction-specialist",
      "Faction Specialist",
      "Play five games with the same faction.",
      "Faction Mastery",
      ACHIEVEMENT_TIERS.COMMON,
      "hexagon",
      25,
      function(metrics) {
        return buildAchievementThreshold(metrics.mostFactionGames, 5);
      }
    ),
    buildAchievementDefinition(
      "faction-master",
      "Faction Master",
      "Play ten games with the same faction.",
      "Faction Mastery",
      ACHIEVEMENT_TIERS.RARE,
      "badge",
      60,
      function(metrics) {
        return buildAchievementThreshold(metrics.mostFactionGames, 10);
      }
    ),
    buildAchievementDefinition(
      "faction-played-every-faction",
      "Played Every Faction",
      "Record games with every faction represented in league history.",
      "Faction Mastery",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "globe",
      250,
      function(metrics) {
        return buildAchievementResult(
          metrics.knownFactions > 0 &&
            metrics.uniqueFactions >= metrics.knownFactions,
          buildAchievementProgress(
            metrics.uniqueFactions,
            metrics.knownFactions || 1
          ),
          "factions"
        );
      }
    ),
    buildAchievementDefinition(
      "faction-ten-wins-same-faction",
      "Ten Wins with Same Faction",
      "Win ten games with one faction.",
      "Faction Mastery",
      ACHIEVEMENT_TIERS.EPIC,
      "award",
      125,
      function(metrics) {
        return buildAchievementThreshold(metrics.mostFactionWins, 10);
      }
    ),
    buildAchievementDefinition(
      "mission-master",
      "Mission Master",
      "Play five games on the same mission.",
      "Mission Mastery",
      ACHIEVEMENT_TIERS.COMMON,
      "map",
      25,
      function(metrics) {
        return buildAchievementThreshold(metrics.mostMissionGames, 5);
      }
    ),
    buildAchievementDefinition(
      "mission-win-every-mission",
      "Win Every Mission",
      "Win on every mission represented in league history.",
      "Mission Mastery",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "compass",
      250,
      function(metrics) {
        return buildAchievementResult(
          metrics.knownMissions > 0 &&
            metrics.uniqueMissionWins >= metrics.knownMissions,
          buildAchievementProgress(
            metrics.uniqueMissionWins,
            metrics.knownMissions || 1
          ),
          "missions"
        );
      }
    ),
    buildAchievementDefinition(
      "mission-five-wins-same-mission",
      "Five Wins on Same Mission",
      "Win five games on one mission.",
      "Mission Mastery",
      ACHIEVEMENT_TIERS.RARE,
      "route",
      60,
      function(metrics) {
        return buildAchievementThreshold(metrics.mostMissionWins, 5);
      }
    ),
    buildAchievementDefinition(
      "army-building-first-list",
      "First Army List",
      "Submit your first army list.",
      "Army Building",
      ACHIEVEMENT_TIERS.COMMON,
      "file",
      10,
      function(metrics) {
        return buildAchievementThreshold(metrics.armyLists, 1);
      }
    ),
    buildAchievementDefinition(
      "army-building-list-engineer",
      "List Engineer",
      "Submit five army lists.",
      "Army Building",
      ACHIEVEMENT_TIERS.RARE,
      "files",
      45,
      function(metrics) {
        return buildAchievementThreshold(metrics.armyLists, 5);
      }
    ),
    buildAchievementDefinition(
      "army-building-highest-rated",
      "Highest Rated Army List",
      "Earn a positive community rating on an army list.",
      "Army Building",
      ACHIEVEMENT_TIERS.RARE,
      "thumbs-up",
      35,
      function(metrics) {
        return buildAchievementThreshold(metrics.highestListScore, 1);
      }
    ),
    buildAchievementDefinition(
      "promotion-promoted",
      "Promoted",
      "Reach a promotion position in your division.",
      "Season Awards",
      ACHIEVEMENT_TIERS.EPIC,
      "arrow-up",
      100,
      function(metrics) {
        return buildAchievementResult(
          metrics.rank > 0 &&
            metrics.rank <= 2 &&
            metrics.division !== CONFIG.DIVISIONS.MAIN_MAN,
          metrics.rank > 0 ? 100 : 0,
          "standings"
        );
      }
    ),
    buildAchievementDefinition(
      "promotion-main-man",
      "Main Man",
      "Compete in the Main Man division.",
      "League History",
      ACHIEVEMENT_TIERS.EPIC,
      "shield-check",
      125,
      function(metrics) {
        return buildAchievementResult(
          metrics.division === CONFIG.DIVISIONS.MAIN_MAN,
          metrics.division === CONFIG.DIVISIONS.MAIN_MAN ? 100 : 0,
          "division"
        );
      }
    ),
    buildAchievementDefinition(
      "promotion-division-champion",
      "Division Champion",
      "Hold rank #1 in your division.",
      "Season Awards",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "crown",
      200,
      function(metrics) {
        return buildAchievementResult(
          metrics.rank === 1,
          metrics.rank === 1 ? 100 : 50,
          "standings"
        );
      }
    ),
    buildAchievementDefinition(
      "promotion-season-champion",
      "Season Champion",
      "Hold rank #1 in Main Man.",
      "Season Awards",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "trophy",
      300,
      function(metrics) {
        return buildAchievementResult(
          metrics.rank === 1 &&
            metrics.division === CONFIG.DIVISIONS.MAIN_MAN,
          metrics.rank === 1 ? 100 : 0,
          "standings"
        );
      }
    ),
    buildAchievementDefinition(
      "legendary-hall-of-fame",
      "Hall of Fame",
      "Appear on a Hall of Fame leaderboard.",
      "League History",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "landmark",
      250,
      function(metrics) {
        return buildAchievementResult(
          metrics.hallOfFame,
          metrics.hallOfFame ? 100 : 0,
          "history"
        );
      }
    ),
    buildAchievementDefinition(
      "legendary-veteran",
      "Veteran",
      "Play fifty recorded league games.",
      "League History",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "ribbon",
      150,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 50);
      }
    ),
    buildAchievementDefinition(
      "legendary-century-club",
      "Century Club",
      "Play one hundred recorded league games.",
      "League History",
      ACHIEVEMENT_TIERS.LEGENDARY,
      "infinity",
      300,
      function(metrics) {
        return buildAchievementThreshold(metrics.games, 100);
      }
    ),
    buildManualAchievementDefinition(
      "sportsmanship-community-favorite",
      "Community Favorite",
      "Awarded by the commissioner for community impact.",
      "Sportsmanship",
      ACHIEVEMENT_TIERS.EPIC,
      "heart",
      100
    ),
    buildManualAchievementDefinition(
      "sportsmanship-best-painted",
      "Best Painted",
      "Awarded for outstanding painted miniatures.",
      "Sportsmanship",
      ACHIEVEMENT_TIERS.RARE,
      "brush",
      75
    ),
    buildManualAchievementDefinition(
      "sportsmanship-best-opponent",
      "Best Opponent",
      "Awarded for exceptional sportsmanship.",
      "Sportsmanship",
      ACHIEVEMENT_TIERS.RARE,
      "handshake",
      75
    ),
    buildManualAchievementDefinition(
      "sportsmanship-great-sportsman",
      "Great Sportsman",
      "Awarded for consistently improving the league experience.",
      "Sportsmanship",
      ACHIEVEMENT_TIERS.EPIC,
      "sparkles",
      125
    ),
    buildManualAchievementDefinition(
      "commissioner-award",
      "Commissioner Award",
      "Special recognition from league commissioners.",
      "Commissioner Awards",
      ACHIEVEMENT_TIERS.EPIC,
      "stamp",
      150
    ),
    buildHiddenAchievementDefinition(
      ACHIEVEMENT_PERFECT_CONTROL_ID,
      "Perfect Control",
      "Unlock this hidden achievement by recording a perfect OP game.",
      "Hidden Achievements",
      ACHIEVEMENT_TIERS.EPIC,
      "lock",
      75,
      function(metrics) {
        return buildAchievementResult(
          Number(metrics.perfectControlGames) > 0,
          Number(metrics.perfectControlGames) > 0 ? 100 : 0,
          "league-data"
        );
      }
    )
  ];

}

function buildAchievementDefinition(
  id,
  name,
  description,
  category,
  tier,
  icon,
  points,
  evaluator
) {

  return {
    id: id,
    name: name,
    description: description,
    category: category,
    tier: tier,
    icon: icon,
    points: points,
    visibility: ACHIEVEMENT_VISIBILITY.VISIBLE,
    automatic: true,
    commissionerAward: false,
    evaluator: evaluator,
    requirement: ""
  };

}

function buildManualAchievementDefinition(
  id,
  name,
  description,
  category,
  tier,
  icon,
  points
) {

  return {
    id: id,
    name: name,
    description: description,
    category: category,
    tier: tier,
    icon: icon,
    points: points,
    visibility: ACHIEVEMENT_VISIBILITY.VISIBLE,
    automatic: false,
    commissionerAward: true,
    evaluator: function() {
      return buildAchievementResult(false, 0, "manual");
    },
    requirement: ""
  };

}

function buildHiddenAchievementDefinition(
  id,
  name,
  description,
  category,
  tier,
  icon,
  points,
  evaluator
) {

  const definition =
    buildAchievementDefinition(
      id,
      name,
      description,
      category,
      tier,
      icon,
      points,
      evaluator
    );

  definition.visibility =
    ACHIEVEMENT_VISIBILITY.HIDDEN;

  return definition;

}

function buildCommissionerAchievementDefinition(parameters) {

  return {
    id:
      getApiParameter(parameters, "achievementId") ||
      getApiParameter(parameters, "id"),
    name:
      getApiParameter(parameters, "name") ||
      "Commissioner Award",
    description:
      getApiParameter(parameters, "description") ||
      "Special recognition from league commissioners.",
    category:
      getApiParameter(parameters, "category") ||
      "Commissioner Awards",
    tier:
      getApiParameter(parameters, "tier") ||
      ACHIEVEMENT_TIERS.EPIC,
    icon:
      getApiParameter(parameters, "icon") ||
      "stamp",
    points:
      Number(getApiParameter(parameters, "points")) || 150,
    visibility:
      getApiParameter(parameters, "visibility") ||
      ACHIEVEMENT_VISIBILITY.VISIBLE,
    automatic: false,
    commissionerAward: true,
    requirement: "",
    evaluator: function() {
      return buildAchievementResult(false, 0, "manual");
    }
  };

}

function buildAchievementMetrics(playerName) {

  const player =
    getAuthString(playerName);

  const normalized =
    player.toLowerCase();

  const games =
    typeof getAllRecentGameObjects === "function"
      ? getAllRecentGameObjects()
      : [];

  const playerGames =
    games.filter(function(game) {

      return (
        getAuthString(game.winner).toLowerCase() === normalized ||
        getAuthString(game.loser).toLowerCase() === normalized
      );

    });

  const lists =
    typeof getArmyListObjects === "function"
      ? getArmyListObjects().filter(function(list) {
          return getAuthString(list.player).toLowerCase() === normalized;
        })
      : [];

  const standing =
    getAchievementStanding(player);

  const metrics = {
    player: player,
    games: playerGames.length,
    wins: 0,
    losses: 0,
    rank: Number(standing.rank) || 0,
    division: getAuthString(standing.division),
    highestTP: 0,
    highestOP: 0,
    highestVP: 0,
    perfectControlGames: 0,
    longestWinStreak: 0,
    currentWinStreak: 0,
    mostFactionGames: 0,
    mostFactionWins: 0,
    mostMissionGames: 0,
    mostMissionWins: 0,
    uniqueFactions: 0,
    uniqueMissionWins: 0,
    knownFactions: getKnownAchievementFactionCount(games),
    knownMissions: getKnownAchievementMissionCount(games),
    armyLists: lists.length,
    highestListScore: getHighestAchievementListScore(lists),
    hallOfFame: getAchievementHallOfFameStatus(player)
  };

  const factionGames = {};
  const factionWins = {};
  const missionGames = {};
  const missionWins = {};
  const uniqueFactions = {};
  const uniqueMissionWins = {};

  let currentStreak = 0;
  let longestStreak = 0;

  playerGames
    .slice()
    .reverse()
    .forEach(function(game) {

      const won =
        getAuthString(game.winner).toLowerCase() === normalized;

      const faction =
        won
          ? getAuthString(game.winnerFaction)
          : getAuthString(game.loserFaction);

      const mission =
        getAuthString(game.mission);

      updateAchievementScoreMetrics(
        metrics,
        game,
        won
      );

      if (faction !== "") {
        factionGames[faction] =
          (factionGames[faction] || 0) + 1;
        uniqueFactions[faction] = true;
      }

      if (mission !== "")
        missionGames[mission] =
          (missionGames[mission] || 0) + 1;

      if (won) {
        metrics.wins++;
        currentStreak++;
        longestStreak =
          Math.max(longestStreak, currentStreak);

        if (faction !== "")
          factionWins[faction] =
            (factionWins[faction] || 0) + 1;

        if (mission !== "") {
          missionWins[mission] =
            (missionWins[mission] || 0) + 1;
          uniqueMissionWins[mission] = true;
        }
      }
      else {
        metrics.losses++;
        currentStreak = 0;
      }

    });

  metrics.longestWinStreak =
    longestStreak;

  metrics.currentWinStreak =
    currentStreak;

  metrics.mostFactionGames =
    getAchievementMaxCount(factionGames);

  metrics.mostFactionWins =
    getAchievementMaxCount(factionWins);

  metrics.mostMissionGames =
    getAchievementMaxCount(missionGames);

  metrics.mostMissionWins =
    getAchievementMaxCount(missionWins);

  metrics.uniqueFactions =
    Object.keys(uniqueFactions).length;

  metrics.uniqueMissionWins =
    Object.keys(uniqueMissionWins).length;

  return metrics;

}

function updateAchievementScoreMetrics(metrics, game, won) {

  const tp =
    getAchievementPlayerScore(game.tp, won);

  const op =
    getAchievementPlayerScore(game.op, won);

  const vp =
    getAchievementPlayerScore(game.vp, won);

  metrics.highestTP =
    Math.max(metrics.highestTP, tp);

  metrics.highestOP =
    Math.max(metrics.highestOP, op);

  metrics.highestVP =
    Math.max(metrics.highestVP, vp);

  if (op === 10)
    metrics.perfectControlGames =
      (Number(metrics.perfectControlGames) || 0) + 1;

  return {
    tp: tp,
    op: op,
    vp: vp
  };

}

function getAchievementStanding(playerName) {

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(registry);

  const registeredPlayer =
    registry[playerName];

  if (!registeredPlayer)
    return {};

  const standing =
    getPlayerStanding(
      registry,
      registeredPlayer
    );

  return {
    division: registeredPlayer.division,
    rank: standing.rank,
    games: standing.games,
    wins: standing.wins,
    losses: standing.losses,
    tp: standing.tp,
    op: standing.op,
    vp: standing.vp
  };

}

function getKnownAchievementFactionCount(games) {

  const factions = {};

  games.forEach(function(game) {

    const winnerFaction =
      getAuthString(game.winnerFaction);

    const loserFaction =
      getAuthString(game.loserFaction);

    if (winnerFaction !== "")
      factions[winnerFaction] = true;

    if (loserFaction !== "")
      factions[loserFaction] = true;

  });

  return Object.keys(factions).length;

}

function getKnownAchievementMissionCount(games) {

  const missions = {};

  games.forEach(function(game) {

    const mission =
      getAuthString(game.mission);

    if (mission !== "")
      missions[mission] = true;

  });

  return Object.keys(missions).length;

}

function getHighestAchievementListScore(lists) {

  return lists.reduce(function(best, list) {

    return Math.max(
      best,
      Number(list.score) || 0
    );

  }, 0);

}

function getAchievementHallOfFameStatus(playerName) {

  if (typeof getHallOfFameStandings !== "function")
    return false;

  const normalized =
    getAuthString(playerName).toLowerCase();

  return getHallOfFameStandings()
    .some(function(record) {
      return getAuthString(record.player).toLowerCase() === normalized;
    });

}

function getAchievementPlayerScore(score, isWinner) {

  const parts =
    String(score || "0-0")
      .split("-")
      .map(function(part) {
        return Number(part) || 0;
      });

  return isWinner
    ? parts[0] || 0
    : parts[1] || 0;

}

function getAchievementMaxCount(counts) {

  return Object.keys(counts)
    .reduce(function(best, key) {
      return Math.max(best, counts[key]);
    }, 0);

}

function evaluateAchievementDefinition(definition, metrics) {

  if (!definition || typeof definition.evaluator !== "function")
    return buildAchievementResult(false, 0, "");

  return definition.evaluator(metrics);

}

function buildAchievementThreshold(value, required) {

  return buildAchievementResult(
    Number(value) >= Number(required),
    buildAchievementProgress(value, required),
    "league-data"
  );

}

function buildAchievementResult(unlocked, progress, source) {

  return {
    unlocked: unlocked,
    progress: Math.max(
      0,
      Math.min(100, Number(progress) || 0)
    ),
    source: source || "league-data"
  };

}

function buildAchievementProgress(value, required) {

  const target =
    Number(required) || 1;

  return Math.round(
    Math.max(
      0,
      Math.min(1, (Number(value) || 0) / target)
    ) * 100
  );

}

function unlockAchievementForPlayer(playerName, definition, options) {

  const player =
    getAuthString(playerName);

  const sheet =
    getAchievementsSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0];

  const columns =
    getAchievementColumns(headers);

  const existing =
    findAchievementRow(
      values,
      columns,
      player,
      definition.id
    );

  if (existing.record)
    return existing.record;

  const record =
    {
      player: player,
      id: definition.id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      tier: definition.tier,
      icon: definition.icon,
      points: Number(definition.points) || 0,
      unlocked: true,
      dateEarned: getAchievementTimestamp(),
      seasonEarned: getAchievementCurrentSeason(),
      visibility: definition.visibility,
      automatic: definition.automatic,
      commissionerAward: definition.commissionerAward,
      progress: Number(options && options.progress) || 100,
      requirement: definition.requirement || "",
      source: (options && options.source) || "league-data"
    };

  sheet.appendRow(
    buildAchievementSheetRow(record)
  );

  try {

    if (typeof publishLeagueAutomationEvent === "function")
      publishLeagueAutomationEvent({
        eventType: "achievementUnlocked",
        category: "Achievements",
        priority:
          record.tier === "Legendary" ||
          record.tier === "Epic" ||
          record.commissionerAward
            ? "high"
            : "normal",
        player: player,
        division: "",
        message:
          player +
          " unlocked " +
          record.name +
          ".",
        payload: JSON.stringify(record)
      });

  }
  catch (err) {

    Logger.log(
      "Discord achievement announcement failed for " +
      player +
      ": " +
      String(err && err.message ? err.message : err)
    );

  }

  return record;

}

function getAchievementRecordsForPlayer(playerName) {

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

  const normalized =
    getAuthString(playerName).toLowerCase();

  return values
    .map(function(row) {
      return buildAchievementRecord(row, columns);
    })
    .filter(function(record) {
      return getAuthString(record.player).toLowerCase() === normalized;
    });

}

function findAchievementRow(values, columns, playerName, achievementId) {

  const normalizedPlayer =
    getAuthString(playerName).toLowerCase();

  const normalizedId =
    getAuthString(achievementId).toLowerCase();

  for (let index = 1; index < values.length; index++) {

    const record =
      buildAchievementRecord(
        values[index],
        columns
      );

    if (
      getAuthString(record.player).toLowerCase() === normalizedPlayer &&
      getAuthString(record.id).toLowerCase() === normalizedId
    )
      return {
        row: index + 1,
        record: record
      };

  }

  return {
    row: -1,
    record: null
  };

}

function buildAchievementRecordMap(records) {

  const map = {};

  records.forEach(function(record) {
    map[record.id] = record;
  });

  return map;

}

function revokeInvalidPerfectControlAchievementForPlayer(player, metrics, recordMap) {

  if (!recordMap[ACHIEVEMENT_PERFECT_CONTROL_ID])
    return false;

  if (Number(metrics.perfectControlGames) > 0)
    return false;

  const removed =
    deleteAchievementRecordForPlayer(
      player,
      ACHIEVEMENT_PERFECT_CONTROL_ID
    );

  if (removed) {
    delete recordMap[ACHIEVEMENT_PERFECT_CONTROL_ID];
    invalidateAchievementCaches(player);
  }

  return removed;

}

function deleteAchievementRecordForPlayer(playerName, achievementId) {

  const sheet =
    getAchievementsSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return false;

  const columns =
    getAchievementColumns(values[0]);

  const existing =
    findAchievementRow(
      values,
      columns,
      playerName,
      achievementId
    );

  if (existing.row <= 1)
    return false;

  sheet.deleteRow(existing.row);
  return true;

}

function getPerfectControlAchievementRows() {

  const sheet =
    getAchievementsSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  const columns =
    getAchievementColumns(values[0]);

  const rows = [];

  for (let index = 1; index < values.length; index++) {
    const record =
      buildAchievementRecord(
        values[index],
        columns
      );

    if (
      record.unlocked &&
      record.id === ACHIEVEMENT_PERFECT_CONTROL_ID
    )
      rows.push({
        row: index + 1,
        record: record
      });
  }

  return rows;

}

function getAchievementPlayerObjectiveGames(playerName) {

  const normalized =
    getAuthString(playerName).toLowerCase();

  const games =
    typeof getAllRecentGameObjects === "function"
      ? getAllRecentGameObjects()
      : [];

  return games
    .map(function(game) {

      const winner =
        getAuthString(game.winner).toLowerCase();
      const loser =
        getAuthString(game.loser).toLowerCase();

      if (winner !== normalized && loser !== normalized)
        return null;

      const won =
        winner === normalized;

      return {
        date: game.date,
        mission: getAuthString(game.mission),
        objectivePoints:
          getAchievementPlayerScore(game.op, won)
      };

    })
    .filter(function(game) {
      return Boolean(game);
    })
    .sort(function(a, b) {
      return (
        getAchievementDate(b.date).getTime() -
        getAchievementDate(a.date).getTime()
      );
    });

}

function getHighestAchievementObjectiveGame(games) {

  return games
    .slice()
    .sort(function(a, b) {
      if (b.objectivePoints !== a.objectivePoints)
        return b.objectivePoints - a.objectivePoints;

      return (
        getAchievementDate(b.date).getTime() -
        getAchievementDate(a.date).getTime()
      );
    })[0] || null;

}

function buildAchievementRecord(row, columns) {

  return {
    player:
      getAuthString(row[columns.player]),
    id:
      getAuthString(row[columns.id]),
    name:
      getAuthString(row[columns.name]),
    description:
      getAuthString(row[columns.description]),
    category:
      getAuthString(row[columns.category]),
    tier:
      getAuthString(row[columns.tier]),
    icon:
      getAuthString(row[columns.icon]),
    points:
      Number(row[columns.points]) || 0,
    unlocked:
      row[columns.unlocked] === true ||
      getAuthString(row[columns.unlocked]).toLowerCase() === "true",
    dateEarned:
      formatAchievementDate(row[columns.dateEarned]),
    seasonEarned:
      getAuthString(row[columns.seasonEarned]),
    visibility:
      getAuthString(row[columns.visibility]) ||
      ACHIEVEMENT_VISIBILITY.VISIBLE,
    automatic:
      row[columns.automatic] === true ||
      getAuthString(row[columns.automatic]).toLowerCase() === "true",
    commissionerAward:
      row[columns.commissionerAward] === true ||
      getAuthString(row[columns.commissionerAward]).toLowerCase() === "true",
    progress:
      Number(row[columns.progress]) || 0,
    requirement:
      getAuthString(row[columns.requirement]),
    source:
      getAuthString(row[columns.source])
  };

}

function normalizeAchievementPayload(definition, record, progress) {

  const unlocked =
    record && record.unlocked;

  return {
    id: definition.id,
    name:
      unlocked && record.name !== ""
        ? record.name
        : definition.name,
    title:
      unlocked && record.name !== ""
        ? record.name
        : definition.name,
    description:
      unlocked && record.description !== ""
        ? record.description
        : definition.description,
    category:
      definition.category,
    tier:
      definition.tier,
    icon:
      definition.icon,
    points:
      Number(definition.points) || 0,
    unlocked:
      Boolean(unlocked),
    dateEarned:
      unlocked
        ? record.dateEarned
        : "",
    seasonEarned:
      unlocked
        ? record.seasonEarned
        : "",
    visibility:
      definition.visibility,
    automatic:
      definition.automatic,
    commissionerAward:
      definition.commissionerAward,
    progress:
      unlocked
        ? 100
        : Number(progress) || 0,
    requirement:
      definition.requirement || "",
    value:
      unlocked
        ? String(definition.points || 0) + " pts"
        : String(Number(progress) || 0) + "%"
  };

}

function sortAchievementsForProfile(a, b) {

  if (a.unlocked !== b.unlocked)
    return a.unlocked ? -1 : 1;

  const dateOrder =
    getAchievementDate(b.dateEarned).getTime() -
    getAchievementDate(a.dateEarned).getTime();

  if (dateOrder !== 0)
    return dateOrder;

  return (
    getAchievementTierWeight(b.tier) -
    getAchievementTierWeight(a.tier)
  );

}

function getAchievementTierWeight(tier) {

  switch (getAuthString(tier)) {

    case ACHIEVEMENT_TIERS.LEGENDARY:
      return 4;

    case ACHIEVEMENT_TIERS.EPIC:
      return 3;

    case ACHIEVEMENT_TIERS.RARE:
      return 2;

    default:
      return 1;

  }

}

function getAchievementDefinitionById(achievementId) {

  const normalized =
    getAuthString(achievementId).toLowerCase();

  return getAchievementDefinitions()
    .filter(function(definition) {
      return definition.id.toLowerCase() === normalized;
    })[0] || null;

}

function getAchievementLeaguePlayers() {

  const registry =
    buildPlayerRegistry();

  return Object.keys(registry)
    .sort();

}

function getAchievementsSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.ACHIEVEMENTS || "Achievements"
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.ACHIEVEMENTS || "Achievements"
      );

  ensureAchievementSheetHeaders(sheet);

  return sheet;

}

function ensureAchievementSheetHeaders(sheet) {

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ACHIEVEMENT_SHEET_HEADERS);
    return;
  }

  const existing =
    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

  let changed = false;

  ACHIEVEMENT_SHEET_HEADERS.forEach(function(header) {

    if (existing.indexOf(header) === -1) {
      existing.push(header);
      changed = true;
    }

  });

  if (changed)
    sheet
      .getRange(1, 1, 1, existing.length)
      .setValues([existing]);

}

function getAchievementColumns(headers) {

  return {
    player: headers.indexOf("Player"),
    id: headers.indexOf("Achievement ID"),
    name: headers.indexOf("Name"),
    description: headers.indexOf("Description"),
    category: headers.indexOf("Category"),
    tier: headers.indexOf("Tier"),
    icon: headers.indexOf("Icon"),
    points: headers.indexOf("Points"),
    unlocked: headers.indexOf("Unlocked"),
    dateEarned: headers.indexOf("Date Earned"),
    seasonEarned: headers.indexOf("Season Earned"),
    visibility: headers.indexOf("Visibility"),
    automatic: headers.indexOf("Automatic"),
    commissionerAward: headers.indexOf("Commissioner Award"),
    progress: headers.indexOf("Progress"),
    requirement: headers.indexOf("Requirement"),
    source: headers.indexOf("Source")
  };

}

function buildAchievementSheetRow(record) {

  return [
    record.player,
    record.id,
    record.name,
    record.description,
    record.category,
    record.tier,
    record.icon,
    record.points,
    record.unlocked,
    record.dateEarned,
    record.seasonEarned,
    record.visibility,
    record.automatic,
    record.commissionerAward,
    record.progress,
    record.requirement,
    record.source
  ];

}

function getCachedAchievementPayload(playerName) {

  try {
    const cache =
      CacheService.getScriptCache();

    const cached =
      cache.get(getAchievementCacheKey(playerName));

    return cached
      ? JSON.parse(cached)
      : null;
  }
  catch (err) {
    return null;
  }

}

function cacheAchievementPayload(playerName, payload) {

  try {
    CacheService
      .getScriptCache()
      .put(
        getAchievementCacheKey(playerName),
        JSON.stringify(payload),
        60
      );
  }
  catch (err) {}

}

function invalidateAchievementCaches(playerName) {

  try {
    const cache =
      CacheService.getScriptCache();

    if (playerName !== "")
      cache.remove(
        getAchievementCacheKey(playerName)
      );

    cache.remove("achievement-unlocks-recent");
  }
  catch (err) {}

}

function getAchievementCacheKey(playerName) {

  return (
    "achievements-" +
    ACHIEVEMENT_CACHE_VERSION +
    "-" +
    getAuthString(playerName).toLowerCase()
  );

}

function getAchievementCurrentSeason() {

  const settings =
    typeof getSettingsObjectSafe === "function"
      ? getSettingsObjectSafe()
      : {};

  return (
    getAuthString(settings.currentSeason) ||
    getAuthString(settings.season) ||
    String(new Date().getFullYear())
  );

}

function getAchievementTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function formatAchievementDate(value) {

  if (Object.prototype.toString.call(value) === "[object Date]")
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss"
    );

  return getAuthString(value);

}

function getAchievementDate(value) {

  if (Object.prototype.toString.call(value) === "[object Date]")
    return value;

  const parsed =
    new Date(value || 0);

  if (isNaN(parsed.getTime()))
    return new Date(0);

  return parsed;

}
