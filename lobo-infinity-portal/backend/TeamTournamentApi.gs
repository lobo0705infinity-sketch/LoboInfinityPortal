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

const TEAM_TOURNAMENT_INVITATION_HEADERS = [
  "Event ID",
  "Invitation ID",
  "Team Name",
  "Captain",
  "Player",
  "Status",
  "Message",
  "Created At",
  "Updated At"
];

const TEAM_TOURNAMENT_RESULT_HEADERS = [
  "Event ID",
  "Result ID",
  "Round ID",
  "Round",
  "Team A",
  "Team B",
  "Player",
  "Opponent",
  "Tournament Points",
  "Objective Points",
  "Victory Points",
  "Winning Faction",
  "First Turn",
  "Best Moment",
  "Notes",
  "Status",
  "Submitted By",
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

  const invitations =
    getTeamTournamentInvitations(eventId);

  const results =
    getTeamTournamentResults(eventId);

  const standings =
    buildTeamTournamentStandings(eventId, teams, results);

  const registrations =
    getEventRegistrationRows(eventId);

  const auth =
    getRequestUser(e);

  const currentPlayerRegistration =
    auth.authenticated && auth.user.leaguePlayer
      ? getEventRegistrationForPlayer(eventId, auth.user.leaguePlayer)
      : null;

  return jsonOutput({
    success: true,
    tournament: {
      event: event,
      status: event.status || "Planning",
      currentRound: getTeamTournamentCurrentRound(eventId),
      registration:
        buildEventRegistrationPayload(
          event,
          registrations,
          currentPlayerRegistration
        ),
      registeredTeams:
        Math.max(
          teams.length,
          getEventRegistrationTeamSummary(registrations).filter(function(team) {
            return team.teamName !== "Looking for Team";
          }).length
        ),
      completedMatches:
        results.filter(function(result) {
          return result.status !== "Rejected";
        }).length,
      upcomingPairings:
        pairings.filter(function(pairing) {
          return pairing.status !== "Completed";
        }),
      latestResults:
        getAllRecentGameObjectsForEvent(eventId).slice(0, 8),
      tournamentResults: results,
      invitations: invitations,
      timeline:
        buildTeamTournamentTimeline(event, teams, pairings, registrations, invitations, results),
      freeAgents:
        registrations.filter(function(registration) {
          return registration.freeAgent === true && registration.status !== "Withdrawn";
        }),
      champion:
        buildTeamTournamentChampion(event, standings),
      news:
        buildTeamTournamentNews(event, teams, pairings, results),
      quickActions:
        buildTeamTournamentQuickActions(eventId, event),
      teams: teams,
      pairings: pairings,
      standings: standings
    }
  });

}

function registerTeamTournamentPlayer(e) {

  return registerForEvent(e);

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

function saveTeamTournamentInvitation(e) {

  return requireApiPermission(e, "runSeasonControl", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

    const teamName =
      getTeamTournamentString(params.teamName);

    const player =
      getTeamTournamentString(params.player);

    if (teamName === "" || player === "")
      return jsonOutput({
        success: false,
        error: "Team and player are required."
      });

    const invitationId =
      getTeamTournamentString(params.invitationId) ||
      "invite-" + Utilities.getUuid();

    upsertTeamTournamentCompositeRow(
      ensureTeamTournamentInvitationsSheet(),
      TEAM_TOURNAMENT_INVITATION_HEADERS,
      [
        "Event ID",
        "Invitation ID"
      ],
      [
        eventId,
        invitationId
      ],
      [
        eventId,
        invitationId,
        teamName,
        getTeamTournamentString(params.captain) ||
          (auth && auth.user ? auth.user.leaguePlayer : "Commissioner"),
        player,
        getTeamTournamentString(params.status) || "Pending",
        getTeamTournamentString(params.message),
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

function saveTeamTournamentResult(e) {

  return requireApiPermission(e, "submitLists", function(auth) {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

    const player =
      getTeamTournamentString(params.player) ||
      (auth && auth.user ? auth.user.leaguePlayer : "");

    const opponent =
      getTeamTournamentString(params.opponent);

    if (player === "" || opponent === "")
      return jsonOutput({
        success: false,
        error: "Player and opponent are required."
      });

    const resultId =
      getTeamTournamentString(params.resultId) ||
      "result-" + Utilities.getUuid();

    upsertTeamTournamentCompositeRow(
      ensureTeamTournamentResultsSheet(),
      TEAM_TOURNAMENT_RESULT_HEADERS,
      [
        "Event ID",
        "Result ID"
      ],
      [
        eventId,
        resultId
      ],
      [
        eventId,
        resultId,
        getTeamTournamentString(params.roundId),
        getTeamTournamentString(params.round) || "Round 1",
        getTeamTournamentString(params.teamA),
        getTeamTournamentString(params.teamB),
        player,
        opponent,
        getTeamTournamentString(params.tournamentPoints),
        getTeamTournamentString(params.objectivePoints),
        getTeamTournamentString(params.victoryPoints),
        getTeamTournamentString(params.winningFaction),
        getTeamTournamentString(params.firstTurn),
        getTeamTournamentString(params.bestMoment),
        getTeamTournamentString(params.notes),
        getTeamTournamentString(params.status) || "Submitted",
        auth && auth.user ? auth.user.leaguePlayer || auth.user.email : "Player",
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

function advanceTeamTournamentRound(e) {

  return requireApiPermission(e, "runSeasonControl", function() {
    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

    const lifecycleStage =
      getTeamTournamentString(params.lifecycleStage) || "Round 1";

    const status =
      getTeamTournamentString(params.status) || lifecycleStage;

    updateEventManagerEventFields(eventId, {
      "Lifecycle Stage": lifecycleStage,
      "Status": status
    });

    invalidatePortalCacheGroup("events");

    return getTeamTournament({
      parameter: {
        eventId: eventId
      }
    });
  });

}

function buildTeamTournamentStandings(eventId, teams, tournamentResults) {

  const games =
    getAllRecentGameObjectsForEvent(eventId);

  const results =
    tournamentResults || [];

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

      results
        .filter(function(result) {
          return result.status !== "Rejected" &&
            (result.teamA === team.teamName || result.teamB === team.teamName);
        })
        .forEach(function(result) {
          const teamIsA =
            result.teamA === team.teamName;

          const score =
            parseTeamTournamentScore(result.tournamentPoints);
          const objective =
            parseTeamTournamentScore(result.objectivePoints);
          const victory =
            parseTeamTournamentScore(result.victoryPoints);

          const teamTp =
            teamIsA ? score.left : score.right;
          const otherTp =
            teamIsA ? score.right : score.left;

          if (teamTp > otherTp)
            wins++;
          else if (otherTp > teamTp)
            losses++;

          tp += teamTp;
          op += teamIsA ? objective.left : objective.right;
          vp += teamIsA ? victory.left : victory.right;
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

function getTeamTournamentInvitations(eventId) {

  return getTeamTournamentRows(
    ensureTeamTournamentInvitationsSheet()
  ).filter(function(row) {
    return row["Event ID"] === eventId;
  }).map(function(row) {
    return {
      eventId: row["Event ID"],
      invitationId: row["Invitation ID"],
      teamName: row["Team Name"],
      captain: row["Captain"],
      player: row["Player"],
      status: row["Status"],
      message: row["Message"],
      createdAt: row["Created At"],
      updatedAt: row["Updated At"]
    };
  });

}

function getTeamTournamentResults(eventId) {

  return getTeamTournamentRows(
    ensureTeamTournamentResultsSheet()
  ).filter(function(row) {
    return row["Event ID"] === eventId;
  }).map(function(row) {
    return {
      eventId: row["Event ID"],
      resultId: row["Result ID"],
      roundId: row["Round ID"],
      round: row["Round"],
      teamA: row["Team A"],
      teamB: row["Team B"],
      player: row["Player"],
      opponent: row["Opponent"],
      tournamentPoints: row["Tournament Points"],
      objectivePoints: row["Objective Points"],
      victoryPoints: row["Victory Points"],
      winningFaction: row["Winning Faction"],
      firstTurn: row["First Turn"],
      bestMoment: row["Best Moment"],
      notes: row["Notes"],
      status: row["Status"],
      submittedBy: row["Submitted By"],
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

function buildTeamTournamentNews(event, teams, pairings, results) {

  const news = [];

  news.push((event.name || "Team Tournament") + " is " + (event.status || "Planning") + ".");

  if (teams.length > 0)
    news.push(teams.length + " teams are registered.");

  if (pairings.length > 0)
    news.push("Pairings are posted for " + (pairings[0].round || "the current round") + ".");

  if (results.length > 0)
    news.push(results.length + " tournament results have been submitted.");

  return news;

}

function buildTeamTournamentTimeline(event, teams, pairings, registrations, invitations, results) {

  const timeline = [
    {
      type: "Event",
      title: event.name + " active",
      body: event.status || event.lifecycleStage || "Tournament configured.",
      timestamp: event.updatedAt || event.createdAt || ""
    }
  ];

  registrations.slice(0, 8).forEach(function(registration) {
    timeline.push({
      type: "Registration",
      title: registration.displayName + " registered",
      body: registration.preferredTeam || registration.team || "Looking for Team",
      timestamp: registration.updatedAt || registration.registeredAt || ""
    });
  });

  teams.slice(0, 8).forEach(function(team) {
    timeline.push({
      type: "Team",
      title: team.teamName + " rostered",
      body: "Captain: " + (team.captain || "Not assigned"),
      timestamp: team.updatedAt || team.createdAt || ""
    });
  });

  invitations.slice(0, 8).forEach(function(invitation) {
    timeline.push({
      type: "Invitation",
      title: invitation.teamName + " invited " + invitation.player,
      body: invitation.status,
      timestamp: invitation.updatedAt || invitation.createdAt || ""
    });
  });

  pairings.slice(0, 8).forEach(function(pairing) {
    timeline.push({
      type: "Pairing",
      title: pairing.teamA + " vs " + pairing.teamB,
      body: pairing.round + " - " + pairing.status,
      timestamp: pairing.updatedAt || pairing.createdAt || ""
    });
  });

  results.slice(0, 8).forEach(function(result) {
    timeline.push({
      type: "Result",
      title: result.player + " reported " + result.round,
      body: result.teamA + " vs " + result.teamB,
      timestamp: result.updatedAt || result.createdAt || ""
    });
  });

  return timeline.sort(function(left, right) {
    return String(right.timestamp).localeCompare(String(left.timestamp));
  });

}

function buildTeamTournamentChampion(event, standings) {

  if (
    event.lifecycleStage !== "Awards" &&
    event.status !== "Champion" &&
    event.status !== "Archived"
  )
    return null;

  const champion =
    standings[0];

  if (!champion)
    return null;

  return {
    teamName: champion.teamName,
    captain: champion.captain,
    players: champion.players,
    wins: champion.wins,
    losses: champion.losses,
    tournamentPoints: champion.tournamentPoints,
    objectivePoints: champion.objectivePoints,
    victoryPoints: champion.victoryPoints
  };

}

function buildTeamTournamentQuickActions(eventId, event) {

  return [
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
  ensureTeamTournamentInvitationsSheet();
  ensureTeamTournamentResultsSheet();

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

function ensureTeamTournamentInvitationsSheet() {

  return ensureEventEngineSheet(
    CONFIG.SHEETS.TEAM_TOURNAMENT_INVITATIONS,
    TEAM_TOURNAMENT_INVITATION_HEADERS
  );

}

function ensureTeamTournamentResultsSheet() {

  return ensureEventEngineSheet(
    CONFIG.SHEETS.TEAM_TOURNAMENT_RESULTS,
    TEAM_TOURNAMENT_RESULT_HEADERS
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
