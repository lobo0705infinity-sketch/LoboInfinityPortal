/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * AuthApi.gs
 *
 * Google identity, user records, and authorization helpers.
 *******************************************************/

const USER_ROLES = {
  GUEST: "Guest",
  MEMBER: "League Member",
  ASSISTANT: "Assistant Commissioner",
  COMMISSIONER: "Commissioner"
};

const USER_ROLE_ORDER = [
  USER_ROLES.GUEST,
  USER_ROLES.MEMBER,
  USER_ROLES.ASSISTANT,
  USER_ROLES.COMMISSIONER
];

const USER_HEADERS = [
  "Google Email",
  "Display Name",
  "Role",
  "Enabled",
  "Favorite Faction",
  "Avatar URL",
  "Created",
  "Last Login",
  "Last Seen",
  "Notification Preferences",
  "Theme Preference",
  "Dismissed Alerts",
  "Read Alerts",
  "Archived Alerts",
  "Last Page",
  "Search History"
];

const PERMISSION_MIN_ROLE = {
  readPortal: USER_ROLES.GUEST,
  vote: USER_ROLES.MEMBER,
  submitLists: USER_ROLES.MEMBER,
  updateProfile: USER_ROLES.MEMBER,
  manageNotifications: USER_ROLES.MEMBER,
  approveLists: USER_ROLES.ASSISTANT,
  manageNews: USER_ROLES.ASSISTANT,
  manageStreams: USER_ROLES.ASSISTANT,
  manageSettings: USER_ROLES.COMMISSIONER,
  runSeasonControl: USER_ROLES.COMMISSIONER,
  runLeagueAudit: USER_ROLES.COMMISSIONER,
  manageCache: USER_ROLES.COMMISSIONER,
  viewOperations: USER_ROLES.ASSISTANT
};

function getAuthSession(e) {

  ensureUsersSheet();

  const auth =
    getRequestUser(e);

  return jsonOutput({
    success: true,
    authenticated: auth.authenticated,
    user: auth.user,
    permissions: getRolePermissions(auth.user.role),
    oauthConfigured:
      getRequestOAuthClientId(e) !== "" ||
      isGoogleOAuthConfigured(),
    error: auth.error || ""
  });

}

function getMyProfile(e) {

  return requireApiPermission(
    e,
    "updateProfile",
    function(auth) {

      return jsonOutput({
        success: true,
        profile: buildUserProfile(auth.user)
      });

    }
  );

}

function updateMyProfile(e) {

  return requireApiPermission(
    e,
    "updateProfile",
    function(auth) {

      const params =
        getAuthParams(e);

      const sheet =
        ensureUsersSheet();

      const columns =
        getUsersColumns(sheet);

      const rowNumber =
        getUserRowNumber(
          sheet,
          columns,
          auth.user.email
        );

      if (rowNumber === -1)
        return jsonOutput({
          success: false,
          error: "User record not found."
        });

      if (params.displayName !== undefined)
        sheet
          .getRange(rowNumber, columns.displayName + 1)
          .setValue(getAuthString(params.displayName));

      if (params.favoriteFaction !== undefined)
        sheet
          .getRange(rowNumber, columns.favoriteFaction + 1)
          .setValue(getAuthString(params.favoriteFaction));

      if (params.themePreference !== undefined)
        sheet
          .getRange(rowNumber, columns.themePreference + 1)
          .setValue(getAuthString(params.themePreference));

      if (params.notificationPreferences !== undefined)
        sheet
          .getRange(rowNumber, columns.notificationPreferences + 1)
          .setValue(getAuthString(params.notificationPreferences));

      if (params.lastPage !== undefined)
        sheet
          .getRange(rowNumber, columns.lastPage + 1)
          .setValue(getAuthString(params.lastPage));

      if (params.searchHistory !== undefined)
        sheet
          .getRange(rowNumber, columns.searchHistory + 1)
          .setValue(getAuthString(params.searchHistory));

      updateUserLastSeen(
        sheet,
        columns,
        rowNumber
      );

      return jsonOutput({
        success: true,
        profile: buildUserProfile(getUserByEmail(auth.user.email))
      });

    }
  );

}

function updateNotificationState(e) {

  return requireApiPermission(
    e,
    "manageNotifications",
    function(auth) {

      const params =
        getAuthParams(e);

      const notificationId =
        getAuthString(params.notificationId);

      const state =
        getAuthString(params.state);

      const allIds =
        getAuthString(params.notificationIds)
          .split(",")
          .map(function(id) {
            return id.trim();
          })
          .filter(function(id) {
            return id !== "";
          });

      const ids =
        notificationId === "all"
          ? allIds
          : [notificationId];

      const sheet =
        ensureUsersSheet();

      const columns =
        getUsersColumns(sheet);

      const rowNumber =
        getUserRowNumber(
          sheet,
          columns,
          auth.user.email
        );

      if (rowNumber === -1)
        return jsonOutput({
          success: false,
          error: "User record not found."
        });

      if (state === "read")
        appendUserIdList(
          sheet,
          rowNumber,
          columns.readAlerts,
          ids
        );

      if (state === "dismissed")
        appendUserIdList(
          sheet,
          rowNumber,
          columns.dismissedAlerts,
          ids
        );

      if (state === "archived")
        appendUserIdList(
          sheet,
          rowNumber,
          columns.archivedAlerts,
          ids
        );

      updateUserLastSeen(
        sheet,
        columns,
        rowNumber
      );

      return jsonOutput({
        success: true
      });

    }
  );

}

function requireApiPermission(e, permission, handler) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
    return jsonOutput({
      success: false,
      code: "AUTH_REQUIRED",
      error: auth.error || "Authentication is required.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER
    });

  if (!auth.user.enabled)
    return jsonOutput({
      success: false,
      code: "USER_DISABLED",
      error: "This Google account is not enabled for league access.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER
    });

  if (!userHasPermission(auth.user.role, permission))
    return jsonOutput({
      success: false,
      code: "PERMISSION_DENIED",
      error: "You do not have permission to perform this action.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER,
      role: auth.user.role
    });

  return handler(auth);

}

function getRequestUser(e) {

  const token =
    getRequestAuthToken(e);

  if (token === "")
    return {
      authenticated: false,
      user: buildGuestUser(),
      error: "Sign in with Google to continue."
    };

  const verified =
    verifyGoogleIdentityToken(
      token,
      getRequestOAuthClientId(e)
    );

  if (!verified.valid)
    return {
      authenticated: false,
      user: buildGuestUser(),
      error: verified.error || "Google identity could not be verified."
    };

  const sheet =
    ensureUsersSheet();

  const columns =
    getUsersColumns(sheet);

  const bootstrap =
    sheet.getLastRow() <= 1;

  const configuredCommissioner =
    isConfiguredCommissionerEmail(verified.email);

  const leagueIdentity =
    getAuthLeagueIdentityByEmail(verified.email);

  let rowNumber =
    getUserRowNumber(
      sheet,
      columns,
      verified.email
    );

  if (rowNumber === -1) {
    rowNumber =
      createUserRow(
        sheet,
        columns,
        verified,
        bootstrap || configuredCommissioner
          ? USER_ROLES.COMMISSIONER
          : USER_ROLES.MEMBER,
        bootstrap ||
          configuredCommissioner ||
          leagueIdentity.player !== ""
      );
  }

  if (
    rowNumber !== -1 &&
    configuredCommissioner
  )
    promoteConfiguredCommissioner(
      sheet,
      columns,
      rowNumber
    );

  if (
    rowNumber !== -1 &&
    leagueIdentity.player !== ""
  )
    activateLinkedLeagueMember(
      sheet,
      columns,
      rowNumber
    );

  const user =
    readUserRow(
      sheet,
      columns,
      rowNumber
    );

  if (!user.enabled)
    return {
      authenticated: false,
      user: user,
      error: "This Google account exists but is not enabled."
    };

  syncUserIdentity(
    sheet,
    columns,
    rowNumber,
    verified
  );

  return {
    authenticated: true,
    user:
      readUserRow(
        sheet,
        columns,
        rowNumber
      )
  };

}

function activateLinkedLeagueMember(sheet, columns, rowNumber) {

  const role =
    normalizeUserRole(
      sheet
        .getRange(rowNumber, columns.role + 1)
        .getValue()
    );

  if (getRoleRank(role) < getRoleRank(USER_ROLES.MEMBER))
    sheet
      .getRange(rowNumber, columns.role + 1)
      .setValue(USER_ROLES.MEMBER);

  sheet
    .getRange(rowNumber, columns.enabled + 1)
    .setValue(true);

}

function promoteConfiguredCommissioner(sheet, columns, rowNumber) {

  sheet
    .getRange(rowNumber, columns.role + 1)
    .setValue(USER_ROLES.COMMISSIONER);

  sheet
    .getRange(rowNumber, columns.enabled + 1)
    .setValue(true);

}

function verifyGoogleIdentityToken(token, requestClientId) {

  const settings =
    getSettingsObjectSafe();

  const configuredClientId =
    getAuthString(requestClientId) ||
    getAuthString(settings.googleOAuthClientId);

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    "google-token-" +
    Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        token + ":" + configuredClientId
      )
    ).slice(0, 48);

  const cached =
    cache.get(cacheKey);

  if (cached)
    return JSON.parse(cached);

  try {

    const response =
      UrlFetchApp.fetch(
        "https://oauth2.googleapis.com/tokeninfo?id_token=" +
          encodeURIComponent(token),
        {
          muteHttpExceptions: true
        }
      );

    if (response.getResponseCode() !== 200)
      return {
        valid: false,
        error: "Google token verification failed."
      };

    const payload =
      JSON.parse(response.getContentText());

    if (
      configuredClientId === ""
    )
      return {
        valid: false,
        error: "Google OAuth Client ID is not configured."
      };

    if (
      payload.aud !== configuredClientId
    )
      return {
        valid: false,
        error: "Google token audience does not match the configured OAuth client."
      };

    if (
      getAuthString(payload.email) === "" ||
      payload.email_verified === "false"
    )
      return {
        valid: false,
        error: "Google email is missing or unverified."
      };

    const verified = {
      valid: true,
      email: getAuthString(payload.email).toLowerCase(),
      displayName: getAuthString(payload.name),
      avatarUrl: getAuthString(payload.picture)
    };

    cache.put(
      cacheKey,
      JSON.stringify(verified),
      300
    );

    return verified;

  }
  catch (err) {

    return {
      valid: false,
      error: String(err)
    };

  }

}

function ensureUsersSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.USERS);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.USERS);

  ensureUsersColumns(sheet);

  return sheet;

}

function ensureUsersColumns(sheet) {

  const lastColumn =
    Math.max(sheet.getLastColumn(), 1);

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0]
      .map(function(header) {
        return getAuthString(header);
      });

  let nextColumn =
    headers.length === 1 && headers[0] === ""
      ? 0
      : headers.length;

  USER_HEADERS.forEach(function(header) {

    if (headers.indexOf(header) !== -1)
      return;

    sheet
      .getRange(1, nextColumn + 1)
      .setValue(header);

    nextColumn++;

  });

}

function getUsersColumns(sheet) {

  const headers =
    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(function(header) {
        return getAuthString(header);
      });

  return {
    email: headers.indexOf("Google Email"),
    displayName: headers.indexOf("Display Name"),
    role: headers.indexOf("Role"),
    enabled: headers.indexOf("Enabled"),
    favoriteFaction: headers.indexOf("Favorite Faction"),
    avatarUrl: headers.indexOf("Avatar URL"),
    created: headers.indexOf("Created"),
    lastLogin: headers.indexOf("Last Login"),
    lastSeen: headers.indexOf("Last Seen"),
    notificationPreferences: headers.indexOf("Notification Preferences"),
    themePreference: headers.indexOf("Theme Preference"),
    dismissedAlerts: headers.indexOf("Dismissed Alerts"),
    readAlerts: headers.indexOf("Read Alerts"),
    archivedAlerts: headers.indexOf("Archived Alerts"),
    lastPage: headers.indexOf("Last Page"),
    searchHistory: headers.indexOf("Search History")
  };

}

function createUserRow(sheet, columns, verified, role, enabled) {

  const row = [];
  const timestamp =
    getAuthTimestamp();

  row[columns.email] = verified.email;
  row[columns.displayName] = verified.displayName || verified.email;
  row[columns.role] = role;
  row[columns.enabled] = enabled;
  row[columns.favoriteFaction] = "";
  row[columns.avatarUrl] = verified.avatarUrl;
  row[columns.created] = timestamp;
  row[columns.lastLogin] = timestamp;
  row[columns.lastSeen] = timestamp;
  row[columns.notificationPreferences] = "{}";
  row[columns.themePreference] = "system";
  row[columns.dismissedAlerts] = "[]";
  row[columns.readAlerts] = "[]";
  row[columns.archivedAlerts] = "[]";
  row[columns.lastPage] = "";
  row[columns.searchHistory] = "[]";

  sheet.appendRow(row);

  return sheet.getLastRow();

}

function getUserByEmail(email) {

  const sheet =
    ensureUsersSheet();

  const columns =
    getUsersColumns(sheet);

  const rowNumber =
    getUserRowNumber(
      sheet,
      columns,
      email
    );

  if (rowNumber === -1)
    return buildGuestUser();

  return readUserRow(
    sheet,
    columns,
    rowNumber
  );

}

function getUserRowNumber(sheet, columns, email) {

  const normalized =
    getAuthString(email)
      .toLowerCase();

  if (normalized === "")
    return -1;

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
      getAuthString(values[index][columns.email])
        .toLowerCase() === normalized
    )
      return index + 1;

  }

  return -1;

}

function readUserRow(sheet, columns, rowNumber) {

  const row =
    sheet
      .getRange(rowNumber, 1, 1, sheet.getLastColumn())
      .getValues()[0];

  const leagueIdentity =
    getAuthLeagueIdentityByEmail(
      getAuthString(row[columns.email])
    );

  return {
    email: getAuthString(row[columns.email]).toLowerCase(),
    displayName: getAuthString(row[columns.displayName]),
    leaguePlayer: leagueIdentity.player,
    playerDisplayName:
      leagueIdentity.displayName ||
      leagueIdentity.player,
    leagueDivision: leagueIdentity.division,
    role: normalizeUserRole(row[columns.role]),
    enabled: getAuthBoolean(row[columns.enabled]),
    favoriteFaction: getAuthString(row[columns.favoriteFaction]),
    avatarUrl: getAuthString(row[columns.avatarUrl]),
    created: getAuthString(row[columns.created]),
    lastLogin: getAuthString(row[columns.lastLogin]),
    lastSeen: getAuthString(row[columns.lastSeen]),
    notificationPreferences: getAuthJson(row[columns.notificationPreferences], {}),
    themePreference: getAuthString(row[columns.themePreference]) || "system",
    dismissedAlerts: getAuthJson(row[columns.dismissedAlerts], []),
    readAlerts: getAuthJson(row[columns.readAlerts], []),
    archivedAlerts: getAuthJson(row[columns.archivedAlerts], []),
    lastPage: getAuthString(row[columns.lastPage]),
    searchHistory: getAuthJson(row[columns.searchHistory], [])
  };

}

function syncUserIdentity(sheet, columns, rowNumber, verified) {

  if (verified.displayName)
    sheet
      .getRange(rowNumber, columns.displayName + 1)
      .setValue(verified.displayName);

  if (verified.avatarUrl)
    sheet
      .getRange(rowNumber, columns.avatarUrl + 1)
      .setValue(verified.avatarUrl);

  sheet
    .getRange(rowNumber, columns.lastLogin + 1)
    .setValue(getAuthTimestamp());

  updateUserLastSeen(
    sheet,
    columns,
    rowNumber
  );

}

function getAuthLeagueIdentityByEmail(email) {

  const normalized =
    getAuthString(email)
      .toLowerCase();

  if (normalized === "")
    return {
      player: "",
      displayName: "",
      division: ""
    };

  const spreadsheet =
    SpreadsheetApp.getActive();

  const sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!sheet)
    return {
      player: "",
      displayName: "",
      division: ""
    };

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length === 0)
    return {
      player: "",
      displayName: "",
      division: ""
    };

  const headers =
    values[0]
      .map(function(header) {
        return getAuthString(header);
      });

  const playerCol =
    headers.indexOf("Player");

  const divisionCol =
    headers.indexOf("Division");

  const displayNameCol =
    headers.indexOf("Display Name");

  const emailCol =
    headers.indexOf("Google Email");

  if (
    playerCol === -1 ||
    emailCol === -1
  )
    return {
      player: "",
      displayName: "",
      division: ""
    };

  for (
    let index = 1;
    index < values.length;
    index++
  ) {

    if (
      getAuthString(values[index][emailCol])
        .toLowerCase() === normalized
    )
      return {
        player: getAuthString(values[index][playerCol]),
        displayName:
          displayNameCol === -1
            ? getAuthString(values[index][playerCol])
            : getAuthString(values[index][displayNameCol]) ||
              getAuthString(values[index][playerCol]),
        division:
          divisionCol === -1
            ? ""
            : getAuthString(values[index][divisionCol])
      };

  }

  return {
    player: "",
    displayName: "",
    division: ""
  };

}

function updateUserLastSeen(sheet, columns, rowNumber) {

  sheet
    .getRange(rowNumber, columns.lastSeen + 1)
    .setValue(getAuthTimestamp());

}

function appendUserIdList(sheet, rowNumber, columnIndex, ids) {

  const existing =
    getAuthJson(
      sheet
        .getRange(rowNumber, columnIndex + 1)
        .getValue(),
      []
    );

  const seen = {};

  existing.forEach(function(id) {
    if (id !== "")
      seen[String(id)] = true;
  });

  ids.forEach(function(id) {
    if (id !== "")
      seen[String(id)] = true;
  });

  sheet
    .getRange(rowNumber, columnIndex + 1)
    .setValue(JSON.stringify(Object.keys(seen)));

}

function buildUserProfile(user) {

  const armyLists =
    getUserSubmittedLists(user);

  const activity =
    getUserRecentActivity(user);

  const playerStats =
    getUserLeagueStatistics(user);

  const recentGames =
    getUserRecentGames(user);

  const allGames =
    getUserAllLeagueGames(user);

  return {
    user: user,
    submittedLists: armyLists,
    votesCast: getUserVotesCast(user),
    recentActivity: activity,
    recentGames: recentGames,
    leagueStatistics: playerStats,
    currentSeasonStatistics:
      buildProfileStatisticsSnapshot(playerStats),
    careerStatistics:
      buildProfileStatisticsSnapshot(playerStats),
    leaguePerformance:
      buildProfileLeaguePerformance(
        user,
        playerStats,
        allGames
      ),
    intelligence:
      buildProfileIntelligenceContext(
        user,
        playerStats
      ),
    achievements:
      typeof buildLeaguePlayerAchievements === "function"
        ? buildLeaguePlayerAchievements(user.leaguePlayer)
        : buildProfileAchievements(
            user,
            playerStats,
            armyLists
          ),
    futureSections: []
  };

}

function getUserAllLeagueGames(user) {

  if (typeof getAllRecentGameObjects !== "function")
    return [];

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  if (leaguePlayer === "")
    return [];

  const normalizedPlayer =
    leaguePlayer.toLowerCase();

  return getAllRecentGameObjects()
    .filter(function(game) {
      return (
        getAuthString(game.winner).toLowerCase() === normalizedPlayer ||
        getAuthString(game.loser).toLowerCase() === normalizedPlayer
      );
    });

}

function getUserSubmittedLists(user) {

  if (typeof getArmyListObjects !== "function")
    return [];

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  if (leaguePlayer === "")
    return [];

  return getArmyListObjects()
    .filter(function(list) {
      return (
        getAuthString(list.player)
          .toLowerCase() === leaguePlayer.toLowerCase()
      );
    });

}

function getUserVotesCast(user) {

  const preferences =
    user.notificationPreferences || {};

  return Number(preferences.votesCast) || 0;

}

function incrementUserVotesCast(e) {

  const auth =
    getRequestUser(e);

  if (!auth.authenticated)
    return;

  const sheet =
    ensureUsersSheet();

  const columns =
    getUsersColumns(sheet);

  const rowNumber =
    getUserRowNumber(
      sheet,
      columns,
      auth.user.email
    );

  if (rowNumber === -1)
    return;

  const preferences =
    auth.user.notificationPreferences || {};

  preferences.votesCast =
    (Number(preferences.votesCast) || 0) + 1;

  sheet
    .getRange(rowNumber, columns.notificationPreferences + 1)
    .setValue(JSON.stringify(preferences));

  updateUserLastSeen(
    sheet,
    columns,
    rowNumber
  );

}

function getUserRecentActivity(user) {

  if (typeof buildLeagueTimeline !== "function")
    return [];

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  if (leaguePlayer === "")
    return [];

  return buildLeagueTimeline()
    .filter(function(item) {
      return (
        item.body.indexOf(leaguePlayer) !== -1 ||
        item.title.indexOf(leaguePlayer) !== -1 ||
        item.relatedPlayer === leaguePlayer
      );
    })
    .slice(0, 6);

}

function getUserRecentGames(user) {

  if (typeof getAllRecentGameObjects !== "function")
    return [];

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  if (leaguePlayer === "")
    return [];

  const normalizedPlayer =
    leaguePlayer.toLowerCase();

  return getUserAllLeagueGames(user)
    .slice(0, 12);

}

function getUserLeagueStatistics(user) {

  if (typeof getPlayer !== "function")
    return null;

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  if (leaguePlayer === "")
    return null;

  try {
    const response =
      JSON.parse(
        getPlayer({
          parameter: {
            name: leaguePlayer
          }
        }).getContent()
      );

    return response.player || null;
  }
  catch (err) {
    return null;
  }

}

function buildProfileStatisticsSnapshot(playerStats) {

  if (!playerStats)
    return null;

  const games =
    Number(playerStats.games) || 0;

  const wins =
    Number(playerStats.wins) || 0;

  return {
    division: getAuthString(playerStats.division),
    rank: Number(playerStats.rank) || 0,
    games: games,
    wins: wins,
    losses: Number(playerStats.losses) || 0,
    tp: Number(playerStats.tp) || 0,
    op: Number(playerStats.op) || 0,
    vp: Number(playerStats.vp) || 0,
    winPercentage:
      games === 0
        ? 0
        : Math.round((wins / games) * 1000) / 10,
    averageTournamentPoints:
      getProfileAverage(Number(playerStats.tp) || 0, games),
    averageObjectivePoints:
      getProfileAverage(Number(playerStats.op) || 0, games),
    averageVictoryPoints:
      getProfileAverage(Number(playerStats.vp) || 0, games),
    promotionStatus:
      getProfilePromotionStatus(
        getAuthString(playerStats.division),
        Number(playerStats.rank) || 0
      ),
    seasonProgress:
      games
  };

}

function buildProfileIntelligenceContext(user, playerStats) {

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  const division =
    playerStats
      ? getAuthString(playerStats.division)
      : getAuthString(user.leagueDivision);

  const rows =
    getProfileIntelligenceStandingsRows();

  const activeRows =
    rows.filter(function(row) {
      return Number(row.games) > 0;
    });

  const divisionRows =
    activeRows.filter(function(row) {
      return getAuthString(row.division) === division;
    });

  const playerRow =
    activeRows.filter(function(row) {
      return getAuthString(row.player) === leaguePlayer;
    })[0] || null;

  return {
    player: leaguePlayer,
    division: division,
    divisionAverage:
      buildProfileIntelligenceAverage(divisionRows),
    leagueAverage:
      buildProfileIntelligenceAverage(activeRows),
    topThreeAverage:
      buildProfileIntelligenceAverage(
        activeRows
          .slice()
          .sort(function(a, b) {
            if (Number(b.tp) !== Number(a.tp))
              return Number(b.tp) - Number(a.tp);

            if (Number(b.op) !== Number(a.op))
              return Number(b.op) - Number(a.op);

            return Number(b.vp) - Number(a.vp);
          })
          .slice(0, 3)
      ),
    ranks:
      buildProfileIntelligenceRanks(
        activeRows,
        playerRow
      )
  };

}

function getProfileIntelligenceStandingsRows() {

  const rows = [];

  [
    getStandingsDivisionConfig("main"),
    getStandingsDivisionConfig("pga"),
    getStandingsDivisionConfig("pgb")
  ].forEach(function(config) {

    if (!config)
      return;

    buildStandingsResponse(config)
      .standings
      .forEach(function(row) {

        rows.push({
          division: config.label,
          rank: Number(row.rank) || 0,
          player: getAuthString(row.player),
          games: Number(row.games) || 0,
          wins: Number(row.wins) || 0,
          losses: Number(row.losses) || 0,
          tp: Number(row.tp) || 0,
          op: Number(row.op) || 0,
          vp: Number(row.vp) || 0
        });

      });

  });

  return rows;

}

function buildProfileIntelligenceAverage(rows) {

  const games =
    rows.reduce(function(total, row) {
      return total + (Number(row.games) || 0);
    }, 0);

  const wins =
    rows.reduce(function(total, row) {
      return total + (Number(row.wins) || 0);
    }, 0);

  const tp =
    rows.reduce(function(total, row) {
      return total + (Number(row.tp) || 0);
    }, 0);

  const op =
    rows.reduce(function(total, row) {
      return total + (Number(row.op) || 0);
    }, 0);

  const vp =
    rows.reduce(function(total, row) {
      return total + (Number(row.vp) || 0);
    }, 0);

  return {
    players: rows.length,
    games: games,
    averageTP:
      getProfileAverage(tp, games),
    averageOP:
      getProfileAverage(op, games),
    averageVP:
      getProfileAverage(vp, games),
    winPercentage:
      games === 0
        ? 0
        : Math.round((wins / games) * 1000) / 10
  };

}

function buildProfileIntelligenceRanks(rows, playerRow) {

  if (!playerRow)
    return {
      objectivePoints: 0,
      tournamentPoints: 0,
      victoryPoints: 0,
      winPercentage: 0
    };

  return {
    objectivePoints:
      getProfileMetricRank(rows, playerRow, "op"),
    tournamentPoints:
      getProfileMetricRank(rows, playerRow, "tp"),
    victoryPoints:
      getProfileMetricRank(rows, playerRow, "vp"),
    winPercentage:
      getProfileMetricRank(rows, playerRow, "winPercentage")
  };

}

function getProfileMetricRank(rows, playerRow, metric) {

  const sorted =
    rows
      .slice()
      .sort(function(a, b) {

        const left =
          metric === "winPercentage"
            ? getProfileWinPercentage(a)
            : Number(a[metric]) || 0;

        const right =
          metric === "winPercentage"
            ? getProfileWinPercentage(b)
            : Number(b[metric]) || 0;

        return right - left;

      });

  for (let index = 0; index < sorted.length; index++) {
    if (sorted[index].player === playerRow.player)
      return index + 1;
  }

  return 0;

}

function getProfileWinPercentage(row) {

  const games =
    Number(row.games) || 0;

  if (games === 0)
    return 0;

  return (
    (Number(row.wins) || 0) /
    games
  );

}

function getProfileAverage(total, games) {

  return games === 0
    ? 0
    : Math.round((total / games) * 10) / 10;

}

function getProfilePromotionStatus(division, rank) {

  if (rank <= 0)
    return "Unranked";

  const normalized =
    getAuthString(division).toLowerCase();

  if (normalized.indexOf("main") !== -1)
    return rank >= 7
      ? "Relegation Watch"
      : "Safe";

  return rank <= 2
    ? "Promotion Zone"
    : "Chasing Promotion";

}

function buildProfileLeaguePerformance(
  user,
  playerStats,
  games
) {

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  const opponents = {};
  const chronological =
    games.slice().reverse();
  let longestWinStreak = 0;
  let longestLosingStreak = 0;
  let currentWinStreak = 0;
  let currentLosingStreak = 0;
  let runningResult = "";
  let runningCount = 0;
  let closestVictory = null;
  let worstDefeat = null;

  chronological.forEach(function(game) {

    const result =
      getProfileGameResult(
        game,
        leaguePlayer
      );

    if (result === "")
      return;

    if (runningResult === result)
      runningCount++;
    else {
      runningResult = result;
      runningCount = 1;
    }

    if (result === "Win")
      longestWinStreak =
        Math.max(
          longestWinStreak,
          runningCount
        );

    if (result === "Loss")
      longestLosingStreak =
        Math.max(
          longestLosingStreak,
          runningCount
        );

  });

  games.forEach(function(game, index) {

    const result =
      getProfileGameResult(
        game,
        leaguePlayer
      );

    const opponent =
      getProfileGameOpponent(
        game,
        leaguePlayer
      );

    if (opponent !== "") {
      if (!opponents[opponent])
        opponents[opponent] = {
          opponent: opponent,
          games: 0,
          wins: 0,
          losses: 0
        };

      opponents[opponent].games++;

      if (result === "Win")
        opponents[opponent].wins++;

      if (result === "Loss")
        opponents[opponent].losses++;
    }

    if (index === 0)
      currentWinStreak =
        result === "Win"
          ? 1
          : 0;
    else if (
      currentWinStreak === index &&
      result === "Win"
    )
      currentWinStreak++;

    if (index === 0)
      currentLosingStreak =
        result === "Loss"
          ? 1
          : 0;
    else if (
      currentLosingStreak === index &&
      result === "Loss"
    )
      currentLosingStreak++;

    const margin =
      getProfileVictoryPointMargin(game);

    if (
      result === "Win" &&
      margin !== null &&
      (
        closestVictory === null ||
        margin < closestVictory.margin
      )
    )
      closestVictory =
        buildProfileGameSummary(
          game,
          opponent,
          margin
        );

    if (
      result === "Loss" &&
      margin !== null &&
      (
        worstDefeat === null ||
        margin > worstDefeat.margin
      )
    )
      worstDefeat =
        buildProfileGameSummary(
          game,
          opponent,
          margin
        );

  });

  const opponentRows =
    Object.keys(opponents)
      .map(function(key) {
        return opponents[key];
      });

  return {
    bestOpponent:
      getProfileBestOpponent(opponentRows),
    worstOpponent:
      getProfileWorstOpponent(opponentRows),
    longestWinStreak: longestWinStreak,
    longestLosingStreak: longestLosingStreak,
    currentStreak:
      getProfileCurrentStreak(
        currentWinStreak,
        currentLosingStreak
      ),
    mostPlayedOpponent:
      getProfileMostPlayedOpponent(opponentRows),
    closestVictory: closestVictory,
    worstDefeat: worstDefeat,
    fallbackBestOpponent:
      playerStats
        ? getAuthString(playerStats.rival)
        : "",
    fallbackWorstOpponent:
      playerStats
        ? getAuthString(playerStats.nemesis)
        : ""
  };

}

function getProfileGameResult(game, leaguePlayer) {

  const normalizedPlayer =
    getAuthString(leaguePlayer).toLowerCase();

  if (
    getAuthString(game.winner).toLowerCase() ===
    normalizedPlayer
  )
    return "Win";

  if (
    getAuthString(game.loser).toLowerCase() ===
    normalizedPlayer
  )
    return "Loss";

  return "";

}

function getProfileGameOpponent(game, leaguePlayer) {

  return getProfileGameResult(
    game,
    leaguePlayer
  ) === "Win"
    ? getAuthString(game.loser)
    : getAuthString(game.winner);

}

function getProfileVictoryPointMargin(game) {

  const score =
    getAuthString(game.vp)
      .split("-")
      .map(function(value) {
        return Number(value) || 0;
      });

  if (score.length < 2)
    return null;

  return Math.abs(score[0] - score[1]);

}

function buildProfileGameSummary(game, opponent, margin) {

  return {
    gameId: Number(game.id) || 0,
    date: getAuthString(game.date),
    opponent: opponent,
    mission: getAuthString(game.mission),
    margin: margin,
    score: getAuthString(game.vp)
  };

}

function getProfileBestOpponent(opponents) {

  const sorted =
    opponents
      .filter(function(opponent) {
        return opponent.wins > 0;
      })
      .sort(function(a, b) {
        if (b.wins !== a.wins)
          return b.wins - a.wins;
        return b.games - a.games;
      });

  return sorted.length === 0
    ? ""
    : sorted[0].opponent;

}

function getProfileWorstOpponent(opponents) {

  const sorted =
    opponents
      .filter(function(opponent) {
        return opponent.losses > 0;
      })
      .sort(function(a, b) {
        if (b.losses !== a.losses)
          return b.losses - a.losses;
        return b.games - a.games;
      });

  return sorted.length === 0
    ? ""
    : sorted[0].opponent;

}

function getProfileMostPlayedOpponent(opponents) {

  const sorted =
    opponents
      .slice()
      .sort(function(a, b) {
        return b.games - a.games;
      });

  return sorted.length === 0
    ? ""
    : sorted[0].opponent;

}

function getProfileCurrentStreak(winStreak, losingStreak) {

  if (winStreak > 0)
    return winStreak + "W";

  if (losingStreak > 0)
    return losingStreak + "L";

  return "None";

}

function buildProfileAchievements(
  user,
  playerStats,
  armyLists
) {

  const achievements = [];

  if (!playerStats)
    return achievements;

  const games =
    Number(playerStats.games) || 0;

  const wins =
    Number(playerStats.wins) || 0;

  const losses =
    Number(playerStats.losses) || 0;

  if (Number(playerStats.rank) > 0)
    achievements.push({
      title: "Ranked Competitor",
      description: "Current division ranking is active.",
      value: "#" + playerStats.rank
    });

  if (games > 0)
    achievements.push({
      title: "Season Campaigner",
      description: "Recorded league games this season.",
      value: String(games)
    });

  if (wins > losses)
    achievements.push({
      title: "Winning Record",
      description: "Wins currently exceed losses.",
      value: wins + "-" + losses
    });

  if (getAuthString(playerStats.favoriteFaction) !== "")
    achievements.push({
      title: "Faction Specialist",
      description: "Most-played faction profile is established.",
      value: getAuthString(playerStats.favoriteFaction)
    });

  if (Number(playerStats.firstTurnGames) > 0)
    achievements.push({
      title: "First Turn Ledger",
      description: "First-turn win rate is tracked.",
      value: (Number(playerStats.firstTurnWinRate) || 0) + "%"
    });

  if (armyLists.length > 0)
    achievements.push({
      title: "List Architect",
      description: "Approved army lists are attached to this player.",
      value: String(armyLists.length)
    });

  if (achievements.length === 0)
    achievements.push({
      title: "League Profile Linked",
      description: "Google account is mapped to the league player record.",
      value: getAuthString(user.leaguePlayer)
    });

  return achievements.slice(0, 6);

}

function getRolePermissions(role) {

  const permissions = {};

  for (const permission in PERMISSION_MIN_ROLE)
    permissions[permission] =
      userHasPermission(
        role,
        permission
      );

  return permissions;

}

function userHasPermission(role, permission) {

  const required =
    PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER;

  return (
    getRoleRank(role) >=
    getRoleRank(required)
  );

}

function getRoleRank(role) {

  const index =
    USER_ROLE_ORDER.indexOf(
      normalizeUserRole(role)
    );

  return index === -1
    ? 0
    : index;

}

function normalizeUserRole(role) {

  const text =
    getAuthString(role);

  if (USER_ROLE_ORDER.indexOf(text) !== -1)
    return text;

  return USER_ROLES.GUEST;

}

function buildGuestUser() {

  return {
    email: "",
    displayName: "Guest",
    leaguePlayer: "",
    playerDisplayName: "",
    leagueDivision: "",
    role: USER_ROLES.GUEST,
    enabled: false,
    favoriteFaction: "",
    avatarUrl: "",
    created: "",
    lastLogin: "",
    lastSeen: "",
    notificationPreferences: {},
    themePreference: "system",
    dismissedAlerts: [],
    readAlerts: [],
    archivedAlerts: [],
    lastPage: "",
    searchHistory: []
  };

}

function getRequestAuthToken(e) {

  const params =
    getAuthParams(e);

  return getAuthString(
    params.authToken ||
    params.idToken ||
    params.credential
  );

}

function getRequestOAuthClientId(e) {

  const params =
    getAuthParams(e);

  return getAuthString(params.oauthClientId);

}

function getAuthParams(e) {

  if (
    e &&
    e.parameter
  )
    return e.parameter;

  return {};

}

function getSettingsObjectSafe() {

  try {
    return getSettingsObject();
  }
  catch (err) {
    return {};
  }

}

function isGoogleOAuthConfigured() {

  const settings =
    getSettingsObjectSafe();

  return getAuthString(settings.googleOAuthClientId) !== "";

}

function isConfiguredCommissionerEmail(email) {

  const settings =
    getSettingsObjectSafe();

  const normalized =
    getAuthString(email)
      .toLowerCase();

  if (normalized === "")
    return false;

  return getAuthString(settings.commissionerEmails)
    .split(",")
    .map(function(item) {
      return item.trim().toLowerCase();
    })
    .filter(function(item) {
      return item !== "";
    })
    .indexOf(normalized) !== -1;

}

function getAuthJson(value, fallback) {

  const text =
    getAuthString(value);

  if (text === "")
    return fallback;

  try {
    return JSON.parse(text);
  }
  catch (err) {
    return fallback;
  }

}

function getAuthString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getAuthBoolean(value) {

  const text =
    getAuthString(value)
      .toLowerCase();

  return (
    value === true ||
    text === "true" ||
    text === "yes" ||
    text === "1" ||
    text === "enabled"
  );

}

function getAuthTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
