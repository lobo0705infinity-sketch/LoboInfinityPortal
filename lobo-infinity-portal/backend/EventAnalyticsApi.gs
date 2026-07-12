/*******************************************************
 * LOBO INFINITY LEAGUE
 * EventAnalyticsApi.gs
 *
 * Event-scoped analytics dispatch layer. Keeps legacy
 * response shapes while selecting the data source from
 * the active Event.
 *******************************************************/

function buildEventAnalyticsContext(e) {

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

  const gameType =
    normalizeGameType(params.gameType || "league");

  const event =
    (
      typeof getEventByIdSnapshot === "function"
        ? getEventByIdSnapshot(eventId)
        : null
    ) ||
    (
      typeof getCurrentLeagueEventSnapshot === "function"
        ? getCurrentLeagueEventSnapshot()
        : null
    ) ||
    buildEventAnalyticsFallbackEvent(eventId);

  return {
    eventId: event.id || eventId,
    event: event,
    eventType: getEventAnalyticsString(event.type) || "League",
    gameType: gameType,
    isLeague:
      getEventAnalyticsString(event.type).toLowerCase() === "league"
  };

}

function buildEventAnalyticsFallbackEvent(eventId) {

  return {
    id: eventId || EVENT_ENGINE_DEFAULT_EVENT_ID,
    name: eventId || "Current Event",
    type: "League",
    status: "",
    lifecycleStage: ""
  };

}

function getEventAnalyticsPlayers(context) {

  if (
    context.isLeague &&
    context.gameType === "league"
  )
    return [
      buildEventStandingsResponse(
        getStandingsDivisionConfig("main"),
        context.eventId
      ),
      buildEventStandingsResponse(
        getStandingsDivisionConfig("pga"),
        context.eventId
      ),
      buildEventStandingsResponse(
        getStandingsDivisionConfig("pgb"),
        context.eventId
      )
    ];

  if (context.isLeague)
    return getEventAnalyticsGameEnginePlayers(context);

  const rows =
    getEventAnalyticsRegistrations(context.eventId)
      .filter(function(registration) {
        return registration.status !== "Withdrawn" &&
          registration.status !== "Removed";
      });

  const standings =
    rows.map(function(registration, index) {
      return buildEventAnalyticsStanding(
        context,
        registration.player || registration.displayName,
        registration.displayName,
        index + 1
      );
    });

  return [
    {
      success: true,
      eventId: context.eventId,
      event: context.event,
      division: "main",
      divisionLabel: context.event.name + " Participants",
      standings: standings,
      summary: buildEventAnalyticsDivisionSummary(standings)
    }
  ];

}

function getEventAnalyticsFactions(context) {

  if (context.isLeague)
    return buildFactionApiSummaries(
      context.gameType === "league"
        ? context.eventId
        : "all",
      context.gameType
    );

  const factions = {};

  getEventAnalyticsRegistrations(context.eventId)
    .forEach(function(registration) {
      const faction =
        getEventAnalyticsString(registration.faction) ||
        "Unreported";

      if (!factions[faction])
        factions[faction] = {
          name: faction,
          games: 0,
          wins: 0,
          losses: 0,
          tp: 0,
          op: 0,
          vp: 0,
          players: [],
          lastPlayed: ""
        };

      factions[faction].players.push(
        registration.displayName ||
        registration.player
      );
    });

  getEventAnalyticsResults(context.eventId)
    .forEach(function(result) {
      const faction =
        getEventAnalyticsString(result.winningFaction) ||
        "Unreported";

      if (!factions[faction])
        factions[faction] = {
          name: faction,
          games: 0,
          wins: 0,
          losses: 0,
          tp: 0,
          op: 0,
          vp: 0,
          players: [],
          lastPlayed: ""
        };

      factions[faction].games += 1;
      factions[faction].wins += 1;
      factions[faction].tp += Number(result.tournamentPoints) || 0;
      factions[faction].op += Number(result.objectivePoints) || 0;
      factions[faction].vp += Number(result.victoryPoints) || 0;
      factions[faction].lastPlayed =
        result.updatedAt ||
        result.createdAt ||
        factions[faction].lastPlayed;
    });

  return Object.keys(factions)
    .sort()
    .map(function(name) {
      const faction =
        factions[name];
      const games =
        faction.games || 0;

      return {
        name: faction.name,
        games: games,
        wins: faction.wins,
        losses: faction.losses,
        winRate: games > 0 ? (faction.wins / games) * 100 : 0,
        averageTP: games > 0 ? faction.tp / games : 0,
        averageOP: games > 0 ? faction.op / games : 0,
        averageVP: games > 0 ? faction.vp / games : 0,
        topPlayer: faction.players[0] || "",
        topPlayerDisplayName: faction.players[0] || "",
        lastPlayed: faction.lastPlayed,
        divisionBreakdown: []
      };
    });

}

function getEventAnalyticsGameEnginePlayers(context) {

  const rows =
    getLeagueDataForEvent(
      context.gameType === "league"
        ? context.eventId
        : "all",
      context.gameType
    );

  const players = {};

  rows.forEach(function(row) {
    const player =
      getEventAnalyticsString(row[CONFIG.ENGINE.PLAYER]);

    if (!player)
      return;

    if (!players[player])
      players[player] = {
        player: player,
        displayName: getPlayerDisplayName(player),
        games: 0,
        wins: 0,
        losses: 0,
        tp: 0,
        op: 0,
        vp: 0,
        faction: ""
      };

    const record =
      players[player];

    record.games += 1;
    record.tp += Number(row[CONFIG.ENGINE.TP]) || 0;
    record.op += Number(row[CONFIG.ENGINE.OP]) || 0;
    record.vp += Number(row[CONFIG.ENGINE.VP]) || 0;
    record.faction =
      record.faction ||
      getEventAnalyticsString(row[CONFIG.ENGINE.FACTION]);

    switch (getEventAnalyticsString(row[CONFIG.ENGINE.RESULT])) {
      case "W":
        record.wins += 1;
        break;
      case "L":
        record.losses += 1;
        break;
    }
  });

  const standings =
    Object.values(players)
      .sort(function(a, b) {
        if (b.wins !== a.wins)
          return b.wins - a.wins;
        if (b.tp !== a.tp)
          return b.tp - a.tp;
        if (b.op !== a.op)
          return b.op - a.op;
        if (b.vp !== a.vp)
          return b.vp - a.vp;
        return a.player.localeCompare(b.player);
      })
      .map(function(player, index) {
        return {
          eventId:
            context.gameType === "casual"
              ? ""
              : context.eventId,
          rank: index + 1,
          player: player.player,
          displayName: player.displayName || player.player,
          division:
            context.gameType === "all"
              ? "All Games"
              : capitalizeEventAnalyticsGameType(context.gameType),
          games: player.games,
          wins: player.wins,
          losses: player.losses,
          tp: player.tp,
          op: player.op,
          vp: player.vp,
          faction: player.faction
        };
      });

  return [
    {
      success: true,
      eventId:
        context.gameType === "casual"
          ? ""
          : context.eventId,
      event: context.event,
      division: context.gameType,
      divisionLabel:
        capitalizeEventAnalyticsGameType(context.gameType) +
        " Player Analytics",
      standings: standings,
      summary: buildEventAnalyticsDivisionSummary(standings)
    }
  ];

}

function capitalizeEventAnalyticsGameType(gameType) {

  const value =
    getEventAnalyticsString(gameType);

  if (!value)
    return "League";

  if (value === "all")
    return "All Games";

  return value.charAt(0).toUpperCase() + value.slice(1);

}

function getEventAnalyticsMissions(context) {

  if (context.isLeague)
    return buildMissionApiSummaries(
      context.gameType === "league"
        ? context.eventId
        : "all",
      context.gameType
    );

  const missions = {};

  getEventAnalyticsResults(context.eventId)
    .forEach(function(result) {
      const mission =
        getEventAnalyticsString(result.mission) ||
        "Unassigned Mission";

      if (!missions[mission])
        missions[mission] = {
          mission: mission,
          games: 0,
          winnerTP: 0,
          winnerOP: 0,
          winnerVP: 0,
          factions: {},
          lastPlayed: ""
        };

      missions[mission].games += 1;
      missions[mission].winnerTP += Number(result.tournamentPoints) || 0;
      missions[mission].winnerOP += Number(result.objectivePoints) || 0;
      missions[mission].winnerVP += Number(result.victoryPoints) || 0;

      const faction =
        getEventAnalyticsString(result.winningFaction);

      if (faction)
        missions[mission].factions[faction] =
          (missions[mission].factions[faction] || 0) + 1;

      missions[mission].lastPlayed =
        result.updatedAt ||
        result.createdAt ||
        missions[mission].lastPlayed;
    });

  return Object.keys(missions)
    .sort()
    .map(function(name) {
      const mission =
        missions[name];
      const games =
        mission.games || 0;

      return {
        mission: mission.mission,
        games: games,
        averageTP: games > 0 ? mission.winnerTP / games : 0,
        averageOP: games > 0 ? mission.winnerOP / games : 0,
        averageVP: games > 0 ? mission.winnerVP / games : 0,
        firstTurnWinRate: 0,
        mostSuccessfulFaction:
          getEventAnalyticsTopKey(mission.factions),
        lastPlayed: mission.lastPlayed
      };
    });

}

function getEventAnalyticsIntelligence(context) {

  if (
    context.isLeague &&
    context.gameType === "league"
  )
    return JSON.parse(getIntelligence().getContent());

  if (context.isLeague)
    return getEventAnalyticsGameTypeIntelligence(context);

  const results =
    getEventAnalyticsResults(context.eventId);

  const standings =
    getEventAnalyticsTeamStandings(context);

  const missionTrends =
    getEventAnalyticsMissions(context)
      .map(function(mission) {
        mission.story =
          mission.games +
          " reported games for " +
          mission.mission +
          ".";
        return mission;
      });

  const factionMomentum =
    getEventAnalyticsFactions(context)
      .map(function(faction) {
        return {
          faction: faction.name,
          games: faction.games,
          wins: faction.wins,
          losses: faction.losses,
          trend: faction.games > 0 ? "Active" : "Registered",
          story:
            faction.name +
            " has " +
            faction.games +
            " reported games in this event."
        };
      });

  return {
    success: true,
    winStreaks: [],
    losingStreaks: [],
    highestVPGames: [],
    biggestVictories: buildEventAnalyticsGames(results),
    closestGames: buildEventAnalyticsGames(results),
    factionMomentum: factionMomentum,
    missionTrends: missionTrends,
    recentUpsets: [],
    promotionBattle: [],
    relegationBattle: [],
    records: buildEventAnalyticsRecords(results, standings)
  };

}

function getEventAnalyticsGameTypeIntelligence(context) {

  const games =
    getAllRecentGameObjectsForEvent(
      context.gameType === "league"
        ? context.eventId
        : "all",
      context.gameType
    );

  const intelligenceGames =
    games.map(function(game, index) {
      return {
        id: index + 1,
        date: game.date,
        division: game.division,
        winner: game.winner,
        winnerDisplayName: game.winnerDisplayName || game.winner,
        loser: game.loser,
        loserDisplayName: game.loserDisplayName || game.loser,
        winnerFaction: game.winnerFaction,
        loserFaction: game.loserFaction,
        mission: game.mission,
        tp: game.tp,
        op: game.op,
        vp: game.vp,
        bestMoment: game.bestMoment,
        firstTurn: game.firstTurn,
        value: Number(String(game.op || "").split("-")[0]) || 0,
        label: game.op || "",
        story:
          game.winner +
          " defeated " +
          game.loser +
          " on " +
          (game.mission || "an unreported mission") +
          "."
      };
    });

  return {
    success: true,
    winStreaks: [],
    losingStreaks: [],
    highestVPGames: intelligenceGames,
    biggestVictories: intelligenceGames,
    closestGames: intelligenceGames,
    factionMomentum:
      getEventAnalyticsFactions(context)
        .map(function(faction) {
          return {
            faction: faction.name,
            games: faction.games,
            wins: faction.wins,
            losses: faction.losses,
            trend: faction.games > 0 ? "Active" : "No data",
            story:
              faction.name +
              " has " +
              faction.games +
              " " +
              context.gameType +
              " games."
          };
        }),
    missionTrends:
      getEventAnalyticsMissions(context)
        .map(function(mission) {
          return {
            mission: mission.mission,
            games: mission.games,
            firstTurnWinRate: mission.firstTurnWinRate,
            mostSuccessfulFaction: mission.mostSuccessfulFaction,
            story:
              mission.mission +
              " has " +
              mission.games +
              " " +
              context.gameType +
              " games."
          };
        }),
    recentUpsets: [],
    promotionBattle: [],
    relegationBattle: [],
    records: getEventAnalyticsGameTypeRecords(context)
  };

}

function getEventAnalyticsGameTypeRecords(context) {

  const games =
    getAllRecentGameObjectsForEvent(
      context.gameType === "league"
        ? context.eventId
        : "all",
      context.gameType
    );

  return {
    largestVPMargin:
      getBiggestVictories(games)[0] || null,
    largestOPMargin:
      getLargestScoreMargin(
        games,
        "op",
        "OP Margin"
      ),
    highestScoringGame:
      getHighestScoringGames(games)[0] || null,
    lowestScoringGame:
      getLowestScoringGame(games),
    closestVPGame:
      getClosestGames(games)[0] || null,
    mostActivePlayer:
      getEventAnalyticsMostActiveGameValue(
        games,
        "player"
      ),
    mostActiveFaction:
      getEventAnalyticsMostActiveGameValue(
        games,
        "faction"
      ),
    mostActiveMission:
      getEventAnalyticsMostActiveGameValue(
        games,
        "mission"
      ),
    bestFirstTurnFaction:
      getEventAnalyticsFirstTurnFactionRecord(games, true),
    worstFirstTurnFaction:
      getEventAnalyticsFirstTurnFactionRecord(games, false)
  };

}

function getEventAnalyticsMostActiveGameValue(games, type) {

  const counts = {};

  games.forEach(function(game) {
    if (type === "player") {
      incrementEventAnalyticsCount(counts, game.winnerDisplayName || game.winner);
      incrementEventAnalyticsCount(counts, game.loserDisplayName || game.loser);
    } else if (type === "faction") {
      incrementEventAnalyticsCount(counts, game.winnerFaction);
      incrementEventAnalyticsCount(counts, game.loserFaction);
    } else {
      incrementEventAnalyticsCount(counts, game.mission);
    }
  });

  const name =
    getEventAnalyticsTopKey(counts);

  if (!name)
    return null;

  return {
    type: type,
    name: name,
    displayName: name,
    games: counts[name],
    story:
      name +
      " is the most active " +
      type +
      " with " +
      counts[name] +
      " appearances."
  };

}

function getEventAnalyticsFirstTurnFactionRecord(games, best) {

  const factions = {};

  games.forEach(function(game) {
    const firstTurn =
      getEventAnalyticsString(game.firstTurn);

    if (!firstTurn)
      return;

    const winner =
      getEventAnalyticsString(game.winner);
    const loser =
      getEventAnalyticsString(game.loser);
    const faction =
      firstTurn === winner
        ? game.winnerFaction
        : firstTurn === loser
          ? game.loserFaction
          : "";

    if (!faction)
      return;

    if (!factions[faction])
      factions[faction] = {
        faction: faction,
        games: 0,
        wins: 0
      };

    factions[faction].games += 1;

    if (firstTurn === winner)
      factions[faction].wins += 1;
  });

  const ranked =
    Object.values(factions)
      .filter(function(record) {
        return record.games > 0;
      })
      .sort(function(a, b) {
        const left =
          a.wins / a.games;
        const right =
          b.wins / b.games;

        return best
          ? right - left
          : left - right;
      });

  const record =
    ranked[0];

  if (!record)
    return null;

  const winRate =
    Math.round((record.wins / record.games) * 100);

  return {
    faction: record.faction,
    games: record.games,
    wins: record.wins,
    winRate: winRate,
    story:
      record.faction +
      " is " +
      winRate +
      "% when taking first turn."
  };

}

function incrementEventAnalyticsCount(counts, value) {

  const key =
    getEventAnalyticsString(value);

  if (!key)
    return;

  counts[key] =
    (counts[key] || 0) + 1;

}

function getEventIntelligence(e) {

  const context =
    buildEventAnalyticsContext(e);

  return jsonOutput(
    getEventAnalyticsIntelligence(context)
  );

}

function getEventAnalyticsTimeline(context) {

  if (context.isLeague)
    return buildLeagueTimeline();

  if (context.eventType === "Team Tournament")
    return buildTeamTournamentTimeline(
      context.event,
      getEventAnalyticsTeams(context.eventId),
      getEventAnalyticsPairings(context.eventId),
      getEventAnalyticsRegistrations(context.eventId),
      getEventAnalyticsInvitations(context.eventId),
      getEventAnalyticsResults(context.eventId)
    );

  return [];

}

function getEventAnalyticsHallOfFame(context) {

  if (context.isLeague)
    return getHallOfFameSnapshot();

  const standings =
    getEventAnalyticsTeamStandings(context)
      .map(function(row) {
        return {
          division: context.event.name,
          player: row.player,
          displayName: row.displayName || row.player,
          rank: row.rank,
          games: row.games,
          wins: row.wins,
          losses: row.losses,
          tp: row.tp,
          op: row.op,
          vp: row.vp
        };
      });

  return {
    success: true,
    leaders: {
      tournamentPoints: standings.slice(0, 10),
      objectivePoints: standings.slice(0, 10),
      victoryPoints: standings.slice(0, 10),
      wins: standings.slice(0, 10),
      games: standings.slice(0, 10)
    },
    records: buildEventAnalyticsRecords(
      getEventAnalyticsResults(context.eventId),
      standings
    ),
    careerLeaders: {
      achievementPoints: [],
      championships: [],
      communityAwards: [],
      promotions: [],
      seasonsPlayed: [],
      winPercentage: []
    },
    recordBook: [],
    leagueHistory: [],
    seasonHistory: [],
    playerCareers: []
  };

}

function getEventAnalyticsComparison(e) {

  const context =
    buildEventAnalyticsContext(e);

  if (context.isLeague)
    return getLeaguePlayerComparison(e);

  const leftName =
    getComparisonParameter(e, "left");

  const rightName =
    getComparisonParameter(e, "right");

  if (!leftName || !rightName)
    return jsonOutput({
      success: false,
      error: "Missing comparison players."
    });

  const players =
    getEventAnalyticsPlayers(context)[0].standings;

  const left =
    findEventAnalyticsStanding(players, leftName);

  const right =
    findEventAnalyticsStanding(players, rightName);

  if (!left || !right)
    return jsonOutput({
      success: false,
      error: "One or both event participants could not be found."
    });

  return jsonOutput({
    success: true,
    players: [
      buildEventAnalyticsComparisonPlayer(left, context),
      buildEventAnalyticsComparisonPlayer(right, context)
    ],
    headToHead:
      getEventAnalyticsHeadToHead(
        context.eventId,
        left.player,
        right.player
      )
  });

}

function buildEventAnalyticsComparisonPlayer(standing, context) {

  return {
    name: standing.player,
    displayName: standing.displayName || standing.player,
    division: context.event.name,
    rank: standing.rank,
    games: standing.games,
    wins: standing.wins,
    losses: standing.losses,
    tp: standing.tp,
    op: standing.op,
    vp: standing.vp,
    favoriteFaction: "",
    favoriteMission: "",
    bestFaction: ""
  };

}

function getEventAnalyticsSearchData(context) {

  return {
    success: true,
    players: getEventAnalyticsPlayers(context),
    factions: getEventAnalyticsFactions(context),
    missions: getEventAnalyticsMissions(context),
    games:
      context.isLeague
        ? getAllRecentGameObjectsForEvent(
            context.gameType === "league"
              ? context.eventId
              : "all",
            context.gameType
          ).slice(0, RECENT_GAMES_LIMIT)
        : getAllRecentGameObjectsForEvent(
            context.eventId,
            context.gameType
          ).slice(0, RECENT_GAMES_LIMIT),
    armyLists:
      context.isLeague
        ? getArmyListObjects().filter(function(list) { return list.approved; })
        : []
  };

}

function getEventAnalyticsPlayerProfile(e, requestedName) {

  const context =
    buildEventAnalyticsContext(e);

  if (
    context.isLeague &&
    context.gameType === "league"
  )
    return null;

  const players =
    getEventAnalyticsPlayers(context)[0].standings;

  const standing =
    findEventAnalyticsStanding(players, requestedName);

  if (!standing)
    return jsonOutput({
      success: false,
      error: "Event participant not found."
    });

  const registration =
    getEventAnalyticsRegistrations(context.eventId)
      .filter(function(row) {
        return getEventAnalyticsString(row.player).toLowerCase() ===
          getEventAnalyticsString(standing.player).toLowerCase() ||
          getEventAnalyticsString(row.displayName).toLowerCase() ===
          getEventAnalyticsString(standing.player).toLowerCase();
      })[0] || {};

  return jsonOutput({
    success: true,
    eventId: context.eventId,
    event: context.event,
    player: {
      name: standing.player,
      displayName: standing.displayName || standing.player,
      division: context.event.name,
      rank: standing.rank,
      games: standing.games,
      wins: standing.wins,
      losses: standing.losses,
      tp: standing.tp,
      op: standing.op,
      vp: standing.vp,
      favoriteFaction: registration.faction || "",
      favoriteMission: "",
      firstTurnGames: 0,
      secondTurnGames: 0,
      firstTurnWinRate: 0,
      secondTurnWinRate: 0,
      bestFaction: registration.faction || "",
      rival: "",
      nemesis: "",
      armyLists: [],
      armyListSummary: {
        submitted: 0,
        highestRated: null,
        newest: null,
        averageRating: 0,
        favoriteFaction: registration.faction || ""
      },
      registeredEvents: [{
        eventId: context.eventId,
        eventName: context.event.name,
        eventType: context.event.type,
        status: registration.status || "Registered",
        team: registration.team || "",
        preferredTeam: registration.preferredTeam || registration.team || "",
        registeredAt: registration.registeredAt || "",
        updatedAt: registration.updatedAt || registration.registeredAt || ""
      }],
      availability: {},
      profilePicture: "",
      discordHandle: registration.discord || "",
      homeStore: "",
      city: "",
      preferredLocations: "",
      scheduleLink:
        "/match-finder?eventId=" +
        encodeURIComponent(context.eventId) +
        "&opponent=" +
        encodeURIComponent(standing.player)
    }
  });

}

function getEventAnalyticsFactionProfile(context, requestedName) {

  if (
    context.isLeague &&
    context.gameType === "league"
  )
    return null;

  const faction =
    getEventAnalyticsFactions(context)
      .filter(function(item) {
        return getEventAnalyticsString(item.name).toLowerCase() ===
          getEventAnalyticsString(requestedName).toLowerCase();
      })[0];

  if (!faction)
    return jsonOutput({
      success: false,
      error: "Faction not found for this event."
    });

  return jsonOutput({
    success: true,
    eventId: context.eventId,
    event: context.event,
    faction: {
      name: faction.name,
      games: faction.games,
      wins: faction.wins,
      losses: faction.losses,
      winRate: faction.winRate,
      averageTP: faction.averageTP,
      averageOP: faction.averageOP,
      averageVP: faction.averageVP,
      topPlayer: faction.topPlayer,
      topPlayerDisplayName: faction.topPlayerDisplayName,
      lastPlayed: faction.lastPlayed,
      divisionBreakdown: faction.divisionBreakdown || [],
      mostPlayedMission: "",
      recentGames: buildEventAnalyticsGames(
        getEventAnalyticsProfileResults(context)
      ).filter(function(game) {
        return game.winnerFaction === faction.name;
      }),
      bestMoments: [],
      matchups: [],
      matchupSummary: {
        games: 0,
        wins: 0,
        losses: 0,
        winRate: 0
      },
      armyLists: {
        lists: [],
        summary: {
          submitted: 0,
          highestRated: null,
          newest: null,
          averageRating: 0,
          favoriteFaction: faction.name
        }
      }
    }
  });

}

function getEventAnalyticsMissionProfile(context, requestedName) {

  if (
    context.isLeague &&
    context.gameType === "league"
  )
    return null;

  const mission =
    getEventAnalyticsMissions(context)
      .filter(function(item) {
        return getEventAnalyticsString(item.mission).toLowerCase() ===
          getEventAnalyticsString(requestedName).toLowerCase();
      })[0];

  if (!mission)
    return jsonOutput({
      success: false,
      error: "Mission not found for this event."
    });

  return jsonOutput({
    success: true,
    eventId: context.eventId,
    event: context.event,
    mission: {
      mission: mission.mission,
      games: mission.games,
      averageTP: mission.averageTP,
      averageOP: mission.averageOP,
      averageVP: mission.averageVP,
      firstTurnWinRate: mission.firstTurnWinRate,
      mostSuccessfulFaction: mission.mostSuccessfulFaction,
      lastPlayed: mission.lastPlayed,
      mostPlayedFaction: mission.mostSuccessfulFaction,
      recentGames: buildEventAnalyticsGames(
        getEventAnalyticsProfileResults(context)
      ).filter(function(game) {
        return game.mission === mission.mission;
      }),
      bestMoments: [],
      divisionBreakdown: []
    }
  });

}

function getEventAnalyticsTeamStandings(context) {

  if (context.eventType === "Team Tournament")
    return buildTeamTournamentStandings(
      context.eventId,
      getEventAnalyticsTeams(context.eventId),
      getEventAnalyticsResults(context.eventId),
      getAllRecentGameObjectsForEvent(context.eventId)
    ).map(function(row) {
      return {
        eventId: context.eventId,
        rank: row.rank,
        player: row.teamName || row.player || row.team,
        displayName: row.teamName || row.player || row.team,
        games: row.matches || row.games || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        tp: row.tournamentPoints || row.tp || 0,
        op: row.objectivePoints || row.op || 0,
        vp: row.victoryPoints || row.vp || 0
      };
    });

  return [];

}

function buildEventAnalyticsStanding(context, player, displayName, rank) {

  const results =
    getEventAnalyticsResults(context.eventId)
      .filter(function(result) {
        return result.player === player ||
          result.opponent === player;
      });

  const wins =
    results.filter(function(result) {
      return result.winner === player;
    }).length;

  const totals =
    results.reduce(function(total, result) {
      total.tp += Number(result.tournamentPoints) || 0;
      total.op += Number(result.objectivePoints) || 0;
      total.vp += Number(result.victoryPoints) || 0;
      return total;
    }, {
      tp: 0,
      op: 0,
      vp: 0
    });

  return {
    eventId: context.eventId,
    rank: rank,
    player: player,
    displayName: displayName || player,
    games: results.length,
    wins: wins,
    losses: Math.max(0, results.length - wins),
    tp: totals.tp,
    op: totals.op,
    vp: totals.vp
  };

}

function buildEventAnalyticsDivisionSummary(standings) {

  return {
    leader: standings[0] || null,
    players: standings.length,
    gamesPlayed:
      standings.reduce(function(total, player) {
        return total + (Number(player.games) || 0);
      }, 0) / 2,
    activePlayers:
      standings.filter(function(player) {
        return Number(player.games) > 0;
      }).length
  };

}

function buildEventAnalyticsRecords(results, standings) {

  const games =
    buildEventAnalyticsGames(results);

  const topStanding =
    standings[0] || null;

  const topResult =
    games[0] || null;

  return {
    largestVPMargin: topResult,
    largestOPMargin: topResult,
    highestScoringGame: topResult,
    lowestScoringGame: topResult,
    closestVPGame: topResult,
    mostActivePlayer:
      topStanding
        ? {
            type: "player",
            name: topStanding.player,
            displayName: topStanding.displayName || topStanding.player,
            games: topStanding.games || 0,
            story: "Most active participant in this event."
          }
        : null,
    mostActiveFaction: null,
    mostActiveMission: null,
    bestFirstTurnFaction: null,
    worstFirstTurnFaction: null
  };

}

function buildEventAnalyticsGames(results) {

  return results
    .filter(function(result) {
      return result.status !== "Rejected";
    })
    .map(function(result, index) {
      const winner =
        result.winner || result.player;
      const loser =
        winner === result.player
          ? result.opponent
          : result.player;
      const objectivePoints =
        Number(result.objectivePoints) || 0;

      return {
        id: index + 1,
        date: result.updatedAt || result.createdAt || "",
        division: result.round || "",
        winner: winner,
        winnerDisplayName: winner,
        loser: loser,
        loserDisplayName: loser,
        winnerFaction: result.winningFaction || "",
        loserFaction: "",
        mission: result.mission || "",
        tp: String(result.tournamentPoints || ""),
        op: String(result.objectivePoints || ""),
        vp: String(result.victoryPoints || ""),
        bestMoment: result.bestMoment || "",
        firstTurn: result.firstTurn || "",
        value: objectivePoints,
        label: objectivePoints + " OP",
        story:
          winner +
          " reported a result against " +
          loser +
          " in " +
          (result.mission || "the event") +
          "."
      };
    });

}

function getEventAnalyticsProfileResults(context) {

  if (
    context.isLeague &&
    context.gameType !== "league"
  )
    return getAllRecentGameObjectsForEvent(
      "all",
      context.gameType
    ).map(function(game) {
      return {
        status: "",
        updatedAt: game.date,
        createdAt: game.date,
        winner: game.winner,
        player: game.winner,
        opponent: game.loser,
        winningFaction: game.winnerFaction,
        mission: game.mission,
        tournamentPoints: game.tp,
        objectivePoints: game.op,
        victoryPoints: game.vp,
        bestMoment: game.bestMoment,
        firstTurn: game.firstTurn
      };
    });

  return getEventAnalyticsResults(context.eventId);

}

function findEventAnalyticsStanding(standings, playerName) {

  const target =
    getEventAnalyticsString(playerName).toLowerCase();

  return standings.filter(function(standing) {
    return getEventAnalyticsString(standing.player).toLowerCase() === target ||
      getEventAnalyticsString(standing.displayName).toLowerCase() === target;
  })[0] || null;

}

function getEventAnalyticsHeadToHead(eventId, left, right) {

  const games =
    getEventAnalyticsResults(eventId)
      .filter(function(result) {
        return (
          result.player === left &&
          result.opponent === right
        ) ||
        (
          result.player === right &&
          result.opponent === left
        );
      });

  return {
    games: games.length,
    leftWins:
      games.filter(function(result) {
        return result.winner === left;
      }).length,
    rightWins:
      games.filter(function(result) {
        return result.winner === right;
      }).length
  };

}

function getEventAnalyticsRegistrations(eventId) {

  if (typeof getEventRegistrationRows === "function")
    return getEventRegistrationRows(eventId);

  return [];

}

function getEventAnalyticsTeams(eventId) {

  if (typeof getTeamTournamentTeams === "function")
    return getTeamTournamentTeams(eventId)
      .filter(function(team) {
        return team.status !== "Deleted";
      });

  return [];

}

function getEventAnalyticsPairings(eventId) {

  if (typeof getTeamTournamentPairings === "function")
    return getTeamTournamentPairings(eventId);

  return [];

}

function getEventAnalyticsInvitations(eventId) {

  if (typeof getTeamTournamentInvitations === "function")
    return getTeamTournamentInvitations(eventId);

  return [];

}

function getEventAnalyticsResults(eventId) {

  if (typeof getTeamTournamentResults === "function")
    return getTeamTournamentResults(eventId);

  return [];

}

function getEventAnalyticsTopKey(counts) {

  let topKey = "";
  let topValue = -1;

  Object.keys(counts || {})
    .forEach(function(key) {
      if (counts[key] > topValue) {
        topKey = key;
        topValue = counts[key];
      }
    });

  return topKey;

}

function getEventAnalyticsString(value) {

  if (value === null || value === undefined)
    return "";

  return String(value).trim();

}
