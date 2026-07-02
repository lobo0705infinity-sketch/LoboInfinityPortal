/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * LeagueIntelligence.gs
 *
 * Narrative league intelligence endpoint.
 *******************************************************/

const INTELLIGENCE_LIMIT = 5;

function getIntelligence() {

  const games =
    getAllRecentGameObjects();

  const standings =
    getLeagueIntelligenceStandings();

  return jsonOutput({
    success: true,
    winStreaks: getLeagueWinStreaks("W"),
    losingStreaks: getLeagueWinStreaks("L"),
    highestVPGames: getHighestScoringGames(games),
    biggestVictories: getBiggestVictories(games),
    closestGames: getClosestGames(games),
    factionMomentum: getFactionMomentum(games),
    missionTrends: getMissionTrends(),
    recentUpsets:
      getRecentUpsets(
        games,
        standings.rankMap
      ),
    promotionBattle:
      getPromotionBattle(
        standings.divisions
      ),
    relegationBattle:
      getRelegationBattle(
        standings.divisions
      ),
    records:
      getLeagueRecords(
        games
      )
  });

}

function getLeagueWinStreaks(result) {

  const playerGames = {};

  getLeagueData()
    .forEach(function(game) {

      const player =
        String(
          game[CONFIG.ENGINE.PLAYER]
        ).trim();

      if (!player)
        return;

      if (!playerGames[player])
        playerGames[player] = [];

      playerGames[player].push(
        game
      );

    });

  const streaks = [];

  for (const player in playerGames) {

    playerGames[player].sort(function(a, b) {

      return (
        getRecentGameDate(b[CONFIG.ENGINE.DATE]).getTime() -
        getRecentGameDate(a[CONFIG.ENGINE.DATE]).getTime()
      );

    });

    let count = 0;

    for (
      let index = 0;
      index < playerGames[player].length;
      index++
    ) {

      if (
        playerGames[player][index][CONFIG.ENGINE.RESULT] !==
        result
      )
        break;

      count++;

    }

    if (count === 0)
      continue;

    streaks.push({
      player: player,
      games: count,
      type:
        result === "W"
          ? "Win Streak"
          : "Losing Streak",
      story:
        player +
        " is riding a " +
        count +
        "-game " +
        (
          result === "W"
            ? "win streak."
            : "losing streak."
        )
    });

  }

  return streaks
    .sort(function(a, b) {

      if (b.games !== a.games)
        return b.games - a.games;

      return a.player.localeCompare(
        b.player
      );

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function getHighestScoringGames(games) {

  return games
    .map(function(game) {

      const score =
        getLeagueScoreParts(
          game.vp
        );

      return buildGameInsight(
        game,
        score.winner + score.loser,
        "Total VP"
      );

    })
    .sort(function(a, b) {

      return b.value - a.value;

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function getBiggestVictories(games) {

  return games
    .map(function(game) {

      const vp =
        getLeagueScoreParts(
          game.vp
        );

      const op =
        getLeagueScoreParts(
          game.op
        );

      return buildGameInsight(
        game,
        Math.abs(vp.winner - vp.loser),
        "VP Margin",
        Math.abs(op.winner - op.loser)
      );

    })
    .sort(function(a, b) {

      if (b.value !== a.value)
        return b.value - a.value;

      return b.secondary - a.secondary;

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function getClosestGames(games) {

  return games
    .map(function(game) {

      const score =
        getLeagueScoreParts(
          game.vp
        );

      return buildGameInsight(
        game,
        Math.abs(score.winner - score.loser),
        "VP Margin"
      );

    })
    .sort(function(a, b) {

      return a.value - b.value;

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function getFactionMomentum(games) {

  const factions = {};

  games.forEach(function(game) {

    addFactionMomentumGame(
      factions,
      game.winnerFaction,
      true,
      game
    );

    addFactionMomentumGame(
      factions,
      game.loserFaction,
      false,
      game
    );

  });

  return Object.keys(factions)
    .map(function(faction) {

      const recent =
        factions[faction]
          .slice(0, 5);

      const wins =
        recent.filter(function(game) {

          return game.win;

        }).length;

      const losses =
        recent.length - wins;

      return {
        faction: faction,
        games: recent.length,
        wins: wins,
        losses: losses,
        trend: getFactionTrend(wins, losses),
        story:
          faction +
          " is " +
          wins +
          "-" +
          losses +
          " across its last " +
          recent.length +
          " games."
      };

    })
    .sort(function(a, b) {

      if (b.games !== a.games)
        return b.games - a.games;

      if (b.wins !== a.wins)
        return b.wins - a.wins;

      return a.faction.localeCompare(
        b.faction
      );

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function addFactionMomentumGame(
  factions,
  faction,
  win,
  game
) {

  if (!faction)
    return;

  if (!factions[faction])
    factions[faction] = [];

  factions[faction].push({
    win: win,
    id: game.id,
    date: game.date
  });

}

function getFactionTrend(wins, losses) {

  if (wins >= losses + 2)
    return "Rising";

  if (losses >= wins + 2)
    return "Falling";

  return "Stable";

}

function getMissionTrends() {

  return buildMissionApiSummaries()
    .map(function(mission) {

      return {
        mission: mission.mission,
        games: mission.games,
        averageVP: mission.averageVP,
        averageOP: mission.averageOP,
        averageTP: mission.averageTP,
        firstTurnWinRate: mission.firstTurnWinRate,
        mostSuccessfulFaction:
          mission.mostSuccessfulFaction,
        story:
          mission.mission +
          " is averaging " +
          mission.averageVP +
          " winner VP with " +
          mission.firstTurnWinRate +
          "% first-turn wins."
      };

    })
    .sort(function(a, b) {

      return b.games - a.games;

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function getRecentUpsets(games, rankMap) {

  return games
    .map(function(game) {

      const winnerRank =
        getPlayerRank(
          rankMap,
          game.division,
          game.winner
        );

      const loserRank =
        getPlayerRank(
          rankMap,
          game.division,
          game.loser
        );

      return {
        id: game.id,
        date: game.date,
        division: game.division,
        winner: game.winner,
        loser: game.loser,
        winnerRank: winnerRank,
        loserRank: loserRank,
        mission: game.mission,
        story:
          game.winner +
          " knocked off " +
          game.loser +
          " in " +
          game.mission +
          "."
      };

    })
    .filter(function(game) {

      return (
        game.winnerRank > 0 &&
        game.loserRank > 0 &&
        game.winnerRank > game.loserRank
      );

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function getPromotionBattle(divisions) {

  const battle = [];

  [CONFIG.DIVISIONS.PGA, CONFIG.DIVISIONS.PGB]
    .forEach(function(division) {

      const standings =
        divisions[division] || [];

      standings
        .slice(0, 4)
        .forEach(function(player, index) {

          const next =
            standings[index + 1];

          battle.push({
            division: division,
            player: player.player,
            rank: player.rank,
            tp: player.tp,
            op: player.op,
            vp: player.vp,
            chaser:
              next
                ? next.player
                : "",
            withinOneGame:
              next
                ? player.tp - next.tp <= 5
                : false,
            story:
              player.player +
              " is rank #" +
              player.rank +
              " in " +
              division +
              (
                next && player.tp - next.tp <= 5
                  ? ", with " + next.player + " within one win."
                  : "."
              )
          });

        });

    });

  return battle
    .slice(0, INTELLIGENCE_LIMIT);

}

function getRelegationBattle(divisions) {

  const standings =
    divisions[CONFIG.DIVISIONS.MAIN_MAN] ||
    [];

  return standings
    .filter(function(player) {

      return player.rank >= 7;

    })
    .map(function(player, index, players) {

      const target =
        players[index - 1] ||
        standings[player.rank - 2];

      return {
        division: CONFIG.DIVISIONS.MAIN_MAN,
        player: player.player,
        rank: player.rank,
        tp: player.tp,
        op: player.op,
        vp: player.vp,
        target:
          target
            ? target.player
            : "",
        withinOneGame:
          target
            ? target.tp - player.tp <= 5
            : false,
        story:
          player.player +
          " is rank #" +
          player.rank +
          (
            target && target.tp - player.tp <= 5
              ? " and can pressure " + target.player + " with one result."
              : " in the Main Man danger zone."
          )
      };

    })
    .slice(0, INTELLIGENCE_LIMIT);

}

function getLeagueRecords(games) {

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
      getMostActiveEngineValue(
        CONFIG.ENGINE.PLAYER,
        "player"
      ),
    mostActiveFaction:
      getMostActiveEngineValue(
        CONFIG.ENGINE.FACTION,
        "faction"
      ),
    mostActiveMission:
      getMostActiveMissionRecord(games),
    bestFirstTurnFaction:
      getFirstTurnFactionRecord(true),
    worstFirstTurnFaction:
      getFirstTurnFactionRecord(false)
  };

}

function getLargestScoreMargin(
  games,
  key,
  label
) {

  return games
    .map(function(game) {

      const score =
        getLeagueScoreParts(
          game[key]
        );

      return buildGameInsight(
        game,
        Math.abs(score.winner - score.loser),
        label
      );

    })
    .sort(function(a, b) {

      return b.value - a.value;

    })[0] || null;

}

function getLowestScoringGame(games) {

  return games
    .map(function(game) {

      const score =
        getLeagueScoreParts(
          game.vp
        );

      return buildGameInsight(
        game,
        score.winner + score.loser,
        "Total VP"
      );

    })
    .sort(function(a, b) {

      return a.value - b.value;

    })[0] || null;

}

function getMostActiveMissionRecord(games) {

  const counts = {};

  games.forEach(function(game) {

    if (!game.mission)
      return;

    if (!counts[game.mission])
      counts[game.mission] = 0;

    counts[game.mission]++;

  });

  let topMission = "";
  let topCount = 0;

  for (const mission in counts) {

    if (
      counts[mission] > topCount ||
      (
        counts[mission] === topCount &&
        mission.localeCompare(topMission) < 0
      )
    ) {

      topMission = mission;
      topCount = counts[mission];

    }

  }

  return {
    type: "mission",
    name: topMission,
    games: topCount,
    story:
      topMission +
      " is the most active mission with " +
      topCount +
      " games."
  };

}

function getMostActiveEngineValue(column, label) {

  const counts = {};

  getLeagueData()
    .forEach(function(row) {

      const value =
        String(row[column]).trim();

      if (!value)
        return;

      if (!counts[value])
        counts[value] = 0;

      counts[value]++;

    });

  let topValue = "";
  let topCount = 0;

  for (const value in counts) {

    if (
      counts[value] > topCount ||
      (
        counts[value] === topCount &&
        value.localeCompare(topValue) < 0
      )
    ) {

      topValue = value;
      topCount = counts[value];

    }

  }

  return {
    type: label,
    name: topValue,
    games: topCount,
    story:
      topValue +
      " is the most active " +
      label +
      " with " +
      topCount +
      " appearances."
  };

}

function getFirstTurnFactionRecord(best) {

  const factions = {};

  getLeagueData()
    .forEach(function(row) {

      if (row[CONFIG.ENGINE.FIRST_TURN] !== "Yes")
        return;

      const faction =
        String(
          row[CONFIG.ENGINE.FACTION]
        ).trim();

      if (!faction)
        return;

      if (!factions[faction])
        factions[faction] = {
          faction: faction,
          games: 0,
          wins: 0
        };

      factions[faction].games++;

      if (row[CONFIG.ENGINE.RESULT] === "W")
        factions[faction].wins++;

    });

  const list =
    Object.values(factions)
      .map(function(record) {

        record.winRate =
          record.games === 0
            ? 0
            : roundFaction(
                (record.wins / record.games) * 100
              );

        record.story =
          record.faction +
          " is " +
          record.winRate +
          "% when taking first turn.";

        return record;

      })
      .filter(function(record) {

        return record.games > 0;

      });

  list.sort(function(a, b) {

    if (best)
      return b.winRate - a.winRate;

    return a.winRate - b.winRate;

  });

  return list[0] || null;

}

function getLeagueIntelligenceStandings() {

  const divisionConfigs = [
    getStandingsDivisionConfig("main"),
    getStandingsDivisionConfig("pga"),
    getStandingsDivisionConfig("pgb")
  ];

  const divisions = {};
  const rankMap = {};

  divisionConfigs.forEach(function(config) {

    const response =
      buildStandingsResponse(
        config
      );

    divisions[config.label] =
      response.standings;

    rankMap[config.label] = {};

    response.standings
      .forEach(function(player) {

        rankMap[config.label][player.player] =
          player.rank;

      });

  });

  return {
    divisions: divisions,
    rankMap: rankMap
  };

}

function getPlayerRank(
  rankMap,
  division,
  player
) {

  if (
    !rankMap[division] ||
    !rankMap[division][player]
  )
    return 0;

  return rankMap[division][player];

}

function buildGameInsight(
  game,
  value,
  label,
  secondary
) {

  return {
    id: game.id,
    date: game.date,
    division: game.division,
    mission: game.mission,
    winner: game.winner,
    loser: game.loser,
    winnerFaction: game.winnerFaction,
    loserFaction: game.loserFaction,
    vp: game.vp,
    op: game.op,
    tp: game.tp,
    value: value,
    label: label,
    secondary: secondary || 0,
    story:
      game.winner +
      " defeated " +
      game.loser +
      " in " +
      game.mission +
      " (" +
      game.vp +
      ")."
  };

}

function getLeagueScoreParts(score) {

  const parts =
    String(score || "0-0")
      .split("-");

  return {
    winner: Number(parts[0]) || 0,
    loser: Number(parts[1]) || 0
  };

}
