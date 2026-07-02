/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * MissionApi.gs
 *
 * Mission list and mission profile API endpoints.
 *******************************************************/

const MISSION_PROFILE_RECENT_GAMES_LIMIT = 5;
const MISSION_PROFILE_BEST_MOMENTS_LIMIT = 5;

function getMissions() {

  return jsonOutput({
    success: true,
    missions: buildMissionApiSummaries()
  });

}

function getMission(e) {

  const requestedName =
    getMissionRequestName(e);

  if (!requestedName)
    return jsonOutput({
      success: false,
      error: "Missing mission name."
    });

  const summaries =
    buildMissionApiSummaries();

  const mission =
    findMissionSummary(
      summaries,
      requestedName
    );

  if (!mission)
    return jsonOutput({
      success: false,
      error: "Mission not found."
    });

  const recentGames =
    getMissionRecentGames(
      mission.mission
    );

  return jsonOutput({
    success: true,
    mission: {
      mission: mission.mission,
      games: mission.games,
      averageTP: mission.averageTP,
      averageOP: mission.averageOP,
      averageVP: mission.averageVP,
      firstTurnWinRate: mission.firstTurnWinRate,
      mostSuccessfulFaction: mission.mostSuccessfulFaction,
      mostPlayedFaction:
        getMissionMostPlayedFaction(
          mission.mission
        ),
      recentGames: recentGames,
      bestMoments:
        getMissionBestMoments(
          recentGames
        ),
      divisionBreakdown:
        getMissionDivisionBreakdown(
          recentGames
        ),
      lastPlayed: mission.lastPlayed
    }
  });

}

function buildMissionApiSummaries() {

  const registry =
    buildMissionRegistry();

  updateMissionRegistry(
    registry
  );

  return Object.values(registry)
    .sort(function(a, b) {

      return a.mission.localeCompare(
        b.mission
      );

    })
    .map(function(mission) {

      return buildMissionApiSummary(
        mission
      );

    });

}

function buildMissionApiSummary(mission) {

  const recentGames =
    getMissionRecentGames(
      mission.mission
    );

  return {
    mission: mission.mission,
    games: mission.games,
    averageTP:
      getMissionAverage(
        mission.winnerTP,
        mission.games
      ),
    averageOP:
      getMissionAverage(
        mission.winnerOP,
        mission.games
      ),
    averageVP:
      getMissionAverage(
        mission.winnerVP,
        mission.games
      ),
    firstTurnWinRate:
      getMissionFirstTurnWinRate(
        mission
      ),
    mostSuccessfulFaction:
      getMissionMostSuccessfulFaction(
        mission.factions
      ),
    lastPlayed:
      getMissionLastPlayed(
        recentGames
      )
  };

}

function getMissionRequestName(e) {

  if (
    !e ||
    !e.parameter ||
    !e.parameter.name
  )
    return "";

  return String(e.parameter.name)
    .trim();

}

function findMissionSummary(
  missions,
  requestedName
) {

  const normalizedName =
    requestedName.toLowerCase();

  for (
    let index = 0;
    index < missions.length;
    index++
  ) {

    if (
      missions[index].mission.toLowerCase() ===
      normalizedName
    )
      return missions[index];

  }

  return null;

}

function getMissionAverage(total, games) {

  if (games === 0)
    return 0;

  return roundMission(
    total / games
  );

}

function getMissionFirstTurnWinRate(mission) {

  if (mission.games === 0)
    return 0;

  return roundMission(
    (mission.firstPlayerWins / mission.games) * 100
  );

}

function getMissionMostSuccessfulFaction(factions) {

  const top =
    getTopThreeWinningFactions(
      factions
    );

  if (!top)
    return "";

  return top.split(", ")[0]
    .replace(/\s+\(\d+-\d+\)$/, "");

}

function getMissionMostPlayedFaction(missionName) {

  const counts = {};

  getLeagueData()
    .forEach(function(game) {

      if (
        String(
          game[CONFIG.ENGINE.MISSION]
        ).trim() !== missionName
      )
        return;

      const faction =
        String(
          game[CONFIG.ENGINE.FACTION]
        ).trim();

      if (!faction)
        return;

      if (!counts[faction])
        counts[faction] = 0;

      counts[faction]++;

    });

  let topFaction = "";
  let topCount = 0;

  for (const faction in counts) {

    if (
      counts[faction] > topCount ||
      (
        counts[faction] === topCount &&
        faction.localeCompare(topFaction) < 0
      )
    ) {

      topFaction = faction;
      topCount = counts[faction];

    }

  }

  return topFaction;

}

function getMissionRecentGames(missionName) {

  return getAllRecentGameObjects()
    .filter(function(game) {

      return game.mission === missionName;

    })
    .slice(
      0,
      MISSION_PROFILE_RECENT_GAMES_LIMIT
    );

}

function getMissionBestMoments(games) {

  return games
    .filter(function(game) {

      return game.bestMoment !== "";

    })
    .slice(
      0,
      MISSION_PROFILE_BEST_MOMENTS_LIMIT
    )
    .map(function(game) {

      return {
        gameId: game.id,
        date: game.date,
        mission: game.mission,
        moment: game.bestMoment
      };

    });

}

function getMissionDivisionBreakdown(games) {

  const breakdown = {
    mainMan: 0,
    provingGroundsA: 0,
    provingGroundsB: 0
  };

  games.forEach(function(game) {

    switch (game.division) {

      case CONFIG.DIVISIONS.MAIN_MAN:
        breakdown.mainMan++;
        break;

      case CONFIG.DIVISIONS.PGA:
        breakdown.provingGroundsA++;
        break;

      case CONFIG.DIVISIONS.PGB:
        breakdown.provingGroundsB++;
        break;

    }

  });

  return breakdown;

}

function getMissionLastPlayed(games) {

  if (games.length === 0)
    return "";

  return games[0].date;

}
