/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * OperationsApi.gs
 *
 * Commissioner operations center APIs.
 *******************************************************/

const COMMISSIONER_NEWS_HEADERS = [
  "Date",
  "Title",
  "Body",
  "Link",
  "Related Player",
  "Related Faction",
  "Related Mission",
  "Pinned",
  "Archived"
];

function getOperationsDashboard() {

  const armyLists =
    getArmyListObjects();

  const pendingArmyLists =
    armyLists.filter(function(list) {

      return !list.approved;

    });

  const streams =
    getOperationsStreams();

  const news =
    getOperationsNews();

  const games =
    getAllRecentGameObjects();

  const settings =
    getSettingsObject();

  const audit =
    buildLeagueAudit();

  const identityStatus =
    getOperationsIdentityStatus();

  const notificationStatus =
    getOperationsNotificationStatus();

  return jsonOutput({
    success: true,
    summary: {
      pendingArmyLists: pendingArmyLists.length,
      pendingStreams: streams.filter(function(stream) {
        return stream.youtubeUrl === "";
      }).length,
      pendingNews: news.filter(function(item) {
        return !item.archived;
      }).length,
      recentMatchSubmissions: games.slice(0, 5),
      leagueStatistics: {
        games: games.length,
        activePlayers: getOperationsActivePlayers(),
        factions: buildFactionApiSummaries().length,
        missions: buildMissionApiSummaries().length
      },
      cacheStatus: getOperationsCacheStatus(),
      systemHealth: getOperationsSystemHealth(),
      leagueAuditSummary: audit.summary,
      seasonStatus: getSeasonStatusObject(),
      identityStatus: identityStatus,
      notificationStatus: notificationStatus,
      deploymentStatus:
        getOperationsDeploymentStatus(settings),
      discordStatus:
        getDiscordOperationsStatus()
    },
    pendingArmyLists: pendingArmyLists,
    streams: streams,
    news: news,
    players: getOperationsPlayers(),
    identity: getOperationsIdentityManagement(),
    eventLifecycle:
      buildEventLifecycleDashboard(EVENT_ENGINE_DEFAULT_EVENT_ID),
    discord: getDiscordOperationsStatus(),
    settings: settings,
    audit: audit
  });

}

function getOperationsSummaryDashboard() {

  return jsonOutput(buildOperationsDashboardPayload({
    eventLifecycle:
      buildEventLifecycleSummaryDashboard(EVENT_ENGINE_DEFAULT_EVENT_ID)
  }));

}

function getOperationsLifecycleDashboard() {

  return jsonOutput(buildOperationsDashboardPayload({
    eventLifecycle:
      buildEventLifecycleDashboard(EVENT_ENGINE_DEFAULT_EVENT_ID)
  }));

}

function getOperationsIdentityDashboard() {

  return jsonOutput(buildOperationsDashboardPayload({
    identity:
      getOperationsIdentityManagement(),
    players:
      getOperationsPlayers()
  }));

}

function getOperationsContentDashboard() {

  const armyLists =
    getArmyListObjects();

  return jsonOutput(buildOperationsDashboardPayload({
    pendingArmyLists:
      armyLists.filter(function(list) {
        return !list.approved;
      }),
    streams:
      getOperationsStreams(),
    news:
      getOperationsNews()
  }));

}

function getOperationsDiscordDashboard() {

  const discord =
    getDiscordOperationsStatus();

  return jsonOutput(buildOperationsDashboardPayload({
    discord: discord,
    summaryOverrides: {
      discordStatus: discord
    }
  }));

}

function getOperationsNotificationsDashboard() {

  const notificationStatus =
    getOperationsNotificationStatus();

  return jsonOutput(buildOperationsDashboardPayload({
    summaryOverrides: {
      notificationStatus: notificationStatus
    }
  }));

}

function getOperationsAudit() {

  const audit =
    buildLeagueAudit();

  return jsonOutput(buildOperationsDashboardPayload({
    audit: audit,
    summaryOverrides: {
      leagueAuditSummary: audit.summary
    }
  }));

}

function getOperationsSeason() {

  return jsonOutput({
    success: true,
    season: getSeasonStatusObject(),
    promotionRelegation: buildPromotionRelegationProposal(),
    archive: getSeasonArchiveRows()
  });

}

function buildOperationsDashboardPayload(overrides) {

  const options =
    overrides || {};

  const settings =
    options.settings || getSettingsObject();

  const summary =
    buildOperationsSummaryPayload(settings);

  const summaryOverrides =
    options.summaryOverrides || {};

  Object.keys(summaryOverrides).forEach(function(key) {
    summary[key] = summaryOverrides[key];
  });

  return {
    success: true,
    summary: summary,
    pendingArmyLists:
      options.pendingArmyLists || [],
    streams:
      options.streams || [],
    news:
      options.news || [],
    players:
      options.players || [],
    identity:
      options.identity || buildEmptyOperationsIdentityManagement(),
    eventLifecycle:
      options.eventLifecycle ||
      buildEventLifecycleSummaryDashboard(EVENT_ENGINE_DEFAULT_EVENT_ID),
    discord:
      options.discord || buildEmptyOperationsDiscordStatus(),
    settings: settings,
    audit:
      options.audit || buildEmptyOperationsAudit()
  };

}

function buildOperationsSummaryPayload(settings) {

  const recentGames =
    getAllRecentGameObjects();

  const streams =
    getOperationsStreams();

  const news =
    getOperationsNews();

  const armyLists =
    getArmyListObjects();

  const auditSummary =
    getIntegritySnapshotAuditSummary();

  return {
    pendingArmyLists:
      armyLists.filter(function(list) {
        return !list.approved;
      }).length,
    pendingStreams:
      streams.filter(function(stream) {
        return stream.youtubeUrl === "";
      }).length,
    pendingNews:
      news.filter(function(item) {
        return !item.archived;
      }).length,
    recentMatchSubmissions:
      recentGames.slice(0, 5),
    leagueStatistics: {
      games: recentGames.length,
      activePlayers:
        getOperationsActivePlayers(),
      factions:
        buildFactionApiSummaries().length,
      missions:
        buildMissionApiSummaries().length
    },
    cacheStatus:
      getOperationsCacheStatus(),
    systemHealth:
      getOperationsSystemHealth(),
    leagueAuditSummary:
      auditSummary,
    seasonStatus:
      getSeasonStatusObject(),
    identityStatus:
      getOperationsIdentityStatus(),
    notificationStatus:
      getOperationsNotificationStatus(),
    deploymentStatus:
      getOperationsDeploymentStatus(settings),
    discordStatus:
      buildEmptyOperationsDiscordStatus()
  };

}

function buildEmptyOperationsIdentityManagement() {

  return {
    records: [],
    audits: []
  };

}

function buildEmptyOperationsDiscordStatus() {

  return {
    enabled: false,
    configured: false,
    webhookMasked: "",
    announcementChannel: "",
    adminChannel: "",
    rateLimitPerHour: 0,
    retryLimit: 0,
    automationEvents: [],
    lastAutomationRun: "",
    queueDepth: 0,
    failures: 0,
    lastResult: null,
    log: [],
    preview: {
      event: "",
      label: "",
      content: "",
      embeds: []
    }
  };

}

function buildEmptyOperationsAudit() {

  return {
    summary: {
      critical: 0,
      warning: 0,
      informational: 0
    },
    issues: []
  };

}

function getOperationsStatus(auth) {

  const settings =
    getSettingsObject();

  return jsonOutput({
    success: true,
    status: {
      currentUser:
        auth && auth.user
          ? auth.user
          : buildGuestUser(),
      authenticationStatus:
        auth && auth.authenticated
          ? "Authenticated"
          : "Guest",
      role:
        auth && auth.user
          ? auth.user.role
          : USER_ROLES.GUEST,
      appsScript: "Online",
      googleSheets: "Online",
      cache: getOperationsCacheStatus(),
      lastSync: getOperationsTimestamp(),
      portalVersion: settings.portalVersion || "1.2.2",
      appsScriptVersion: "Version 1.2.2",
      vercelDeployment: settings.deploymentUrl || "",
      gitCommit: settings.gitCommit || ""
    }
  });

}

function updateOperationsSettings(e) {

  const params =
    getOperationsParams(e);

  const sheet =
    ensureSettingsSheet();

  const columns =
    getSettingsColumns(sheet);

  const keys =
    [
      "currentSeason",
      "leagueName",
      "googleFormUrl",
      "submissionEnabled",
      "submissionButtonText",
      "submissionButtonVisible",
      "discordInvite",
      "leagueWebsite",
      "bannerImage",
      "leagueLogo",
      "commissionerContact",
      "themeAccentColor",
      "seasonStartDate",
      "seasonEndDate",
      "registrationOpen",
      "googleOAuthClientId",
      "commissionerEmails",
      "portalVersion",
      "gitCommit",
      "deploymentUrl"
    ];

  if (
    params.googleFormUrl !== undefined &&
    String(params.googleFormUrl).trim() !== "" &&
    !isOperationsValidUrl(params.googleFormUrl)
  )
    return jsonOutput({
      success: false,
      error: "Google Form URL must be a valid http or https URL."
    });

  keys.forEach(function(key) {

    if (params[key] !== undefined)
      setSettingsValue(
        sheet,
        columns,
        key,
        String(params[key]).trim()
      );

  });

  invalidatePortalCacheGroup("settings");

  return jsonOutput({
    success: true
  });

}

function isOperationsValidUrl(value) {

  const text =
    String(value || "").trim();

  return /^https?:\/\/[^\s]+$/i.test(text);

}

function approveArmyList(e) {

  return setArmyListApproval(
    e,
    true
  );

}

function rejectArmyList(e) {

  return setArmyListApproval(
    e,
    false
  );

}

function updateArmyList(e) {

  const params =
    getOperationsParams(e);

  const id =
    Number(params.id) || 0;

  const sheet =
    getArmyListSheet();

  const rowNumber =
    id + 1;

  if (
    rowNumber < 2 ||
    rowNumber > sheet.getLastRow()
  )
    return jsonOutput({
      success: false,
      error: "Army list not found."
    });

  const editable = {
    player: ARMY_LIST_COLUMNS.PLAYER,
    faction: ARMY_LIST_COLUMNS.FACTION,
    sectorial: ARMY_LIST_COLUMNS.SECTORIAL,
    mission: ARMY_LIST_COLUMNS.MISSION,
    event: ARMY_LIST_COLUMNS.EVENT,
    armyCode: ARMY_LIST_COLUMNS.ARMY_CODE,
    armyLink: ARMY_LIST_COLUMNS.ARMY_LINK,
    armyName: ARMY_LIST_COLUMNS.ARMY_NAME,
    description: ARMY_LIST_COLUMNS.DESCRIPTION
  };

  for (const key in editable) {

    if (params[key] !== undefined) {
      const value =
        key === "faction"
          ? canonicalizeArmyParentFaction(params[key])
          : key === "sectorial"
            ? canonicalizeArmyName(params[key])
            : String(params[key]).trim();

      sheet
        .getRange(
          rowNumber,
          editable[key] + 1
        )
        .setValue(
          value
        );
    }

  }

  invalidatePortalCacheGroup("armyLists");

  return jsonOutput({
    success: true
  });

}

function setArmyListApproval(e, approved) {

  const id =
    Number(
      getOperationsParams(e).id
    ) || 0;

  const sheet =
    getArmyListSheet();

  const rowNumber =
    id + 1;

  if (
    rowNumber < 2 ||
    rowNumber > sheet.getLastRow()
  )
    return jsonOutput({
      success: false,
      error: "Army list not found."
    });

  sheet
    .getRange(
      rowNumber,
      ARMY_LIST_COLUMNS.APPROVED + 1
    )
    .setValue(approved);

  invalidatePortalCacheGroup("armyLists");

  if (approved)
    triggerDiscordAutomation(
      "armyListApproved",
      {
        message: "An army list was approved for league publication."
      }
    );

  return jsonOutput({
    success: true
  });

}

function saveOperationsStream(e) {

  const params =
    getOperationsParams(e);

  const sheet =
    ensureStreamsSheet();

  const id =
    Number(params.id) || 0;

  const row =
    [
      params.date || "",
      params.division || "",
      params.mission || "",
      params.player1 || "",
      canonicalizeArmyName(params.player1Faction),
      params.player2 || "",
      canonicalizeArmyName(params.player2Faction),
      params.youtubeUrl || "",
      getOperationsBoolean(params.featured)
    ];

  const rowNumber =
    id > 0
      ? id + 1
      : sheet.getLastRow() + 1;

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      STREAM_HEADERS.length
    )
    .setValues([row]);

  invalidatePortalCacheGroup("streams");

  triggerDiscordAutomation(
    "streamScheduled",
    {
      message:
        (params.player1 || "Player 1") +
        " vs " +
        (params.player2 || "Player 2") +
        " stream scheduled on " +
        (params.mission || "an unrecorded mission") +
        ".",
      division: params.division || ""
    }
  );

  return jsonOutput({
    success: true
  });

}

function deleteOperationsStream(e) {

  const id =
    Number(
      getOperationsParams(e).id
    ) || 0;

  const sheet =
    ensureStreamsSheet();

  if (
    id < 1 ||
    id + 1 > sheet.getLastRow()
  )
    return jsonOutput({
      success: false,
      error: "Stream not found."
    });

  sheet.deleteRow(id + 1);
  invalidatePortalCacheGroup("streams");

  return jsonOutput({
    success: true
  });

}

function saveOperationsNews(e) {

  const params =
    getOperationsParams(e);

  const sheet =
    ensureCommissionerNewsSheet();

  const id =
    Number(params.id) || 0;

  const row =
    [
      params.date || getOperationsTimestamp(),
      params.title || "",
      params.body || "",
      params.link || "",
      params.relatedPlayer || "",
      params.relatedFaction || "",
      params.relatedMission || "",
      getOperationsBoolean(params.pinned),
      getOperationsBoolean(params.archived)
    ];

  const rowNumber =
    id > 0
      ? id + 1
      : sheet.getLastRow() + 1;

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      COMMISSIONER_NEWS_HEADERS.length
    )
    .setValues([row]);

  invalidatePortalCacheGroup("news");

  triggerDiscordAutomation(
    "commissionerNews",
    {
      message:
        params.title ||
        "Commissioner news published."
    }
  );

  return jsonOutput({
    success: true
  });

}

function deleteOperationsNews(e) {

  const id =
    Number(
      getOperationsParams(e).id
    ) || 0;

  const sheet =
    ensureCommissionerNewsSheet();

  if (
    id < 1 ||
    id + 1 > sheet.getLastRow()
  )
    return jsonOutput({
      success: false,
      error: "News item not found."
    });

  sheet.deleteRow(id + 1);
  invalidatePortalCacheGroup("news");

  return jsonOutput({
    success: true
  });

}

function clearOperationsCache() {

  invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true,
    cache: getOperationsCacheStatus()
  });

}

function refreshOperationsCache(e) {

  const group =
    String(
      getOperationsParams(e).group || "all"
    ).trim();

  invalidatePortalCacheGroup(group);

  return jsonOutput({
    success: true,
    cache: getOperationsCacheStatus(),
    group: group
  });

}

function rebuildOperationsStatistics() {

  try {

    if (typeof rebuildEverything === "function")
      rebuildEverything();

    clearLeagueData();
    invalidatePortalCacheGroup("all");

    return jsonOutput({
      success: true
    });

  }
  catch (err) {

    return jsonOutput({
      success: false,
      error: String(err)
    });

  }

}

function executeSeasonOperation(e) {

  const operation =
    String(
      getOperationsParams(e).operation || ""
    ).trim();

  const sheet =
    ensureSeasonArchiveSheet();

  sheet.appendRow([
    getOperationsTimestamp(),
    operation,
    JSON.stringify(getSeasonStatusObject())
  ]);

  invalidatePortalCacheGroup("all");

  if (operation === "Promotion")
    triggerDiscordAutomation(
      "promotion",
      {}
    );

  if (operation === "Relegation")
    triggerDiscordAutomation(
      "relegation",
      {}
    );

  if (operation === "Season Start")
    triggerDiscordAutomation(
      "seasonStarted",
      {}
    );

  if (operation === "Season End")
    triggerDiscordAutomation(
      "seasonEnded",
      {}
    );

  return jsonOutput({
    success: true
  });

}

function triggerDiscordAutomation(event, params) {

  try {

    if (typeof publishLeagueAutomationEvent !== "function")
      return;

    publishLeagueAutomationEvent({
      eventType: event,
      category:
        params && params.category
          ? params.category
          : "",
      priority:
        params && params.priority
          ? params.priority
          : "",
      player:
        params && params.player
          ? params.player
          : "",
      division:
        params && params.division
          ? params.division
          : "",
      message:
        params && params.message
          ? params.message
          : "",
      payload:
        JSON.stringify(params || {})
    });

  }
  catch (err) {

    Logger.log(
      "Discord automation failed for " +
      event +
      ": " +
      String(err && err.message ? err.message : err)
    );

  }

}

function executeOperationsCommand(e) {

  const params =
    getOperationsParams(e);

  const command =
    getOperationsString(params.command);

  const sheet =
    ensureSeasonArchiveSheet();

  sheet.appendRow([
    getOperationsTimestamp(),
    command,
    JSON.stringify({
      status: "recorded",
      requestedBy: getOperationsString(params.requestedBy),
      snapshot: getSeasonStatusObject()
    })
  ]);

  if (
    command === "Backup" ||
    command === "Export"
  )
    return jsonOutput({
      success: true,
      export: {
        generatedAt: getOperationsTimestamp(),
        settings: getSettingsObject(),
        players: getOperationsPlayers(),
        audit: buildLeagueAudit()
      }
    });

  invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true
  });

}

function bulkEnableIdentityUsers(e) {

  return setIdentityUsersEnabled(
    e,
    true
  );

}

function bulkDisableIdentityUsers(e) {

  return setIdentityUsersEnabled(
    e,
    false
  );

}

function setIdentityUsersEnabled(e, enabled) {

  const emails =
    getOperationsString(getOperationsParams(e).emails)
      .split(",")
      .map(function(email) {
        return getOperationsString(email).toLowerCase();
      })
      .filter(function(email) {
        return email !== "";
      });

  const sheet =
    ensureUsersSheet();

  const columns =
    getUsersColumns(sheet);

  emails.forEach(function(email) {

    const rowNumber =
      getUserRowNumber(
        sheet,
        columns,
        email
      );

    if (rowNumber !== -1)
      sheet
        .getRange(rowNumber, columns.enabled + 1)
        .setValue(enabled);

  });

  invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true
  });

}

function repairIdentityMappings() {

  repairUsersSheet();
  repairMissingIdentityAccounts();
  enableLinkedIdentityUsers();

  invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true
  });

}

function repairUsersSheet() {

  ensureUsersSheet();

  return jsonOutput({
    success: true
  });

}

function repairMissingAccounts() {

  repairMissingIdentityAccounts();
  invalidatePortalCacheGroup("all");

  return jsonOutput({
    success: true
  });

}

function repairMissingIdentityAccounts() {

  const sheet =
    ensureUsersSheet();

  const columns =
    getUsersColumns(sheet);

  const players =
    getOperationsLeagueIdentityRows();

  players.forEach(function(player) {

    if (player.email === "")
      return;

    if (
      getUserRowNumber(
        sheet,
        columns,
        player.email
      ) !== -1
    )
      return;

    createUserRow(
      sheet,
      columns,
      {
        email: player.email,
        displayName: player.player,
        avatarUrl: ""
      },
      USER_ROLES.MEMBER,
      true
    );

  });

}

function enableLinkedIdentityUsers() {

  const sheet =
    ensureUsersSheet();

  const columns =
    getUsersColumns(sheet);

  getOperationsLeagueIdentityRows()
    .forEach(function(player) {

      if (player.email === "")
        return;

      const rowNumber =
        getUserRowNumber(
          sheet,
          columns,
          player.email
        );

      if (rowNumber === -1)
        return;

      activateLinkedLeagueMember(
        sheet,
        columns,
        rowNumber
      );

    });

}

function buildLeagueAudit() {

  const issues = [];
  const games =
    getAllRecentGameObjects();
  const players =
    getOperationsPlayers();
  const streams =
    getOperationsStreams();
  const armyLists =
    getArmyListObjects();
  const settings =
    getSettingsObject();
  const identity =
    getOperationsIdentityStatus();

  players.forEach(function(player) {

    if (player.games === 0)
      issues.push(buildAuditIssue("warning", player.player + " has zero games.", "Schedule a match or confirm inactive status.", "/players/" + encodeURIComponent(player.player)));

    if (player.games < 1)
      issues.push(buildAuditIssue("info", player.player + " may be behind schedule.", "Review weekly match cadence.", "/players/" + encodeURIComponent(player.player)));

  });

  games.forEach(function(game) {

    if (!game.winnerFaction || !game.loserFaction)
      issues.push(buildAuditIssue("warning", "Missing faction data for " + game.winner + " vs " + game.loser + ".", "Update Game Analytics faction fields.", "/games/" + game.id));

    if (!game.mission)
      issues.push(buildAuditIssue("warning", "Missing mission data for game #" + game.id + ".", "Update the match record mission.", "/games/" + game.id));

  });

  streams.forEach(function(stream) {

    if (!stream.youtubeUrl)
      issues.push(buildAuditIssue("warning", "Stream missing YouTube URL.", "Add a valid YouTube URL.", "/streams"));

    if (stream.youtubeUrl && !isStreamYoutubeUrl(stream.youtubeUrl))
      issues.push(buildAuditIssue("critical", "Potentially broken stream URL.", "Replace with a YouTube URL.", "/streams"));

  });

  armyLists.forEach(function(list) {

    if (!list.faction || !list.armyName)
      issues.push(buildAuditIssue("warning", "Army list missing required metadata.", "Edit the army list submission.", "/army-lists"));

  });

  if (
    settings.googleFormUrl &&
    settings.googleFormUrl.indexOf("http") !== 0
  )
    issues.push(buildAuditIssue("critical", "Invalid Google Form URL.", "Update Match Submission settings.", "/commissioner"));

  if (!settings.googleFormUrl)
    issues.push(buildAuditIssue("info", "Match submission form URL is blank.", "Set a Google Form URL or keep submissions hidden.", "/commissioner"));

  if (identity.unlinkedUsers > 0)
    issues.push(buildAuditIssue("warning", identity.unlinkedUsers + " portal users are not linked to league players.", "Add Google Email values to the Players sheet or remove stale Users rows.", "/commissioner"));

  if (identity.playersWithoutEmail > 0)
    issues.push(buildAuditIssue("warning", identity.playersWithoutEmail + " league players do not have Google Email values.", "Populate the Google Email column on the Players sheet.", "/commissioner"));

  if (identity.playersWithoutUser > 0)
    issues.push(buildAuditIssue("info", identity.playersWithoutUser + " league players have not signed in yet.", "No action required unless access is expected now.", "/commissioner"));

  return {
    summary: {
      critical: issues.filter(function(issue) { return issue.severity === "critical"; }).length,
      warning: issues.filter(function(issue) { return issue.severity === "warning"; }).length,
      informational: issues.filter(function(issue) { return issue.severity === "info"; }).length
    },
    issues: issues
  };

}

function getOperationsIdentityStatus() {

  const users =
    getOperationsUsers();

  const players =
    getOperationsLeagueIdentityRows();

  const playerEmails = {};

  players.forEach(function(player) {
    if (player.email !== "")
      playerEmails[player.email] = true;
  });

  const userEmails = {};

  users.forEach(function(user) {
    if (user.email !== "")
      userEmails[user.email] = true;
  });

  return {
    totalUsers: users.length,
    enabledUsers:
      users.filter(function(user) {
        return user.enabled;
      }).length,
    disabledUsers:
      users.filter(function(user) {
        return !user.enabled;
      }).length,
    linkedUsers:
      users.filter(function(user) {
        return user.email !== "" && playerEmails[user.email];
      }).length,
    unlinkedUsers:
      users.filter(function(user) {
        return user.email !== "" && !playerEmails[user.email];
      }).length,
    commissionerUsers:
      users.filter(function(user) {
        return user.role === USER_ROLES.COMMISSIONER;
      }).length,
    assistantUsers:
      users.filter(function(user) {
        return user.role === USER_ROLES.ASSISTANT;
      }).length,
    playersWithEmail:
      players.filter(function(player) {
        return player.email !== "";
      }).length,
    playersWithoutEmail:
      players.filter(function(player) {
        return player.email === "";
      }).length,
    playersWithoutUser:
      players.filter(function(player) {
        return player.email !== "" && !userEmails[player.email];
      }).length
  };

}

function getOperationsIdentityManagement() {

  const users =
    getOperationsUsers();

  const players =
    getOperationsLeagueIdentityRows();

  const usersByEmail =
    getOperationsRowsByEmail(users);

  const playersByEmail =
    getOperationsRowsByEmail(players);

  const playerNameCounts = {};

  players.forEach(function(player) {
    const key =
      player.player.toLowerCase();
    playerNameCounts[key] =
      (playerNameCounts[key] || 0) + 1;
  });

  const playerEmailCounts =
    getOperationsEmailCounts(players);

  const userEmailCounts =
    getOperationsEmailCounts(users);

  const records =
    players.map(function(player) {

      const user =
        usersByEmail[player.email] || null;

      return buildOperationsIdentityRecord(
        player,
        user,
        playerEmailCounts,
        userEmailCounts,
        playerNameCounts
      );

    });

  users.forEach(function(user) {

    if (
      user.email !== "" &&
      !playersByEmail[user.email]
    )
      records.push(
        buildOperationsIdentityRecord(
          {
            player: "",
            division: "",
            email: user.email
          },
          user,
          playerEmailCounts,
          userEmailCounts,
          playerNameCounts
        )
      );

  });

  return {
    records: records,
    audits: buildOperationsIdentityAudits(records)
  };

}

function buildOperationsIdentityRecord(
  player,
  user,
  playerEmailCounts,
  userEmailCounts,
  playerNameCounts
) {

  const email =
    player.email || (user ? user.email : "");

  const playerName =
    player.player || "";

  const linked =
    playerName !== "" &&
    email !== "" &&
    !!user;

  return {
    id:
      (playerName || "Portal User") +
      "|" +
      email,
    player: playerName,
    displayName:
      player.displayName ||
      playerName,
    division: player.division || "",
    googleEmail: email,
    portalUser:
      user
        ? user.displayName || user.email
        : "",
    role:
      user
        ? user.role
        : "",
    lastLogin:
      user
        ? user.lastLogin
        : "",
    lastSeen:
      user
        ? user.lastSeen
        : "",
    linked: linked,
    enabled:
      user
        ? user.enabled
        : false,
    missingEmail:
      playerName !== "" &&
      email === "",
    duplicateEmail:
      email !== "" &&
      (
        playerEmailCounts[email] > 1 ||
        userEmailCounts[email] > 1
      ),
    duplicatePlayer:
      playerName !== "" &&
      playerNameCounts[playerName.toLowerCase()] > 1,
    neverLoggedIn:
      !user ||
      user.lastLogin === "",
    brokenMapping:
      playerName === "" ||
      (
        email !== "" &&
        !user
      )
  };

}

function getOperationsEmailCounts(rows) {

  const counts = {};

  rows.forEach(function(row) {
    if (row.email === "")
      return;
    counts[row.email] =
      (counts[row.email] || 0) + 1;
  });

  return counts;

}

function buildOperationsIdentityAudits(records) {

  const audits = [];

  records.forEach(function(record) {

    if (record.duplicateEmail)
      audits.push(buildOperationsIdentityAudit("critical", "Duplicate Email", record));

    if (record.duplicatePlayer)
      audits.push(buildOperationsIdentityAudit("critical", "Duplicate Player", record));

    if (record.player === "")
      audits.push(buildOperationsIdentityAudit("warning", "Missing Player", record));

    if (record.missingEmail)
      audits.push(buildOperationsIdentityAudit("warning", "Missing Email", record));

    if (record.brokenMapping)
      audits.push(buildOperationsIdentityAudit("warning", "Broken Mapping", record));

    if (record.neverLoggedIn)
      audits.push(buildOperationsIdentityAudit("info", "Never Logged In", record));

  });

  return audits;

}

function buildOperationsIdentityAudit(severity, type, record) {

  return {
    severity: severity,
    type: type,
    player: record.player,
    googleEmail: record.googleEmail,
    message:
      type +
      ": " +
      (
        record.player ||
        record.googleEmail ||
        "Unknown identity"
      )
  };

}

function getOperationsRowsByEmail(rows) {

  const byEmail = {};

  rows.forEach(function(row) {
    if (row.email !== "")
      byEmail[row.email] = row;
  });

  return byEmail;

}

function getOperationsUsers() {

  const sheet =
    ensureUsersSheet();

  const columns =
    getUsersColumns(sheet);

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  return values
    .slice(1)
    .map(function(row) {
      return {
        email:
          getOperationsString(row[columns.email])
            .toLowerCase(),
        displayName:
          getOperationsString(row[columns.displayName]),
        role:
          normalizeUserRole(row[columns.role]),
        enabled:
          getOperationsBoolean(row[columns.enabled]),
        lastLogin:
          getOperationsString(row[columns.lastLogin]),
        lastSeen:
          getOperationsString(row[columns.lastSeen])
      };
    })
    .filter(function(user) {
      return user.email !== "";
    });

}

function getOperationsLeagueIdentityRows() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  const sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!sheet)
    return [];

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  const headers =
    values[0]
      .map(function(header) {
        return getOperationsString(header);
      });

  const playerCol =
    headers.indexOf("Player");

  const divisionCol =
    headers.indexOf("Division");

  const displayNameCol =
    headers.indexOf("Display Name");

  const emailCol =
    headers.indexOf("Google Email");

  if (playerCol === -1)
    return [];

  return values
    .slice(1)
    .map(function(row) {
      return {
        player:
          getOperationsString(row[playerCol]),
        displayName:
          displayNameCol === -1
            ? getOperationsString(row[playerCol])
            : getOperationsString(row[displayNameCol]) ||
              getOperationsString(row[playerCol]),
        division:
          divisionCol === -1
            ? ""
            : getOperationsString(row[divisionCol]),
        email:
          emailCol === -1
            ? ""
            : getOperationsString(row[emailCol]).toLowerCase()
      };
    })
    .filter(function(player) {
      return player.player !== "";
    });

}

function getOperationsNotificationStatus() {

  const notifications =
    typeof buildLeagueNotifications === "function"
      ? buildLeagueNotifications()
      : [];

  return {
    total: notifications.length,
    highPriority:
      notifications.filter(function(notification) {
        return notification.priority === "high";
      }).length,
    normalPriority:
      notifications.filter(function(notification) {
        return notification.priority !== "high";
      }).length
  };

}

function getOperationsDeploymentStatus(settings) {

  return {
    portalVersion:
      settings.portalVersion || "Not recorded",
    appsScriptVersion: "Version 2.0",
    deploymentUrl:
      settings.deploymentUrl || "",
    gitCommit:
      settings.gitCommit || "Not recorded",
    checkedAt:
      getOperationsTimestamp()
  };

}

function buildAuditIssue(severity, description, suggestedFix, link) {

  return {
    severity: severity,
    description: description,
    suggestedFix: suggestedFix,
    link: link || ""
  };

}

function getOperationsStreams() {

  return JSON.parse(
    getStreams().getContent()
  ).streams || [];

}

function getOperationsNews() {

  const sheet =
    ensureCommissionerNewsSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  return values
    .slice(1)
    .map(function(row, index) {

      return {
        id: index + 1,
        date: getOperationsString(row[0]),
        title: getOperationsString(row[1]),
        body: getOperationsString(row[2]),
        link: getOperationsString(row[3]),
        relatedPlayer: getOperationsString(row[4]),
        relatedFaction: getOperationsString(row[5]),
        relatedMission: getOperationsString(row[6]),
        pinned: getOperationsBoolean(row[7]),
        archived: getOperationsBoolean(row[8])
      };

    })
    .filter(function(item) {

      return item.title || item.body;

    });

}

function ensureCommissionerNewsSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.COMMISSIONER_NEWS
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.COMMISSIONER_NEWS
      );

  sheet
    .getRange(
      1,
      1,
      1,
      COMMISSIONER_NEWS_HEADERS.length
    )
    .setValues([COMMISSIONER_NEWS_HEADERS]);

  return sheet;

}

function getSettingsObject() {

  return JSON.parse(
    getSettings().getContent()
  ).settings || {};

}

function setSettingsValue(sheet, columns, key, value) {

  const values =
    sheet
      .getDataRange()
      .getValues();

  for (
    let index = 1;
    index < values.length;
    index++
  ) {

    if (
      getSettingsString(values[index][columns.key]) === key
    ) {

      sheet
        .getRange(
          index + 1,
          columns.value + 1
        )
        .setValue(value);
      return;

    }

  }

  const row =
    sheet.getLastRow() + 1;

  sheet
    .getRange(row, columns.key + 1)
    .setValue(key);

  sheet
    .getRange(row, columns.value + 1)
    .setValue(value);

}

function getOperationsPlayers() {

  return getSearchPlayers()
    .reduce(function(players, division) {

      return players.concat(
        division.standings.map(function(player) {

          return {
            division: division.divisionLabel,
            player: player.player,
            displayName:
              player.displayName ||
              player.player,
            games: player.games,
            rank: player.rank
          };

        })
      );

    }, []);

}

function getOperationsActivePlayers() {

  return getOperationsPlayers()
    .filter(function(player) {

      return player.games > 0;

    }).length;

}

function getOperationsCacheStatus() {

  return getPortalCacheStatus();

}

function getOperationsSystemHealth() {

  return {
    appsScript: "Online",
    sheets: "Online",
    endpoints: "Online",
    checkedAt: getOperationsTimestamp()
  };

}

function getSeasonStatusObject() {

  const settings =
    getSettingsObject();

  const games =
    getAllRecentGameObjects();

  return {
    currentSeasonName: settings.currentSeason || "Current Season",
    startDate: settings.seasonStartDate || "",
    endDate: settings.seasonEndDate || "",
    weeksCompleted: getSeasonWeeksCompleted(settings.seasonStartDate),
    matchesPlayed: games.length,
    remainingMatches: Math.max(0, getOperationsPlayers().length - games.length),
    registrationOpen: settings.registrationOpen === "true"
  };

}

function buildPromotionRelegationProposal() {

  const main =
    buildStandingsResponse(
      getStandingsDivisionConfig("main")
    ).standings;

  const pga =
    buildStandingsResponse(
      getStandingsDivisionConfig("pga")
    ).standings;

  const pgb =
    buildStandingsResponse(
      getStandingsDivisionConfig("pgb")
    ).standings;

  return {
    relegatedFromMain:
      main.slice(-2),
    promotedFromProvingGroundsA:
      pga.slice(0, 2),
    promotedFromProvingGroundsB:
      pgb.slice(0, 2)
  };

}

function getSeasonArchiveRows() {

  const sheet =
    ensureSeasonArchiveSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  return values
    .slice(1)
    .map(function(row) {

      return {
        date: getOperationsString(row[0]),
        operation: getOperationsString(row[1]),
        snapshot: getOperationsString(row[2])
      };

    });

}

function ensureSeasonArchiveSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.SEASON_ARCHIVE
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.SEASON_ARCHIVE
      );

  sheet
    .getRange(1, 1, 1, 3)
    .setValues([[
      "Date",
      "Operation",
      "Snapshot"
    ]]);

  return sheet;

}

function getSeasonWeeksCompleted(startDate) {

  const start =
    new Date(startDate);

  if (isNaN(start.getTime()))
    return 0;

  const diff =
    Date.now() - start.getTime();

  return Math.max(
    0,
    Math.floor(diff / (7 * 24 * 60 * 60 * 1000))
  );

}

function getOperationsParams(e) {

  if (
    e &&
    e.parameter
  )
    return e.parameter;

  return {};

}

function getOperationsString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getOperationsBoolean(value) {

  const text =
    getOperationsString(value)
      .toLowerCase();

  return (
    value === true ||
    text === "true" ||
    text === "yes" ||
    text === "1" ||
    text === "pinned" ||
    text === "featured"
  );

}

function getOperationsTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
