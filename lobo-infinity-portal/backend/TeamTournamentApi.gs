/*******************************************************
 * LOBO INFINITY LEAGUE 6.0.1
 * TeamTournamentApi.gs
 *
 * Event Engine-owned Team Tournament experience.
 *******************************************************/

const TEAM_TOURNAMENT_TEAM_HEADERS = [
  "Event ID",
  "Team ID",
  "Team Name",
  "Captain",
  "Players",
  "Faction Restrictions",
  "Logo URL",
  "Discord Contact",
  "Status",
  "Created At",
  "Updated At"
];

const TEAM_TOURNAMENT_PAIRING_HEADERS = [
  "Event ID",
  "Round ID",
  "Round",
  "Team A",
  "Team B",
  "Player Pairings",
  "Status",
  "Results",
  "Created At",
  "Updated At"
];

function getTeamTournament(e) {

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

  const eventExistsBeforeEnsure =
    getEventByIdSnapshot(eventId) !== null;

  ensureEventEngine();
  ensureTeamTournamentSheets();

  if (!eventExistsBeforeEnsure)
    invalidatePortalCacheGroup("events");

  const event =
    getEventByIdSnapshot(eventId) ||
    getEventByIdSnapshot(EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID) ||
    getCurrentLeagueEventSnapshot();

  const teams =
    getTeamTournamentTeams(eventId);

  const pairings =
    getTeamTournamentPairings(eventId);

  const standings =
    buildTeamTournamentStandings(eventId, teams);

  return jsonOutput({
    success: true,
    tournament: {
      event: event,
      status: event.status || "Planning",
      currentRound: getTeamTournamentCurrentRound(eventId),
      registeredTeams: teams.length,
      completedMatches:
        pairings.filter(function(pairing) {
          return pairing.status === "Completed";
        }).length,
      upcomingPairings:
        pairings.filter(function(pairing) {
          return pairing.status !== "Completed";
        }),
      latestResults:
        getAllRecentGameObjectsForEvent(eventId).slice(0, 8),
      news:
        buildTeamTournamentNews(event, teams, pairings),
      quickActions:
        buildTeamTournamentQuickActions(eventId, event),
      teams: teams,
      pairings: pairings,
      standings: standings
    }
  });

}

function registerTeamTournamentPlayer(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated || !auth.user.leaguePlayer)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

  const teamName =
    getTeamTournamentString(params.teamName);

  ensureEventEngine();

  const participantsSheet =
    ensureEventEngineSheet(
      CONFIG.SHEETS.EVENT_PARTICIPANTS,
      EVENT_ENGINE_PARTICIPANT_HEADERS
    );

  upsertTeamTournamentCompositeRow(
    participantsSheet,
    EVENT_ENGINE_PARTICIPANT_HEADERS,
    [
      "Event ID",
      "Player"
    ],
    [
      eventId,
      auth.user.leaguePlayer
    ],
    [
      eventId,
      auth.user.leaguePlayer,
      auth.user.playerDisplayName || auth.user.leaguePlayer,
      "Player",
      "Registered",
      getTeamTournamentTimestamp(),
      "",
      teamName,
      ""
    ]
  );

  invalidatePortalCacheGroup("events");

  return getTeamTournament({
    parameter: {
      eventId: eventId
    }
  });

}

function saveTeamTournamentTeam(e) {

  return requireApiPermission(e, "runSeasonControl", function() {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

    const teamName =
      getTeamTournamentString(params.teamName);

    if (teamName === "")
      return jsonOutput({
        success: false,
        error: "Team name is required."
      });

    const teamId =
      getTeamTournamentString(params.teamId) ||
      "team-" +
      Utilities.getUuid();

    const sheet =
      ensureTeamTournamentTeamsSheet();

    upsertTeamTournamentCompositeRow(
      sheet,
      TEAM_TOURNAMENT_TEAM_HEADERS,
      [
        "Event ID",
        "Team ID"
      ],
      [
        eventId,
        teamId
      ],
      [
        eventId,
        teamId,
        teamName,
        getTeamTournamentString(params.captain),
        getTeamTournamentString(params.players),
        getTeamTournamentString(params.factionRestrictions),
        getTeamTournamentString(params.logoUrl),
        getTeamTournamentString(params.discordContact),
        getTeamTournamentString(params.status) || "Registered",
        getTeamTournamentTimestamp(),
        getTeamTournamentTimestamp()
      ]
    );

    invalidatePortalCacheGroup("events");

    return getTeamTournament({
      parameter: {
        eventId: eventId
      }
    });
  });

}

function saveTeamTournamentPairing(e) {

  return requireApiPermission(e, "runSeasonControl", function() {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

    const roundId =
      getTeamTournamentString(params.roundId) ||
      EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ROUND_ID;

    const teamA =
      getTeamTournamentString(params.teamA);

    const teamB =
      getTeamTournamentString(params.teamB);

    if (teamA === "" || teamB === "")
      return jsonOutput({
        success: false,
        error: "Both teams are required."
      });

    const sheet =
      ensureTeamTournamentPairingsSheet();

    upsertTeamTournamentCompositeRow(
      sheet,
      TEAM_TOURNAMENT_PAIRING_HEADERS,
      [
        "Event ID",
        "Round ID",
        "Team A",
        "Team B"
      ],
      [
        eventId,
        roundId,
        teamA,
        teamB
      ],
      [
        eventId,
        roundId,
        getTeamTournamentString(params.round) || "Round 1",
        teamA,
        teamB,
        getTeamTournamentString(params.playerPairings),
        getTeamTournamentString(params.status) || "Scheduled",
        getTeamTournamentString(params.results),
        getTeamTournamentTimestamp(),
        getTeamTournamentTimestamp()
      ]
    );

    invalidatePortalCacheGroup("events");

    return getTeamTournament({
      parameter: {
        eventId: eventId
      }
    });
  });

}

function buildTeamTournamentStandings(eventId, teams) {

  const games =
    getAllRecentGameObjectsForEvent(eventId);

  return teams
    .map(function(team) {
      const players =
        splitTeamTournamentPlayers(team.players);

      const teamGames =
        games.filter(function(game) {
          return (
            players.indexOf(game.winner) !== -1 ||
            players.indexOf(game.loser) !== -1
          );
        });

      let wins = 0;
      let losses = 0;
      let tp = 0;
      let op = 0;
      let vp = 0;

      teamGames.forEach(function(game) {
        const winnerOnTeam =
          players.indexOf(game.winner) !== -1;

        const score =
          parseTeamTournamentScore(game.tp);
        const objective =
          parseTeamTournamentScore(game.op);
        const victory =
          parseTeamTournamentScore(game.vp);

        if (winnerOnTeam) {
          wins++;
          tp += score.left;
          op += objective.left;
          vp += victory.left;
        }
        else {
          losses++;
          tp += score.right;
          op += objective.right;
          vp += victory.right;
        }
      });

      return {
        rank: 0,
        teamId: team.teamId,
        teamName: team.teamName,
        captain: team.captain,
        players: players,
        wins: wins,
        losses: losses,
        tournamentPoints: tp,
        objectivePoints: op,
        victoryPoints: vp,
        strengthOfSchedule: 0
      };
    })
    .sort(function(left, right) {
      return (
        right.tournamentPoints - left.tournamentPoints ||
        right.objectivePoints - left.objectivePoints ||
        right.victoryPoints - left.victoryPoints ||
        left.teamName.localeCompare(right.teamName)
      );
    })
    .map(function(team, index) {
      team.rank = index + 1;
      return team;
    });

}

function getTeamTournamentTeams(eventId) {

  return getTeamTournamentRows(
    ensureTeamTournamentTeamsSheet()
  ).filter(function(row) {
    return row["Event ID"] === eventId;
  }).map(function(row) {
    return {
      eventId: row["Event ID"],
      teamId: row["Team ID"],
      teamName: row["Team Name"],
      captain: row["Captain"],
      players: row["Players"],
      factionRestrictions: row["Faction Restrictions"],
      logoUrl: row["Logo URL"],
      discordContact: row["Discord Contact"],
      status: row["Status"],
      createdAt: row["Created At"],
      updatedAt: row["Updated At"]
    };
  });

}

function getTeamTournamentPairings(eventId) {

  return getTeamTournamentRows(
    ensureTeamTournamentPairingsSheet()
  ).filter(function(row) {
    return row["Event ID"] === eventId;
  }).map(function(row) {
    return {
      eventId: row["Event ID"],
      roundId: row["Round ID"],
      round: row["Round"],
      teamA: row["Team A"],
      teamB: row["Team B"],
      playerPairings: row["Player Pairings"],
      status: row["Status"],
      results: row["Results"],
      createdAt: row["Created At"],
      updatedAt: row["Updated At"]
    };
  });

}

function getTeamTournamentCurrentRound(eventId) {

  const rounds =
    getEventEngineSnapshot()
      .rounds
      .filter(function(round) {
        return round.eventId === eventId;
      });

  return rounds[0] || null;

}

function buildTeamTournamentNews(event, teams, pairings) {

  const news = [];

  news.push((event.name || "Team Tournament") + " is " + (event.status || "Planning") + ".");

  if (teams.length > 0)
    news.push(teams.length + " teams are registered.");

  if (pairings.length > 0)
    news.push("Pairings are posted for " + (pairings[0].round || "the current round") + ".");

  return news;

}

function buildTeamTournamentQuickActions(eventId, event) {

  return [
    {
      label: "Register",
      action: "register",
      eventId: eventId,
      enabled: event.registration === "Registration Open"
    },
    {
      label: "View Pairings",
      action: "pairings",
      eventId: eventId,
      enabled: true
    },
    {
      label: "Team Standings",
      action: "standings",
      eventId: eventId,
      enabled: true
    }
  ];

}

function ensureTeamTournamentSheets() {

  ensureTeamTournamentTeamsSheet();
  ensureTeamTournamentPairingsSheet();

}

function ensureTeamTournamentTeamsSheet() {

  return ensureEventEngineSheet(
    CONFIG.SHEETS.TEAM_TOURNAMENT_TEAMS,
    TEAM_TOURNAMENT_TEAM_HEADERS
  );

}

function ensureTeamTournamentPairingsSheet() {

  return ensureEventEngineSheet(
    CONFIG.SHEETS.TEAM_TOURNAMENT_PAIRINGS,
    TEAM_TOURNAMENT_PAIRING_HEADERS
  );

}

function getTeamTournamentRows(sheet) {

  return getEventEngineRows(sheet);

}

function upsertTeamTournamentCompositeRow(
  sheet,
  headers,
  keyHeaders,
  keyValues,
  row
) {

  const data =
    sheet.getDataRange().getValues();

  const headerRow =
    data[0] || headers;

  const keyIndexes =
    keyHeaders.map(function(header) {
      return headerRow.indexOf(header);
    });

  let existingRow =
    -1;

  for (let index = 1; index < data.length; index++) {
    const candidate =
      data[index];

    const matches =
      keyIndexes.every(function(keyIndex, keyIndexPosition) {
        return (
          keyIndex !== -1 &&
          getTeamTournamentString(candidate[keyIndex]) ===
            getTeamTournamentString(keyValues[keyIndexPosition])
        );
      });

    if (matches) {
      existingRow =
        index + 1;
      break;
    }
  }

  if (existingRow === -1) {
    sheet.appendRow(row);
    return;
  }

  const previous =
    data[existingRow - 1] || [];

  const next =
    headers.map(function(header, index) {
      if (header === "Created At")
        return previous[index] || row[index];

      return row[index];
    });

  sheet
    .getRange(existingRow, 1, 1, next.length)
    .setValues([next]);

}

function splitTeamTournamentPlayers(value) {

  return getTeamTournamentString(value)
    .split(/[,;\n]/)
    .map(getTeamTournamentString)
    .filter(function(player) {
      return player !== "";
    });

}

function parseTeamTournamentScore(value) {

  const parts =
    getTeamTournamentString(value)
      .split("-");

  return {
    left: Number(parts[0]) || 0,
    right: Number(parts[1]) || 0
  };

}

function getTeamTournamentTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getTeamTournamentString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
