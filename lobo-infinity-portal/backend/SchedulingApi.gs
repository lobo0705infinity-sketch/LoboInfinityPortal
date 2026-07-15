/*******************************************************
 * LOBO INFINITY LEAGUE 4.0
 * SchedulingApi.gs
 *
 * Community scheduling, match finder, requests, and
 * calendar export derived from league identity.
 *******************************************************/

const SCHEDULING_REQUEST_HEADERS = [
  "ID",
  "From Player",
  "To Player",
  "Proposed Date",
  "Proposed Time",
  "Location",
  "Message",
  "Status",
  "Response Message",
  "Created At",
  "Updated At",
  "Event ID"
];

function getSchedulingCenter(e) {

  const auth =
    getRequestUser(e);
  const runtimeDiagnostics =
    createSchedulingRuntimeDiagnostics(e);

  if (!auth.authenticated)
    logSchedulingRuntimeDiagnostics(
      runtimeDiagnostics
    );

  if (!auth.authenticated)
    return jsonOutput({
      success: false,
      error: "Authentication is required.",
      schedulingRuntimeDiagnostics: runtimeDiagnostics
    });

  const context =
    buildEventSchedulingContext(e, auth);
  annotateSchedulingRuntimeContext(
    runtimeDiagnostics,
    context
  );

  if (!context.canSchedule)
    logSchedulingRuntimeDiagnostics(
      runtimeDiagnostics
    );

  if (!context.canSchedule)
    return jsonOutput({
      success: false,
      error: context.error || "Scheduling is not available for this event.",
      schedulingRuntimeDiagnostics: runtimeDiagnostics
    });

  const scheduling =
    buildEventSchedulingPayload(context);
  annotateSchedulingRuntimePayload(
    runtimeDiagnostics,
    scheduling
  );
  logSchedulingRuntimeDiagnostics(
    runtimeDiagnostics
  );

  return jsonOutput({
    success: true,
    scheduling:
      scheduling,
    schedulingRuntimeDiagnostics:
      runtimeDiagnostics
  });

}

function getMatchFinder(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const context =
    buildEventSchedulingContext(e, auth);

  if (!context.canSchedule)
    return jsonOutput({
      success: false,
      error: context.error || "Scheduling is not available for this event."
    });

  const payload =
    buildEventSchedulingPayload(context);

  return jsonOutput({
    success: true,
    matchFinder: {
      currentSeason: payload.currentSeason,
      player: payload.player,
      availability: payload.availability,
      recommendations: payload.recommendations,
      pendingRequests: payload.requests.pending,
      upcomingMatches: payload.requests.upcoming,
      progress: payload.progress
    }
  });

}

function updateSchedulingAvailability(e) {

  const startedAt =
    new Date();

  try {

    const auth =
      getRequestUser(e);

    if (!auth.authenticated)
      return jsonOutput({
        success: false,
        code: "SCHEDULING_AVAILABILITY_AUTH_FAILED",
        error: auth.error || "Authentication is required.",
        diagnostics: {
          stage: "leaguePlayerResolution",
          authenticated: Boolean(auth.authenticated),
          hasLeaguePlayer: Boolean(getCanonicalPlayerFromUser(auth.user)),
          elapsedMs: new Date().getTime() - startedAt.getTime()
        }
      });

    const context =
      buildEventSchedulingContext(e, auth);

    if (!context.canSchedule)
      return jsonOutput({
        success: false,
        code: "SCHEDULING_AVAILABILITY_AUTH_FAILED",
        error: context.error || "Scheduling is not available for this event.",
        diagnostics: {
          stage: "participantResolution",
          authenticated: Boolean(auth.authenticated),
          eventId: context.eventId,
          eventType: context.eventType,
          participantKey: context.participantKey,
          elapsedMs: new Date().getTime() - startedAt.getTime()
        }
      });

    const record =
      buildEventSchedulingAvailabilityRecordFromRequest(e, context);

    saveSeasonAvailabilityRecord(record);

    const saved =
      getSeasonAvailabilityForPlayer(
        getSeasonAvailabilityMap(),
        context.participantKey
      );

    const verified =
      getSchedulingKey(saved.player) === getSchedulingKey(record.player) &&
      getSchedulingString(saved.status) === getSchedulingString(record.status) &&
      getSchedulingString(saved.preferredDays) === getSchedulingString(record.preferredDays) &&
      getSchedulingString(saved.preferredTimes) === getSchedulingString(record.preferredTimes) &&
      getSchedulingString(saved.discordHandle) === getSchedulingString(record.discordHandle) &&
      getSchedulingString(saved.notes) === getSchedulingString(record.notes);

    if (!verified)
      return jsonOutput({
        success: false,
        code: "SCHEDULING_AVAILABILITY_VERIFY_FAILED",
        error: "Unable to verify saved availability.",
        diagnostics: {
          stage: "spreadsheetVerification",
          player: context.participantKey,
          expected: {
            status: record.status,
            preferredDays: record.preferredDays,
            preferredTimes: record.preferredTimes,
            discordHandle: record.discordHandle,
            notes: record.notes
          },
          actual: {
            status: saved.status,
            preferredDays: saved.preferredDays,
            preferredTimes: saved.preferredTimes,
            discordHandle: saved.discordHandle,
            notes: saved.notes
          },
          elapsedMs: new Date().getTime() - startedAt.getTime()
        }
      });

    invalidatePortalCacheGroup("seasonCommand");
    invalidatePortalCacheGroup("scheduling");

    return jsonOutput({
      success: true,
      scheduling:
        buildEventSchedulingPayload(context),
      diagnostics: {
        stage: "complete",
        player: context.participantKey,
        updatedAt: saved.updatedAt,
        elapsedMs: new Date().getTime() - startedAt.getTime()
      }
    });

  }
  catch (err) {
    return jsonOutput({
      success: false,
      code: "SCHEDULING_AVAILABILITY_EXCEPTION",
      error:
        err && err.message
          ? err.message
          : "Unable to save availability.",
      diagnostics: {
        stage: "exception",
        stack:
          err && err.stack
            ? String(err.stack).slice(0, 1200)
            : "",
        elapsedMs: new Date().getTime() - startedAt.getTime()
      }
    });
  }


}

function createSchedulingRequest(e) {

  const startedAt =
    new Date();

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
    return jsonOutput({
      success: false,
      code: "SCHEDULING_REQUEST_AUTH_FAILED",
      error: "Authentication is required.",
      diagnostics: {
        stage: "leaguePlayerResolution",
        authenticated: Boolean(auth.authenticated),
        hasLeaguePlayer: Boolean(getCanonicalPlayerFromUser(auth.user)),
        elapsedMs: new Date().getTime() - startedAt.getTime()
      }
    });

  const context =
    buildEventSchedulingContext(e, auth);

  if (!context.canSchedule)
    return jsonOutput({
      success: false,
      code: "SCHEDULING_REQUEST_AUTH_FAILED",
      error: context.error || "Scheduling is not available for this event.",
      diagnostics: {
        stage: "participantResolution",
        authenticated: Boolean(auth.authenticated),
        eventId: context.eventId,
        eventType: context.eventType,
        participantKey: context.participantKey,
        elapsedMs: new Date().getTime() - startedAt.getTime()
      }
    });

  const params =
    getApiParameters(e);

  const opponent =
    getSchedulingString(params.opponent);
  const proposedDate =
    getSchedulingString(params.proposedDate);
  const proposedTime =
    getSchedulingString(params.proposedTime);

  if (opponent === "" || proposedDate === "" || proposedTime === "")
    return jsonOutput({
      success: false,
      code: "SCHEDULING_REQUEST_VALIDATION_FAILED",
      error: "Opponent, date, and time are required.",
      diagnostics: {
        stage: "requestValidation",
        hasOpponent: opponent !== "",
        hasProposedDate: proposedDate !== "",
        hasProposedTime: proposedTime !== "",
        elapsedMs: new Date().getTime() - startedAt.getTime()
      }
    });

  const record = {
    id:
      "schedule-" +
      Utilities.getUuid(),
    fromPlayer:
      context.participantKey,
    toPlayer:
      opponent,
    proposedDate:
      proposedDate,
    proposedTime:
      proposedTime,
    location:
      "",
    message:
      getSchedulingString(params.message),
    status:
      "Pending",
    responseMessage:
      "",
    createdAt:
      getSchedulingTimestamp(),
    updatedAt:
      getSchedulingTimestamp(),
    eventId:
      context.eventId
  };

  saveSchedulingRequestRecord(record);

  const refreshedRequest =
    getSchedulingRequestsForPlayer(context.participantKey, record.eventId)
      .some(function(request) {
        return (
          getSchedulingKey(request.id) === getSchedulingKey(record.id) &&
          getSchedulingKey(request.fromPlayer) === getSchedulingKey(record.fromPlayer) &&
          getSchedulingKey(request.toPlayer) === getSchedulingKey(record.toPlayer)
        );
      });

  if (!refreshedRequest)
    return jsonOutput({
      success: false,
      code: "SCHEDULING_REQUEST_VERIFY_FAILED",
      error: "Unable to verify created scheduling request.",
      diagnostics: {
        stage: "spreadsheetVerification",
        requestId: record.id,
        player: context.participantKey,
        opponent: opponent,
        elapsedMs: new Date().getTime() - startedAt.getTime()
      }
    });

  invalidatePortalCacheGroup("scheduling");

  return getSchedulingCenter(e);

}

function respondSchedulingRequest(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const context =
    buildEventSchedulingContext(e, auth);

  if (!context.canSchedule)
    return jsonOutput({
      success: false,
      error: context.error || "Scheduling is not available for this event."
    });

  const params =
    getApiParameters(e);

  const requestId =
    getSchedulingString(params.requestId);

  const status =
    getSchedulingString(params.status);

  if (requestId === "" || status === "")
    return jsonOutput({
      success: false,
      error: "Request ID and status are required."
    });

  const result =
    updateSchedulingRequestStatus(
      requestId,
      context,
      status,
      getSchedulingString(params.responseMessage)
    );

  if (!result.success)
    return jsonOutput(result);

  invalidatePortalCacheGroup("scheduling");

  return getSchedulingCenter(e);

}

function getSchedulingCalendarExport(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
    return jsonOutput({
      success: false,
      error: "Authentication is required."
    });

  const context =
    buildEventSchedulingContext(e, auth);

  if (!context.canSchedule)
    return jsonOutput({
      success: false,
      error: context.error || "Scheduling is not available for this event."
    });

  const params =
    getApiParameters(e);

  const requestId =
    getSchedulingString(params.requestId);

  const request =
    getSchedulingRequests("all")
      .filter(function(item) {
        return item.id === requestId;
      })[0] || null;

  if (!request)
    return jsonOutput({
      success: false,
      error: "Scheduling request was not found."
    });

  return jsonOutput({
    success: true,
    calendar: {
      filename:
        request.id + ".ics",
      ics:
        buildSchedulingIcs(request)
    }
  });

}

function getCommissionerScheduling(e) {

  return requireApiPermission(e, "viewOperations", function() {
    const registry =
      buildPlayerRegistry();

    updateRegistryStatistics(registry);

    const games =
      getAllRecentGameObjects();

    const availability =
      getSeasonAvailabilityMap();

    const divisions = [
      CONFIG.DIVISIONS.MAIN_MAN,
      CONFIG.DIVISIONS.PGA,
      CONFIG.DIVISIONS.PGB
    ];

    return jsonOutput({
      success: true,
      scheduling: {
        divisions:
          divisions.map(function(division) {
            return buildCommissionerSchedulingDivision(
              registry,
              games,
              availability,
              division
            );
          }),
        requests:
          getSchedulingRequests(),
        generatedAt:
          getSchedulingTimestamp()
      }
    });
  });

}

function buildSchedulingPayload(playerName, user, eventId) {

  const resolvedEventId =
    getSchedulingResolvedEventId(eventId);

  const context =
    buildSeasonCommandContext(
      playerName,
      resolvedEventId
    );

  if (!context.player)
    return {
      error: "League player not found."
    };

  const seasonCommand =
    buildSeasonCommandPayload(context);

  const requests =
      getSchedulingRequestsForPlayer(
        playerName,
        resolvedEventId
      );

  const recommendations =
    buildSchedulingRecommendations(
      context,
      seasonCommand,
      requests
    );

  return {
    currentSeason:
      getSchedulingString(context.settings.currentSeason) ||
      "Current Season",
    eventId:
      resolvedEventId,
    event:
      typeof getEventByIdSnapshot === "function"
        ? getEventByIdSnapshot(resolvedEventId) ||
          getCurrentLeagueEventSnapshot()
        : null,
    player:
      seasonCommand.player,
    availability:
      seasonCommand.availability,
    progress:
      seasonCommand.progress,
    opponents:
      seasonCommand.opponents,
    completedOpponents:
      seasonCommand.opponents.filter(function(opponent) {
        return opponent.status === "Already Played";
      }),
    remainingOpponents:
      seasonCommand.opponents.filter(function(opponent) {
        return opponent.status !== "Already Played";
      }),
    recommendations:
      recommendations,
    requests:
      buildSchedulingRequestGroups(
        requests,
        playerName
      ),
    seasonProgress:
      buildSchedulingSeasonProgress(context),
    activity:
      buildSchedulingActivity(
        requests,
        resolvedEventId
      ),
    commissioner:
      buildCommissionerSeasonStatus(context),
    quickActions:
      buildSchedulingQuickActions(
        user,
        recommendations
      )
  };

}

function buildEventSchedulingContext(e, auth) {

  const eventId =
    getSchedulingEventId(e);

  const event =
    getSchedulingEvent(eventId);

  const eventType =
    getSchedulingString(event && event.type) || "League";

  const participantKey =
    eventType === "League"
      ? getSchedulingString(getCanonicalPlayerFromUser(auth.user))
      : getEventParticipantKey(event, auth.user);

  if (participantKey === "")
    return {
      auth: auth,
      canSchedule: false,
      error:
        eventType === "League"
          ? "League membership is required for this event."
          : "Registration is required for this event.",
      event: event,
      eventId: eventId,
      eventType: eventType,
      participantKey: ""
    };

  if (eventType !== "League") {
    const registration =
      getEventRegistrationForPlayer(
        eventId,
        participantKey
      );

    if (!registration)
      return {
        auth: auth,
        canSchedule: false,
        error: "Register for this event before using Match Finder.",
        event: event,
        eventId: eventId,
        eventType: eventType,
        participantKey: participantKey
      };
  }

  return {
    auth: auth,
    canSchedule: true,
    event: event,
    eventId: eventId,
    eventType: eventType,
    participantKey: participantKey
  };

}

function buildEventSchedulingPayload(context) {

  switch (context.eventType) {
    case "Team Tournament":
      return buildTeamTournamentSchedulingPayload(context);

    case "League":
      return buildSchedulingPayload(
        context.participantKey,
        context.auth.user,
        context.eventId
      );

    default:
      return buildGenericEventSchedulingPayload(context);
  }

}

function createSchedulingRuntimeDiagnostics(e) {

  const params =
    getApiParameters(e);

  return {
    requestAction:
      getSchedulingString(params.action),
    browserEventId:
      getSchedulingString(params.eventId),
    requestParameterEventId:
      getSchedulingString(params.eventId),
    resolvedEventId:
      "",
    eventId:
      "",
    eventType:
      "",
    eventName:
      "",
    dispatcherBranch:
      "",
    seasonLabel:
      "",
    returnedEventName:
      "",
    recommendedOpponentSource:
      "",
    progressSource:
      "",
    capturedAt:
      new Date().toISOString()
  };

}

function annotateSchedulingRuntimeContext(diagnostics, context) {

  if (!diagnostics || !context)
    return diagnostics;

  diagnostics.resolvedEventId =
    getSchedulingString(context.eventId);
  diagnostics.eventId =
    getSchedulingString(context.event && context.event.id);
  diagnostics.eventType =
    getSchedulingString(context.event && context.event.type);
  diagnostics.eventName =
    getSchedulingString(context.event && context.event.name);
  diagnostics.dispatcherBranch =
    getSchedulingDispatcherBranch(context);

  return diagnostics;

}

function annotateSchedulingRuntimePayload(diagnostics, scheduling) {

  if (!diagnostics || !scheduling)
    return diagnostics;

  diagnostics.seasonLabel =
    getSchedulingString(scheduling.currentSeason);
  diagnostics.returnedEventName =
    getSchedulingString(scheduling.event && scheduling.event.name);
  diagnostics.recommendedOpponentSource =
    getSchedulingRecommendationSource(scheduling);
  diagnostics.progressSource =
    getSchedulingProgressSource(scheduling);

  return diagnostics;

}

function getSchedulingDispatcherBranch(context) {

  switch (getSchedulingString(context && context.eventType)) {
    case "League":
      return "League";
    case "Team Tournament":
      return "Team Tournament";
    default:
      return "Generic Event";
  }

}

function getSchedulingRecommendationSource(scheduling) {

  const recommendation =
    scheduling.recommendations &&
    scheduling.recommendations.length
      ? scheduling.recommendations[0]
      : null;

  if (!recommendation)
    return "none";

  return getSchedulingString(recommendation.reason) ||
    getSchedulingString(recommendation.division) ||
    getSchedulingString(recommendation.eventId) ||
    "unknown";

}

function getSchedulingProgressSource(scheduling) {

  const progress =
    scheduling.progress || {};

  return [
    "completed=" + getSchedulingString(progress.gamesCompleted),
    "remaining=" + getSchedulingString(progress.gamesRemaining),
    "label=" + getSchedulingString(progress.label || progress.status)
  ].join("; ");

}

function logSchedulingRuntimeDiagnostics(diagnostics) {

  if (typeof console !== "undefined" && console.log)
    console.log(
      "LOBO SCHEDULING RUNTIME DIAGNOSTICS " +
      JSON.stringify(diagnostics)
    );

}

function getSchedulingEvent(eventId) {

  if (typeof validateEventEngineRuntime === "function") {
    const runtimeValidation =
      validateEventEngineRuntime();

    if (!runtimeValidation.initialized)
      return null;
  }

  return (
    typeof getEventByIdSnapshot === "function"
      ? getEventByIdSnapshot(eventId)
      : null
  ) || (
    typeof getCurrentLeagueEventSnapshot === "function"
      ? getCurrentLeagueEventSnapshot()
      : null
  );

}

function buildEventSchedulingAvailabilityRecordFromRequest(e, context) {

  const params =
    getApiParameters(e);

  return {
    player: context.participantKey,
    status:
      getSchedulingString(params.status) ||
      "Available",
    preferredDays:
      getSchedulingString(params.preferredDays),
    preferredTimes:
      getSchedulingString(params.preferredTimes),
    notes:
      getSchedulingString(params.notes),
    updatedAt:
      getSchedulingTimestamp(),
    monday:
      getSchedulingString(params.monday),
    tuesday:
      getSchedulingString(params.tuesday),
    wednesday:
      getSchedulingString(params.wednesday),
    thursday:
      getSchedulingString(params.thursday),
    friday:
      getSchedulingString(params.friday),
    saturday:
      getSchedulingString(params.saturday),
    sunday:
      getSchedulingString(params.sunday),
    homeStore:
      getSchedulingString(params.homeStore),
    city:
      getSchedulingString(params.city),
    maxTravelDistance:
      getSchedulingString(params.maxTravelDistance),
    preferredLocations:
      getSchedulingString(params.preferredLocations),
    discordHandle:
      getSchedulingString(params.discordHandle)
  };

}

function buildTeamTournamentSchedulingPayload(context) {

  const eventId =
    context.eventId;

  ensureTeamTournamentSheets();

  const event =
    context.event;

  const registrations =
    getEventRegistrationRows(eventId)
      .filter(function(registration) {
        return registration.status !== "Withdrawn";
      });

  const currentRegistration =
    getEventRegistrationForPlayer(
      eventId,
      context.participantKey
    );

  const teams =
    getTeamTournamentTeams(eventId)
      .filter(function(team) {
        return team.status !== "Deleted";
      });

  const pairings =
    getTeamTournamentPairings(eventId);

  const results =
    getTeamTournamentResults(eventId);

  const rounds =
    getEventEngineSnapshot()
      .rounds
      .filter(function(round) {
        return round.eventId === eventId;
      });

  const requests =
    getSchedulingRequestsForPlayer(
      context.participantKey,
      eventId
    );

  const availabilityMap =
    getSeasonAvailabilityMap();

  const playerTeam =
    findTeamTournamentSchedulingTeam(
      teams,
      currentRegistration,
      context.participantKey
    );

  const playerResults =
    results.filter(function(result) {
      return (
        result.status !== "Rejected" &&
        (
          getSchedulingKey(result.player) === getSchedulingKey(context.participantKey) ||
          getSchedulingKey(result.opponent) === getSchedulingKey(context.participantKey)
        )
      );
    });

  const recommendations =
    buildTeamTournamentSchedulingRecommendations(
      context,
      currentRegistration,
      playerTeam,
      teams,
      pairings,
      results,
      availabilityMap,
      requests
    );

  const opponents =
    recommendations.map(function(recommendation) {
      return {
        player: recommendation.player,
        displayName: recommendation.displayName,
        rank: recommendation.rank,
        games: recommendation.gamesCompleted,
        status:
          recommendation.gamesRemainingBetweenPlayers > 0
            ? "Tournament Pairing"
            : "Already Played",
        gamesRemainingBetweenPlayers:
          recommendation.gamesRemainingBetweenPlayers,
        gameId: 0,
        lastResult: "",
        availability: recommendation.availability,
        availabilitySummary: recommendation.availabilitySummary,
        preferredStore: recommendation.preferredStore,
        discordHandle: recommendation.discordHandle,
        profileLink: recommendation.profileLink,
        scheduleLink: recommendation.scheduleLink
      };
    });

  const completedOpponents =
    opponents.filter(function(opponent) {
      return opponent.gamesRemainingBetweenPlayers === 0;
    });

  const remainingOpponents =
    opponents.filter(function(opponent) {
      return opponent.gamesRemainingBetweenPlayers > 0;
    });

  const gamesRequired =
    Math.max(
      1,
      recommendations.length
    );

  const gamesCompleted =
    playerResults.length;

  return {
    currentSeason:
      getSchedulingString(event.name) ||
      "Team Tournament",
    eventId:
      eventId,
    event:
      event,
    player:
      {
        player: context.participantKey,
        displayName:
          currentRegistration
            ? currentRegistration.displayName || currentRegistration.player
            : context.auth.user.displayName || context.participantKey,
        division:
          playerTeam
            ? playerTeam.teamName
            : "Team Tournament",
        rank:
          0,
        games:
          gamesCompleted,
        wins:
          countTeamTournamentPlayerWins(context.participantKey, playerResults),
        losses:
          countTeamTournamentPlayerLosses(context.participantKey, playerResults),
        tp:
          0,
        op:
          0,
        vp:
          0
      },
    availability:
      getSeasonAvailabilityForPlayer(
        availabilityMap,
        context.participantKey
      ),
    progress:
      {
        gamesRequired: gamesRequired,
        gamesCompleted: gamesCompleted,
        gamesRemaining: Math.max(0, gamesRequired - gamesCompleted),
        opponentsCompleted: completedOpponents.length,
        opponentsRemaining: remainingOpponents.length,
        midseasonProgress:
          getSeasonCommandPercent(
            gamesCompleted,
            Math.ceil(gamesRequired / 2)
          ),
        seasonProgress:
          getSeasonCommandPercent(
            gamesCompleted,
            gamesRequired
          ),
        completionPercentage:
          getSeasonCommandPercent(
            gamesCompleted,
            gamesRequired
          )
      },
    opponents:
      opponents,
    completedOpponents:
      completedOpponents,
    remainingOpponents:
      remainingOpponents,
    recommendations:
      recommendations,
    requests:
      buildSchedulingRequestGroups(
        requests,
        context.participantKey
      ),
    seasonProgress:
      buildTeamTournamentSchedulingProgress(
        registrations,
        teams,
        pairings,
        results
      ),
    activity:
      buildTeamTournamentSchedulingActivity(
        eventId,
        pairings,
        results,
        requests
      ),
    commissioner:
      buildTeamTournamentSchedulingCommissioner(
        registrations,
        teams,
        pairings,
        results
      ),
    quickActions:
      buildTeamTournamentSchedulingQuickActions(
        eventId,
        recommendations
      ),
    rounds:
      rounds
  };

}

function buildGenericEventSchedulingPayload(context) {

  const availabilityMap =
    getSeasonAvailabilityMap();

  const requests =
    getSchedulingRequestsForPlayer(
      context.participantKey,
      context.eventId
    );

  return {
    currentSeason:
      getSchedulingString(context.event && context.event.name) ||
      getSchedulingString(context.eventType) ||
      "Event",
    eventId:
      context.eventId,
    event:
      context.event,
    player:
      {
        player: context.participantKey,
        displayName:
          context.auth.user.displayName || context.participantKey,
        division:
          context.eventType,
        rank: 0,
        games: 0,
        wins: 0,
        losses: 0,
        tp: 0,
        op: 0,
        vp: 0
      },
    availability:
      getSeasonAvailabilityForPlayer(
        availabilityMap,
        context.participantKey
      ),
    progress:
      {
        gamesRequired: 0,
        gamesCompleted: 0,
        gamesRemaining: 0,
        opponentsCompleted: 0,
        opponentsRemaining: 0,
        midseasonProgress: 0,
        seasonProgress: 0,
        completionPercentage: 0
      },
    opponents: [],
    completedOpponents: [],
    remainingOpponents: [],
    recommendations: [],
    requests:
      buildSchedulingRequestGroups(
        requests,
        context.participantKey
      ),
    seasonProgress:
      {
        player: {},
        division: {
          players: 0,
          gamesCompleted: 0,
          gamesRemaining: 0,
          completionPercentage: 0
        },
        league: []
      },
    activity:
      buildSchedulingActivity(
        requests,
        context.eventId
      ),
    commissioner:
      {
        division: context.eventType,
        finished: 0,
        behind: 0,
        missingPairings: 0,
        latePlayers: []
      },
    quickActions:
      [
        {
          label: "Update Availability",
          link:
            "/match-finder?eventId=" +
            encodeURIComponent(context.eventId) +
            "#availability"
        }
      ]
  };

}

function findTeamTournamentSchedulingTeam(teams, registration, participantKey) {

  const key =
    getSchedulingKey(participantKey);

  const preferredTeam =
    registration
      ? getSchedulingString(registration.team || registration.preferredTeam)
      : "";

  if (preferredTeam !== "") {
    const namedTeam =
      teams.filter(function(team) {
        return getSchedulingKey(team.teamName) === getSchedulingKey(preferredTeam);
      })[0] || null;

    if (namedTeam)
      return namedTeam;
  }

  return teams.filter(function(team) {
    return splitTeamTournamentPlayers(team.players)
      .some(function(player) {
        return getSchedulingKey(player) === key;
      });
  })[0] || null;

}

function buildTeamTournamentSchedulingRecommendations(
  context,
  currentRegistration,
  playerTeam,
  teams,
  pairings,
  results,
  availabilityMap,
  requests
) {

  if (!currentRegistration)
    return [];

  const pendingLookup = {};

  requests.forEach(function(request) {
    if (request.status !== "Pending" && request.status !== "Suggested")
      return;

    const other =
      getSchedulingKey(request.fromPlayer) === getSchedulingKey(context.participantKey)
        ? request.toPlayer
        : request.fromPlayer;

    pendingLookup[getSchedulingKey(other)] = true;
  });

  const opponentPlayers =
    getTeamTournamentSchedulingOpponents(
      context.participantKey,
      playerTeam,
      teams,
      pairings,
      results
    );

  return opponentPlayers
    .map(function(opponent, index) {
      const availability =
        getSeasonAvailabilityForPlayer(
          availabilityMap,
          opponent.player
        );

      const overlap =
        getAvailabilityOverlap(
          availabilityMap,
          context.participantKey,
          opponent.player
        );

      const pending =
        pendingLookup[getSchedulingKey(opponent.player)];

      const score =
        Math.max(
          0,
          Math.min(
            100,
            55 +
              (opponent.scheduled ? 25 : 0) +
              (overlap ? 15 : 0) -
              (pending ? 25 : 0)
          )
        );

      return {
        player: opponent.player,
        displayName: opponent.displayName || opponent.player,
        division: opponent.teamName || "Team Tournament",
        rank: index + 1,
        gamesCompleted: opponent.completed ? 1 : 0,
        gamesRemainingBetweenPlayers: opponent.completed ? 0 : 1,
        availability: availability,
        availabilitySummary: buildSeasonAvailabilitySummary(availability),
        preferredStore: availability.homeStore,
        discordHandle: availability.discordHandle,
        profileLink:
          "/players/" + encodeURIComponent(opponent.player),
        scheduleLink:
          "/match-finder?eventId=" +
          encodeURIComponent(context.eventId) +
          "&opponent=" +
          encodeURIComponent(opponent.player),
        score: score,
        priority:
          score >= 80
            ? "High"
            : score >= 55
              ? "Recommended"
              : "Normal",
        reason:
          buildTeamTournamentSchedulingReason(
            opponent,
            overlap,
            pending
          )
      };
    })
    .sort(function(left, right) {
      return right.score - left.score || left.rank - right.rank;
    });

}

function getTeamTournamentSchedulingOpponents(
  participantKey,
  playerTeam,
  teams,
  pairings,
  results
) {

  if (!playerTeam)
    return [];

  const currentTeamName =
    getSchedulingString(playerTeam.teamName);

  const relevantPairings =
    pairings.filter(function(pairing) {
      return (
        pairing.teamA === currentTeamName ||
        pairing.teamB === currentTeamName
      );
    });

  const opponentTeamNames = {};

  relevantPairings.forEach(function(pairing) {
    const opponentTeam =
      pairing.teamA === currentTeamName
        ? pairing.teamB
        : pairing.teamA;

    if (opponentTeam)
      opponentTeamNames[opponentTeam] = true;
  });

  const opponentTeams =
    teams.filter(function(team) {
      return opponentTeamNames[team.teamName] === true;
    });

  const completedLookup = {};

  results
    .filter(function(result) {
      return result.status !== "Rejected";
    })
    .forEach(function(result) {
      completedLookup[
        getSchedulingKey(result.player) +
        "|" +
        getSchedulingKey(result.opponent)
      ] = true;
      completedLookup[
        getSchedulingKey(result.opponent) +
        "|" +
        getSchedulingKey(result.player)
      ] = true;
    });

  const opponents = [];
  const seen = {};

  opponentTeams.forEach(function(team) {
    splitTeamTournamentPlayers(team.players)
      .forEach(function(player) {
        const key =
          getSchedulingKey(player);

        if (
          key === "" ||
          key === getSchedulingKey(participantKey) ||
          seen[key]
        )
          return;

        seen[key] = true;

        opponents.push({
          player: player,
          displayName: player,
          teamName: team.teamName,
          scheduled: true,
          completed:
            completedLookup[
              getSchedulingKey(participantKey) +
              "|" +
              key
            ] === true
        });
      });
  });

  return opponents;

}

function buildTeamTournamentSchedulingReason(opponent, overlap, pending) {

  if (pending)
    return "A tournament scheduling request is already pending.";

  if (overlap)
    return "Tournament pairing with overlapping availability.";

  if (opponent.scheduled)
    return "Scheduled Team Tournament opponent.";

  return "Eligible Team Tournament opponent.";

}

function countTeamTournamentPlayerWins(participantKey, results) {

  return results.filter(function(result) {
    return getSchedulingKey(result.winner) === getSchedulingKey(participantKey);
  }).length;

}

function countTeamTournamentPlayerLosses(participantKey, results) {

  return results.filter(function(result) {
    return (
      (
        getSchedulingKey(result.player) === getSchedulingKey(participantKey) ||
        getSchedulingKey(result.opponent) === getSchedulingKey(participantKey)
      ) &&
      getSchedulingKey(result.winner) !== "" &&
      getSchedulingKey(result.winner) !== getSchedulingKey(participantKey)
    );
  }).length;

}

function buildTeamTournamentSchedulingProgress(registrations, teams, pairings, results) {

  const activeResults =
    results.filter(function(result) {
      return result.status !== "Rejected";
    });

  const required =
    Math.max(1, pairings.length * 5);

  return {
    player: {},
    division: {
      players: registrations.length,
      gamesCompleted: activeResults.length,
      gamesRemaining: Math.max(0, required - activeResults.length),
      completionPercentage:
        getSeasonCommandPercent(activeResults.length, required)
    },
    league: [
      {
        players: teams.length,
        gamesCompleted: activeResults.length,
        gamesRemaining: Math.max(0, required - activeResults.length),
        completionPercentage:
          getSeasonCommandPercent(activeResults.length, required)
      }
    ]
  };

}

function buildTeamTournamentSchedulingActivity(eventId, pairings, results, requests) {

  const requestActivity =
    requests.map(function(request) {
      return {
        type: "Scheduling",
        title: request.status + " tournament request",
        body:
          request.fromPlayer +
          " -> " +
          request.toPlayer +
          " on " +
          request.proposedDate +
          " at " +
          request.proposedTime,
        timestamp: request.updatedAt || request.createdAt,
        link:
          "/match-finder?eventId=" +
          encodeURIComponent(eventId)
      };
    });

  const pairingActivity =
    pairings.map(function(pairing) {
      return {
        type: "Pairing",
        title: pairing.round || "Tournament pairing",
        body: pairing.teamA + " vs " + pairing.teamB,
        timestamp: pairing.updatedAt || pairing.createdAt,
        link:
          "/event/" +
          encodeURIComponent(eventId) +
          "/tournament#team-tournament-pairings"
      };
    });

  const resultActivity =
    results
      .filter(function(result) {
        return result.status !== "Rejected";
      })
      .map(function(result) {
        return {
          type: "Result",
          title:
            (result.winner || result.player) +
            " submitted a tournament result",
          body:
            result.player +
            " vs " +
            result.opponent,
          timestamp: result.updatedAt || result.createdAt,
          link:
            "/event/" +
            encodeURIComponent(eventId) +
            "/tournament#team-tournament-results"
        };
      });

  return requestActivity
    .concat(pairingActivity)
    .concat(resultActivity)
    .sort(function(left, right) {
      return getSchedulingDateValue(right.timestamp) - getSchedulingDateValue(left.timestamp);
    })
    .slice(0, 10);

}

function buildTeamTournamentSchedulingCommissioner(registrations, teams, pairings, results) {

  const activeResults =
    results.filter(function(result) {
      return result.status !== "Rejected";
    });

  return {
    division: "Team Tournament",
    finished: activeResults.length,
    behind: Math.max(0, pairings.length * 5 - activeResults.length),
    missingPairings:
      pairings.length === 0
        ? Math.max(1, teams.length > 1 ? 1 : 0)
        : 0,
    latePlayers: []
  };

}

function buildTeamTournamentSchedulingQuickActions(eventId, recommendations) {

  const actions = [
    {
      label: "Update Availability",
      link:
        "/match-finder?eventId=" +
        encodeURIComponent(eventId) +
        "#availability"
    },
    {
      label: "Tournament Home",
      link:
        "/event/" +
        encodeURIComponent(eventId) +
        "/tournament"
    },
    {
      label: "Submit Game",
      link:
        "/submit-game?eventId=" +
        encodeURIComponent(eventId) +
        "&gameType=event"
    }
  ];

  if (recommendations[0])
    actions.unshift({
      label:
        "Schedule " +
        recommendations[0].displayName,
      link:
        "/match-finder?eventId=" +
        encodeURIComponent(eventId) +
        "&opponent=" +
        encodeURIComponent(recommendations[0].player)
    });

  return actions;

}

function buildSchedulingRecommendations(context, seasonCommand, requests) {

  const pendingLookup = {};

  requests.forEach(function(request) {
    if (request.status !== "Pending" && request.status !== "Suggested")
      return;

    const other =
      getSchedulingKey(request.fromPlayer) === getSchedulingKey(context.player.player)
        ? request.toPlayer
        : request.fromPlayer;

    pendingLookup[getSchedulingKey(other)] = true;
  });

  return seasonCommand.opponents
    .filter(function(opponent) {
      return opponent.status !== "Already Played";
    })
    .map(function(opponent) {
      const overlap =
        getAvailabilityOverlap(
          context.availability,
          context.player.player,
          opponent.player
        );

      const score =
        getSchedulingRecommendationScore(
          context,
          opponent,
          overlap,
          pendingLookup[getSchedulingKey(opponent.player)]
        );

      return {
        player: opponent.player,
        displayName: opponent.displayName,
        division: context.player.division,
        rank: opponent.rank,
        gamesCompleted: opponent.games,
        gamesRemainingBetweenPlayers: opponent.gamesRemainingBetweenPlayers,
        availability: opponent.availability,
        availabilitySummary: opponent.availabilitySummary,
        preferredStore: opponent.preferredStore,
        discordHandle: opponent.discordHandle,
        profileLink: opponent.profileLink,
        scheduleLink: opponent.scheduleLink,
        score: score,
        priority:
          score >= 80
            ? "High"
            : score >= 55
              ? "Recommended"
              : "Normal",
        reason:
          buildSchedulingRecommendationReason(
            context,
            opponent,
            overlap,
            pendingLookup[getSchedulingKey(opponent.player)]
          )
      };
    })
    .sort(function(a, b) {
      return b.score - a.score || a.rank - b.rank;
    });

}

function getSchedulingRecommendationScore(context, opponent, overlap, pending) {

  let score = 40;

  if (overlap)
    score += 30;

  if (opponent.games < context.standing.games)
    score += 15;

  if (pending)
    score -= 25;

  return Math.max(0, Math.min(100, score));

}

function buildSchedulingRecommendationReason(context, opponent, overlap, pending) {

  if (pending)
    return "A scheduling request is already pending.";

  if (overlap)
    return (
      "You and " +
      opponent.displayName +
      " have overlapping availability. This is a high-priority remaining league match."
    );

  if (opponent.games < context.standing.games)
    return (
      opponent.displayName +
      " needs games and is a useful next scheduling target."
    );

  return "Remaining required division pairing.";

}

function buildSchedulingRequestGroups(requests, playerName) {

  const key =
    getSchedulingKey(playerName);

  return {
    incoming:
      requests.filter(function(request) {
        return getSchedulingKey(request.toPlayer) === key && request.status === "Pending";
      }),
    outgoing:
      requests.filter(function(request) {
        return getSchedulingKey(request.fromPlayer) === key && request.status === "Pending";
      }),
    pending:
      requests.filter(function(request) {
        return request.status === "Pending" || request.status === "Suggested";
      }),
    upcoming:
      requests.filter(function(request) {
        return request.status === "Accepted";
      }),
    history:
      requests.filter(function(request) {
        return request.status !== "Pending";
      })
  };

}

function buildSchedulingSeasonProgress(context) {

  const divisions = [
    CONFIG.DIVISIONS.MAIN_MAN,
    CONFIG.DIVISIONS.PGA,
    CONFIG.DIVISIONS.PGB
  ];

  const leagueRegistry =
    buildPlayerRegistry();

  updateRegistryStatistics(
    leagueRegistry,
    context.eventId
  );

  return {
    player:
      context.standing,
    division:
      buildSchedulingDivisionProgress(
        context.standings
      ),
    league:
      divisions.map(function(division) {
        return buildSchedulingDivisionProgress(
          buildSeasonDivisionStandings(
            leagueRegistry,
            division
          )
        );
      })
  };

}

function buildSchedulingDivisionProgress(rows) {

  const required =
    Math.max(
      SEASON_COMMAND_TARGET_GAMES,
      rows.length - 1
    );

  const completed =
    rows.reduce(function(total, row) {
      return total + (Number(row.games) || 0);
    }, 0);

  const total =
    rows.length * required;

  return {
    players: rows.length,
    gamesCompleted: completed,
    gamesRemaining: Math.max(0, total - completed),
    completionPercentage:
      total === 0
        ? 0
        : Math.round((completed / total) * 100)
  };

}

function buildSchedulingActivity(requests, eventId) {

  const requestActivity =
    requests
      .slice()
      .sort(function(a, b) {
        return getSchedulingDateValue(b.updatedAt) - getSchedulingDateValue(a.updatedAt);
      })
      .slice(0, 8)
      .map(function(request) {
        return {
          type: "Scheduling",
          title:
            request.status + " match request",
          body:
            request.fromPlayer +
            " -> " +
            request.toPlayer +
            " on " +
            request.proposedDate +
            " at " +
            request.proposedTime,
          timestamp:
            request.updatedAt,
          link:
            "/match-finder"
        };
      });

  const games =
    (
      typeof getAllRecentGameObjectsForEvent === "function"
        ? getAllRecentGameObjectsForEvent(eventId)
        : getAllRecentGameObjects()
    )
      .slice(0, 5)
      .map(function(game) {
        return {
          type: "Game Submitted",
          title:
            game.winner +
            " defeated " +
            game.loser,
          body:
            game.mission,
          timestamp:
            game.date,
          link:
            "/games/" + game.id
        };
      });

  return requestActivity.concat(games)
    .sort(function(a, b) {
      return getSchedulingDateValue(b.timestamp) - getSchedulingDateValue(a.timestamp);
    })
    .slice(0, 10);

}

function buildSchedulingQuickActions(user, recommendations) {

  const actions = [
    {
      label: "Update Availability",
      link: "/match-finder#availability"
    },
    {
      label: "View Standings",
      link: "/standings"
    },
    {
      label: "My Profile",
      link: "/profile"
    }
  ];

  if (recommendations[0])
    actions.unshift({
      label:
        "Schedule " +
        recommendations[0].displayName,
      link:
        "/match-finder?opponent=" +
        encodeURIComponent(recommendations[0].player)
    });

  return actions;

}

function buildCommissionerSchedulingDivision(registry, games, availability, division) {

  const standings =
    buildSeasonDivisionStandings(
      registry,
      division
    );

  const context = {
    availability: availability,
    games: games,
    player: standings[0] || null,
    standing: standings[0] || {},
    standings: standings
  };

  const missing =
    context.player
      ? buildMissingDivisionPairings(context)
      : [];

  return {
    division: division,
    progress:
      buildSchedulingDivisionProgress(standings),
    playersBehind:
      standings.filter(function(row) {
        return row.games < Math.ceil(SEASON_COMMAND_TARGET_GAMES / 2);
      }),
    inactivePlayers:
      standings.filter(function(row) {
        const record =
          getSeasonAvailabilityForPlayer(availability, row.player);

        return record.status === "Not Set" && row.games === 0;
      }),
    outstandingMatchups:
      missing,
    suggestedReminderRecipients:
      standings
        .filter(function(row) {
          return row.games < Math.ceil(SEASON_COMMAND_TARGET_GAMES / 2);
        })
        .map(function(row) {
          return {
            player: row.player,
            displayName: row.displayName,
            games: row.games,
            profileLink: "/players/" + encodeURIComponent(row.player)
          };
        })
  };

}

function getSchedulingRequestsForPlayer(playerName, eventId) {

  const key =
    getSchedulingKey(playerName);

  return getSchedulingRequests(eventId)
    .filter(function(request) {
      return (
        getSchedulingKey(request.fromPlayer) === key ||
        getSchedulingKey(request.toPlayer) === key
      );
    });

}

function getSchedulingRequests(eventId) {

  const resolvedEventId =
    getSchedulingResolvedEventId(eventId);

  const sheet =
    ensureSchedulingRequestsSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  return values
    .slice(1)
    .filter(function(row) {
      return getSchedulingString(row[0]) !== "";
    })
    .map(function(row) {
      return {
        id: getSchedulingString(row[0]),
        fromPlayer: getSchedulingString(row[1]),
        toPlayer: getSchedulingString(row[2]),
        proposedDate: getSchedulingString(row[3]),
        proposedTime: getSchedulingString(row[4]),
        location: getSchedulingString(row[5]),
        message: getSchedulingString(row[6]),
        status: getSchedulingString(row[7]) || "Pending",
        responseMessage: getSchedulingString(row[8]),
        createdAt: getSchedulingString(row[9]),
        updatedAt: getSchedulingString(row[10]),
        eventId:
          getSchedulingString(row[11]) ||
          EVENT_ENGINE_DEFAULT_EVENT_ID
      };
    })
    .filter(function(request) {
      return (
        resolvedEventId === "all" ||
        resolvedEventId === "lifetime" ||
        request.eventId === resolvedEventId
      );
    });

}

function saveSchedulingRequestRecord(record) {

  const sheet =
    ensureSchedulingRequestsSheet();

  sheet.appendRow([
    record.id,
    record.fromPlayer,
    record.toPlayer,
    record.proposedDate,
    record.proposedTime,
    record.location,
    record.message,
    record.status,
    record.responseMessage,
    record.createdAt,
    record.updatedAt,
    record.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID
  ]);

}

function updateSchedulingRequestStatus(requestId, context, status, responseMessage) {

  const sheet =
    ensureSchedulingRequestsSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  const normalizedId =
    getSchedulingKey(requestId);

  const normalizedStatus =
    getSchedulingStatus(status);

  for (let index = 1; index < values.length; index++) {
    if (getSchedulingKey(values[index][0]) !== normalizedId)
      continue;

    const fromPlayer =
      getSchedulingString(values[index][1]);

    const toPlayer =
      getSchedulingString(values[index][2]);

    const isParticipant =
      getSchedulingKey(context.participantKey) === getSchedulingKey(fromPlayer) ||
      getSchedulingKey(context.participantKey) === getSchedulingKey(toPlayer);

    const canManage =
      userHasPermission(context.auth.user.role, "viewOperations");

    if (!isParticipant && !canManage)
      return {
        success: false,
        error: "You do not have permission to update this request."
      };

    sheet
      .getRange(index + 1, 8, 1, 4)
      .setValues([[
        normalizedStatus,
        responseMessage,
        getSchedulingString(values[index][9]),
        getSchedulingTimestamp()
      ]]);

    return {
      success: true
    };
  }

  return {
    success: false,
    error: "Scheduling request was not found."
  };

}

function ensureSchedulingRequestsSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.SCHEDULING_REQUESTS
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.SCHEDULING_REQUESTS
      );

  const headerRange =
    sheet.getRange(1, 1, 1, SCHEDULING_REQUEST_HEADERS.length);

  const headers =
    headerRange.getValues()[0];

  const matches =
    SCHEDULING_REQUEST_HEADERS.every(function(header, index) {
      return headers[index] === header;
    });

  if (!matches)
    headerRange.setValues([SCHEDULING_REQUEST_HEADERS]);

  return sheet;

}

function addSchedulingNotifications(notifications, user) {
  const canonicalPlayer =
    getCanonicalPlayerFromUser(user);

  if (!user || !canonicalPlayer)
    return;

  getSchedulingRequestsForPlayer(canonicalPlayer)
    .filter(function(request) {
      return request.status === "Pending" || request.status === "Accepted" || request.status === "Declined" || request.status === "Suggested";
    })
    .slice(0, 8)
    .forEach(function(request) {
      const incoming =
        getSchedulingKey(request.toPlayer) === getSchedulingKey(canonicalPlayer);

      notifications.push(
        buildLeagueNotification({
          id:
            "schedule-" +
            request.id +
            "-" +
            request.status,
          type: "Scheduling",
          title:
            incoming
              ? "Match request from " + request.fromPlayer
              : "Match request " + request.status,
          body:
            request.proposedDate +
            " " +
            request.proposedTime,
          timestamp:
            request.updatedAt || request.createdAt,
          link:
            "/match-finder",
          priority:
            request.status === "Pending"
              ? "high"
              : "normal"
        })
      );
    });

}

function buildSchedulingIcs(request) {

  const dateText =
    request.proposedDate.replace(/-/g, "");

  const timeText =
    getSchedulingString(request.proposedTime).replace(/[^0-9]/g, "");

  const start =
    dateText +
    "T" +
    (timeText.length >= 4 ? timeText.slice(0, 4) : "1900") +
    "00";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lobo Infinity League//Scheduling//EN",
    "BEGIN:VEVENT",
    "UID:" + request.id + "@lobo-infinity",
    "DTSTAMP:" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd'T'HHmmss'Z'"),
    "DTSTART:" + start,
    "SUMMARY:Lobo League Match: " + request.fromPlayer + " vs " + request.toPlayer,
    "LOCATION:Online",
    "DESCRIPTION:" + request.message,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

}

function getSchedulingStatus(status) {

  const text =
    getSchedulingString(status)
      .toLowerCase();

  if (text === "accepted")
    return "Accepted";

  if (text === "declined")
    return "Declined";

  if (text === "suggested")
    return "Suggested";

  return "Pending";

}

function getSchedulingDateValue(value) {

  const parsed =
    new Date(value);

  return isNaN(parsed.getTime())
    ? 0
    : parsed.getTime();

}

function getSchedulingTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}

function getSchedulingEventId(e) {

  const params =
    getApiParameters(e);

  return getSchedulingResolvedEventId(
    params.eventId
  );

}

function getSchedulingResolvedEventId(eventId) {

  if (typeof resolveLeagueEventScope === "function")
    return resolveLeagueEventScope(eventId);

  return getSchedulingString(eventId) || EVENT_ENGINE_DEFAULT_EVENT_ID;

}

function getSchedulingKey(value) {

  return getSchedulingString(value)
    .toLowerCase();

}

function getSchedulingString(value) {

  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  ).trim();

}
