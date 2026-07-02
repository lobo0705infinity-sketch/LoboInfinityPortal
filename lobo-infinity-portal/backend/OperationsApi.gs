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
      seasonStatus: getSeasonStatusObject()
    },
    pendingArmyLists: pendingArmyLists,
    streams: streams,
    news: news,
    settings: settings,
    audit: audit
  });

}

function getOperationsAudit() {

  return jsonOutput({
    success: true,
    audit: buildLeagueAudit()
  });

}

function getOperationsSeason() {

  return jsonOutput({
    success: true,
    season: getSeasonStatusObject(),
    promotionRelegation: buildPromotionRelegationProposal(),
    archive: getSeasonArchiveRows()
  });

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

    if (params[key] !== undefined)
      sheet
        .getRange(
          rowNumber,
          editable[key] + 1
        )
        .setValue(
          String(params[key]).trim()
        );

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
      params.player1Faction || "",
      params.player2 || "",
      params.player2Faction || "",
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

  return jsonOutput({
    success: true
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

  return {
    summary: {
      critical: issues.filter(function(issue) { return issue.severity === "critical"; }).length,
      warning: issues.filter(function(issue) { return issue.severity === "warning"; }).length,
      informational: issues.filter(function(issue) { return issue.severity === "info"; }).length
    },
    issues: issues
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
