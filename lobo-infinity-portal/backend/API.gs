/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * API.gs
 *
 * Public API routing and JSON response formatting.
 *******************************************************/

var API_PIPELINE_CONTEXT = null;

function createApiPipelineContext(action, requestId) {
  return {
    requestId:
      requestId || "api-" + Math.random().toString(36).slice(2),
    action: action,
    startTime: Date.now(),
    currentStage: "requestReceived",
    currentFunction: "",
    authenticated: false,
    credentialPresent: false,
    userEmail: "",
    stageStarts: {},
    stages: {},
    logs: [],
    functionStack: []
  };
}

function getApiCorrelationRequestId(e) {
  try {
    const requestId =
      e && e.parameter && e.parameter.requestId
        ? String(e.parameter.requestId)
        : "";

    return /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)
      ? requestId
      : "";
  }
  catch (err) {
    return "";
  }
}

function logAuthSessionCorrelation(values) {
  try {
    if (!API_PIPELINE_CONTEXT || API_PIPELINE_CONTEXT.action !== "session")
      return;

    const details = values || {};

    if (details.credentialPresent === true)
      API_PIPELINE_CONTEXT.credentialPresent = true;

    Logger.log(
      "AUTH_SESSION_CORRELATION " +
        JSON.stringify({
          requestId: API_PIPELINE_CONTEXT.requestId || "",
          action: "session",
          method: "POST",
          timestamp: getApiForensicTimestamp(),
          requestReceived: details.requestReceived === true,
          requestCompleted: details.requestCompleted === true,
          jsonGenerated: details.jsonGenerated === true,
          exceptionThrown: details.exceptionThrown === true,
          authenticationResult: details.authenticationResult || "",
          credentialPresent:
            details.credentialPresent === true ||
            API_PIPELINE_CONTEXT.credentialPresent === true
        })
    );
  }
  catch (err) {
  }
}

function getApiForensicTimestamp() {
  try {
    return new Date().toISOString();
  }
  catch (err) {
    return "";
  }
}

function getApiForensicElapsed(startTime) {
  try {
    return startTime
      ? Date.now() - startTime
      : 0;
  }
  catch (err) {
    return 0;
  }
}

function recordApiForensicLog(fn, stage, status, startTime, details) {
  try {
    const elapsed =
      getApiForensicElapsed(startTime);
    const entry = {
      requestId:
        API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.requestId
          ? API_PIPELINE_CONTEXT.requestId
          : "",
      action:
        API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.action
          ? API_PIPELINE_CONTEXT.action
          : "",
      functionName: fn || "",
      stage: stage || "",
      status: status || "",
      elapsedTime: elapsed,
      timestamp: getApiForensicTimestamp(),
      details: details || {}
    };

    if (API_PIPELINE_CONTEXT) {
      API_PIPELINE_CONTEXT.currentStage =
        stage || API_PIPELINE_CONTEXT.currentStage || "";
      API_PIPELINE_CONTEXT.currentFunction =
        fn || API_PIPELINE_CONTEXT.currentFunction || "";

      if (!API_PIPELINE_CONTEXT.logs)
        API_PIPELINE_CONTEXT.logs = [];

      API_PIPELINE_CONTEXT.logs.push(entry);
    }

    Logger.log(
      "API_FORENSIC " +
        JSON.stringify(entry)
    );
  }
  catch (err) {
  }
}

function enterApiForensicFunction(fn, stage, details) {
  const start =
    Date.now();

  try {
    if (API_PIPELINE_CONTEXT) {
      API_PIPELINE_CONTEXT.currentStage = stage || fn || "";
      API_PIPELINE_CONTEXT.currentFunction = fn || "";

      if (!API_PIPELINE_CONTEXT.functionStack)
        API_PIPELINE_CONTEXT.functionStack = [];

      API_PIPELINE_CONTEXT.functionStack.push({
        functionName: fn || "",
        stage: stage || fn || "",
        startTime: start,
        exceptionThrown: false
      });
    }

    recordApiForensicLog(
      fn,
      stage || fn,
      "entered",
      start,
      details || {}
    );
  }
  catch (err) {
  }

  return start;
}

function exitApiForensicFunction(fn, stage, startTime, details) {
  try {
    let exceptionThrown = false;

    if (
      API_PIPELINE_CONTEXT &&
      API_PIPELINE_CONTEXT.functionStack &&
      API_PIPELINE_CONTEXT.functionStack.length > 0
    ) {
      const current =
        API_PIPELINE_CONTEXT.functionStack[
          API_PIPELINE_CONTEXT.functionStack.length - 1
        ];

      exceptionThrown =
        current && current.exceptionThrown === true;
    }

    recordApiForensicLog(
      fn,
      stage || fn,
      exceptionThrown
        ? "exitedAfterException"
        : "completed",
      startTime,
      details || {}
    );

    if (
      API_PIPELINE_CONTEXT &&
      API_PIPELINE_CONTEXT.functionStack &&
      API_PIPELINE_CONTEXT.functionStack.length > 0
    ) {
      API_PIPELINE_CONTEXT.functionStack.pop();

      const next =
        API_PIPELINE_CONTEXT.functionStack[
          API_PIPELINE_CONTEXT.functionStack.length - 1
        ];

      API_PIPELINE_CONTEXT.currentStage =
        next
          ? next.stage
          : API_PIPELINE_CONTEXT.currentStage;
      API_PIPELINE_CONTEXT.currentFunction =
        next
          ? next.functionName
          : API_PIPELINE_CONTEXT.currentFunction;
    }
  }
  catch (err) {
  }
}

function recordApiForensicException(fn, stage, startTime, err) {
  try {
    if (
      API_PIPELINE_CONTEXT &&
      API_PIPELINE_CONTEXT.functionStack &&
      API_PIPELINE_CONTEXT.functionStack.length > 0
    ) {
      API_PIPELINE_CONTEXT.functionStack[
        API_PIPELINE_CONTEXT.functionStack.length - 1
      ].exceptionThrown = true;
    }

    recordApiForensicLog(
      fn,
      stage || fn,
      "exception",
      startTime,
      {
        exception: String(err),
        message:
          err && err.message
            ? String(err.message)
            : String(err),
        stack:
          err && err.stack
            ? String(err.stack)
            : ""
      }
    );
  }
  catch (logErr) {
  }
}

function setApiForensicAuthState(auth) {
  try {
    if (!API_PIPELINE_CONTEXT)
      return;

    API_PIPELINE_CONTEXT.authenticated =
      !!(auth && auth.authenticated);

    API_PIPELINE_CONTEXT.userEmail =
      auth && auth.user && auth.user.email
        ? String(auth.user.email)
        : "";
  }
  catch (err) {
  }
}

function clearApiPipelineContext() {
  try {
    API_PIPELINE_CONTEXT = null;
  }
  catch (err) {
  }
}

function safeApiJsonStringify(value, fallback) {
  try {
    return JSON.stringify(value);
  }
  catch (err) {
    try {
      return JSON.stringify(fallback);
    }
    catch (fallbackErr) {
      return '{"success":false,"errorType":"UNCAUGHT_EXCEPTION","message":"Forensic JSON serialization failed."}';
    }
  }
}

function safeApiString(value) {
  try {
    return String(value);
  }
  catch (err) {
    return "";
  }
}

function startApiPipelineStage(stageName) {
  if (!API_PIPELINE_CONTEXT)
    return Date.now();

  const start =
    Date.now();

  API_PIPELINE_CONTEXT.currentStage =
    stageName;

  API_PIPELINE_CONTEXT.stageStarts[stageName] =
    start;

  return start;
}

function endApiPipelineStage(stageName, startTime, details) {
  if (!API_PIPELINE_CONTEXT)
    return;

  API_PIPELINE_CONTEXT.stages[stageName] = {
    stage: stageName,
    startTime: startTime,
    endTime: Date.now(),
    durationMs: Date.now() - startTime,
    details: details || {}
  };
}

function recordApiPipelineSubStage(stageName, startTime, details) {
  if (!API_PIPELINE_CONTEXT)
    return;

  if (!API_PIPELINE_CONTEXT.subStages)
    API_PIPELINE_CONTEXT.subStages = [];

  API_PIPELINE_CONTEXT.subStages.push({
    stage: stageName,
    startTime: startTime,
    endTime: Date.now(),
    durationMs: Date.now() - startTime,
    details: details || {}
  });
}

function recordApiPipelineStage(stageName, durationMs, startTime, endTime, details) {
  if (!API_PIPELINE_CONTEXT)
    return;

  API_PIPELINE_CONTEXT.stages[stageName] = {
    stage: stageName,
    startTime: startTime,
    endTime: endTime,
    durationMs: durationMs,
    details: details || {}
  };
}

function getApiPipelineDiagnostics() {
  if (!API_PIPELINE_CONTEXT)
    return {};

  return {
    requestId: API_PIPELINE_CONTEXT.requestId,
    action: API_PIPELINE_CONTEXT.action,
    startTime: API_PIPELINE_CONTEXT.startTime,
    currentStage: API_PIPELINE_CONTEXT.currentStage || "",
    currentFunction: API_PIPELINE_CONTEXT.currentFunction || "",
    authenticated: API_PIPELINE_CONTEXT.authenticated || false,
    userEmail: API_PIPELINE_CONTEXT.userEmail || "",
    stages: API_PIPELINE_CONTEXT.stages,
    subStages: API_PIPELINE_CONTEXT.subStages || [],
    logs: API_PIPELINE_CONTEXT.logs || [],
    functionStack: API_PIPELINE_CONTEXT.functionStack || []
  };
}

function finalizeApiPipelineEndpointExecution() {
  if (!API_PIPELINE_CONTEXT)
    return;

  if (API_PIPELINE_CONTEXT.stages.endpointExecution)
    return;

  const startTime =
    API_PIPELINE_CONTEXT.stageStarts.endpointExecution;

  if (!startTime)
    return;

  endApiPipelineStage(
    "endpointExecution",
    startTime,
    {}
  );
}

function logApiPipelineTiming() {
  if (!API_PIPELINE_CONTEXT)
    return;

  const stages = API_PIPELINE_CONTEXT.stages;
  const values = [
    "StageTime",
    "Request received",
    stages.requestReceived ? stages.requestReceived.durationMs + " ms" : "0 ms",
    "Auth validation",
    stages.authValidation ? stages.authValidation.durationMs + " ms" : "0 ms",
    "Session lookup",
    stages.sessionLookup ? stages.sessionLookup.durationMs + " ms" : "0 ms",
    "Spreadsheet open",
    stages.spreadsheetOpen ? stages.spreadsheetOpen.durationMs + " ms" : "0 ms",
    "Sheet lookup",
    stages.usersSheetLookup ? stages.usersSheetLookup.durationMs + " ms" : "0 ms",
    "Cache lookup",
    stages.cacheLookup ? stages.cacheLookup.durationMs + " ms" : "0 ms",
    "Endpoint logic",
    stages.endpointExecution ? stages.endpointExecution.durationMs + " ms" : "0 ms",
    "JSON response",
    stages.jsonSerialization ? stages.jsonSerialization.durationMs + " ms" : "0 ms"
  ];

  Logger.log(
    values.join("") +
      " action=" + API_PIPELINE_CONTEXT.action +
      " requestId=" + API_PIPELINE_CONTEXT.requestId
  );
}

function doGet(e) {

  let action = "";

  try {

    action =
      (e && e.parameter && e.parameter.action)
        ? e.parameter.action
        : "";

    API_PIPELINE_CONTEXT =
      createApiPipelineContext(action);

    recordApiPipelineStage(
      "requestReceived",
      0,
      API_PIPELINE_CONTEXT.startTime,
      API_PIPELINE_CONTEXT.startTime,
      {
        action: action,
        method: "GET"
      }
    );

    const parameterParsingStart =
      startApiPipelineStage("parameterParsing");

    endApiPipelineStage(
      "parameterParsing",
      parameterParsingStart,
      {
        action: action
      }
    );

    return handleApiGet(e, action);
  }
  catch (err) {
    return jsonExceptionOutput(
      err,
      action,
      "doGet"
    );
  }
}

function handleApiGet(e, action) {
  const endpointExecutionStart =
    startApiPipelineStage("endpointExecution");

  try {
    switch (action) {

    case "leader":
      return getCachedApiResponse(e, action, function() {
        return getLeader();
      });

    case "dashboard":
      return getCachedApiResponse(e, action, function() {
        return getDashboard();
      });

    case "home":
      return getCachedApiResponse(e, action, function() {
        return getHome();
      });

    case "players":
      return getCachedApiResponse(e, action, function() {
        return getPlayers(e);
      });

    case "player":
      return getCachedApiResponse(e, action, function() {
        return getPlayer(e);
      });

    case "recentGames":
      return getCachedApiResponse(e, action, function() {
        return getRecentGames(e);
      });

    case "gameCenter":
      return requireApiPermission(e, "viewOperations", function() {
        return getGameCenter(e);
      });

    case "armyListLinkCandidates":
      return requireApiPermission(e, "viewOperations", function() {
        return getArmyListLinkCandidates(e);
      });

    case "standings":
      return getCachedApiResponse(e, action, function() {
        return getStandings(e);
      });

    case "factions":
      return getCachedApiResponse(e, action, function() {
        return getFactions(e);
      });

    case "faction":
      return getCachedApiResponse(e, action, function() {
        return getFaction(e);
      });

    case "missions":
      return getCachedApiResponse(e, action, function() {
        return getMissions(e);
      });

    case "leagueOperations":
      return getCachedApiResponse(e, action, function() {
        return getLeagueOperations();
      });

    case "mission":
      return getCachedApiResponse(e, action, function() {
        return getMission(e);
      });

    case "intelligence":
      return getCachedApiResponse(e, action, function() {
        return getEventIntelligence(e);
      });

    case "news":
      return getCachedApiResponse(e, action, function() {
        return getCommissionerNews();
      });

    case "records":
      return getCachedApiResponse(e, action, function() {
        return getRecords(e);
      });

    case "hallOfFame":
      return getCachedApiResponse(e, action, function() {
        return getHallOfFame(e);
      });

    case "comparison":
      return getCachedApiResponse(e, action, function() {
        return getPlayerComparison(e);
      });

    case "notifications":
      return getNotifications(e);

    case "timeline":
      return getCachedApiResponse(e, action, function() {
        return getTimeline(e);
      });

    case "settings":
      return getCachedApiResponse(e, action, function() {
        return getSettings();
      });

    case "events":
      return getCachedApiResponse(e, action, function() {
        return getEvents(e);
      });

    case "event":
      return getCachedApiResponse(e, action, function() {
        return getEvent(e);
      });

    case "eventRegistration":
      return getEventRegistration(e);

    case "eventHome":
      return getEventHome(e);

    case "eventManager":
      return getEventManager(e);

    case "eventTemplates":
      return getCachedApiResponse(e, action, function() {
        return getEventTemplates();
      });

    case "eventSeasons":
      return getCachedApiResponse(e, action, function() {
        return getEventSeasons(e);
      });

    case "eventRounds":
      return getCachedApiResponse(e, action, function() {
        return getEventRounds(e);
      });

    case "eventLifecycle":
      return requireApiPermission(e, "viewOperations", function() {
        return getEventLifecycle(e);
      });

    case "session":
      return getAuthSession(e);

    case "commissionerPasswordStatus":
      return getCommissionerPasswordStatus();

    case "myProfile":
      return getMyProfile(e);

    case "communityCommandCenter":
      return getCommunityCommandCenter(e);

    case "seasonCommandCenter":
      return getSeasonCommandCenter(e);

    case "schedulingCenter":
      return getSchedulingCenter(e);

    case "matchFinder":
      return getMatchFinder(e);

    case "teamTournament":
      return getTeamTournament(e);

    case "teamTournamentDiagnostic":
      return getTeamTournamentDiagnostic(e);

    case "version":
      return getPortalVersion(e);

    case "schedulingCalendar":
      return getSchedulingCalendarExport(e);

    case "commissionerScheduling":
      return getCommissionerScheduling(e);

    case "achievements":
      return getAchievements(e);

    case "streams":
      return getCachedApiResponse(e, action, function() {
        return getStreams();
      });

    case "searchData":
      return getCachedApiResponse(e, action, function() {
        return getSearchData(e);
      });

    case "searchIndex":
      return getCachedApiResponse(e, action, function() {
        return getSearchData(e);
      });

    case "armyLists":
      return getCachedApiResponse(e, action, function() {
        return getArmyLists();
      });

    case "armyIntelligence":
      return getArmyIntelligence(e);

    case "armyIntelligenceSources":
      return requireArmyIntelligenceWorkerOrPermission(e, function() {
        return getArmyIntelligenceSources();
      });

    case "diagnoseArmyList":
      return requireApiPermission(e, "viewOperations", function() {
        return diagnoseArmyList(e);
      });

    case "linkHistoricalArmyLists":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "validateArmyCode":
      return validateArmyCode(e);

    case "flaggedArmySubmissions":
      return requireApiPermission(e, "viewOperations", function() {
        return getFlaggedArmySubmissions(e);
      });

    case "auditArmyCodeSubmissions":
      return requireApiPermission(e, "runLeagueAudit", function() {
        return auditArmyCodeSubmissions(e);
      });

    case "operations":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsDashboard();
      });

    case "operationsSummary":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsSummaryDashboard();
      });

    case "operationsLifecycle":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsLifecycleDashboard();
      });

    case "operationsIdentity":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsIdentityDashboard();
      });

    case "identityResolutionDiagnostics":
      return requireApiPermission(e, "viewOperations", function(auth) {
        return getIdentityResolutionDiagnostics(auth);
      });

    case "operationsContent":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsContentDashboard();
      });

    case "operationsDiscord":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsDiscordDashboard();
      });

    case "operationsNotifications":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsNotificationsDashboard();
      });

    case "operationsAudit":
      return requireApiPermission(e, "runLeagueAudit", function() {
        return getOperationsAudit();
      });

    case "operationsSeason":
      return requireApiPermission(e, "runSeasonControl", function() {
        return getOperationsSeason();
      });

    case "operationsStatus":
      return requireApiPermission(e, "viewOperations", function(auth) {
        return getOperationsStatus(auth);
      });

    case "operationsState":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsEngineState();
      });

    case "operationsQueue":
      return requireApiPermission(e, "viewOperations", function() {
        return getOperationsEngineQueue();
      });

    case "reliability":
      return requireApiPermission(e, "viewOperations", function() {
        return getReliabilityDashboard();
      });

    case "integrity":
      return requireApiPermission(e, "viewOperations", function() {
        return getIntegrityDashboard();
      });

    case "integrityFreshAudit":
      return requireApiPermission(e, "runLeagueAudit", function() {
        return runFreshIntegrityAudit();
      });

    case "integrityReport":
      return requireApiPermission(e, "viewOperations", function() {
        return getIntegrityReport();
      });

    case "automation":
      return requireApiPermission(e, "viewOperations", function() {
        return getAutomationCenter();
      });

    case "eventMigrationAudit":
      return requireApiPermission(e, "viewOperations", function() {
        return getEventMigrationAudit();
      });

    case "eventMigrationPreview":
      return requireApiPermission(e, "viewOperations", function() {
        return getEventMigrationPreview();
      });

    case "eventMigrationReport":
      return requireApiPermission(e, "viewOperations", function() {
        return getEventMigrationReport();
      });

    case "eventMigrationRollback":
      return requireApiPermission(e, "viewOperations", function() {
        return getEventMigrationRollback();
      });

    case "eventMigrationValidation":
      return requireApiPermission(e, "viewOperations", function() {
        return getEventMigrationValidation();
      });

    case "eventLifecycleTransition":
      return requireApiPermission(e, "runSeasonControl", function(auth) {
        return transitionEventLifecycle(e, auth);
      });

    case "registerForEvent":
      return registerForEvent(e);

    case "withdrawEventRegistration":
      return withdrawEventRegistration(e);

    case "manageEventRegistration":
      return manageEventRegistration(e);

    case "eventManagerEvent":
      return saveEventManagerEvent(e);

    case "eventManagerRegistration":
      return setEventManagerRegistration(e);

    case "eventManagerLifecycle":
      return setEventManagerLifecycle(e);

    case "eventManagerCurrentEvent":
      return setEventManagerCurrentEvent(e);

    case "eventManagerParticipant":
      return saveEventManagerParticipant(e);

    case "eventManagerTeam":
      return saveEventManagerTeam(e);

    case "eventManagerPairing":
      return saveEventManagerPairing(e);

    case "leagueOperationsSave":
      return saveLeagueOperations(e);

    case "exportEventRegistrations":
      return exportEventRegistrations(e);

    case "voteArmyList":
      return requireApiPermission(e, "vote", function() {
        return voteArmyList(e);
      });

    case "validateArmyCode":
      return validateArmyCode(e);

    case "flaggedArmySubmissions":
      return requireApiPermission(e, "viewOperations", function() {
        return getFlaggedArmySubmissions(e);
      });

    case "auditArmyCodeSubmissions":
      return requireApiPermission(e, "runLeagueAudit", function() {
        return auditArmyCodeSubmissions(e);
      });

    case "diagnoseArmyList":
      return requireApiPermission(e, "viewOperations", function() {
        return diagnoseArmyList(e);
      });

    case "submitArmyList":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "submitLeagueResult":
      return submitLeagueResult(e);

    case "submitCasualResult":
      return submitCasualResult(e);

    case "updateProfile":
      return updateMyProfile(e);

    case "heartbeat":
      return updateHeartbeat(e);

    case "notificationState":
      return updateNotificationState(e);

    case "seasonAvailability":
      return updateSeasonAvailability(e);

    case "schedulingAvailability":
      return updateSchedulingAvailability(e);

    case "createSchedulingRequest":
      return createSchedulingRequest(e);

    case "respondSchedulingRequest":
      return respondSchedulingRequest(e);

    case "teamTournamentRegister":
      return registerForEvent(e);

    case "teamTournamentTeam":
      return saveTeamTournamentTeam(e);

    case "teamTournamentPairing":
      return saveTeamTournamentPairing(e);

    case "teamTournamentInvitation":
      return saveTeamTournamentInvitation(e);

    case "teamTournamentResult":
      return saveTeamTournamentResult(e);

    case "teamTournamentRound":
      return advanceTeamTournamentRound(e);

    case "updateSettings":
      return requireApiPermission(e, "manageSettings", function() {
        return updateOperationsSettings(e);
      });

    case "deleteCanonicalPlayer":
      return requireApiPermission(e, "runSeasonControl", function() {
        return deleteCanonicalPlayer(e);
      });

    case "setCanonicalPlayerDisplayName":
      return requireApiPermission(e, "runSeasonControl", function() {
        return setCanonicalPlayerDisplayName(e);
      });

    case "approveArmyList":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "rejectArmyList":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "updateArmyList":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "correctGameScore":
      return requireApiPermission(e, "dataCorrections", function(auth) {
        return correctGameScore(e, auth);
      });

    case "repairHistoricalArmyCodes":
      return requireApiPermission(e, "dataCorrections", function(auth) {
        return repairHistoricalArmyCodes(e, auth);
      });

    case "saveStream":
      return requireApiPermission(e, "manageStreams", function() {
        return saveOperationsStream(e);
      });

    case "deleteStream":
      return requireApiPermission(e, "manageStreams", function() {
        return deleteOperationsStream(e);
      });

    case "saveNews":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsNews(e);
      });

    case "deleteNews":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsNews(e);
      });

    case "saveAlert":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsAlert(e);
      });

    case "deleteAlert":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsAlert(e);
      });

    case "saveTimelineEntry":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsTimelineEntry(e);
      });

    case "deleteTimelineEntry":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsTimelineEntry(e);
      });

    case "clearCache":
      return requireApiPermission(e, "manageCache", function() {
        return clearOperationsCache();
      });

    case "refreshCache":
      return requireApiPermission(e, "manageCache", function() {
        return refreshOperationsCache(e);
      });

    case "rebuildStatistics":
      return requireApiPermission(e, "manageCache", function() {
        return rebuildOperationsStatistics();
      });

    case "seasonOperation":
      return requireApiPermission(e, "runSeasonControl", function() {
        return executeSeasonOperation(e);
      });

    case "operationsCommand":
      return requireApiPermission(e, "runSeasonControl", function() {
        return executeOperationsCommand(e);
      });

    case "identityBulkEnable":
      return requireApiPermission(e, "manageSettings", function() {
        return bulkEnableIdentityUsers(e);
      });

    case "identityBulkDisable":
      return requireApiPermission(e, "manageSettings", function() {
        return bulkDisableIdentityUsers(e);
      });

    case "repairIdentity":
      return requireApiPermission(e, "manageSettings", function() {
        return repairIdentityMappings();
      });

    case "repairUsersSheet":
      return requireApiPermission(e, "manageSettings", function() {
        return repairUsersSheet();
      });

    case "repairMissingAccounts":
      return requireApiPermission(e, "manageSettings", function() {
        return repairMissingAccounts();
      });

    case "updateDiscordSettings":
      return requireApiPermission(e, "manageSettings", function() {
        return updateDiscordSettings(e);
      });

    case "testDiscordWebhook":
      return requireApiPermission(e, "manageSettings", function() {
        return testDiscordWebhook(e);
      });

    case "previewDiscordAnnouncement":
      return requireApiPermission(e, "viewOperations", function() {
        return jsonOutput(previewDiscordAnnouncement(e));
      });

    case "sendDiscordAnnouncement":
      return requireApiPermission(e, "manageNews", function() {
        return sendDiscordAnnouncement(e);
      });

    case "resendDiscordAnnouncement":
      return requireApiPermission(e, "manageNews", function() {
        return resendDiscordAnnouncement(e);
      });

    case "disableDiscordAutomation":
      return requireApiPermission(e, "manageSettings", function() {
        return disableDiscordAutomation();
      });

    case "runDiscordAutomationJob":
      return requireApiPermission(e, "manageNews", function() {
        return runDiscordAutomationJob(e);
      });

    case "publishAutomationEvent":
      return requireApiPermission(e, "manageNews", function() {
        return publishAutomationEvent(e);
      });

    case "updateAutomationRule":
      return requireApiPermission(e, "manageSettings", function() {
        return updateAutomationRule(e);
      });

    case "updateAutomationTemplate":
      return requireApiPermission(e, "manageSettings", function() {
        return updateAutomationTemplate(e);
      });

    case "runAutomation":
      return requireApiPermission(e, "manageNews", function() {
        return runAutomation(e);
      });

    case "pauseAutomation":
      return requireApiPermission(e, "manageSettings", function() {
        return pauseAutomation();
      });

    case "resumeAutomation":
      return requireApiPermission(e, "manageSettings", function() {
        return resumeAutomation();
      });

    case "replayLastAutomationEvent":
      return requireApiPermission(e, "manageNews", function() {
        return replayLastAutomationEvent();
      });

    case "replayAutomationWeek":
      return requireApiPermission(e, "manageNews", function() {
        return replayAutomationWeek();
      });

    case "replayAutomationSeason":
      return requireApiPermission(e, "manageNews", function() {
        return replayAutomationSeason();
      });

    case "clearAutomationQueue":
      return requireApiPermission(e, "manageSettings", function() {
        return clearAutomationQueue();
      });

    case "retryAutomationFailed":
      return requireApiPermission(e, "manageNews", function() {
        return retryAutomationFailed();
      });

    case "integrityRepair":
      return requireApiPermission(e, "runLeagueAudit", function() {
        return repairLeagueIntegrity(e);
      });

    case "reliabilityAction":
      return requireApiPermission(e, "manageCache", function(auth) {
        return executeReliabilityAction(e, auth);
      });

    case "awardAchievement":
      return awardAchievement(e);

    case "rebuildAchievements":
      return rebuildAchievements(e);

    default:
      return jsonOutput({
        success: false,
        error: "Unknown API action."
      });

    }
  }
  finally {
    endApiPipelineStage(
      "endpointExecution",
      endpointExecutionStart,
      {}
    );
  }
}

function doPost(e) {

  let action = "";

  try {

    action =
      (e && e.parameter && e.parameter.action)
        ? e.parameter.action
        : "";

    API_PIPELINE_CONTEXT =
      createApiPipelineContext(
        action,
        action === "session" ? getApiCorrelationRequestId(e) : ""
      );

    if (action === "session") {
      logAuthSessionCorrelation({
        requestReceived: true,
        credentialPresent: !!(
          e && e.parameter &&
          (e.parameter.authToken || e.parameter.idToken || e.parameter.credential)
        )
      });
    }

    recordApiPipelineStage(
      "requestReceived",
      0,
      API_PIPELINE_CONTEXT.startTime,
      API_PIPELINE_CONTEXT.startTime,
      {
        action: action,
        method: "POST"
      }
    );

    const parameterParsingStart =
      startApiPipelineStage("parameterParsing");

    endApiPipelineStage(
      "parameterParsing",
      parameterParsingStart,
      {
        action: action
      }
    );

    return handleApiPost(e, action);
  }
  catch (err) {
    logAuthSessionCorrelation({
      exceptionThrown: true,
      credentialPresent:
        API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.credentialPresent === true
    });
    return jsonExceptionOutput(
      err,
      action,
      "doPost"
    );
  }
}

function handleApiPost(e, action) {
  const endpointExecutionStart =
    startApiPipelineStage("endpointExecution");

  try {
    switch (action) {

    case "session":
      return getAuthSession(e);

    case "commissionerLogin":
      return commissionerLogin(e);

    case "commissionerPasswordStatus":
      return getCommissionerPasswordStatus();

    case "setupCommissionerPassword":
      return setupCommissionerPassword(e);

    case "commissionerLogout":
      return commissionerLogout(e);

    case "submitArmyList":
      return submitArmyList(e);

    case "submitLeagueResult":
      return submitLeagueResult(e);

    case "submitCasualResult":
      return submitCasualResult(e);

    case "voteArmyList":
      return requireApiPermission(e, "vote", function() {
        return voteArmyList(e);
      });

    case "updateProfile":
      return updateMyProfile(e);

    case "heartbeat":
      return updateHeartbeat(e);

    case "notificationState":
      return updateNotificationState(e);

    case "seasonAvailability":
      return updateSeasonAvailability(e);

    case "schedulingAvailability":
      return updateSchedulingAvailability(e);

    case "createSchedulingRequest":
      return createSchedulingRequest(e);

    case "respondSchedulingRequest":
      return respondSchedulingRequest(e);

    case "registerForEvent":
      return registerForEvent(e);

    case "withdrawEventRegistration":
      return withdrawEventRegistration(e);

    case "manageEventRegistration":
      return manageEventRegistration(e);

    case "eventManagerEvent":
      return saveEventManagerEvent(e);

    case "eventManagerRegistration":
      return setEventManagerRegistration(e);

    case "eventManagerLifecycle":
      return setEventManagerLifecycle(e);

    case "eventManagerCurrentEvent":
      return setEventManagerCurrentEvent(e);

    case "eventManagerParticipant":
      return saveEventManagerParticipant(e);

    case "eventManagerTeam":
      return saveEventManagerTeam(e);

    case "eventManagerPairing":
      return saveEventManagerPairing(e);

    case "leagueOperationsSave":
      return saveLeagueOperations(e);

    case "exportEventRegistrations":
      return exportEventRegistrations(e);

    case "teamTournamentRegister":
      return registerForEvent(e);

    case "teamTournamentTeam":
      return saveTeamTournamentTeam(e);

    case "teamTournamentPairing":
      return saveTeamTournamentPairing(e);

    case "teamTournamentInvitation":
      return saveTeamTournamentInvitation(e);

    case "teamTournamentResult":
      return saveTeamTournamentResult(e);

    case "teamTournamentRound":
      return advanceTeamTournamentRound(e);

    case "updateSettings":
      return requireApiPermission(e, "manageSettings", function() {
        return updateOperationsSettings(e);
      });

    case "approveArmyList":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "rejectArmyList":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "updateArmyList":
      return legacyStandaloneArmyListWorkflowDisabled();

    case "correctGameScore":
      return requireApiPermission(e, "dataCorrections", function(auth) {
        return correctGameScore(e, auth);
      });

    case "repairHistoricalArmyCodes":
      return requireApiPermission(e, "dataCorrections", function(auth) {
        return repairHistoricalArmyCodes(e, auth);
      });

    case "linkHistoricalArmyLists":
      return linkHistoricalArmyLists(e);

    case "saveStream":
      return requireApiPermission(e, "manageStreams", function() {
        return saveOperationsStream(e);
      });

    case "deleteStream":
      return requireApiPermission(e, "manageStreams", function() {
        return deleteOperationsStream(e);
      });

    case "saveNews":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsNews(e);
      });

    case "deleteNews":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsNews(e);
      });

    case "saveAlert":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsAlert(e);
      });

    case "deleteAlert":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsAlert(e);
      });

    case "saveTimelineEntry":
      return requireApiPermission(e, "manageNews", function() {
        return saveOperationsTimelineEntry(e);
      });

    case "deleteTimelineEntry":
      return requireApiPermission(e, "manageNews", function() {
        return deleteOperationsTimelineEntry(e);
      });

    case "clearCache":
      return requireApiPermission(e, "manageCache", function() {
        return clearOperationsCache();
      });

    case "refreshCache":
      return requireApiPermission(e, "manageCache", function() {
        return refreshOperationsCache(e);
      });

    case "refreshArmyIntelligence":
      return requireArmyIntelligenceWorkerOrPermission(e, function() {
        return refreshArmyIntelligence(e);
      });

    case "installArmyIntelligenceScheduler":
      return requireArmyIntelligenceWorkerOrPermission(e, function() {
        return jsonOutput(installArmyIntelligenceRefreshScheduler(e));
      });

    case "rebuildStatistics":
      return requireApiPermission(e, "manageCache", function() {
        return rebuildOperationsStatistics();
      });

    case "seasonOperation":
      return requireApiPermission(e, "runSeasonControl", function() {
        return executeSeasonOperation(e);
      });

    case "operationsCommand":
      return requireApiPermission(e, "runSeasonControl", function() {
        return executeOperationsCommand(e);
      });

    case "identityBulkEnable":
      return requireApiPermission(e, "manageSettings", function() {
        return bulkEnableIdentityUsers(e);
      });

    case "identityBulkDisable":
      return requireApiPermission(e, "manageSettings", function() {
        return bulkDisableIdentityUsers(e);
      });

    case "repairIdentity":
      return requireApiPermission(e, "manageSettings", function() {
        return repairIdentityMappings();
      });

    case "repairUsersSheet":
      return requireApiPermission(e, "manageSettings", function() {
        return repairUsersSheet();
      });

    case "repairMissingAccounts":
      return requireApiPermission(e, "manageSettings", function() {
        return repairMissingAccounts();
      });

    case "updateDiscordSettings":
      return requireApiPermission(e, "manageSettings", function() {
        return updateDiscordSettings(e);
      });

    case "testDiscordWebhook":
      return requireApiPermission(e, "manageSettings", function() {
        return testDiscordWebhook(e);
      });

    case "previewDiscordAnnouncement":
      return requireApiPermission(e, "viewOperations", function() {
        return jsonOutput(previewDiscordAnnouncement(e));
      });

    case "sendDiscordAnnouncement":
      return requireApiPermission(e, "manageNews", function() {
        return sendDiscordAnnouncement(e);
      });

    case "resendDiscordAnnouncement":
      return requireApiPermission(e, "manageNews", function() {
        return resendDiscordAnnouncement(e);
      });

    case "disableDiscordAutomation":
      return requireApiPermission(e, "manageSettings", function() {
        return disableDiscordAutomation();
      });

    case "runDiscordAutomationJob":
      return requireApiPermission(e, "manageNews", function() {
        return runDiscordAutomationJob(e);
      });

    case "publishAutomationEvent":
      return requireApiPermission(e, "manageNews", function() {
        return publishAutomationEvent(e);
      });

    case "updateAutomationRule":
      return requireApiPermission(e, "manageSettings", function() {
        return updateAutomationRule(e);
      });

    case "updateAutomationTemplate":
      return requireApiPermission(e, "manageSettings", function() {
        return updateAutomationTemplate(e);
      });

    case "runAutomation":
      return requireApiPermission(e, "manageNews", function() {
        return runAutomation(e);
      });

    case "pauseAutomation":
      return requireApiPermission(e, "manageSettings", function() {
        return pauseAutomation();
      });

    case "resumeAutomation":
      return requireApiPermission(e, "manageSettings", function() {
        return resumeAutomation();
      });

    case "replayLastAutomationEvent":
      return requireApiPermission(e, "manageNews", function() {
        return replayLastAutomationEvent();
      });

    case "replayAutomationWeek":
      return requireApiPermission(e, "manageNews", function() {
        return replayAutomationWeek();
      });

    case "replayAutomationSeason":
      return requireApiPermission(e, "manageNews", function() {
        return replayAutomationSeason();
      });

    case "clearAutomationQueue":
      return requireApiPermission(e, "manageSettings", function() {
        return clearAutomationQueue();
      });

    case "retryAutomationFailed":
      return requireApiPermission(e, "manageNews", function() {
        return retryAutomationFailed();
      });

    case "integrityRepair":
      return requireApiPermission(e, "runLeagueAudit", function() {
        return repairLeagueIntegrity(e);
      });

    case "reliabilityAction":
      return requireApiPermission(e, "manageCache", function(auth) {
        return executeReliabilityAction(e, auth);
      });

    case "awardAchievement":
      return awardAchievement(e);

    case "rebuildAchievements":
      return rebuildAchievements(e);

    default:
      return doGet(e);

    }
  }
  finally {
    endApiPipelineStage(
      "endpointExecution",
      endpointExecutionStart,
      {}
    );
  }
}

function jsonOutput(data) {

  if (API_PIPELINE_CONTEXT) {
    finalizeApiPipelineEndpointExecution();

    if (data && typeof data === "object" && data !== null) {
      data.pipelineDiagnostics = getApiPipelineDiagnostics();
    }
  }

  const jsonSerializationStart =
    API_PIPELINE_CONTEXT
      ? startApiPipelineStage("jsonSerialization")
      : 0;

  const json =
    JSON.stringify(data);

  if (API_PIPELINE_CONTEXT) {
    endApiPipelineStage(
      "jsonSerialization",
      jsonSerializationStart,
      {
        bytes: json.length
      }
    );

    if (data && typeof data === "object" && data !== null) {
      data.pipelineDiagnostics = getApiPipelineDiagnostics();
    }
  }

  const finalJson =
    JSON.stringify(data);

  if (API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.action === "session") {
    logAuthSessionCorrelation({
      requestCompleted: true,
      jsonGenerated: true,
      authenticationResult:
        data && data.authenticated
          ? "authenticated"
          : (data && data.code ? String(data.code) : "unauthenticated"),
      credentialPresent: API_PIPELINE_CONTEXT.credentialPresent === true
    });
  }

  const output =
    ContentService
      .createTextOutput(finalJson)
      .setMimeType(ContentService.MimeType.JSON);

  if (API_PIPELINE_CONTEXT) {
    recordApiPipelineStage(
      "responseReturned",
      Date.now() - API_PIPELINE_CONTEXT.startTime,
      API_PIPELINE_CONTEXT.startTime,
      Date.now(),
      {}
    );

    logApiPipelineTiming();
    clearApiPipelineContext();
  }

  return output;

}

function jsonExceptionOutput(err, action, endpoint) {

  try {

    let context = {};

    try {
      context =
        API_PIPELINE_CONTEXT
          ? getApiPipelineDiagnostics()
          : {};
    }
    catch (diagnosticsErr) {
      context = {
        diagnosticsError: safeApiString(diagnosticsErr)
      };
    }

    const requestId =
      API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.requestId
        ? API_PIPELINE_CONTEXT.requestId
        : "api-" + Math.random().toString(36).slice(2);

    const pipelineStage =
      API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.currentStage
        ? API_PIPELINE_CONTEXT.currentStage
        : "unknown";

    const exceptionText =
      safeApiString(err);
    const messageText =
      err && err.message
        ? safeApiString(err.message)
        : exceptionText;
    const stackText =
      err && err.stack
        ? safeApiString(err.stack)
        : "";

    const payload = {
      success: false,
      errorType: "UNCAUGHT_EXCEPTION",
      exception: exceptionText,
      message: messageText,
      stack: stackText,
      action: safeApiString(action || ""),
      requestId: requestId,
      pipelineStage: pipelineStage,
      authenticated:
        API_PIPELINE_CONTEXT
          ? !!API_PIPELINE_CONTEXT.authenticated
          : false,
      userEmail:
        API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.userEmail
          ? safeApiString(API_PIPELINE_CONTEXT.userEmail)
          : "",
      endpoint: safeApiString(endpoint || ""),
      timestamp: getApiForensicTimestamp(),
      diagnostics: context
    };

    recordApiForensicLog(
      endpoint || "api",
      pipelineStage,
      "uncaughtExceptionJsonReturned",
      API_PIPELINE_CONTEXT
        ? API_PIPELINE_CONTEXT.startTime
        : Date.now(),
      {
        exception: payload.exception,
        message: payload.message
      }
    );

    const json =
      safeApiJsonStringify(
        payload,
        {
          success: false,
          errorType: "UNCAUGHT_EXCEPTION",
          exception: payload.exception || "",
          message: payload.message || "",
          action: safeApiString(action || ""),
          requestId: requestId,
          pipelineStage: pipelineStage,
          endpoint: safeApiString(endpoint || ""),
          timestamp: getApiForensicTimestamp(),
          diagnosticsSerializationFailed: true
        }
      );

    try {
      Logger.log(
        "API_UNCAUGHT_EXCEPTION " +
          json
      );
    }
    catch (logErr) {
    }

    clearApiPipelineContext();

    try {
      return ContentService
        .createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
    }
    catch (outputErr) {
      clearApiPipelineContext();

      return ContentService
        .createTextOutput(
          '{"success":false,"errorType":"UNCAUGHT_EXCEPTION","message":"Forensic exception output failed."}'
        )
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  catch (handlerErr) {
    clearApiPipelineContext();

    return ContentService
      .createTextOutput(
        '{"success":false,"errorType":"UNCAUGHT_EXCEPTION","message":"Forensic exception handler failed before payload construction."}'
      )
      .setMimeType(ContentService.MimeType.JSON);
  }

}

function legacyStandaloneArmyListWorkflowDisabled() {

  return jsonOutput({
    success: false,
    error:
      "Standalone Army List submissions are no longer supported. Submit games with Army Lists through Submit Game."
  });

}
