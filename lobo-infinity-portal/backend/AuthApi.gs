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
    oauthConfigured: isGoogleOAuthConfigured(),
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
      error: auth.error || "Authentication is required.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER
    });

  if (!auth.user.enabled)
    return jsonOutput({
      success: false,
      error: "This Google account is not enabled for league access.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER
    });

  if (!userHasPermission(auth.user.role, permission))
    return jsonOutput({
      success: false,
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
    verifyGoogleIdentityToken(token);

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
        bootstrap
          ? USER_ROLES.COMMISSIONER
          : USER_ROLES.MEMBER,
        bootstrap
      );
  }

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

function verifyGoogleIdentityToken(token) {

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    "google-token-" +
    Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        token
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

    const settings =
      getSettingsObjectSafe();

    const configuredClientId =
      getAuthString(settings.googleOAuthClientId);

    if (
      configuredClientId !== "" &&
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

  return {
    email: getAuthString(row[columns.email]).toLowerCase(),
    displayName: getAuthString(row[columns.displayName]),
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

  return {
    user: user,
    submittedLists: armyLists,
    votesCast: getUserVotesCast(user),
    recentActivity: activity,
    leagueStatistics: playerStats,
    futureSections: [
      "Achievements",
      "Badges",
      "Season Goals"
    ]
  };

}

function getUserSubmittedLists(user) {

  if (typeof getArmyListObjects !== "function")
    return [];

  return getArmyListObjects()
    .filter(function(list) {
      return (
        list.player === user.displayName ||
        list.player === user.email
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

  return buildLeagueTimeline()
    .filter(function(item) {
      return (
        item.body.indexOf(user.displayName) !== -1 ||
        item.title.indexOf(user.displayName) !== -1
      );
    })
    .slice(0, 6);

}

function getUserLeagueStatistics(user) {

  if (typeof getPlayer !== "function")
    return null;

  try {
    const response =
      JSON.parse(
        getPlayer({
          parameter: {
            name: user.displayName
          }
        }).getContent()
      );

    return response.player || null;
  }
  catch (err) {
    return null;
  }

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
