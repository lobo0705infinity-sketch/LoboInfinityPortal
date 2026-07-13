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
  "Discord Name",
  "Profile Visibility",
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
  updateProfile: USER_ROLES.GUEST,
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
    code: auth.code || "",
    stage: auth.stage || "",
    diagnostics: auth.diagnostics || {},
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

      if (params.displayName !== undefined) {
        const validation =
          validatePortalDisplayName(
            sheet,
            columns,
            params.displayName,
            auth.user.email,
            auth.user.leaguePlayer
          );

        if (!validation.valid)
          return jsonOutput({
            success: false,
            error: validation.error
          });

        sheet
          .getRange(rowNumber, columns.displayName + 1)
          .setValue(validation.displayName);

        syncPortalDisplayNameReferences(
          auth.user,
          validation.displayName
        );
      }

      if (params.favoriteFaction !== undefined)
        sheet
          .getRange(rowNumber, columns.favoriteFaction + 1)
          .setValue(getAuthString(params.favoriteFaction));

      if (
        columns.discordName !== -1 &&
        params.discordName !== undefined
      ) {
        const discordValidation =
          validatePortalDiscordName(params.discordName);

        if (!discordValidation.valid)
          return jsonOutput({
            success: false,
            error: discordValidation.error
          });

        sheet
          .getRange(rowNumber, columns.discordName + 1)
          .setValue(discordValidation.discordName);
      }

      if (
        columns.profileVisibility !== -1 &&
        params.profileVisibility !== undefined
      )
        sheet
          .getRange(rowNumber, columns.profileVisibility + 1)
          .setValue(validatePortalProfileVisibility(params.profileVisibility));

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

      invalidatePortalIdentityCaches();

      return jsonOutput({
        success: true,
        profile: buildUserProfile(getUserByEmail(auth.user.email))
      });

    }
  );

}

function updateHeartbeat(e) {

  return requireApiPermission(
    e,
    "readPortal",
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

      if (params.lastPage !== undefined)
        sheet
          .getRange(rowNumber, columns.lastPage + 1)
          .setValue(getAuthString(params.lastPage));

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
      authCode: auth.code || "AUTH_REQUIRED",
      stage: auth.stage || "authentication",
      diagnostics: auth.diagnostics || {},
      error: auth.error || "Authentication is required.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER
    });

  if (!auth.user.enabled)
    return jsonOutput({
      success: false,
      code: "USER_DISABLED",
      authCode: auth.code || "AUTH_USER_DISABLED",
      stage: "playerAuthorization",
      diagnostics: auth.diagnostics || {},
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

  const authTimings = [];

  const authValidationStart =
    startApiPipelineStage("authValidation");

  const tokenExtractionStart =
    Date.now();

  const tokenSelection =
    selectRequestGoogleToken(e);

  const token =
    tokenSelection.token;

  const tokenFormat =
    tokenSelection.tokenFormat;

  recordAuthFlowTiming(
    authTimings,
    "tokenExtraction",
    tokenExtractionStart,
      {
        credentialReturned: token !== "",
        candidateDiagnostics: tokenSelection.candidates,
        noValidTokenFound: !tokenSelection.verified,
        requestFields: tokenSelection.fields,
        selectedTokenSource: tokenSelection.selectedTokenSource,
        tokenSource: tokenSelection.selectedTokenSource,
        tokenFormat: tokenFormat
      }
  );

  if (!tokenSelection.verified) {
    const failure =
      tokenSelection.failure ||
      (
        tokenSelection.hasCredential
          ? buildAuthVerificationFailure(
              "AUTH_GOOGLE_TOKEN_MALFORMED",
              "Google credential could not be decoded.",
              tokenFormat,
              {
                candidateDiagnostics: tokenSelection.candidates,
                noValidTokenFound: true,
                requestFields: tokenSelection.fields,
                selectedTokenSource: ""
              }
            )
          : {
              code: "AUTH_GOOGLE_TOKEN_MISSING",
              stage: "frontendCredential",
              error: "Sign in with Google to continue.",
              diagnostics:
                buildAuthDiagnostics(
                  "frontendCredential",
                  "AUTH_GOOGLE_TOKEN_MISSING",
                  "No Google credential was provided with the session request.",
                  {
                    candidateDiagnostics: tokenSelection.candidates,
                    noValidTokenFound: true,
                    requestFields: tokenSelection.fields,
                    selectedTokenSource: "",
                    tokenFormat: tokenFormat
                  }
                )
            }
      );

    endApiPipelineStage(
      "authValidation",
      authValidationStart,
      {
        reason: tokenSelection.hasCredential
          ? "no_valid_token"
          : "missing_token"
      }
    );

    return {
      authenticated: false,
      code: failure.code || "AUTH_GOOGLE_TOKEN_MISSING",
      stage: failure.stage || "frontendCredential",
      user: buildGuestUser(),
      error: failure.error || "Sign in with Google to continue.",
      diagnostics:
        attachAuthFlowTimings(
          failure.diagnostics || {},
          authTimings
        )
    };
  }

  const verified =
    tokenSelection.verified;

  recordAuthFlowTiming(
    authTimings,
    "googleTokenValidation",
    tokenExtractionStart,
    {
      valid: verified.valid || false,
      code: verified.code || "",
      stage: verified.stage || "googleTokenVerification",
      candidateDiagnostics: tokenSelection.candidates,
      selectedTokenSource: tokenSelection.selectedTokenSource,
      tokenFormat: tokenFormat
    }
  );

  endApiPipelineStage(
    "authValidation",
    authValidationStart,
    {
      tokenPresent: true,
      verified: verified.valid || false,
      verifiedStage: verified.stage || ""
    }
  );

  if (!verified.valid)
    return {
      authenticated: false,
      code: verified.code || "AUTH_GOOGLE_TOKEN_INVALID",
      stage: verified.stage || "googleTokenVerification",
      user: buildGuestUser(),
      error: verified.error || "Google identity could not be verified.",
      diagnostics:
        attachAuthFlowTimings(
          verified.diagnostics || {},
          authTimings
        )
    };

  const spreadsheetOpenStart =
    startApiPipelineStage("spreadsheetOpen");

  const sheet =
    ensureUsersSheet();

  endApiPipelineStage(
    "spreadsheetOpen",
    spreadsheetOpenStart,
    {
      sheetName: CONFIG.SHEETS.USERS
    }
  );

  const sheetLookupStart =
    startApiPipelineStage("sheetLookup");

  const userResolutionStart =
    Date.now();

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
    const role =
      bootstrap || configuredCommissioner
        ? USER_ROLES.COMMISSIONER
        : leagueIdentity.player !== ""
          ? USER_ROLES.MEMBER
          : USER_ROLES.GUEST;

    rowNumber =
      createUserRow(
        sheet,
        columns,
        verified,
        role,
        bootstrap ||
          configuredCommissioner ||
          leagueIdentity.player !== "" ||
          role === USER_ROLES.GUEST,
        leagueIdentity
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

  if (
    rowNumber !== -1 &&
    leagueIdentity.player === ""
  )
    activatePortalGuestUser(
      sheet,
      columns,
      rowNumber
    );

  let user =
    readUserRow(
      sheet,
      columns,
      rowNumber
    );

  if (!user.enabled) {
    activatePortalUser(
      sheet,
      columns,
      rowNumber
    );

    user =
      readUserRow(
        sheet,
        columns,
        rowNumber
      );
  }

  endApiPipelineStage(
    "sheetLookup",
    sheetLookupStart,
    {
      rowNumber: rowNumber,
      enabled: user.enabled || false
    }
  );

  recordAuthFlowTiming(
    authTimings,
    "userResolution",
    userResolutionStart,
    {
      rowNumber: rowNumber,
      enabled: user.enabled || false,
      leagueIdentity: leagueIdentity.player || ""
    }
  );

  if (!user.enabled)
    return {
      authenticated: false,
      code: "AUTH_USER_DISABLED",
      stage: "playerAuthorization",
      user: user,
      error: "This Google account exists but is not enabled.",
      diagnostics:
        attachAuthFlowTimings(
          buildAuthDiagnostics(
          "playerAuthorization",
          "AUTH_USER_DISABLED",
          "The user row exists but is disabled.",
          {
            email: verified.email,
            leaguePlayer: user.leaguePlayer || "",
            userRow: rowNumber,
            playerLookup: leagueIdentity
          }
          ),
          authTimings
        )
    };

  const sessionLookupStart =
    startApiPipelineStage("sessionLookup");

  const sessionCreationStart =
    Date.now();

  syncUserIdentity(
    sheet,
    columns,
    rowNumber,
    verified,
    leagueIdentity
  );

  endApiPipelineStage(
    "sessionLookup",
    sessionLookupStart,
    {
      rowNumber: rowNumber,
      leagueIdentity: leagueIdentity.player || ""
    }
  );

  recordAuthFlowTiming(
    authTimings,
    "sessionCreation",
    sessionCreationStart,
    {
      rowNumber: rowNumber,
      leagueIdentity: leagueIdentity.player || ""
    }
  );

  return {
    authenticated: true,
    code: "AUTH_OK",
    stage: "sessionValidation",
    diagnostics:
      attachAuthFlowTimings(
        buildAuthDiagnostics(
        "sessionValidation",
        "AUTH_OK",
        "Google credential verified and portal user resolved.",
        {
          email: verified.email,
          leaguePlayer:
            getAuthString(
              readUserRow(
                sheet,
                columns,
                rowNumber
              ).leaguePlayer
            ),
          userRow: rowNumber,
          playerLookup: leagueIdentity
        }
        ),
        authTimings
      ),
    user:
      readUserRow(
        sheet,
        columns,
        rowNumber
      )
  };

}

const PORTAL_DISPLAY_NAME_RESERVED = [
  "admin",
  "administrator",
  "commissioner",
  "guest",
  "system",
  "unknown"
];

function validatePortalDisplayName(
  sheet,
  columns,
  value,
  currentEmail,
  currentLeaguePlayer
) {

  const displayName =
    getAuthString(value);

  if (displayName.length < 3)
    return {
      valid: false,
      error: "Display name must be at least 3 characters."
    };

  if (displayName.length > 24)
    return {
      valid: false,
      error: "Display name must be 24 characters or fewer."
    };

  if (!/^[A-Za-z0-9 _-]+$/.test(displayName))
    return {
      valid: false,
      error: "Display name may use letters, numbers, spaces, hyphen, and underscore only."
    };

  const normalized =
    displayName.toLowerCase();

  if (PORTAL_DISPLAY_NAME_RESERVED.indexOf(normalized) !== -1)
    return {
      valid: false,
      error: "That display name is reserved."
    };

  if (
    isPortalDisplayNameTaken(
      sheet,
      columns,
      displayName,
      currentEmail,
      currentLeaguePlayer
    )
  )
    return {
      valid: false,
      error: "That display name is already in use."
    };

  return {
    valid: true,
    displayName: displayName
  };

}

function isPortalDisplayNameTaken(
  sheet,
  columns,
  displayName,
  currentEmail,
  currentLeaguePlayer
) {

  const target =
    getAuthString(displayName).toLowerCase();
  const currentEmailKey =
    getAuthString(currentEmail).toLowerCase();
  const currentLeaguePlayerKey =
    getAuthString(currentLeaguePlayer).toLowerCase();

  const values =
    sheet
      .getDataRange()
      .getValues();

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const email =
      getAuthString(values[index][columns.email])
        .toLowerCase();

    if (email === currentEmailKey)
      continue;

    if (
      getAuthString(values[index][columns.displayName])
        .toLowerCase() === target
    )
      return true;
  }

  const registry =
    buildPlayerRegistry();

  for (const key in registry) {
    const player =
      registry[key];
    const playerName =
      getAuthString(player.player);

    if (playerName.toLowerCase() === currentLeaguePlayerKey)
      continue;

    if (
      playerName.toLowerCase() === target ||
      getAuthString(player.displayName).toLowerCase() === target
    )
      return true;
  }

  return false;

}

function validatePortalDiscordName(value) {

  const discordName =
    getAuthString(value);

  if (discordName.length > 40)
    return {
      valid: false,
      error: "Discord name must be 40 characters or fewer."
    };

  if (
    discordName !== "" &&
    !/^[A-Za-z0-9 ._#@-]+$/.test(discordName)
  )
    return {
      valid: false,
      error: "Discord name contains unsupported characters."
    };

  return {
    valid: true,
    discordName: discordName
  };

}

function validatePortalProfileVisibility(value) {

  const visibility =
    getAuthString(value);

  if (visibility === "Private")
    return "Private";

  return "Public";

}

function syncPortalDisplayNameReferences(user, displayName) {

  const leaguePlayer =
    getAuthString(user.leaguePlayer);

  if (leaguePlayer !== "") {
    try {
      setLeaguePlayerDisplayName(
        leaguePlayer,
        displayName
      );
    }
    catch (err) {
      Logger.log(
        "League display name sync skipped: " +
        err
      );
    }
  }

  syncEventParticipantDisplayName(
    user,
    displayName
  );

}

function syncEventParticipantDisplayName(user, displayName) {

  const leaguePlayer =
    getAuthString(user.leaguePlayer);
  const email =
    getAuthString(user.email).toLowerCase();

  if (
    leaguePlayer === "" &&
    email === ""
  )
    return;

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.EVENT_PARTICIPANTS);

  if (!sheet)
    return;

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return;

  const headers =
    values[0]
      .map(getAuthString);
  const playerCol =
    headers.indexOf("Player");
  const displayNameCol =
    headers.indexOf("Display Name");
  const emailCol =
    headers.indexOf("Email");

  if (displayNameCol === -1)
    return;

  for (
    let index = 1;
    index < values.length;
    index++
  ) {
    const rowPlayer =
      playerCol === -1
        ? ""
        : getAuthString(values[index][playerCol]);
    const rowEmail =
      emailCol === -1
        ? ""
        : getAuthString(values[index][emailCol]).toLowerCase();

    if (
      (
        leaguePlayer !== "" &&
        rowPlayer.toLowerCase() === leaguePlayer.toLowerCase()
      ) ||
      (
        email !== "" &&
        rowEmail === email
      )
    )
      sheet
        .getRange(index + 1, displayNameCol + 1)
        .setValue(displayName);
  }

}

function invalidatePortalIdentityCaches() {

  if (typeof invalidatePlayerRegistryCache === "function")
    invalidatePlayerRegistryCache();

  if (typeof invalidatePortalCacheGroup === "function") {
    invalidatePortalCacheGroup("players");
    invalidatePortalCacheGroup("search");
    invalidatePortalCacheGroup("analytics");
  }

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

function activatePortalGuestUser(sheet, columns, rowNumber) {

  activatePortalUser(
    sheet,
    columns,
    rowNumber
  );

}

function activatePortalUser(sheet, columns, rowNumber) {

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

  const tokenDiagnostics =
    getGoogleTokenDiagnostics(token);

  if (configuredClientId === "")
    return buildAuthVerificationFailure(
      "AUTH_OAUTH_CLIENT_MISSING",
      "Google OAuth Client ID is not configured.",
      tokenDiagnostics,
      {
        correctiveAction: "Configure the Google OAuth Client ID in portal settings."
      }
    );

  if (tokenDiagnostics.malformed)
    return buildAuthVerificationFailure(
      "AUTH_GOOGLE_TOKEN_MALFORMED",
      "Google credential could not be decoded.",
      tokenDiagnostics,
      {
        correctiveAction: "Sign out, refresh the page, and sign in with Google again."
      }
    );

  if (
    tokenDiagnostics.exp !== "" &&
    Number(tokenDiagnostics.exp) + 120 <
      Math.floor(Date.now() / 1000)
  )
    return buildAuthVerificationFailure(
      "AUTH_GOOGLE_TOKEN_EXPIRED",
      "Google credential has expired.",
      tokenDiagnostics,
      {
        correctiveAction: "Refresh the page and sign in again."
      }
    );

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
      return buildAuthVerificationFailure(
        response.getResponseCode() >= 500
          ? "AUTH_GOOGLE_TOKENINFO_UNAVAILABLE"
          : "AUTH_GOOGLE_TOKEN_INVALID",
        response.getResponseCode() >= 500
          ? "Google token verification service is temporarily unavailable."
          : "Google credential could not be verified.",
        tokenDiagnostics,
        {
          httpStatus: response.getResponseCode(),
          tokenInfoError:
            getAuthTokenInfoError(response.getContentText()),
          correctiveAction:
            response.getResponseCode() >= 500
              ? "Refresh the page and try signing in again."
              : "Sign out, refresh the page, and sign in with Google again."
        }
      );

    const payload =
      JSON.parse(response.getContentText());

    if (
      payload.aud !== configuredClientId
    )
      return buildAuthVerificationFailure(
        "AUTH_GOOGLE_TOKEN_AUDIENCE_MISMATCH",
        "Google token audience does not match the configured OAuth client.",
        getGoogleTokenPayloadDiagnostics(payload),
        {
          configuredAudienceHash:
            hashAuthDiagnosticValue(configuredClientId),
          correctiveAction:
            "Confirm the deployed frontend and portal settings use the same Google OAuth Client ID."
        }
      );

    if (
      getAuthString(payload.iss) !== "" &&
      getAuthString(payload.iss) !== "accounts.google.com" &&
      getAuthString(payload.iss) !== "https://accounts.google.com"
    )
      return buildAuthVerificationFailure(
        "AUTH_GOOGLE_TOKEN_ISSUER_INVALID",
        "Google token issuer is invalid.",
        getGoogleTokenPayloadDiagnostics(payload),
        {
          correctiveAction: "Sign in again with Google."
        }
      );

    if (
      getAuthString(payload.email) === "" ||
      payload.email_verified === "false"
    )
      return buildAuthVerificationFailure(
        "AUTH_EMAIL_UNVERIFIED",
        "Google email is missing or unverified.",
        getGoogleTokenPayloadDiagnostics(payload),
        {
          correctiveAction:
            "Use a Google account with a verified email address."
        }
      );

    const verified = {
      valid: true,
      code: "AUTH_GOOGLE_TOKEN_VERIFIED",
      stage: "googleTokenVerification",
      email: getAuthString(payload.email).toLowerCase(),
      displayName: getAuthString(payload.name),
      avatarUrl: getAuthString(payload.picture),
      diagnostics:
        buildAuthDiagnostics(
          "googleTokenVerification",
          "AUTH_GOOGLE_TOKEN_VERIFIED",
          "Google token verified successfully.",
          getGoogleTokenPayloadDiagnostics(payload)
        )
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
      code: "AUTH_GOOGLE_TOKEN_VERIFICATION_EXCEPTION",
      stage: "googleTokenVerification",
      error: "Google credential verification failed unexpectedly.",
      diagnostics:
        buildAuthDiagnostics(
          "googleTokenVerification",
          "AUTH_GOOGLE_TOKEN_VERIFICATION_EXCEPTION",
          "Google token verification threw an exception.",
          {
            exception: String(err),
            token: tokenDiagnostics
          }
        )
    };

  }

}

function getGoogleTokenFormatDiagnostics(token) {

  const text =
    getAuthString(token);

  const parts =
    text.split(".");

  return {
    credentialLength: text.length,
    credentialPreviewEnd:
      text.slice(-8),
    credentialPreviewStart:
      text.slice(0, 8),
    credentialSha256:
      hashAuthDiagnosticValue(text),
    credentialStartsWithEyJ:
      text.indexOf("eyJ") === 0,
    headerLength: parts[0] ? parts[0].length : 0,
    payloadLength: parts[1] ? parts[1].length : 0,
    signatureLength: parts[2] ? parts[2].length : 0,
    partCount: parts.length,
    format:
      parts.length === 3
        ? "jwt"
        : "not_jwt",
    hasWhitespace:
      /\s/.test(text)
  };

}

function isLikelyGoogleJwt(token) {

  const text =
    getAuthString(token);

  const parts =
    text.split(".");

  return (
    text.length > 100 &&
    text.indexOf("eyJ") === 0 &&
    parts.length === 3 &&
    !/\s/.test(text)
  );

}

function buildAuthVerificationFailure(code, message, tokenDiagnostics, details) {

  return {
    valid: false,
    code: code,
    stage: "googleTokenVerification",
    error: message,
    diagnostics:
      buildAuthDiagnostics(
        "googleTokenVerification",
        code,
        message,
        Object.assign(
          {
            token: tokenDiagnostics || {}
          },
          details || {}
        )
      )
  };

}

function buildAuthDiagnostics(stage, code, message, details) {

  return {
    timestamp: getAuthTimestamp(),
    stage: stage,
    code: code,
    message: message,
    details: details || {}
  };

}

function recordAuthFlowTiming(timings, stage, startTime, details) {

  if (!timings)
    return;

  timings.push({
    stage: stage,
    startTime: startTime,
    endTime: Date.now(),
    durationMs: Date.now() - startTime,
    details: details || {}
  });

}

function attachAuthFlowTimings(diagnostics, timings) {

  const next =
    diagnostics || {};

  if (!next.details)
    next.details = {};

  next.details.authFlowTimings =
    timings || [];

  return next;

}

function getGoogleTokenDiagnostics(token) {

  const parts =
    getAuthString(token).split(".");

  if (parts.length < 2)
    return {
      malformed: true
    };

  try {
    const payloadText =
      Utilities.newBlob(
        Utilities.base64DecodeWebSafe(parts[1])
      ).getDataAsString();

    return getGoogleTokenPayloadDiagnostics(
      JSON.parse(payloadText)
    );
  }
  catch (err) {
    return {
      malformed: true,
      exception: String(err)
    };
  }

}

function getGoogleTokenPayloadDiagnostics(payload) {

  return {
    audHash:
      hashAuthDiagnosticValue(
        getAuthString(payload.aud)
      ),
    email:
      getAuthString(payload.email)
        .toLowerCase(),
    emailVerified:
      String(payload.email_verified) === "true" ||
      payload.email_verified === true,
    exp: getAuthString(payload.exp),
    hd: getAuthString(payload.hd),
    iss: getAuthString(payload.iss),
    subHash:
      hashAuthDiagnosticValue(
        getAuthString(payload.sub)
      )
  };

}

function getAuthTokenInfoError(content) {

  try {
    const payload =
      JSON.parse(content);

    return getAuthString(payload.error_description) ||
      getAuthString(payload.error);
  }
  catch (err) {
    return "";
  }

}

function hashAuthDiagnosticValue(value) {

  const text =
    getAuthString(value);

  if (text === "")
    return "";

  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      text
    )
  ).slice(0, 16);

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
    discordName: headers.indexOf("Discord Name"),
    profileVisibility: headers.indexOf("Profile Visibility"),
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

function createUserRow(sheet, columns, verified, role, enabled, leagueIdentity) {

  const row = [];
  const timestamp =
    getAuthTimestamp();

  row[columns.email] = verified.email;
  row[columns.displayName] =
    getAuthString(leagueIdentity && leagueIdentity.player) ||
    verified.displayName ||
    verified.email;
  row[columns.role] = role;
  row[columns.enabled] = enabled;
  row[columns.favoriteFaction] = "";
  if (columns.discordName !== -1)
    row[columns.discordName] = "";
  if (columns.profileVisibility !== -1)
    row[columns.profileVisibility] = "Public";
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
      getAuthString(row[columns.displayName]) ||
      leagueIdentity.displayName ||
      leagueIdentity.player,
    leagueDivision: leagueIdentity.division,
    role: normalizeUserRole(row[columns.role]),
    enabled: getAuthBoolean(row[columns.enabled]),
    favoriteFaction: getAuthString(row[columns.favoriteFaction]),
    discordName:
      columns.discordName === -1
        ? ""
        : getAuthString(row[columns.discordName]),
    profileVisibility:
      columns.profileVisibility === -1
        ? "Public"
        : getAuthString(row[columns.profileVisibility]) || "Public",
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

function syncUserIdentity(sheet, columns, rowNumber, verified, leagueIdentity) {

  if (verified.avatarUrl)
    sheet
      .getRange(rowNumber, columns.avatarUrl + 1)
      .setValue(verified.avatarUrl);

  migratePortalDisplayName(
    sheet,
    columns,
    rowNumber,
    verified,
    leagueIdentity
  );

  sheet
    .getRange(rowNumber, columns.lastLogin + 1)
    .setValue(getAuthTimestamp());

  updateUserLastSeen(
    sheet,
    columns,
    rowNumber
  );

}

function migratePortalDisplayName(sheet, columns, rowNumber, verified, leagueIdentity) {

  if (columns.displayName === -1)
    return;

  const leagueDisplayName =
    getAuthString(leagueIdentity && leagueIdentity.displayName) ||
    getAuthString(leagueIdentity && leagueIdentity.player);

  if (leagueDisplayName === "")
    return;

  const currentDisplayName =
    getAuthString(
      sheet
        .getRange(rowNumber, columns.displayName + 1)
        .getValue()
    );

  const googleDisplayName =
    getAuthString(verified.displayName);
  const email =
    getAuthString(verified.email);

  if (
    currentDisplayName !== "" &&
    currentDisplayName.toLowerCase() !== email.toLowerCase() &&
    (
      googleDisplayName === "" ||
      currentDisplayName.toLowerCase() !== googleDisplayName.toLowerCase()
    )
  )
    return;

  sheet
    .getRange(rowNumber, columns.displayName + 1)
    .setValue(leagueDisplayName);

}

function getAuthLeagueIdentityByEmail(email) {

  const normalized =
    getAuthString(email)
      .toLowerCase();

  if (normalized === "")
    return {
      player: "",
      displayName: "",
      division: "",
      matches: 0,
      status: "NO_EMAIL"
    };

  const spreadsheet =
    SpreadsheetApp.getActive();

  const sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.PLAYERS);

  if (!sheet)
    return {
      player: "",
      displayName: "",
      division: "",
      matches: 0,
      status: "PLAYERS_SHEET_MISSING"
    };

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length === 0)
    return {
      player: "",
      displayName: "",
      division: "",
      matches: 0,
      status: "PLAYERS_SHEET_EMPTY"
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
      division: "",
      matches: 0,
      status: "PLAYERS_HEADERS_MISSING"
    };

  const matches = [];

  for (
    let index = 1;
    index < values.length;
    index++
  ) {

    if (
      getAuthString(values[index][emailCol])
        .toLowerCase() === normalized
    )
      matches.push({
        player: getAuthString(values[index][playerCol]),
        displayName:
          displayNameCol === -1
            ? getAuthString(values[index][playerCol])
            : getAuthString(values[index][displayNameCol]) ||
              getAuthString(values[index][playerCol]),
        division:
          divisionCol === -1
            ? ""
            : getAuthString(values[index][divisionCol]),
        row: index + 1
      });

  }

  if (matches.length > 0)
    return {
      player: matches[0].player,
      displayName: matches[0].displayName,
      division: matches[0].division,
      matchRows:
        matches.map(function(match) {
          return match.row;
        }),
      matches: matches.length,
      status:
        matches.length > 1
          ? "DUPLICATE_MATCH"
          : "MATCH"
    };

  return {
    player: "",
    displayName: "",
    matches: 0,
    status: "NO_MATCH"
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

  const profileUser =
    Object.assign(
      {},
      user,
      {
        eventRegistrations:
          getProfileEventRegistrations(user)
      }
    );

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
    user: profileUser,
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

function getProfileEventRegistrations(user) {

  if (!user)
    return [];

  if (
    typeof getEventEngineSnapshot !== "function" ||
    typeof getEventEngineRows !== "function" ||
    typeof ensureEventEngineSheet !== "function" ||
    typeof getEventParticipantKey !== "function"
  )
    return [];

  const eventsById = {};

  getEventEngineSnapshot()
    .events
    .forEach(function(event) {
      eventsById[event.id] = event;
    });

  const rows =
    getEventEngineRows(
      ensureEventEngineSheet(
        CONFIG.SHEETS.EVENT_PARTICIPANTS,
        EVENT_ENGINE_PARTICIPANT_HEADERS
      )
    );

  return rows
    .filter(function(row) {
      const event =
        eventsById[row["Event ID"]] || {};
      const participantKey =
        getEventParticipantKey(event, user);

      return participantKey !== "" &&
        getAuthString(row["Player"]).toLowerCase() ===
          participantKey.toLowerCase();
    })
    .map(function(row) {
      const event =
        eventsById[row["Event ID"]] || {};

      return {
        eventId: row["Event ID"],
        eventName: event.name || row["Event ID"],
        eventType: event.type || "",
        eventRole: row["Role"] || "Player",
        team: row["Team"],
        status: row["Status"] || "Registered",
        registeredAt: row["Registered At"],
        updatedAt: row["Updated At"] || row["Registered At"],
        registration: {
          eventId: row["Event ID"],
          eventName: event.name || row["Event ID"],
          eventType: event.type || "",
          status: row["Status"] || "Registered",
          team: row["Team"],
          preferredTeam: row["Preferred Team"] || row["Team"]
        }
      };
    });

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
    draws: Number(playerStats.draws) || 0,
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
          losses: 0,
          draws: 0
        };

      opponents[opponent].games++;

      if (result === "Win")
        opponents[opponent].wins++;

      if (result === "Loss")
        opponents[opponent].losses++;

      if (result === "Draw")
        opponents[opponent].draws++;
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

  return selectRequestGoogleToken(e).token;

}

function selectRequestGoogleToken(e) {

  const metadata =
    getRequestAuthTokenMetadata(e);

  const requestClientId =
    getRequestOAuthClientId(e);

  const candidates =
    metadata.candidates.map(function(candidate) {
      return Object.assign(
        {
          verificationAttempted: false,
          verificationSucceeded: false,
          skippedBecauseInvalidShape: false,
          skippedBecauseEmpty: candidate.token === ""
        },
        candidate.diagnostics,
        {
          source: candidate.source
        }
      );
    });

  let failure =
    null;

  for (let index = 0; index < metadata.candidates.length; index += 1) {
    const candidate =
      metadata.candidates[index];

    const candidateDiagnostic =
      candidates[index];

    if (candidate.token === "")
      continue;

    if (!isLikelyGoogleJwt(candidate.token)) {
      candidateDiagnostic.skippedBecauseInvalidShape = true;
      continue;
    }

    candidateDiagnostic.verificationAttempted = true;

    const verified =
      verifyGoogleIdentityToken(
        candidate.token,
        requestClientId
      );

    candidateDiagnostic.verificationSucceeded =
      verified.valid || false;
    candidateDiagnostic.verificationCode =
      verified.code || "";
    candidateDiagnostic.verificationStage =
      verified.stage || "";

    if (verified.valid)
      return {
        candidates: candidates,
        failure: null,
        fields: metadata.fields,
        hasCredential: metadata.hasCredential,
        selectedTokenSource: candidate.source,
        token: candidate.token,
        tokenFormat: candidate.diagnostics,
        verified: verified
      };

    failure =
      verified;
  }

  const firstProvided =
    metadata.candidates.filter(function(candidate) {
      return candidate.token !== "";
    })[0];

  return {
    candidates: candidates,
    failure: failure,
    fields: metadata.fields,
    hasCredential: metadata.hasCredential,
    selectedTokenSource: "",
    token: "",
    tokenFormat: firstProvided
      ? firstProvided.diagnostics
      : getGoogleTokenFormatDiagnostics(""),
    verified: null
  };

}

function getRequestAuthTokenMetadata(e) {

  const params =
    getAuthParams(e);

  const authToken =
    getAuthString(params.authToken);

  const idToken =
    getAuthString(params.idToken);

  const credential =
    getAuthString(params.credential);

  const source =
    authToken !== ""
      ? "authToken"
      : idToken !== ""
        ? "idToken"
        : credential !== ""
          ? "credential"
          : "";

  const token =
    source === "authToken"
      ? authToken
      : source === "idToken"
        ? idToken
        : source === "credential"
          ? credential
          : "";

  return {
    token: token,
    source: source,
    hasCredential:
      authToken !== "" ||
      idToken !== "" ||
      credential !== "",
    candidates: [
      {
        source: "authToken",
        token: authToken,
        diagnostics: getGoogleTokenFormatDiagnostics(authToken)
      },
      {
        source: "idToken",
        token: idToken,
        diagnostics: getGoogleTokenFormatDiagnostics(idToken)
      },
      {
        source: "credential",
        token: credential,
        diagnostics: getGoogleTokenFormatDiagnostics(credential)
      }
    ],
    fields: {
      authToken: getGoogleTokenFormatDiagnostics(authToken),
      credential: getGoogleTokenFormatDiagnostics(credential),
      idToken: getGoogleTokenFormatDiagnostics(idToken),
      populated: {
        authToken: authToken !== "",
        credential: credential !== "",
        idToken: idToken !== ""
      }
    }
  };

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
