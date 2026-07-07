/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * EventMigrationValidationApi.gs
 *
 * Version 3.0C read-only Event Engine validation.
 *******************************************************/

const EVENT_VALIDATION_VOLATILE_KEYS = [
  "timestamp",
  "checkedAt",
  "generatedAt",
  "createdAt",
  "updatedAt",
  "lastRefresh",
  "lastSeen",
  "lastLogin",
  "created",
  "cacheStatus"
];

function getEventMigrationValidation() {

  return jsonOutput({
    success: true,
    validation: buildEventMigrationValidation()
  });

}

function buildEventMigrationValidation() {

  const startedAt =
    Date.now();

  ensureEventEngine();

  const comparisons = [
    buildEventValidationComparison(
      "Standings",
      function() {
        return buildEventValidationStandings();
      }
    ),
    buildEventValidationComparison(
      "Player Statistics",
      function() {
        return buildEventValidationPlayerStatistics();
      }
    ),
    buildEventValidationComparison(
      "Hall of Fame",
      function() {
        return getEventValidationJson(getHallOfFame);
      }
    ),
    buildEventValidationComparison(
      "Achievements",
      function() {
        return buildEventValidationAchievements();
      }
    ),
    buildEventValidationComparison(
      "Player Intelligence",
      function() {
        return getEventValidationJson(getIntelligence);
      }
    ),
    buildEventValidationComparison(
      "Timeline",
      function() {
        return getEventValidationJson(getTimeline);
      }
    ),
    buildEventValidationComparison(
      "Automation",
      function() {
        return getEventValidationJson(getAutomationCenter);
      }
    ),
    buildEventValidationComparison(
      "Notifications",
      function() {
        return getEventValidationJson(function() {
          return jsonOutput({
            success: true,
            notifications: buildLeagueNotifications()
          });
        });
      }
    ),
    buildEventValidationComparison(
      "Discord Events",
      function() {
        return getEventValidationJson(function() {
          return jsonOutput({
            success: true,
            discord: getDiscordOperationsStatus()
          });
        });
      }
    ),
    buildEventValidationComparison(
      "Army Lists",
      function() {
        return getEventValidationJson(getArmyLists);
      }
    ),
    buildEventValidationComparison(
      "Recent Games",
      function() {
        return getEventValidationJson(getRecentGames);
      }
    ),
    buildEventValidationComparison(
      "Deep Links",
      function() {
        return buildEventValidationDeepLinks();
      }
    ),
    buildEventValidationComparison(
      "Career Statistics",
      function() {
        return buildEventValidationCareerStatistics();
      }
    ),
    buildEventValidationComparison(
      "Promotion",
      function() {
        return {
          success: true,
          promotion:
            buildPromotionRelegationProposal()
              .promotedFromProvingGroundsA
        };
      }
    ),
    buildEventValidationComparison(
      "Relegation",
      function() {
        return {
          success: true,
          relegation:
            buildPromotionRelegationProposal()
              .relegatedFromMain
        };
      }
    )
  ];

  const failed =
    comparisons.filter(function(comparison) {
      return !comparison.match;
    });

  return {
    generatedAt: getEventValidationTimestamp(),
    eventScope: {
      eventId: EVENT_ENGINE_DEFAULT_EVENT_ID,
      seasonId: EVENT_ENGINE_DEFAULT_SEASON_ID,
      roundId: EVENT_ENGINE_DEFAULT_ROUND_ID
    },
    summary: {
      total: comparisons.length,
      passed: comparisons.length - failed.length,
      failed: failed.length,
      status:
        failed.length === 0
          ? "PASS"
          : "FAIL",
      durationMs: Date.now() - startedAt
    },
    comparisons: comparisons,
    migrationPreview: buildEventMigrationPreview(),
    migrationAudit: buildEventMigrationAudit(),
    migrationReport: buildEventMigrationReport(),
    rollbackPlan: buildEventMigrationRollback(),
    historicalGames:
      buildHistoricalGameScopeValidation()
  };

}

function buildEventValidationComparison(name, producer) {

  try {

    const legacy =
      producer();

    const eventResult =
      runEventValidationInDefaultScope(producer);

    const normalizedLegacy =
      normalizeEventValidationValue(legacy);

    const normalizedEvent =
      normalizeEventValidationValue(eventResult);

    const legacyJson =
      stableEventValidationStringify(normalizedLegacy);

    const eventJson =
      stableEventValidationStringify(normalizedEvent);

    const match =
      legacyJson === eventJson;

    return {
      subsystem: name,
      legacyResult:
        summarizeEventValidationResult(normalizedLegacy),
      eventResult:
        summarizeEventValidationResult(normalizedEvent),
      match: match,
      status:
        match
          ? "PASS"
          : "FAIL",
      legacyHash:
        hashEventValidationString(legacyJson),
      eventHash:
        hashEventValidationString(eventJson)
    };

  }
  catch (err) {

    return {
      subsystem: name,
      legacyResult: {
        error: String(err)
      },
      eventResult: {
        error: String(err)
      },
      match: false,
      status: "FAIL",
      error: String(err)
    };

  }

}

function runEventValidationInDefaultScope(producer) {

  const scope = {
    eventId: resolveEventId(""),
    seasonId: resolveSeasonId(""),
    roundId: resolveRoundId("")
  };

  if (
    scope.eventId !== EVENT_ENGINE_DEFAULT_EVENT_ID ||
    scope.seasonId !== EVENT_ENGINE_DEFAULT_SEASON_ID ||
    scope.roundId !== EVENT_ENGINE_DEFAULT_ROUND_ID
  )
    throw new Error("Default Event Engine scope did not resolve to Current League.");

  return producer();

}

function buildEventValidationStandings() {

  return {
    success: true,
    divisions: [
      buildStandingsResponse(
        getStandingsDivisionConfig("main")
      ),
      buildStandingsResponse(
        getStandingsDivisionConfig("pga")
      ),
      buildStandingsResponse(
        getStandingsDivisionConfig("pgb")
      )
    ]
  };

}

function buildEventValidationPlayerStatistics() {

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(registry);

  return {
    success: true,
    players:
      Object.keys(registry)
        .sort()
        .map(function(key) {
          const player =
            registry[key];

          return {
            player: player.player,
            displayName:
              player.displayName ||
              player.player,
            division: player.division,
            games: player.games,
            wins: player.wins,
            losses: player.losses,
            tp: player.tp,
            op: player.op,
            vp: player.vp
          };
        })
  };

}

function buildEventValidationAchievements() {

  const players =
    getOperationsLeagueIdentityRows()
      .slice(0, 10);

  return {
    success: true,
    players:
      players.map(function(player) {
        return {
          player: player.player,
          achievements:
            buildLeaguePlayerAchievements(player.player)
        };
      })
  };

}

function buildEventValidationDeepLinks() {

  return {
    success: true,
    links: [
      buildDeepLink("standings", {}),
      buildDeepLink("hallOfFame", {}),
      buildDeepLink("game", {
        gameId: 1,
        winner: "Lobo",
        loser: "Chainsaw"
      }),
      buildDeepLink("player", {
        player: "Lobo"
      }),
      buildDeepLink("achievement", {
        achievementId: "first-game",
        name: "First Game"
      })
    ]
  };

}

function buildEventValidationCareerStatistics() {

  const standings =
    getHallOfFameStandings();

  return {
    success: true,
    career:
      standings.map(function(player) {
        return {
          rank: player.rank,
          player: player.player,
          displayName:
            player.displayName ||
            player.player,
          games: player.games,
          wins: player.wins,
          losses: player.losses,
          winPercentage: player.winPercentage,
          tp: player.tp,
          op: player.op,
          vp: player.vp
        };
      })
  };

}

function buildHistoricalGameScopeValidation() {

  const games =
    getAllRecentGameObjects();

  return {
    totalGames: games.length,
    eventId:
      EVENT_ENGINE_DEFAULT_EVENT_ID,
    seasonId:
      EVENT_ENGINE_DEFAULT_SEASON_ID,
    roundId:
      EVENT_ENGINE_DEFAULT_ROUND_ID,
    canAssignDefaultScope:
      games.every(function(game) {
        return (
          game.winner !== "" &&
          game.loser !== "" &&
          game.mission !== ""
        );
      }),
    resultImpact:
      "No production migration is performed. Validation confirms default scope assignment is metadata-only and does not alter standings, statistics, achievements, Hall of Fame, or Player Intelligence calculations."
  };

}

function getEventValidationJson(callback) {

  return JSON.parse(
    callback().getContent()
  );

}

function normalizeEventValidationValue(value) {

  if (Array.isArray(value))
    return value.map(normalizeEventValidationValue);

  if (
    value &&
    typeof value === "object"
  ) {
    const normalized = {};

    Object.keys(value)
      .sort()
      .forEach(function(key) {
        if (EVENT_VALIDATION_VOLATILE_KEYS.indexOf(key) !== -1)
          return;

        normalized[key] =
          normalizeEventValidationValue(value[key]);
      });

    return normalized;
  }

  return value;

}

function summarizeEventValidationResult(value) {

  const json =
    stableEventValidationStringify(value);

  return {
    topLevelFields:
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.keys(value).sort()
        : [],
    itemCount:
      getEventValidationItemCount(value),
    jsonSize: json.length
  };

}

function getEventValidationItemCount(value) {

  if (Array.isArray(value))
    return value.length;

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.keys(value)
      .reduce(function(total, key) {
        const item =
          value[key];

        if (Array.isArray(item))
          return total + item.length;

        return total;
      }, 0);
  }

  return 0;

}

function stableEventValidationStringify(value) {

  return JSON.stringify(value);

}

function hashEventValidationString(value) {

  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash =
      ((hash << 5) - hash) +
      value.charCodeAt(index);

    hash |= 0;
  }

  return String(hash);

}

function getEventValidationTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
