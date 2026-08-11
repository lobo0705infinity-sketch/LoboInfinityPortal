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

function getTeamTournament(e) {

  const params =
    getApiParameters(e);

  const auth =
    getRequestUser(e);

  const commissionerContext =
    typeof getResultSubmissionCommissionerContext === "function"
      ? getResultSubmissionCommissionerContext(auth, params)
      : { enabled: false, override: false, reason: "", commissioner: "" };

  if (commissionerContext.error)
    return jsonOutput({
      success: false,
      error: commissionerContext.error
    });

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID);

  const runtimeValidation =
    validateEventEngineRuntime();

  if (!runtimeValidation.initialized)
    return jsonOutput(
      buildEventEngineInitializationRequiredResponse(runtimeValidation)
    );

  const runtime =
    buildTeamTournamentRuntime(eventId);

  const event =
    runtime.event;

  const teams =
    runtime.teams;

  const pairings =
    runtime.pairings;

  const invitations =
    runtime.invitations;

  const results =
    runtime.results;

  const resultStatuses =
    buildTeamTournamentResultStatuses(pairings, results);

  const standings =
    buildTeamTournamentStandings(eventId, teams, [], runtime.recentGames);

  const registrations =
    resolveTeamTournamentRegistrationMembership(
      runtime.registrations,
      teams
    );

  const currentPlayerRegistration =
    auth.authenticated
      ? findTeamTournamentRegistrationForPlayer(
          registrations,
          getEventParticipantKey(event, auth.user)
        )
      : null;

  const includeRegistrationDetails =
    canViewEventRegistrationDetails(auth);

  const visibleRegistrations =
    includeRegistrationDetails
      ? registrations
      : currentPlayerRegistration
        ? [currentPlayerRegistration]
        : [];

  const teamSummary =
    getEventRegistrationTeamSummary(registrations);

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
          currentPlayerRegistration,
          {
            includeRegistrationDetails: includeRegistrationDetails
          }
        ),
      registeredTeams:
        Math.max(
          teams.length,
          teamSummary.filter(function(team) {
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
        runtime.recentGames.slice(0, 8),
      tournamentResults: results,
      resultStatuses: resultStatuses,
      invitations: invitations,
      timeline:
        buildTeamTournamentTimeline(event, teams, pairings, visibleRegistrations, invitations, results),
      freeAgents:
        includeRegistrationDetails
          ? registrations.filter(function(registration) {
              return registration.freeAgent === true && registration.status !== "Withdrawn";
            })
          : [],
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

// Temporary commissioner-only diagnostic endpoint for live Team Tournament tracing.
// Remove this endpoint once the registration/pairing bug is resolved.
function getTeamTournamentDiagnostic(e) {

  return requireApiPermission(
  e,
  "runSeasonControl",
  function(auth) {

    const params =
      getApiParameters(e);

    const eventId =
      resolveEventId(
        params.eventId || EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID
      );

    const event =
      getEventByIdSnapshot(eventId) ||
      getEventByIdSnapshot(EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID) ||
      getCurrentLeagueEventSnapshot();

    const spreadsheet =
    lifGetTargetSpreadsheet_();

    const sheets = {
      teams:
        spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_TEAMS),
      pairings:
        spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_PAIRINGS),
      registrations:
        spreadsheet.getSheetByName(CONFIG.SHEETS.EVENT_PARTICIPANTS)
    };

    const teams =
      getTeamTournamentTeams(eventId, sheets.teams);

    const pairings =
      getTeamTournamentPairings(eventId, sheets.pairings);

    const rawRegistrations =
      getTeamTournamentRegistrationRows(eventId, sheets.registrations);

    const registrations =
      resolveTeamTournamentRegistrationMembership(
        rawRegistrations,
        teams
      );

    const currentRound =
      getTeamTournamentCurrentRound(eventId);

    const authParticipantKey =
      getEventParticipantKey(event, auth.user);

    const requestedPlayer =
      getTeamTournamentString(params.player);

    const targetKey =
      requestedPlayer !== ""
        ? requestedPlayer
        : authParticipantKey;

    const registration =
      findTeamTournamentRegistrationForPlayer(
        registrations,
        targetKey
      );

    const registrationCandidates =
      registration
        ? []
        : rawRegistrations.slice(0, 50).map(function(registration) {
            return {
              player: registration.player,
              displayName: registration.displayName,
              email: registration.email,
              status: registration.status,
              eventId: registration.eventId,
              normalized: {
                player: normalizeTeamTournamentPlayerKey(registration.player),
                displayName: normalizeTeamTournamentPlayerKey(registration.displayName),
                email: normalizeTeamTournamentPlayerKey(registration.email)
              }
            };
          });

    const player =
      registration
        ? getTeamTournamentString(registration.player) ||
          getTeamTournamentString(registration.displayName)
        : "";

    const teamName =
      registration
        ? getTeamTournamentString(registration.team) ||
          getTeamTournamentString(registration.preferredTeam)
        : "";

    const currentRoundId =
      getTeamTournamentRoundValue(currentRound, "roundId") ||
      getTeamTournamentRoundValue(currentRound, "id");

    const teamMatches =
      teamName !== ""
        ? teams.filter(function(team) {
            return teamTournamentSameValue(team.teamName, teamName);
          })
        : [];

    const pairingsForTeam =
      teamName !== ""
        ? pairings.filter(function(pairing) {
            return (
              teamTournamentSameValue(pairing.teamA, teamName) ||
              teamTournamentSameValue(pairing.teamB, teamName)
            );
          })
        : [];

    const currentRoundPairingsForTeam =
      teamName !== ""
        ? pairingsForTeam.filter(function(pairing) {
            return (
              currentRoundId === "" ||
              getTeamTournamentString(pairing.roundId) === currentRoundId
            );
          })
        : [];

    const activePairingsForTeam =
      currentRoundPairingsForTeam.filter(function(pairing) {
        return getTeamTournamentString(pairing.status).toLowerCase() !== "completed";
      });

    const assignment =
      registration
        ? resolveTeamTournamentResultAssignment(
            event,
            currentRound,
            registration,
            pairings,
            params
          )
        : null;

    let failure = "";

    if (!registration) {
      failure =
        "Registration lookup failed for participant key: '" +
        targetKey +
        "'.";
    }
    else if (teamName === "") {
      failure =
        "Registration found but no Team is assigned for this player.";
    }
    else if (pairingsForTeam.length === 0) {
      failure =
        "No published pairing contains team '" +
        teamName +
        "'.";
    }
    else if (currentRoundPairingsForTeam.length === 0) {
      failure =
        "Published pairings contain team '" +
        teamName +
        "', but none are in the current round '" +
        (currentRound ? getTeamTournamentString(currentRound.round) || getTeamTournamentRoundValue(currentRound, "name") : "") +
        "'.";
    }
    else if (activePairingsForTeam.length === 0) {
      failure =
        "Pairings were found for team '" +
        teamName +
        "' in the current round, but none are active (all are completed).";
    }
    else if (!assignment) {
      failure =
        "Active pairing found for team '" +
        teamName +
        "' but player '" +
        player +
        "' did not match any published pairing assignment.";
    }
    else {
      failure = "No failure; assignment resolved.";
    }

    return jsonOutput({
      success: true,
      diagnostic: {
        eventId: eventId,
        currentRound: {
          roundId: currentRoundId,
          round: getTeamTournamentString(currentRound && currentRound.round) ||
            getTeamTournamentRoundValue(currentRound, "name") ||
            ""
        },
        auth: {
          email: getTeamTournamentString(auth.user && auth.user.email),
          displayName: getTeamTournamentString(auth.user && auth.user.displayName),
          leaguePlayer: getTeamTournamentString(auth.user && auth.user.leaguePlayer),
          participantKey: authParticipantKey
        },
        query: {
          requestedPlayer: requestedPlayer,
          targetKey: targetKey,
          searchMode: requestedPlayer !== "" ? "requestedPlayer" : "authenticatedUser"
        },
        registration: registration,
        registrationFound: !!registration,
        registrationCandidates: registrationCandidates,
        team: teamName,
        teamFound: teamMatches.length > 0,
        matchingTeams: teamMatches.map(function(team) {
          return {
            teamName: team.teamName,
            captain: team.captain,
            players: team.players,
            status: team.status
          };
        }),
        pairingSummary: {
          allPairingsForTeam: pairingsForTeam.map(function(pairing) {
            return {
              roundId: pairing.roundId,
              round: pairing.round,
              teamA: pairing.teamA,
              teamB: pairing.teamB,
              status: pairing.status,
              playerPairings: pairing.playerPairings
            };
          }),
          currentRoundPairingsForTeam: currentRoundPairingsForTeam.map(function(pairing) {
            return {
              roundId: pairing.roundId,
              round: pairing.round,
              teamA: pairing.teamA,
              teamB: pairing.teamB,
              status: pairing.status,
              playerPairings: pairing.playerPairings
            };
          }),
          activePairingsForTeam: activePairingsForTeam.map(function(pairing) {
            return {
              roundId: pairing.roundId,
              round: pairing.round,
              teamA: pairing.teamA,
              teamB: pairing.teamB,
              status: pairing.status,
              playerPairings: pairing.playerPairings
            };
          })
        },
        assignment: assignment,
        failure: failure
      }
    });
  }
  );

}

function buildTeamTournamentRuntime(eventId) {

  const cached =
    readTeamTournamentRuntimeCache(eventId);

  if (cached)
    return cached;

  const spreadsheet =
    measureTeamTournamentOperation(
      "teamTournament.spreadsheet.getActive",
      function() {
        return lifGetTargetSpreadsheet_();
      },
      {
        eventId: eventId
      }
    );

  const sheets =
    measureTeamTournamentOperation(
      "teamTournament.sheetLookup",
      function() {
        return {
          teams: spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_TEAMS),
          pairings: spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_PAIRINGS),
          invitations: spreadsheet.getSheetByName(CONFIG.SHEETS.TEAM_TOURNAMENT_INVITATIONS),
          registrations: spreadsheet.getSheetByName(CONFIG.SHEETS.EVENT_PARTICIPANTS)
        };
      },
      {
        eventId: eventId
      }
    );

  const event =
    measureTeamTournamentOperation(
      "teamTournament.eventLookup",
      function() {
        return getEventByIdSnapshot(eventId) ||
          getEventByIdSnapshot(EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ID) ||
          getCurrentLeagueEventSnapshot();
      },
      {
        eventId: eventId
      }
    );

  const teams =
    measureTeamTournamentOperation(
      "teamTournament.teams.load",
      function() {
        return getTeamTournamentTeams(eventId, sheets.teams);
      },
      {
        eventId: eventId
      }
    );

  const pairings =
    measureTeamTournamentOperation(
      "teamTournament.pairings.load",
      function() {
        return getTeamTournamentPairings(eventId, sheets.pairings);
      },
      {
        eventId: eventId
      }
    );

  const recentGames =
    measureTeamTournamentOperation(
      "teamTournament.recentGames.load",
      function() {
        return getTeamTournamentCanonicalGames_(eventId);
      },
      {
        eventId: eventId
      }
    );

  const runtime = {
    event: event,
    teams: teams,
    pairings: pairings,
    invitations:
      measureTeamTournamentOperation(
        "teamTournament.invitations.load",
        function() {
          return getTeamTournamentInvitations(eventId, sheets.invitations);
        },
        {
          eventId: eventId
        }
      ),
    results:
      measureTeamTournamentOperation(
        "teamTournament.results.load",
        function() {
          return buildTeamTournamentResultsFromCanonicalGames(
            eventId,
            teams,
            pairings,
            recentGames
          );
        },
        {
          eventId: eventId
        }
      ),
    registrations:
      measureTeamTournamentOperation(
        "teamTournament.registrations.load",
        function() {
          return getTeamTournamentRegistrationRows(eventId, sheets.registrations);
        },
        {
          eventId: eventId
        }
      ),
    recentGames: recentGames
  };

  writeTeamTournamentRuntimeCache(eventId, runtime);

  return runtime;

}

function readTeamTournamentRuntimeCache(eventId) {

  const start =
    Date.now();

  try {
    const cached =
      CacheService
        .getScriptCache()
        .get(getTeamTournamentRuntimeCacheKey(eventId));

    if (!cached) {
      recordApiPipelineSubStage(
        "teamTournament.runtimeCache",
        start,
        {
          cache: "miss",
          eventId: eventId
        }
      );
      return null;
    }

    const payload =
      JSON.parse(cached);

    recordApiPipelineSubStage(
      "teamTournament.runtimeCache",
      start,
      {
        cache: "hit",
        eventId: eventId
      }
    );

    return JSON.parse(payload.content);
  }
  catch (err) {
    recordApiPipelineSubStage(
      "teamTournament.runtimeCache",
      start,
      {
        cache: "error",
        eventId: eventId,
        error: String(err)
      }
    );
    return null;
  }

}

function writeTeamTournamentRuntimeCache(eventId, runtime) {

  const start =
    Date.now();

  try {
    const content =
      JSON.stringify(runtime);

    const payload =
      buildPortalCachePayload(
        "teamTournament",
        content,
        Date.now()
      );

    writePortalCacheEntry(
      CacheService.getScriptCache(),
      getTeamTournamentRuntimeCacheKey(eventId),
      getPortalStaleCacheKey(getTeamTournamentRuntimeCacheKey(eventId)),
      payload,
      "teamTournament"
    );

    recordApiPipelineSubStage(
      "teamTournament.runtimeCacheWrite",
      start,
      {
        eventId: eventId,
        size: content.length
      }
    );
  }
  catch (err) {
    recordApiPipelineSubStage(
      "teamTournament.runtimeCacheWrite",
      start,
      {
        eventId: eventId,
        error: String(err)
      }
    );
  }

}

function getTeamTournamentRuntimeCacheKey(eventId) {

  return (
    PORTAL_CACHE_PREFIX +
    getPortalCacheVersion() +
    ":teamTournamentRuntime:" +
    encodeURIComponent(eventId)
  );

}

function invalidateTeamTournamentRuntimeCache(eventId) {

  const cacheKey =
    getTeamTournamentRuntimeCacheKey(eventId);

  CacheService
    .getScriptCache()
    .removeAll([
      cacheKey,
      getPortalStaleCacheKey(cacheKey)
    ]);

  invalidatePortalCacheGroup("events");

}

function measureTeamTournamentOperation(stageName, operation, details) {

  const start =
    Date.now();

  try {
    return operation();
  }
  finally {
    recordApiPipelineSubStage(
      stageName,
      start,
      details || {}
    );
  }

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

    const timestamp =
      getTeamTournamentTimestamp();

    const team =
      {
        eventId: eventId,
        teamId: teamId,
        teamName: teamName,
        captain: getTeamTournamentString(params.captain),
        players: getTeamTournamentString(params.players),
        factionRestrictions: getTeamTournamentString(params.factionRestrictions),
        logoUrl: getTeamTournamentString(params.logoUrl),
        discordContact: getTeamTournamentString(params.discordContact),
        status: getTeamTournamentString(params.status) || "Registered",
        createdAt: timestamp,
        updatedAt: timestamp
      };

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
        team.eventId,
        team.teamId,
        team.teamName,
        team.captain,
        team.players,
        team.factionRestrictions,
        team.logoUrl,
        team.discordContact,
        team.status,
        team.createdAt,
        team.updatedAt
      ]
    );

    invalidatePortalCacheGroup("events");

    return buildTeamTournamentMutationResponse(
      "team",
      eventId,
      {
        team: team
      }
    );
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

    const timestamp =
      getTeamTournamentTimestamp();

    const existingPairings =
      getTeamTournamentPairings(eventId);

    const existingPairing =
      existingPairings.find(function(pairing) {
        return (
          getTeamTournamentString(pairing.roundId) === roundId &&
          getTeamTournamentString(pairing.teamA).toLowerCase() === teamA.toLowerCase() &&
          getTeamTournamentString(pairing.teamB).toLowerCase() === teamB.toLowerCase()
        );
      });

    const playerPairings =
      getTeamTournamentString(params.playerPairings) ||
      (existingPairing ? getTeamTournamentString(existingPairing.playerPairings) : "");

    const pairing =
      {
        eventId: eventId,
        roundId: roundId,
        round: getTeamTournamentString(params.round) || "Round 1",
        teamA: teamA,
        teamB: teamB,
        playerPairings: playerPairings,
        status: getTeamTournamentString(params.status) || "Scheduled",
        results: getTeamTournamentString(params.results),
        createdAt: timestamp,
        updatedAt: timestamp
      };

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
        pairing.eventId,
        pairing.roundId,
        pairing.round,
        pairing.teamA,
        pairing.teamB,
        pairing.playerPairings,
        pairing.status,
        pairing.results,
        pairing.createdAt,
        pairing.updatedAt
      ]
    );

    invalidatePortalCacheGroup("events");

    return buildTeamTournamentMutationResponse(
      "pairing",
      eventId,
      {
        pairing: pairing
      }
    );
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

    const timestamp =
      getTeamTournamentTimestamp();

    const invitation =
      {
        eventId: eventId,
        invitationId: invitationId,
        teamName: teamName,
        captain:
          getTeamTournamentString(params.captain) ||
          (auth && auth.user ? getCanonicalPlayerFromUser(auth.user) : "Commissioner"),
        player: player,
        status: getTeamTournamentString(params.status) || "Pending",
        message: getTeamTournamentString(params.message),
        createdAt: timestamp,
        updatedAt: timestamp
      };

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
        invitation.eventId,
        invitation.invitationId,
        invitation.teamName,
        invitation.captain,
        invitation.player,
        invitation.status,
        invitation.message,
        invitation.createdAt,
        invitation.updatedAt
      ]
    );

    invalidatePortalCacheGroup("events");

    return buildTeamTournamentMutationResponse(
      "invitation",
      eventId,
      {
        invitation: invitation
      }
    );
  });

}

function saveTeamTournamentResult(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const params =
    getApiParameters(e);

  const commissionerContext =
    typeof getResultSubmissionCommissionerContext === "function"
      ? getResultSubmissionCommissionerContext(auth, params)
      : { enabled: false, override: false, reason: "", commissioner: "" };

  if (commissionerContext.error)
    return jsonOutput({
      success: false,
      error: commissionerContext.error
    });

  const command =
    createSubmissionCommand({
      source: "portal",
      workflow: "team-tournament",
      params: params,
      auth: auth,
      commissionerContext: commissionerContext
    });
  const submission =
    submitCanonicalGame(command);

  if (!submission.success)
    return jsonOutput({
      success: false,
      error: submission.error
    });

  return buildTeamTournamentSubmissionResponse_(
    submission,
    params,
    auth,
    commissionerContext
  );

}

function buildTeamTournamentSubmissionResponse_(submission, params, auth, commissionerContext) {
  const eventId = submission.context.eventId;
  const assignment = submission.context.assignment;
  const timestamp = submission.context.timestamp;
  const canonicalSubmission = submission.context.submission;
  const targetRow = submission.targetRow;
  const result = {
    eventId: eventId,
    resultId: "canonical-game-" + targetRow,
    roundId: assignment.roundId,
    round: assignment.round,
    teamA: assignment.teamA,
    teamB: assignment.teamB,
    player: assignment.player,
    opponent: assignment.opponent,
    tournamentPoints: getTeamTournamentString(params.tournamentPoints),
    objectivePoints: getTeamTournamentString(params.objectivePoints),
    victoryPoints: getTeamTournamentString(params.victoryPoints),
    winningFaction: getTeamTournamentWinningFaction_(canonicalSubmission),
    firstTurn: lifResolveCanonicalFirstTurn_(canonicalSubmission),
    bestMoment: getTeamTournamentString(params.bestMoment),
    notes: getTeamTournamentString(params.notes),
    status: "Submitted",
    submittedBy: commissionerContext.enabled
      ? commissionerContext.commissioner
      : getCanonicalPlayerFromUser(auth.user) || auth.user.email || assignment.player,
    createdAt: timestamp,
    updatedAt: timestamp,
    table: assignment.table,
    mission: assignment.mission,
    winner: getTeamTournamentString(params.winner)
  };

  if (typeof recordResultSubmissionCommissionerAudit === "function")
    recordResultSubmissionCommissionerAudit(
      commissionerContext,
      "tournament",
      {
        eventId: eventId,
        player: assignment.player,
        opponent: assignment.opponent,
        mission: assignment.mission,
        result: result.winner
      }
    );

  return buildTeamTournamentMutationResponse(
    "result",
    eventId,
    {
      result: result
    }
  );
}

function getTeamTournamentCanonicalGameResult_(winner, assignment) {

  const value =
    getTeamTournamentString(winner);

  if (teamTournamentSameValue(value, "Draw"))
    return "Draw";

  if (
    teamTournamentSameValue(value, "Player Victory") ||
    teamTournamentSameValue(value, assignment.player)
  )
    return "Player Victory";

  if (
    teamTournamentSameValue(value, "Opponent Victory") ||
    teamTournamentSameValue(value, assignment.opponent)
  )
    return "Opponent Victory";

  return value;

}

function getTeamTournamentCanonicalFirstTurn_(firstTurn, assignment) {

  const value =
    getTeamTournamentString(firstTurn);

  if (
    teamTournamentSameValue(value, "Player") ||
    teamTournamentSameValue(value, assignment.player)
  )
    return "Player";

  if (
    teamTournamentSameValue(value, "Opponent") ||
    teamTournamentSameValue(value, assignment.opponent)
  )
    return "Opponent";

  return value;

}

function getTeamTournamentWinningFaction_(submission) {

  const winner =
    lifDetermineWinner_(submission);

  if (winner === "Draw")
    return "";

  return winner === submission.player
    ? canonicalizeArmyName(submission.playerFaction)
    : canonicalizeArmyName(submission.opponentFaction);

}

function getTeamTournamentArmyCodeFaction(armyCode) {

  if (
    !armyCode ||
    typeof CanonicalDecoderGateway === "undefined" ||
    typeof CanonicalDecoderGateway.decode !== "function"
  )
    return "";

  const decoded =
    CanonicalDecoderGateway.decode(armyCode);

  return canonicalizeArmyName(
    decoded.sectorial ||
    decoded.faction ||
    ""
  );

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

    return buildTeamTournamentMutationResponse(
      "round",
      eventId,
      {
        lifecycleStage: lifecycleStage,
        status: status
      }
    );
  });

}

function buildTeamTournamentMutationResponse(kind, eventId, payload) {

  return jsonOutput({
    success: true,
    mutation: Object.assign(
      {
        kind: kind,
        eventId: eventId
      },
      payload || {}
    )
  });

}

function buildTeamTournamentStandings(eventId, teams, tournamentResults, recentGames) {

  const games =
    recentGames || getTeamTournamentCanonicalGames_(eventId);

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
      let draws = 0;
      let tp = 0;
      let op = 0;
      let vp = 0;

      teamGames.forEach(function(game) {
        const isDraw =
          getTeamTournamentString(game.gameResult).toLowerCase() === "draw" ||
          (
            teamTournamentScoreIsDraw(game.tp) &&
            teamTournamentScoreIsDraw(game.op) &&
            teamTournamentScoreIsDraw(game.vp)
          );
        const winnerOnTeam =
          players.indexOf(game.winner) !== -1;

        const score =
          parseTeamTournamentScore(game.tp);
        const objective =
          parseTeamTournamentScore(game.op);
        const victory =
          parseTeamTournamentScore(game.vp);

        if (isDraw) {
          draws++;
          tp += score.left;
          op += objective.left;
          vp += victory.left;
        }
        else if (winnerOnTeam) {
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
          const teamOp =
            teamIsA ? objective.left : objective.right;
          const otherOp =
            teamIsA ? objective.right : objective.left;
          const teamVp =
            teamIsA ? victory.left : victory.right;
          const otherVp =
            teamIsA ? victory.right : victory.left;

          if (teamTp === otherTp && teamOp === otherOp && teamVp === otherVp)
            draws++;
          else if (teamTp > otherTp)
            wins++;
          else if (otherTp > teamTp)
            losses++;

          tp += teamTp;
          op += teamOp;
          vp += teamVp;
        });

      return {
        rank: 0,
        teamId: team.teamId,
        teamName: team.teamName,
        captain: team.captain,
        players: players,
        wins: wins,
        losses: losses,
        draws: draws,
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

function findTeamTournamentRegistrationForPlayer(registrations, player) {

  const target =
    normalizeTeamTournamentPlayerKey(player);

  if (target === "")
    return null;

  for (let index = 0; index < registrations.length; index++) {
    const registration =
      registrations[index];

    if (
      normalizeTeamTournamentPlayerKey(registration.player) === target ||
      normalizeTeamTournamentPlayerKey(registration.displayName) === target ||
      normalizeTeamTournamentPlayerKey(registration.email) === target
    )
      return registration;
  }

  return null;

}

function resolveTeamTournamentRegistrationMembership(registrations, teams) {

  const membership =
    buildTeamTournamentMembershipLookup(teams);

  return registrations.map(function(registration) {
    const teamName =
      findTeamTournamentMembership(
        membership,
        registration.player,
        registration.displayName
      );

    const copy =
      Object.assign({}, registration);

    if (teamName !== "") {
      copy.team = teamName;
      copy.preferredTeam = teamName;
      copy.freeAgent = false;
    } else {
      copy.team = "";
      copy.preferredTeam = "";
      copy.freeAgent = true;
    }

    return copy;
  });

}

function buildTeamTournamentMembershipLookup(teams) {

  const lookup = {};

  teams
    .filter(function(team) {
      return getTeamTournamentString(team.status) !== "Deleted";
    })
    .forEach(function(team) {
      const teamName =
        getTeamTournamentString(team.teamName);

      [
        team.captain
      ].concat(
        parseTeamTournamentRoster(team.players)
      ).forEach(function(player) {
        const key =
          normalizeTeamTournamentPlayerKey(player);

        if (key !== "")
          lookup[key] = teamName;
      });
    });

  return lookup;

}

function findTeamTournamentMembership(membership, player, displayName) {

  const playerKey =
    normalizeTeamTournamentPlayerKey(player);

  if (
    playerKey !== "" &&
    membership[playerKey]
  )
    return membership[playerKey];

  const displayNameKey =
    normalizeTeamTournamentPlayerKey(displayName);

  if (
    displayNameKey !== "" &&
    membership[displayNameKey]
  )
    return membership[displayNameKey];

  return "";

}

function normalizeTeamTournamentPlayerKey(value) {

  return getTeamTournamentString(value)
    .trim()
    .toLowerCase();

}

function parseTeamTournamentRoster(players) {

  return getTeamTournamentString(players)
    .split(/[,;\n]/)
    .map(function(player) {
      return getTeamTournamentString(player);
    })
    .filter(function(player) {
      return player !== "";
    });

}

function getTeamTournamentTeams(eventId, sheet) {

  return getTeamTournamentRows(
    sheet || getTeamTournamentRuntimeSheet(CONFIG.SHEETS.TEAM_TOURNAMENT_TEAMS)
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

function getTeamTournamentPairings(eventId, sheet) {

  return getTeamTournamentRows(
    sheet || getTeamTournamentRuntimeSheet(CONFIG.SHEETS.TEAM_TOURNAMENT_PAIRINGS)
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

function getTeamTournamentInvitations(eventId, sheet) {

  return getTeamTournamentRows(
    sheet || getTeamTournamentRuntimeSheet(CONFIG.SHEETS.TEAM_TOURNAMENT_INVITATIONS)
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

  return buildTeamTournamentResultsFromCanonicalGames(
    eventId,
    getTeamTournamentTeams(eventId),
    getTeamTournamentPairings(eventId),
    getTeamTournamentCanonicalGames_(eventId)
  );

}

function getTeamTournamentCanonicalGames_(eventId) {

  const rows =
    getLeagueDataForEvent(
      eventId,
      "tournament"
    );

  const games = [];

  for (
    let index = 0;
    index < rows.length;
    index += 2
  ) {
    const game =
      buildRecentGameFromGameEngineRows(
        rows[index],
        rows[index + 1],
        index
      );

    if (game)
      games.push(game);
  }

  return games.sort(function(left, right) {

    const dateOrder =
      right.sortDate.getTime() -
      left.sortDate.getTime();

    if (dateOrder !== 0)
      return dateOrder;

    return right.sourceIndex - left.sourceIndex;

  });

}

function buildTeamTournamentResultsFromCanonicalGames(eventId, teams, pairings, recentGames) {

  const assignments = [];

  (pairings || []).forEach(function(pairing) {
    parseTeamTournamentPlayerPairings(pairing).forEach(function(assignment) {
      assignments.push({
        assignment: assignment,
        used: false
      });
    });
  });

  const membership =
    buildTeamTournamentMembershipLookup(teams || []);

  return (recentGames || [])
    .slice()
    .sort(function(left, right) {
      return Number(left.id) - Number(right.id);
    })
    .map(function(game) {
      const assignmentEntry =
        findTeamTournamentCanonicalGameAssignment_(
          game,
          assignments
        );

      const assignment =
        assignmentEntry
          ? assignmentEntry.assignment
          : buildTeamTournamentCanonicalGameAssignmentFromTeams_(
              game,
              pairings || [],
              membership
            );

      if (!assignment)
        return null;

      if (assignmentEntry)
        assignmentEntry.used = true;

      return buildTeamTournamentResultFromCanonicalGame_(
        eventId,
        assignment,
        game
      );
    })
    .filter(function(result) {
      return result !== null;
    });

}

function findTeamTournamentCanonicalGameAssignment_(game, assignments) {

  const matching =
    assignments.filter(function(entry) {
      return !entry.used && teamTournamentCanonicalGameMatchesAssignment_(game, entry.assignment);
    });

  if (!matching.length)
    return null;

  const mission =
    getTeamTournamentString(game.mission);

  if (mission !== "") {
    const missionMatch =
      matching.filter(function(entry) {
        return teamTournamentSameValue(entry.assignment.mission, mission);
      })[0];

    if (missionMatch)
      return missionMatch;
  }

  return matching[0];

}

function teamTournamentCanonicalGameMatchesAssignment_(game, assignment) {

  return (
    (
      teamTournamentCanonicalGamePlayerMatches_(game, "winner", assignment.player) &&
      teamTournamentCanonicalGamePlayerMatches_(game, "loser", assignment.opponent)
    ) ||
    (
      teamTournamentCanonicalGamePlayerMatches_(game, "winner", assignment.opponent) &&
      teamTournamentCanonicalGamePlayerMatches_(game, "loser", assignment.player)
    )
  );

}

function teamTournamentCanonicalGamePlayerMatches_(game, side, player) {

  const gameKeys = [
    game[side],
    game[side + "DisplayName"]
  ].map(normalizeTeamTournamentPlayerKey);

  const playerKeys = [
    player,
    typeof getPlayerDisplayName === "function" ? getPlayerDisplayName(player) : player
  ].map(normalizeTeamTournamentPlayerKey);

  return gameKeys.some(function(gameKey) {
    return gameKey !== "" && playerKeys.indexOf(gameKey) !== -1;
  });

}

function buildTeamTournamentCanonicalGameAssignmentFromTeams_(game, pairings, membership) {

  const winnerTeam =
    findTeamTournamentMembership(
      membership,
      game.winner,
      game.winnerDisplayName
    );

  const loserTeam =
    findTeamTournamentMembership(
      membership,
      game.loser,
      game.loserDisplayName
    );

  if (winnerTeam === "" || loserTeam === "" || teamTournamentSameValue(winnerTeam, loserTeam))
    return null;

  const pairing =
    (pairings || []).filter(function(candidate) {
      return (
        (
          teamTournamentSameValue(candidate.teamA, winnerTeam) &&
          teamTournamentSameValue(candidate.teamB, loserTeam)
        ) ||
        (
          teamTournamentSameValue(candidate.teamA, loserTeam) &&
          teamTournamentSameValue(candidate.teamB, winnerTeam)
        )
      );
    })[0];

  if (!pairing)
    return null;

  const winnerIsTeamA =
    teamTournamentSameValue(pairing.teamA, winnerTeam);

  return {
    roundId: pairing.roundId,
    round: pairing.round,
    teamA: pairing.teamA,
    teamB: pairing.teamB,
    table: "",
    player: winnerIsTeamA ? game.winner : game.loser,
    opponent: winnerIsTeamA ? game.loser : game.winner,
    mission: game.mission || pairing.round
  };

}

function buildTeamTournamentResultFromCanonicalGame_(eventId, assignment, game) {

  const playerIsWinnerSide =
    teamTournamentCanonicalGamePlayerMatches_(game, "winner", assignment.player);

  const draw =
    teamTournamentSameValue(game.gameResult, "Draw");

  return {
    eventId: eventId,
    resultId: "canonical-game-" + getTeamTournamentString(game.id),
    roundId: assignment.roundId,
    round: assignment.round,
    teamA: assignment.teamA,
    teamB: assignment.teamB,
    table: assignment.table,
    player: assignment.player,
    opponent: assignment.opponent,
    mission: game.mission || assignment.mission,
    winner: draw ? "Draw" : game.winner,
    tournamentPoints: orientTeamTournamentCanonicalGameScore_(game.tp, playerIsWinnerSide),
    objectivePoints: orientTeamTournamentCanonicalGameScore_(game.op, playerIsWinnerSide),
    victoryPoints: orientTeamTournamentCanonicalGameScore_(game.vp, playerIsWinnerSide),
    winningFaction: draw ? "" : game.winnerFaction,
    firstTurn: game.firstTurn,
    bestMoment: game.bestMoment,
    notes: "",
    status: "Submitted",
    submittedBy: "Canonical Game Engine",
    createdAt: game.date,
    updatedAt: game.date
  };

}

function orientTeamTournamentCanonicalGameScore_(value, keepOrder) {

  const score =
    parseTeamTournamentScore(value);

  return keepOrder
    ? score.left + "-" + score.right
    : score.right + "-" + score.left;

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
    draws: champion.draws,
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

function buildTeamTournamentResultStatuses(pairings, results) {

  const statuses = [];

  pairings.forEach(function(pairing) {
    const assignments =
      parseTeamTournamentPlayerPairings(pairing);

    if (assignments.length === 0) {
      const result =
        findTeamTournamentResultForAssignment(results, {
          roundId: pairing.roundId,
          teamA: pairing.teamA,
          teamB: pairing.teamB,
          player: "",
          opponent: ""
        });

      statuses.push({
        roundId: pairing.roundId,
        round: pairing.round,
        teamA: pairing.teamA,
        teamB: pairing.teamB,
        table: "",
        player: "",
        opponent: "",
        status: result ? result.status || "Submitted" : "Outstanding",
        resultId: result ? result.resultId : ""
      });
      return;
    }

    assignments.forEach(function(assignment) {
      const result =
        findTeamTournamentResultForAssignment(results, assignment);

      statuses.push({
        roundId: assignment.roundId,
        round: assignment.round,
        teamA: assignment.teamA,
        teamB: assignment.teamB,
        table: assignment.table,
        player: assignment.player,
        opponent: assignment.opponent,
        status: result ? result.status || "Submitted" : "Outstanding",
        resultId: result ? result.resultId : ""
      });
    });
  });

  return statuses;

}

function resolveTeamTournamentResultAssignment(
  event,
  currentRound,
  registration,
  pairings,
  params
) {

  const player =
    getTeamTournamentString(registration.player) ||
    getTeamTournamentString(registration.displayName) ||
    getTeamTournamentString(params.player);

  const team =
    getTeamTournamentString(registration.team) ||
    getTeamTournamentString(registration.preferredTeam);

  if (player === "" || team === "")
    return null;

  const currentRoundId =
    getTeamTournamentRoundValue(currentRound, "roundId") ||
    getTeamTournamentRoundValue(currentRound, "id");

  const activePairings =
    pairings.filter(function(pairing) {
      if (!teamTournamentSameValue(pairing.teamA, team) &&
          !teamTournamentSameValue(pairing.teamB, team))
        return false;

      if (currentRoundId !== "" &&
          getTeamTournamentString(pairing.roundId) !== currentRoundId)
        return false;

      return getTeamTournamentString(pairing.status).toLowerCase() !== "completed";
    });

  for (let index = 0; index < activePairings.length; index++) {
    const assignments =
      parseTeamTournamentPlayerPairings(activePairings[index]);

    for (let assignmentIndex = 0; assignmentIndex < assignments.length; assignmentIndex++) {
      const assignment =
        assignments[assignmentIndex];

      if (teamTournamentSameValue(assignment.player, player) ||
          teamTournamentSameValue(assignment.opponent, player)) {
        const playerIsOpponent =
          teamTournamentSameValue(assignment.opponent, player);

        return {
          roundId: assignment.roundId,
          round: assignment.round,
          teamA: activePairings[index].teamA,
          teamB: activePairings[index].teamB,
          table: assignment.table,
          player: player,
          opponent: playerIsOpponent ? assignment.player : assignment.opponent,
          mission: assignment.mission ||
            getTeamTournamentRoundValue(currentRound, "mission") ||
            getTeamTournamentRoundValue(currentRound, "Mission") ||
            getTeamTournamentRoundValue(currentRound, "name") ||
            getTeamTournamentString(activePairings[index].round)
        };
      }
    }

    const selectedOpponent =
      getTeamTournamentString(params.opponent);

    return {
      roundId: getTeamTournamentString(activePairings[index].roundId),
      round: getTeamTournamentString(activePairings[index].round) ||
        getTeamTournamentRoundValue(currentRound, "name") ||
        "",
      teamA: activePairings[index].teamA,
      teamB: activePairings[index].teamB,
      table: "",
      player: player,
      opponent: selectedOpponent,
      mission:
        getTeamTournamentString(params.mission) ||
        getTeamTournamentRoundValue(currentRound, "mission") ||
        getTeamTournamentRoundValue(currentRound, "Mission") ||
        getTeamTournamentRoundValue(currentRound, "name") ||
        getTeamTournamentString(activePairings[index].round)
    };
  }

  return null;
}
function buildCommissionerTeamTournamentOverrideAssignment(
  eventId,
  currentRound,
  params
) {

  const player =
    getTeamTournamentString(params.player);

  const opponent =
    getTeamTournamentString(params.opponent);

  if (player === "" || opponent === "")
    return null;

  if (teamTournamentSameValue(player, opponent))
    return null;

  const roundId =
    getTeamTournamentString(params.roundId) ||
    getTeamTournamentRoundValue(currentRound, "roundId") ||
    getTeamTournamentRoundValue(currentRound, "id") ||
    EVENT_ENGINE_DEFAULT_TEAM_TOURNAMENT_ROUND_ID;

  const round =
    getTeamTournamentString(params.round) ||
    getTeamTournamentRoundValue(currentRound, "name") ||
    getTeamTournamentRoundValue(currentRound, "round") ||
    "Commissioner Correction";

  const mission =
    getTeamTournamentString(params.mission) ||
    getTeamTournamentRoundValue(currentRound, "mission") ||
    getTeamTournamentRoundValue(currentRound, "Mission") ||
    round;

  return {
    roundId: roundId,
    round: round,
    teamA: getTeamTournamentString(params.teamA),
    teamB: getTeamTournamentString(params.teamB),
    table: getTeamTournamentString(params.table) || "Commissioner Override",
    player: player,
    opponent: opponent,
    mission: mission
  };

}

function hasSubmittedTeamTournamentResult(results, assignment) {

  return results.some(function(result) {
    if (getTeamTournamentString(result.status).toLowerCase() === "rejected")
      return false;

    return (
      getTeamTournamentString(result.roundId) === getTeamTournamentString(assignment.roundId) &&
      (
        (
          teamTournamentSameValue(result.player, assignment.player) &&
          teamTournamentSameValue(result.opponent, assignment.opponent)
        ) ||
        (
          teamTournamentSameValue(result.player, assignment.opponent) &&
          teamTournamentSameValue(result.opponent, assignment.player)
        )
      )
    );
  });

}

function findTeamTournamentResultForAssignment(results, assignment) {

  for (let index = 0; index < results.length; index++) {
    const result =
      results[index];

    if (getTeamTournamentString(result.status).toLowerCase() === "rejected")
      continue;

    if (getTeamTournamentString(result.roundId) !== getTeamTournamentString(assignment.roundId))
      continue;

    if (assignment.player === "" && assignment.opponent === "") {
      if (
        (
          teamTournamentSameValue(result.teamA, assignment.teamA) &&
          teamTournamentSameValue(result.teamB, assignment.teamB)
        ) ||
        (
          teamTournamentSameValue(result.teamA, assignment.teamB) &&
          teamTournamentSameValue(result.teamB, assignment.teamA)
        )
      )
        return result;
    }

    if (
      (
        teamTournamentSameValue(result.player, assignment.player) &&
        teamTournamentSameValue(result.opponent, assignment.opponent)
      ) ||
      (
        teamTournamentSameValue(result.player, assignment.opponent) &&
        teamTournamentSameValue(result.opponent, assignment.player)
      )
    )
      return result;
  }

  return null;

}

function parseTeamTournamentPlayerPairings(pairing) {

  return getTeamTournamentString(pairing.playerPairings)
    .split(/\n|;/)
    .map(function(line) {
      return parseTeamTournamentPlayerPairingLine(pairing, line);
    })
    .filter(function(assignment) {
      return assignment !== null;
    });

}

function parseTeamTournamentPlayerPairingLine(pairing, line) {

  const text =
    getTeamTournamentString(line);

  if (text === "")
    return null;

  const withoutTable =
    text.replace(/^\s*(table|tbl)\s*#?\s*\d+\s*[:.)-]?\s*/i, "");

  const tableMatch =
    text.match(/\b(?:table|tbl)\s*#?\s*(\d+)/i);

  const missionMatch =
    text.match(/\bmission\s*[:=-]\s*([^|,;]+)/i);

  const parts =
    withoutTable
      .replace(/\bmission\s*[:=-]\s*[^|,;]+/i, "")
      .split(/\s+vs\.?\s+|\s+v\.?\s+|\s+-\s+|\s+\u2014\s+/i)
      .map(getTeamTournamentString)
      .filter(function(part) {
        return part !== "";
      });

  if (parts.length < 2)
    return null;

  return {
    roundId: pairing.roundId,
    round: pairing.round,
    teamA: pairing.teamA,
    teamB: pairing.teamB,
    table: tableMatch ? tableMatch[1] : "",
    player: cleanTeamTournamentPlayerName(parts[0]),
    opponent: cleanTeamTournamentPlayerName(parts[1]),
    mission: missionMatch ? getTeamTournamentString(missionMatch[1]) : ""
  };

}

function cleanTeamTournamentPlayerName(value) {

  return getTeamTournamentString(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\btable\s*#?\s*\d+/ig, "")
    .replace(/\bmission\s*[:=-].*$/i, "")
    .trim();

}

function isTeamTournamentRoundActive(event, currentRound) {

  if (!currentRound)
    return false;

  const text =
    [
      event.status,
      event.lifecycleStage,
      getTeamTournamentRoundValue(currentRound, "status"),
      getTeamTournamentRoundValue(currentRound, "Status")
    ].join(" ").toLowerCase();

  if (
    text.indexOf("archived") !== -1 ||
    text.indexOf("completed") !== -1 ||
    text.indexOf("registration open") !== -1 ||
    text.indexOf("planning") !== -1
  )
    return false;

  return true;

}

function parseTeamTournamentSubmittedScore(value) {

  const parts =
    getTeamTournamentString(value).split("-");

  const left =
    Number(parts[0]);

  const right =
    Number(parts[1]);

  return {
    valid:
      parts.length === 2 &&
      Number.isFinite(left) &&
      Number.isFinite(right) &&
      left >= 0 &&
      right >= 0,
    left: left,
    right: right
  };

}

function determineTeamTournamentResultWinner(player, opponent, tp, op, vp) {

  if (!tp.valid || !op.valid || !vp.valid)
    return "";

  if (tp.left !== tp.right)
    return tp.left > tp.right ? player : opponent;

  if (op.left !== op.right)
    return op.left > op.right ? player : opponent;

  if (vp.left !== vp.right)
    return vp.left > vp.right ? player : opponent;

  return "Draw";

}

function getTeamTournamentRoundValue(round, key) {

  if (!round)
    return "";

  return getTeamTournamentString(round[key]);

}

function teamTournamentSameValue(left, right) {

  return getTeamTournamentString(left).toLowerCase() ===
    getTeamTournamentString(right).toLowerCase();

}

function ensureTeamTournamentSheets() {

  ensureTeamTournamentTeamsSheet();
  ensureTeamTournamentPairingsSheet();
  ensureTeamTournamentInvitationsSheet();

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

function getTeamTournamentRows(sheet) {

  if (!sheet)
    return [];

  return getEventEngineRows(sheet);

}

function getTeamTournamentRegistrationRows(eventId, sheet) {

  const target =
    getTeamTournamentString(eventId);

  return getTeamTournamentRows(sheet)
    .filter(function(row) {
      return row["Event ID"] === target;
    })
    .map(function(row) {
      return mapEventRegistrationRow(row);
    });

}

function getTeamTournamentRuntimeSheet(sheetName) {

  return getEventEngineRuntimeSheet(sheetName);

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
    right: Number(parts[1]) || 0,
    valid: parts.length === 2
  };

}

function teamTournamentScoreIsDraw(value) {

  const score =
    parseTeamTournamentScore(value);

  return score.valid && score.left === score.right;

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
