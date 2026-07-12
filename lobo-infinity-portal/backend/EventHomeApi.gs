/*******************************************************
 * LOBO INFINITY LEAGUE 6.0.3
 * EventHomeApi.gs
 *
 * Event Engine-owned Event Home experience.
 *******************************************************/

var EVENT_HOME_FORENSIC_CONTEXT = null;

function getEventHome(e) {

  ensureEventHomePipelineContext();

  resetEventHomeForensicMetrics();

  const totalStart =
    startEventHomeSubStage(
      "eventHome.total"
    );

  const paramsStart =
    startEventHomeSubStage(
      "eventHome.requestParameters"
    );

  const params =
    getApiParameters(e);

  const eventId =
    resolveEventId(params.eventId || EVENT_ENGINE_DEFAULT_EVENT_ID);

  endEventHomeSubStage(
    "eventHome.requestParameters",
    paramsStart,
    {
      eventId: eventId
    }
  );

  const runtimeValidationStart =
    startEventHomeSubStage(
      "eventHome.runtimeValidation.eventEngine"
    );

  const runtimeValidation =
    measureEventHomeOperation(
      "eventHome.runtimeValidation.eventEngine.validate",
      function() {
        return validateEventEngineRuntime();
      },
      {}
    );

  endEventHomeSubStage(
    "eventHome.runtimeValidation.eventEngine",
    runtimeValidationStart,
    runtimeValidation
  );

  if (!runtimeValidation.initialized)
    return returnEventHomeResponse(
      buildEventEngineInitializationRequiredResponse(runtimeValidation),
      totalStart,
      {
        eventId: eventId,
        initializationRequired: true
      }
    );

  const eventLookupStart =
    startEventHomeSubStage(
      "eventHome.eventLookup"
    );

  const event =
    measureEventHomeOperation(
      "eventHome.eventLookup.synthetic",
      function() {
        return getEventHomeSyntheticEvent(eventId);
      },
      {
        eventId: eventId
      }
    ) ||
    measureEventHomeOperation(
      "eventHome.eventLookup.byIdSnapshot",
      function() {
        return getEventByIdSnapshot(eventId);
      },
      {
        eventId: eventId
      }
    ) ||
    measureEventHomeOperation(
      "eventHome.eventLookup.currentLeagueFallback",
      function() {
        return getCurrentLeagueEventSnapshot();
      },
      {}
    );

  endEventHomeSubStage(
    "eventHome.eventLookup",
    eventLookupStart,
    {
      eventId: event.id,
      eventType: event.type
    }
  );

  const lifecycleStart =
    startEventHomeSubStage(
      "eventHome.eventLifecycleLoading.rounds"
    );

  const rounds =
    measureEventHomeOperation(
      "eventHome.eventLifecycleLoading.rounds.snapshotAndFilter",
      function() {
        return getEventEngineSnapshot()
          .rounds
          .filter(function(round) {
            return measureEventHomeLoopIteration(
              "eventHome.loop.rounds.filter",
              function() {
                return round.eventId === event.id;
              }
            );
          });
      },
      {
        eventId: event.id
      }
    );

  endEventHomeSubStage(
    "eventHome.eventLifecycleLoading.rounds",
    lifecycleStart,
    {
      rounds: rounds.length
    }
  );

  const currentRoundStart =
    startEventHomeSubStage(
      "eventHome.eventLifecycleLoading.currentRound"
    );

  const currentRound =
    measureEventHomeOperation(
      "eventHome.eventLifecycleLoading.currentRound.sort",
      function() {
        return getEventHomeCurrentRound(rounds);
      },
      {
        rounds: rounds.length
      }
    );

  endEventHomeSubStage(
    "eventHome.eventLifecycleLoading.currentRound",
    currentRoundStart,
    {
      currentRound: currentRound ? currentRound.id || currentRound.name : ""
    }
  );

  const participantsStart =
    startEventHomeSubStage(
      "eventHome.participantLoading.registrations"
    );

  const registrations =
    measureEventHomeOperation(
      "eventHome.participantLoading.registrations.getRows",
      function() {
        return getEventRegistrationRows(event.id);
      },
      {
        eventId: event.id
      }
    );

  endEventHomeSubStage(
    "eventHome.participantLoading.registrations",
    participantsStart,
    {
      registrations: registrations.length
    }
  );

  const authStart =
    startEventHomeSubStage(
      "eventHome.authContext.getRequestUser"
    );

  const auth =
    measureEventHomeOperation(
      "eventHome.authContext.getRequestUser.call",
      function() {
        return getRequestUser(e);
      },
      {}
    );

  endEventHomeSubStage(
    "eventHome.authContext.getRequestUser",
    authStart,
    {
      authenticated: auth.authenticated
    }
  );

  const currentPlayerStart =
    startEventHomeSubStage(
      "eventHome.participantLoading.currentPlayer"
    );

  const currentPlayer =
    measureEventHomeOperation(
      "eventHome.participantLoading.currentPlayer.lookup",
      function() {
        return auth.authenticated
          ? getEventRegistrationForPlayer(
              event.id,
              getEventParticipantKey(event, auth.user)
            )
          : null;
      },
      {
        authenticated: auth.authenticated,
        player:
          auth.authenticated && auth.user
            ? getEventParticipantKey(event, auth.user)
            : ""
      }
    );

  endEventHomeSubStage(
    "eventHome.participantLoading.currentPlayer",
    currentPlayerStart,
    {
      authenticated: auth.authenticated,
      found: currentPlayer !== null
    }
  );

  const standingsStart =
    startEventHomeSubStage(
      "eventHome.standingsLoading.recentGames"
    );

  const games =
    measureEventHomeOperation(
      "eventHome.standingsLoading.recentGames.getAllForEvent",
      function() {
        return getAllRecentGameObjectsForEvent(event.id);
      },
      {
        eventId: event.id
      }
    );

  endEventHomeSubStage(
    "eventHome.standingsLoading.recentGames",
    standingsStart,
    {
      games: games.length
    }
  );

  const registrationStart =
    startEventHomeSubStage(
      "eventHome.registrationLookup.buildPayload"
    );

  const registration =
    measureEventHomeOperation(
      "eventHome.registrationLookup.buildPayload.call",
      function() {
        return buildEventRegistrationPayload(
          event,
          registrations,
          currentPlayer,
          {
            includeRegistrationDetails: canViewEventRegistrationDetails(auth)
          }
        );
      },
      {
        registrations: registrations.length
      }
    );

  endEventHomeSubStage(
    "eventHome.registrationLookup.buildPayload",
    registrationStart,
    {
      registeredCount: registration.registeredCount,
      teamCount: registration.teamCount
    }
  );

  const eligibleOpponentsStart =
    startEventHomeSubStage(
      "eventHome.eligibleOpponents"
    );

  const eligibleOpponents =
    measureEventHomeOperation(
      "eventHome.eligibleOpponents.build",
      function() {
        return buildEventHomeEligibleOpponents(
          event,
          registrations,
          currentPlayer
        );
      },
      {
        eventId: event.id,
        registrations: registrations.length
      }
    );

  endEventHomeSubStage(
    "eventHome.eligibleOpponents",
    eligibleOpponentsStart,
    {
      opponents: eligibleOpponents.length
    }
  );

  const statisticsStart =
    startEventHomeSubStage(
      "eventHome.eventStatistics"
    );

  const statistics =
    measureEventHomeOperation(
      "eventHome.eventStatistics.build",
      function() {
        return buildEventHomeStatistics(event, registration, games, rounds);
      },
      {
        games: games.length,
        rounds: rounds.length
      }
    );

  endEventHomeSubStage(
    "eventHome.eventStatistics",
    statisticsStart,
    {
      completedGames: statistics.completedGames,
      registeredPlayers: statistics.registeredPlayers
    }
  );

  const timelineStart =
    startEventHomeSubStage(
      "eventHome.timeline"
    );

  const timeline =
    measureEventHomeOperation(
      "eventHome.timeline.build",
      function() {
        return buildEventHomeTimeline(event, registration, rounds, games);
      },
      {
        games: games.length,
        rounds: rounds.length
      }
    );

  endEventHomeSubStage(
    "eventHome.timeline",
    timelineStart,
    {
      entries: timeline.length
    }
  );

  const newsStart =
    startEventHomeSubStage(
      "eventHome.news"
    );

  const news =
    measureEventHomeOperation(
      "eventHome.news.build",
      function() {
        return buildEventHomeNews(event, registration, rounds, games);
      },
      {
        games: games.length,
        rounds: rounds.length
      }
    );

  endEventHomeSubStage(
    "eventHome.news",
    newsStart,
    {
      entries: news.length
    }
  );

  const quickActionsStart =
    startEventHomeSubStage(
      "eventHome.quickActions"
    );

  const quickActions =
    measureEventHomeOperation(
      "eventHome.quickActions.build",
      function() {
        return buildEventHomeQuickActions(event, registration, currentPlayer);
      },
      {
        hasCurrentPlayer: currentPlayer !== null
      }
    );

  endEventHomeSubStage(
    "eventHome.quickActions",
    quickActionsStart,
    {
      actions: quickActions.length
    }
  );

  const playerStatusStart =
    startEventHomeSubStage(
      "eventHome.playerStatus"
    );

  const playerStatus =
    measureEventHomeOperation(
      "eventHome.playerStatus.build",
      function() {
        return buildEventHomePlayerStatus(registration, currentPlayer);
      },
      {
        hasCurrentPlayer: currentPlayer !== null
      }
    );

  endEventHomeSubStage(
    "eventHome.playerStatus",
    playerStatusStart,
    {
      hasCurrentPlayer: currentPlayer !== null
    }
  );

  const navigationStart =
    startEventHomeSubStage(
      "eventHome.navigation"
    );

  const navigation =
    measureEventHomeOperation(
      "eventHome.navigation.build",
      function() {
        return buildEventHomeNavigation(event);
      },
      {
        eventType: event.type
      }
    );

  endEventHomeSubStage(
    "eventHome.navigation",
    navigationStart,
    {
      items: navigation.length
    }
  );

  recordEventHomeSkippedStages();

  return returnEventHomeResponse(
    {
    success: true,
    home: {
      event: event,
      eligibleOpponents: eligibleOpponents,
      registration: registration,
      currentRound: currentRound,
      rounds: rounds,
      statistics: statistics,
      timeline: timeline,
      news: news,
      quickActions: quickActions,
      playerStatus: playerStatus,
      navigation: navigation
    }
    },
    totalStart,
    {
      eventId: event.id,
      eventType: event.type
    }
  );

}

function buildEventHomeEligibleOpponents(event, registrations, currentPlayer) {

  const registry =
    buildPlayerRegistry();

  const currentPlayerId =
    currentPlayer
      ? getEventRegistrationString(currentPlayer.player)
      : "";

  const currentPlayerRegistryEntry =
    currentPlayer
      ? (
          findPlayerRegistryEntry(registry, currentPlayer.player) ||
          findPlayerRegistryEntry(registry, currentPlayer.displayName)
        )
      : null;

  const currentDivision =
    currentPlayer
      ? normalizeEventHomeDivision(
          getEventRegistrationString(currentPlayer.notes) ||
          (
            currentPlayerRegistryEntry
              ? getEventRegistrationString(currentPlayerRegistryEntry.division)
              : ""
          )
        )
      : "";

  const isLeagueEvent =
    getEventRegistrationString(event && event.type)
      .toLowerCase()
      .indexOf("league") !== -1;

  return registrations
    .map(function(registration) {
      return measureEventHomeLoopIteration(
        "eventHome.loop.eligibleOpponents.map",
        function() {
          const registryEntry =
            findPlayerRegistryEntry(
              registry,
              registration.player
            ) ||
            findPlayerRegistryEntry(
              registry,
              registration.displayName
            );

          const division =
            getEventRegistrationString(registration.notes) ||
            (
              registryEntry
                ? getEventRegistrationString(registryEntry.division)
                : ""
            );

          return {
            playerId:
              getEventRegistrationString(registration.player),
            playerName:
              getEventRegistrationString(registration.displayName) ||
              getEventRegistrationString(registration.player),
            division: division,
            divisionKey:
              normalizeEventHomeDivision(division),
            active:
              isEventHomeEligibleOpponentActive(
                registration,
                registryEntry
              ),
            self:
              currentPlayerId !== "" &&
              getEventRegistrationString(registration.player)
                .toLowerCase() === currentPlayerId.toLowerCase()
          };
        }
      );
    })
    .filter(function(opponent) {
      return measureEventHomeLoopIteration(
        "eventHome.loop.eligibleOpponents.filter",
        function() {
          if (opponent.playerId === "")
            return false;

          if (!opponent.active)
            return false;

          if (opponent.self)
            return false;

          if (
            isLeagueEvent &&
            currentDivision !== "" &&
            opponent.divisionKey !== currentDivision
          )
            return false;

          return true;
        }
      );
    })
    .map(function(opponent) {
      return measureEventHomeLoopIteration(
        "eventHome.loop.eligibleOpponents.publicShape",
        function() {
          return {
            playerId: opponent.playerId,
            playerName: opponent.playerName,
            division: opponent.division,
            active: opponent.active
          };
        }
      );
    });

}

function normalizeEventHomeDivision(value) {

  const compact =
    getEventRegistrationString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  if (
    compact === "main" ||
    compact.indexOf("mainman") !== -1
  )
    return "main";

  if (
    compact === "pga" ||
    compact.indexOf("provinggroundsa") !== -1 ||
    compact.indexOf("provinggrounda") !== -1
  )
    return "pga";

  if (
    compact === "pgb" ||
    compact.indexOf("provinggroundsb") !== -1 ||
    compact.indexOf("provinggroundb") !== -1
  )
    return "pgb";

  return compact;

}

function isEventHomeEligibleOpponentActive(registration, registryEntry) {

  const status =
    getEventRegistrationString(registration.status)
      .toLowerCase();

  if (
    status === "deleted" ||
    status === "removed" ||
    status === "withdrawn"
  )
    return false;

  if (registryEntry && registryEntry.active === false)
    return false;

  return true;

}

function returnEventHomeResponse(response, totalStart, totalDetails) {

  endEventHomeSubStage(
    "eventHome.total",
    totalStart,
    totalDetails || {}
  );

  recordEventHomeForensicSummaries();

  if (
    typeof getApiPipelineDiagnostics === "function" &&
    typeof API_PIPELINE_CONTEXT !== "undefined" &&
    API_PIPELINE_CONTEXT
  ) {
    response.pipelineDiagnostics =
      getApiPipelineDiagnostics();
  }

  if (!response.pipelineDiagnostics)
    response.pipelineDiagnostics =
      getEventHomeForensicDiagnostics();

  return jsonOutput(response);

}

function ensureEventHomePipelineContext() {

  EVENT_HOME_FORENSIC_CONTEXT = {
    requestId:
      "eventHome-" + Math.random().toString(36).slice(2),
    action: "eventHome",
    startTime: Date.now(),
    stageStarts: {
      endpointExecution: Date.now()
    },
    stages: {
      requestReceived: {
        stage: "requestReceived",
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 0,
        details: {
          action: "eventHome",
          source: "eventHomeLocalForensicContext"
        }
      }
    },
    subStages: [],
    eventHomeForensicMetrics: {}
  };

  if (
    typeof API_PIPELINE_CONTEXT !== "undefined" &&
    API_PIPELINE_CONTEXT
  )
    return;

  if (
    typeof createApiPipelineContext !== "function" ||
    typeof recordApiPipelineStage !== "function" ||
    typeof startApiPipelineStage !== "function"
  )
    return;

  API_PIPELINE_CONTEXT =
    createApiPipelineContext("eventHome");

  recordApiPipelineStage(
    "requestReceived",
    0,
    API_PIPELINE_CONTEXT.startTime,
    API_PIPELINE_CONTEXT.startTime,
    {
      action: "eventHome",
      source: "eventHomeFallbackPipelineContext"
    }
  );

  startApiPipelineStage("endpointExecution");

}

function startEventHomeSubStage(stageName) {

  if (
    (
      typeof API_PIPELINE_CONTEXT === "undefined" ||
      !API_PIPELINE_CONTEXT ||
      API_PIPELINE_CONTEXT.action !== "eventHome"
    ) &&
    !EVENT_HOME_FORENSIC_CONTEXT
  )
    return 0;

  return Date.now();

}

function endEventHomeSubStage(stageName, startTime, details) {

  if (!startTime)
    return;

  if (
    typeof API_PIPELINE_CONTEXT !== "undefined" &&
    API_PIPELINE_CONTEXT &&
    API_PIPELINE_CONTEXT.action === "eventHome" &&
    typeof recordApiPipelineSubStage === "function"
  ) {
    recordApiPipelineSubStage(
      stageName,
      startTime,
      details || {}
    );
  }

  recordEventHomeLocalSubStage(
    stageName,
    startTime,
    details || {}
  );

}

function resetEventHomeForensicMetrics() {

  if (
    typeof API_PIPELINE_CONTEXT !== "undefined" &&
    API_PIPELINE_CONTEXT &&
    API_PIPELINE_CONTEXT.action === "eventHome"
  )
    API_PIPELINE_CONTEXT.eventHomeForensicMetrics = {};

  if (EVENT_HOME_FORENSIC_CONTEXT)
    EVENT_HOME_FORENSIC_CONTEXT.eventHomeForensicMetrics = {};

}

function measureEventHomeOperation(stageName, callback, details) {

  const start =
    startEventHomeSubStage(stageName);

  try {
    return callback();
  }
  finally {
    const elapsed =
      start
        ? Date.now() - start
        : 0;

    recordEventHomeForensicMetric(
      stageName,
      elapsed,
      details || {}
    );

    endEventHomeSubStage(
      stageName,
      start,
      details || {}
    );
  }

}

function measureEventHomeLoopIteration(stageName, callback) {

  const start =
    Date.now();

  try {
    return callback();
  }
  finally {
    recordEventHomeForensicMetric(
      stageName,
      Date.now() - start,
      {
        loop: true
      }
    );
  }

}

function recordEventHomeForensicMetric(stageName, durationMs, details) {

  if (
    typeof API_PIPELINE_CONTEXT !== "undefined" &&
    API_PIPELINE_CONTEXT &&
    API_PIPELINE_CONTEXT.action === "eventHome"
  ) {
    if (!API_PIPELINE_CONTEXT.eventHomeForensicMetrics)
      API_PIPELINE_CONTEXT.eventHomeForensicMetrics = {};

    recordEventHomeMetricInto(
      API_PIPELINE_CONTEXT.eventHomeForensicMetrics,
      stageName,
      durationMs,
      details || {}
    );
  }

  if (EVENT_HOME_FORENSIC_CONTEXT) {
    if (!EVENT_HOME_FORENSIC_CONTEXT.eventHomeForensicMetrics)
      EVENT_HOME_FORENSIC_CONTEXT.eventHomeForensicMetrics = {};

    recordEventHomeMetricInto(
      EVENT_HOME_FORENSIC_CONTEXT.eventHomeForensicMetrics,
      stageName,
      durationMs,
      details || {}
    );
  }

}

function recordEventHomeMetricInto(metrics, stageName, durationMs, details) {

  if (!metrics[stageName])
    metrics[stageName] = {
      stage: stageName,
      callCount: 0,
      totalTimeMs: 0,
      maxTimeMs: 0,
      details: details || {}
    };

  metrics[stageName].callCount++;
  metrics[stageName].totalTimeMs += durationMs;
  metrics[stageName].maxTimeMs =
    Math.max(metrics[stageName].maxTimeMs, durationMs);
  metrics[stageName].averageTimeMs =
    metrics[stageName].callCount > 0
      ? Math.round(metrics[stageName].totalTimeMs / metrics[stageName].callCount)
      : 0;
  metrics[stageName].details =
    Object.assign(
      {},
      metrics[stageName].details || {},
      details || {}
    );

}

function recordEventHomeForensicSummaries() {

  const apiMetrics =
    typeof API_PIPELINE_CONTEXT !== "undefined" &&
    API_PIPELINE_CONTEXT &&
    API_PIPELINE_CONTEXT.action === "eventHome"
      ? API_PIPELINE_CONTEXT.eventHomeForensicMetrics
      : null;

  const localMetrics =
    EVENT_HOME_FORENSIC_CONTEXT
      ? EVENT_HOME_FORENSIC_CONTEXT.eventHomeForensicMetrics
      : null;

  const metrics =
    apiMetrics || localMetrics;

  if (!metrics)
    return;

  const endpointExecution =
    typeof API_PIPELINE_CONTEXT !== "undefined" &&
    API_PIPELINE_CONTEXT &&
    API_PIPELINE_CONTEXT.stages &&
    API_PIPELINE_CONTEXT.stages.endpointExecution
      ? API_PIPELINE_CONTEXT.stages.endpointExecution.durationMs
      : EVENT_HOME_FORENSIC_CONTEXT &&
          EVENT_HOME_FORENSIC_CONTEXT.stageStarts.endpointExecution
        ? Date.now() - EVENT_HOME_FORENSIC_CONTEXT.stageStarts.endpointExecution
        : 0;

  Object.keys(metrics)
    .sort(function(left, right) {
      return metrics[right].totalTimeMs - metrics[left].totalTimeMs;
    })
    .forEach(function(stageName, index) {
      const metric =
        metrics[stageName];

      const summaryStart =
        Date.now();

      const summaryDetails = {
        rank: index + 1,
        callCount: metric.callCount,
        totalTimeMs: metric.totalTimeMs,
        averageTimeMs: metric.averageTimeMs,
        maxTimeMs: metric.maxTimeMs,
        percentOfEndpointExecution:
          endpointExecution > 0
            ? Math.round((metric.totalTimeMs / endpointExecution) * 10000) / 100
            : 0,
        details: metric.details || {}
      };

      if (
        typeof API_PIPELINE_CONTEXT !== "undefined" &&
        API_PIPELINE_CONTEXT &&
        API_PIPELINE_CONTEXT.action === "eventHome" &&
        typeof recordApiPipelineSubStage === "function"
      ) {
        recordApiPipelineSubStage(
          "eventHome.forensicSummary." + stageName,
          summaryStart,
          summaryDetails
        );
      }

      recordEventHomeLocalSubStage(
        "eventHome.forensicSummary." + stageName,
        summaryStart,
        summaryDetails
      );
    });

}

function recordEventHomeLocalSubStage(stageName, startTime, details) {

  if (!EVENT_HOME_FORENSIC_CONTEXT || !startTime)
    return;

  EVENT_HOME_FORENSIC_CONTEXT.subStages.push({
    stage: stageName,
    startTime: startTime,
    endTime: Date.now(),
    durationMs: Date.now() - startTime,
    details: details || {}
  });

}

function getEventHomeForensicDiagnostics() {

  if (!EVENT_HOME_FORENSIC_CONTEXT)
    return {};

  if (!EVENT_HOME_FORENSIC_CONTEXT.stages.endpointExecution) {
    const startTime =
      EVENT_HOME_FORENSIC_CONTEXT.stageStarts.endpointExecution ||
      EVENT_HOME_FORENSIC_CONTEXT.startTime;

    EVENT_HOME_FORENSIC_CONTEXT.stages.endpointExecution = {
      stage: "endpointExecution",
      startTime: startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      details: {
        source: "eventHomeLocalForensicContext"
      }
    };
  }

  return {
    requestId: EVENT_HOME_FORENSIC_CONTEXT.requestId,
    action: EVENT_HOME_FORENSIC_CONTEXT.action,
    startTime: EVENT_HOME_FORENSIC_CONTEXT.startTime,
    stages: EVENT_HOME_FORENSIC_CONTEXT.stages,
    subStages: EVENT_HOME_FORENSIC_CONTEXT.subStages || []
  };

}

function recordEventHomeSkippedStages() {

  [
    "eventHome.teamLoading.notUsed",
    "eventHome.teamStandings.notUsed",
    "eventHome.teamStatistics.notUsed",
    "eventHome.pairingLoading.notUsed",
    "eventHome.currentRound.teamTournamentCurrentRound.notUsed",
    "eventHome.intelligence.notUsed",
    "eventHome.commissionerWorkflow.notUsed",
    "eventHome.ruleGeneration.notUsed",
    "eventHome.eventCapabilityGeneration.notUsed"
  ].forEach(function(stageName) {
    const start =
      startEventHomeSubStage(stageName);

    endEventHomeSubStage(
      stageName,
      start,
      {
        skipped: true,
        reason: "eventHome does not load this dataset"
      }
    );
  });

}

function getEventHomeSyntheticEvent(eventId) {

  const scope =
    String(eventId || "").toLowerCase();

  if (scope !== "lifetime" && scope !== "all")
    return null;

  return {
    id: scope,
    communityId: EVENT_ENGINE_COMMUNITY_ID,
    seriesId: EVENT_ENGINE_DEFAULT_SERIES_ID,
    templateId: "template-lifetime",
    name: scope === "lifetime" ? "Lifetime" : "All Events",
    description: "Aggregate historical view across Event Engine-scoped games.",
    type: "Aggregate",
    lifecycleStage: "Historical",
    status: "Read Only",
    owner: "Commissioner",
    commissioners: "",
    startDate: "",
    endDate: "",
    registration: "Registration Closed",
    participants: "All Events",
    rules: "Aggregate statistics only.",
    scoringModel: "Lifetime aggregate",
    standingsModel: "Career records",
    automation: "",
    discord: "",
    achievements: "Career achievements",
    history: "Lifetime history",
    archive: "Aggregate",
    createdAt: "",
    updatedAt: ""
  };

}

function buildEventHomeStatistics(event, registration, games, rounds) {

  const completedGames =
    measureEventHomeOperation(
      "eventHome.eventStatistics.completedGames.count",
      function() {
        return games.length;
      },
      {
        games: games.length
      }
    );

  return {
    registeredPlayers: registration.registeredCount,
    teams: registration.teamCount,
    completedGames: completedGames,
    gamesRemaining: 0,
    currentRound:
      rounds.length > 0
        ? rounds[0].name
        : "",
    completionPercentage:
      completedGames > 0 ? 100 : 0,
    lifecycleStage: event.lifecycleStage || event.status || "",
    registrationStatus: registration.status
  };

}

function buildEventHomeTimeline(event, registration, rounds, games) {

  const timeline =
    measureEventHomeOperation(
      "eventHome.timeline.initialize",
      function() {
        return [
          {
            title: event.name + " created",
            body: event.description || "Event created in the Event Engine.",
            timestamp: event.createdAt || event.updatedAt || "",
            type: "Event"
          }
        ];
      },
      {
        eventId: event.id
      }
    );

  if (event.registration)
    measureEventHomeOperation(
      "eventHome.timeline.registrationEntry",
      function() {
        timeline.push({
          title: event.registration,
          body: "Registration status is " + event.registration + ".",
          timestamp: event.updatedAt || "",
          type: "Registration"
        });
      },
      {}
    );

  rounds.forEach(function(round) {
    measureEventHomeLoopIteration(
      "eventHome.loop.timeline.rounds",
      function() {
        timeline.push({
          title: round.name,
          body: round.status || round.type || "Round configured.",
          timestamp: round.updatedAt || round.createdAt || "",
          type: "Round"
        });
      }
    );
  });

  games.slice(0, 5).forEach(function(game) {
    measureEventHomeLoopIteration(
      "eventHome.loop.timeline.games",
      function() {
        timeline.push({
          title: game.winnerDisplayName + " defeated " + game.loserDisplayName,
          body: game.mission || "Event game submitted.",
          timestamp: game.date || "",
          type: "Result"
        });
      }
    );
  });

  if (registration.registeredCount > 0)
    measureEventHomeOperation(
      "eventHome.timeline.registeredCountEntry",
      function() {
        timeline.push({
          title: registration.registeredCount + " players registered",
          body: "Registration list updated for " + event.name + ".",
          timestamp: getEventHomeTimestamp(),
          type: "Registration"
        });
      },
      {
        registeredCount: registration.registeredCount
      }
    );

  return timeline;

}

function buildEventHomeNews(event, registration, rounds, games) {

  const news = [];

  measureEventHomeOperation(
    "eventHome.news.statusEntry",
    function() {
      news.push(event.name + " is currently " + (event.status || "active") + ".");
    },
    {}
  );

  if (registration.registrationOpen)
    measureEventHomeOperation(
      "eventHome.news.registrationOpenEntry",
      function() {
        news.push("Registration is open.");
      },
      {}
    );
  else
    measureEventHomeOperation(
      "eventHome.news.registrationStatusEntry",
      function() {
        news.push(registration.status + ".");
      },
      {}
    );

  if (rounds.length > 0)
    measureEventHomeOperation(
      "eventHome.news.currentRoundEntry",
      function() {
        news.push(rounds[0].name + " is the current event round.");
      },
      {}
    );

  if (games.length > 0)
    measureEventHomeOperation(
      "eventHome.news.latestResultEntry",
      function() {
        news.push(games[0].winnerDisplayName + " submitted the latest event result.");
      },
      {}
    );

  return news;

}

function buildEventHomeQuickActions(event, registration, currentPlayer) {

  const actions = [];

  if (registration.registrationOpen && !currentPlayer)
    measureEventHomeOperation(
      "eventHome.quickActions.register",
      function() {
        actions.push({
          label: "Register",
          action: "register",
          href: "/event/" + encodeURIComponent(event.id) + "#registration",
          enabled: true
        });
      },
      {}
    );

  if (registration.registrationOpen && currentPlayer)
    measureEventHomeOperation(
      "eventHome.quickActions.editRegistration",
      function() {
        actions.push({
          label: "Edit Registration",
          action: "editRegistration",
          href: "/event/" + encodeURIComponent(event.id) + "#registration",
          enabled: true
        });
      },
      {}
    );

  measureEventHomeOperation(
    "eventHome.quickActions.submitResult",
    function() {
      actions.push({
        label: "Submit Game",
        action: "submitResult",
        href: "/submit-game?eventId=" + encodeURIComponent(event.id) + "&gameType=event",
        enabled: currentPlayer !== null
      });
    },
    {}
  );

  measureEventHomeOperation(
    "eventHome.quickActions.standings",
    function() {
      actions.push({
        label: "Standings",
        action: "standings",
        href:
          event.type === "Team Tournament"
            ? "/event/" + encodeURIComponent(event.id) + "/tournament#team-tournament-standings"
            : "/standings?eventId=" + encodeURIComponent(event.id),
        enabled: true
      });
    },
    {}
  );

  measureEventHomeOperation(
    "eventHome.quickActions.results",
    function() {
      actions.push({
        label: "Results",
        action: "results",
        href: "/event/" + encodeURIComponent(event.id) + "#results",
        enabled: true
      });
    },
    {}
  );

  if (event.type === "Team Tournament")
    measureEventHomeOperation(
      "eventHome.quickActions.teamTournament",
      function() {
        actions.push({
          label: "Team Tournament",
          action: "teamTournament",
          href: "/event/" + encodeURIComponent(event.id) + "/tournament",
          enabled: true
        });
      },
      {}
    );

  return actions;

}

function buildEventHomePlayerStatus(registration, currentPlayer) {

  if (!currentPlayer)
    return measureEventHomeOperation(
      "eventHome.playerStatus.notRegistered",
      function() {
        return {
          registrationStatus: "Not Registered",
          currentTeam: "",
          captain: false,
          upcomingMatch: "Pending Pairings",
          outstandingAction:
            registration.registrationOpen
              ? "Register for this Event."
              : "Registration is closed.",
          notifications: []
        };
      },
      {}
    );

  return measureEventHomeOperation(
    "eventHome.playerStatus.registered",
    function() {
      return {
        registrationStatus: currentPlayer.status,
        currentTeam:
          currentPlayer.preferredTeam ||
          currentPlayer.team ||
          "Looking for Team",
        captain: currentPlayer.captain,
        upcomingMatch: "Pending Pairings",
        outstandingAction:
          currentPlayer.status === "Registered"
            ? "Watch for pairings and event updates."
            : "Review your registration status.",
        notifications: []
      };
    },
    {}
  );

}

function buildEventHomeNavigation(event) {

  const base =
    "/event/" + encodeURIComponent(event.id);

  const items =
    measureEventHomeOperation(
      "eventHome.navigation.baseItems",
      function() {
        return [
          ["Overview", base],
          ["Registration", base + "#registration"],
          ["Submit Game", "/submit-game?eventId=" + encodeURIComponent(event.id) + "&gameType=event"],
          ["Standings", base + "#standings"],
          ["Results", base + "#results"],
          ["Rules", base + "#rules"],
          ["News", base + "#news"]
        ];
      },
      {}
    );

  if (event.type === "Team Tournament") {
    measureEventHomeOperation(
      "eventHome.navigation.teamTournamentItems",
      function() {
        items.splice(2, 0, ["Teams", base + "/tournament#team-tournament-register"]);
        items.splice(3, 0, ["Pairings", base + "/tournament#team-tournament-pairings"]);
      },
      {}
    );
  }

  return items.map(function(item) {
    return measureEventHomeLoopIteration(
      "eventHome.loop.navigation.map",
      function() {
        return {
          label: item[0],
          href: item[1]
        };
      }
    );
  });

}

function getEventHomeCurrentRound(rounds) {

  if (rounds.length === 0)
    return null;

  return rounds
    .slice()
    .sort(function(a, b) {
      return measureEventHomeLoopIteration(
        "eventHome.loop.currentRound.sortComparator",
        function() {
          return (Number(b.number) || 0) - (Number(a.number) || 0);
        }
      );
    })[0];

}

function getEventHomeTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
