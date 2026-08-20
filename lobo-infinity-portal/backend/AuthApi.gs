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
  "Password Hash",
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
  // Deprecated: legacy League-only submission permission.
  // Use canSubmitLeagueGames, canSubmitCasualGames, or canSubmitArmyLists for new work.
  submitLists: USER_ROLES.MEMBER,
  canSubmitLeagueGames: USER_ROLES.MEMBER,
  canSubmitCasualGames: USER_ROLES.GUEST,
  canSubmitArmyLists: USER_ROLES.GUEST,
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

  const forensicStart =
    enterApiForensicFunction(
      "getAuthSession",
      "authentication",
      {}
    );

  try {

    ensureUsersSheet();

    const auth =
      getRequestUser(e);

    setApiForensicAuthState(auth);

    logAuthSessionCorrelation({
      authenticationResult:
        auth.authenticated
          ? "authenticated"
          : (auth.code || "unauthenticated"),
      credentialPresent: !!(e && e.parameter && e.parameter.sessionToken)
    });

    return jsonOutput({
      success: true,
      authenticated: auth.authenticated,
      code: auth.code || "",
      stage: auth.stage || "",
      diagnostics: auth.diagnostics || {},
      user: auth.user,
      permissions: getRolePermissions(auth.user.role),
      oauthConfigured: false,
      error: auth.error || ""
    });
  }
  catch (err) {
    recordApiForensicException(
      "getAuthSession",
      "authentication",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "getAuthSession",
      "authentication",
      forensicStart,
      {}
    );
  }

}

function commissionerLogin(e) {

  const password =
    e && e.parameter && e.parameter.password !== undefined
      ? String(e.parameter.password)
      : "";
  const session = createCommissionerSession(password);

  if (!session)
    return jsonOutput({
      success: false,
      authenticated: false,
      code: "AUTH_INVALID_CREDENTIALS",
      stage: "credentialVerification",
      user: buildGuestUser(),
      permissions: getRolePermissions(USER_ROLES.GUEST),
      error: "Invalid Commissioner password."
    });

  return jsonOutput({
    success: true,
    authenticated: true,
    code: "AUTH_OK",
    stage: "sessionValidation",
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    user: session.user,
    permissions: getRolePermissions(session.user.role)
  });

}

function getCommissionerPasswordStatus() {

  return jsonOutput({
    success: true,
    configured: commissionerPasswordConfigured()
  });

}

function setupCommissionerPassword(e) {

  const password =
    e && e.parameter && e.parameter.password !== undefined
      ? String(e.parameter.password)
      : "";
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    if (commissionerPasswordConfigured())
      return jsonOutput({
        success: false,
        authenticated: false,
        code: "AUTH_COMMISSIONER_ALREADY_CONFIGURED",
        stage: "credentialSetup",
        user: buildGuestUser(),
        permissions: getRolePermissions(USER_ROLES.GUEST),
        error: "Commissioner access is already configured."
      });

    const passwordHash = hashUserPassword(password);

    PropertiesService.getScriptProperties().setProperty(
      COMMISSIONER_PASSWORD_HASH_PROPERTY,
      passwordHash
    );

    const session = createCommissionerSessionRecord();

    return jsonOutput({
      success: true,
      authenticated: true,
      code: "AUTH_OK",
      stage: "sessionValidation",
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      user: session.user,
      permissions: getRolePermissions(session.user.role)
    });
  }
  finally {
    lock.releaseLock();
  }

}

function commissionerLogout(e) {

  const token =
    getAuthString(
      e && e.parameter
        ? e.parameter.sessionToken
        : ""
    );

  destroyNativeSession(token);

  const user = buildGuestUser();

  return jsonOutput({
    success: true,
    authenticated: false,
    code: "AUTH_LOGGED_OUT",
    stage: "sessionDestruction",
    user: user,
    permissions: getRolePermissions(user.role)
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

function getIdentityResolutionDiagnostics(auth) {

  const profile =
    buildUserProfile(auth.user);
  const user =
    profile.user || {};
  const email =
    getAuthString(user.email).toLowerCase();
  const canonicalIdentity =
    getAuthCanonicalPlayerIdentityByEmail(email);
  const canonicalPlayer =
    getAuthString(user.canonicalPlayer);
  const standingsResolution =
    resolveIdentityDiagnosticsStanding(canonicalPlayer);
  const reasons = [];

  if (email === "")
    reasons.push("Authenticated Google email is missing.");

  if (canonicalIdentity.player === "")
    reasons.push(getIdentityResolutionRegistryReason(canonicalIdentity.status));

  if (canonicalPlayer === "")
    reasons.push("Canonical player is missing from getMyProfile payload.");

  if (!standingsResolution.match)
    reasons.push(
      canonicalPlayer === ""
        ? "No DivisionStandings lookup attempted because canonical player is missing."
        : "No DivisionStandings match for canonical player: " + canonicalPlayer
    );

  return jsonOutput({
    success: true,
    identityResolution: {
      email: email,
      canonicalPlayer: canonicalPlayer,
      leaguePlayer: getAuthString(user.leaguePlayer),
      displayName: getAuthString(user.displayName),
      playerRegistryMatch: canonicalIdentity.player !== "",
      playerRegistryStatus: canonicalIdentity.status,
      playerRegistryReason:
        canonicalIdentity.player !== ""
          ? ""
          : getIdentityResolutionRegistryReason(canonicalIdentity.status),
      playerRegistrySource: getAuthString(canonicalIdentity.source),
      playerRegistryMatchRows: canonicalIdentity.matchRows || [],
      divisionStandingsMatch: standingsResolution.match,
      divisionStandingsReason:
        standingsResolution.match
          ? ""
          : (
              canonicalPlayer === ""
                ? "Canonical player missing."
                : "No DivisionStandings match for canonical player."
            ),
      currentLeague: standingsResolution.currentLeague,
      division: standingsResolution.division,
      rank: standingsResolution.rank,
      competitiveHome: standingsResolution.competitiveHome,
      matchedStanding: standingsResolution.standing,
      reasons: reasons
    }
  });

}

function resolveIdentityDiagnosticsStanding(canonicalPlayer) {

  const normalized =
    getAuthString(canonicalPlayer).toLowerCase();

  if (normalized === "")
    return {
      match: false,
      currentLeague: "",
      division: "",
      rank: 0,
      competitiveHome: "",
      standing: null
    };

  const divisions =
    getSearchPlayers();

  for (
    let divisionIndex = 0;
    divisionIndex < divisions.length;
    divisionIndex++
  ) {
    const division =
      divisions[divisionIndex];
    const standings =
      division.standings || [];

    for (
      let rowIndex = 0;
      rowIndex < standings.length;
      rowIndex++
    ) {
      const row =
        standings[rowIndex];
      const player =
        getAuthString(row.player).toLowerCase();
      const displayName =
        getAuthString(row.displayName).toLowerCase();

      if (
        player === normalized ||
        displayName === normalized
      ) {
        const divisionLabel =
          getAuthString(row.division) ||
          getAuthString(division.divisionLabel);

        return {
          match: true,
          currentLeague:
            division.event && division.event.name
              ? getAuthString(division.event.name)
              : "",
          division: divisionLabel,
          rank: Number(row.rank) || 0,
          competitiveHome: divisionLabel,
          standing: {
            eventId: getAuthString(row.eventId),
            player: getAuthString(row.player),
            displayName: getAuthString(row.displayName),
            division: divisionLabel,
            rank: Number(row.rank) || 0
          }
        };
      }
    }
  }

  return {
    match: false,
    currentLeague: "",
    division: "",
    rank: 0,
    competitiveHome: "",
    standing: null
  };

}

function getIdentityResolutionRegistryReason(status) {

  switch (status) {
    case "NO_EMAIL":
      return "No authenticated Google email.";
    case "NO_MATCH":
      return "No Players-sheet email match.";
    case "DUPLICATE_MATCH":
      return "Multiple Players-sheet email matches; using the first row.";
    case "RECOVERED_EVENT_PARTICIPANT_MATCH":
      return "Recovered canonical player from Event Engine participant email.";
    case "RECOVERED_EVENT_PARTICIPANT_DUPLICATE_MATCH":
      return "Recovered canonical player from multiple Event Engine participant rows; using the first row.";
    case "NO_RECOVERY_MATCH":
      return "No Players-sheet or Event Participants email match.";
    case "PLAYERS_SHEET_MISSING":
      return "Players sheet not found.";
    case "PLAYERS_SHEET_EMPTY":
      return "Players sheet has no rows.";
    case "PLAYERS_HEADERS_MISSING":
      return "Players sheet is missing Player or Google Email headers.";
    default:
      return "Player Registry lookup failed: " + getAuthString(status);
  }

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
            getCanonicalPlayerFromUser(auth.user)
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

function requireApiPermission(e, permission, handler, resolvedAuth) {

  const auth =
    resolvedAuth || getRequestUser(e);

  logAuthorizationDiagnostic(
    "authorization.check",
    auth,
    permission,
    ""
  );

  if (!auth.authenticated) {
    logAuthorizationDiagnostic(
      "authorization.denied",
      auth,
      permission,
      auth.error || "Authentication is required."
    );

    return jsonOutput({
      success: false,
      code: "AUTH_REQUIRED",
      authCode: auth.code || "AUTH_REQUIRED",
      stage: auth.stage || "authentication",
      diagnostics: auth.diagnostics || {},
      error: auth.error || "Authentication is required.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER
    });
  }

  if (!auth.user.enabled) {
    logAuthorizationDiagnostic(
      "authorization.denied",
      auth,
      permission,
      "User is disabled."
    );

    return jsonOutput({
      success: false,
      code: "USER_DISABLED",
      authCode: auth.code || "AUTH_USER_DISABLED",
      stage: "playerAuthorization",
      diagnostics: auth.diagnostics || {},
      error: "This Google account is not enabled for league access.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER
    });
  }

  if (!userHasPermission(auth.user.role, permission)) {
    logAuthorizationDiagnostic(
      "authorization.denied",
      auth,
      permission,
      "Role does not satisfy required permission."
    );

    return jsonOutput({
      success: false,
      code: "PERMISSION_DENIED",
      error: "You do not have permission to perform this action.",
      requiredRole: PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER,
      role: auth.user.role
    });
  }

  return handler(auth);

}

function logAuthorizationDiagnostic(stage, auth, permission, reason) {

  try {
    const user =
      auth && auth.user
        ? auth.user
        : buildGuestUser();
    const permissions =
      getRolePermissions(user.role);
    const canonicalPlayer =
      getCanonicalPlayerFromUser(user);

    Logger.log(
      "AUTHORIZATION_DIAGNOSTIC " +
      JSON.stringify({
        stage: stage,
        endpoint:
          API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.action
            ? API_PIPELINE_CONTEXT.action
            : "",
        action:
          API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.action
            ? API_PIPELINE_CONTEXT.action
            : "",
        requestId:
          API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.requestId
            ? API_PIPELINE_CONTEXT.requestId
            : "",
        timestamp: new Date().toISOString(),
        authorizationHelper: "requireApiPermission",
        permission: permission,
        permissionRequested: permission,
        permissionGranted:
          userHasPermission(
            user.role,
            permission
          ),
        failedPermission: reason ? permission : "",
        reason: reason || "",
        email: getAuthString(user.email).toLowerCase(),
        authenticated: !!(auth && auth.authenticated),
        canonicalPlayer: canonicalPlayer,
        registeredUser: !!(user && user.enabled),
        leaguePlayer: canonicalPlayer !== "",
        commissioner:
          userHasPermission(
            user.role,
            "runSeasonControl"
          ),
        canSubmitLeagueGames:
          permissions.canSubmitLeagueGames === true,
        canSubmitCasualGames:
          permissions.canSubmitCasualGames === true,
        canSubmitArmyLists:
          permissions.canSubmitArmyLists === true,
        role: user.role || "",
        requiredRole:
          PERMISSION_MIN_ROLE[permission] || USER_ROLES.MEMBER,
        authCode: auth && auth.code ? auth.code : ""
      })
    );
  }
  catch (err) {
    Logger.log(
      "AUTHORIZATION_DIAGNOSTIC_FAILED " + err
    );
  }

}

function getRequestUser(e) {

  const forensicStart =
    enterApiForensicFunction(
      "getRequestUser",
      "authentication",
      {}
    );

  try {

  const hasNativeSessionToken = !!(
    e &&
    e.parameter &&
    Object.prototype.hasOwnProperty.call(e.parameter, "sessionToken")
  );

  if (hasNativeSessionToken) {
    const nativeSession =
      validateNativeSession(e.parameter.sessionToken);

    if (!nativeSession)
      return {
        authenticated: false,
        code: "AUTH_NATIVE_SESSION_INVALID",
        stage: "sessionValidation",
        user: buildGuestUser(),
        error: "Session is invalid or expired.",
        diagnostics: {}
      };

    return {
      authenticated: true,
      code: "AUTH_OK",
      stage: "sessionValidation",
      user: nativeSession.user,
      diagnostics: {}
    };
  }

  return {
    authenticated: false,
    code: "AUTH_SESSION_MISSING",
    stage: "sessionValidation",
    user: buildGuestUser(),
    error: "Commissioner authentication is required.",
    diagnostics: {}
  };

  const authTimings = [];

  const authValidationStart =
    startApiPipelineStage("authValidation");

  const tokenExtractionStart =
    Date.now();

  const tokenSelection =
    selectRequestGoogleToken(e);

  const token =
    tokenSelection.token;

  logAuthSessionCorrelation({
    credentialPresent: token !== ""
  });

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
    getAuthCanonicalPlayerIdentityByEmail(verified.email);

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
  catch (err) {
    recordApiForensicException(
      "getRequestUser",
      "authentication",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "getRequestUser",
      "authentication",
      forensicStart,
      {}
    );
  }

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
    getAuthString(getCanonicalPlayerFromUser(user));

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
    getAuthString(getCanonicalPlayerFromUser(user));
  const email =
    getAuthString(user.email).toLowerCase();

  if (
    leaguePlayer === "" &&
    email === ""
  )
    return;

  const sheet =
    lifGetTargetSpreadsheet_()
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

  logAuthSessionCorrelation({
    credentialPresent: getAuthString(token) !== ""
  });

  const forensicStart =
    enterApiForensicFunction(
      "verifyGoogleIdentityToken",
      "tokenVerification",
      {}
    );

  try {

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

    let response;

    try {
      response =
        UrlFetchApp.fetch(
          "https://oauth2.googleapis.com/tokeninfo?id_token=" +
            encodeURIComponent(token),
          {
            muteHttpExceptions: true
          }
        );
    }
    catch (fetchErr) {
      const exception =
        getGoogleTokenVerificationExceptionDiagnostics(fetchErr);

      logGoogleTokenVerificationFetchException(exception);

      return buildGoogleTokenVerificationExceptionFailure(
        tokenDiagnostics,
        exception
      );
    }

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

    return buildGoogleTokenVerificationExceptionFailure(
      tokenDiagnostics,
      getGoogleTokenVerificationExceptionDiagnostics(err)
    );

  }

  }
  catch (err) {
    recordApiForensicException(
      "verifyGoogleIdentityToken",
      "tokenVerification",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "verifyGoogleIdentityToken",
      "tokenVerification",
      forensicStart,
      {}
    );
  }

}

function buildGoogleTokenVerificationExceptionFailure(
  tokenDiagnostics,
  exception
) {

  const preservedException =
    exception || {
      name: "Error",
      message: "",
      stack: ""
    };

  const diagnostics =
    buildAuthDiagnostics(
      "googleTokenVerification",
      "AUTH_GOOGLE_TOKEN_VERIFICATION_EXCEPTION",
      "Google token verification threw an exception.",
      {
        exception: preservedException,
        token: tokenDiagnostics
      }
    );

  diagnostics.exception = preservedException;

  return {
    valid: false,
    code: "AUTH_GOOGLE_TOKEN_VERIFICATION_EXCEPTION",
    stage: "googleTokenVerification",
    error: "Google credential verification failed unexpectedly.",
    diagnostics: diagnostics
  };

}

function getGoogleTokenVerificationExceptionDiagnostics(err) {

  return {
    name:
      err && err.name
        ? redactGoogleCredentialFromExceptionText(err.name)
        : "Error",
    message:
      redactGoogleCredentialFromExceptionText(
        err && err.message
          ? err.message
          : err
      ),
    stack:
      redactGoogleCredentialFromExceptionText(
        err && err.stack
          ? err.stack
          : ""
      )
  };

}

function redactGoogleCredentialFromExceptionText(value) {

  return String(value === undefined || value === null ? "" : value)
    .replace(/(id_token=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]");

}

function logGoogleTokenVerificationFetchException(exception) {

  const diagnostic = {
    requestId:
      API_PIPELINE_CONTEXT && API_PIPELINE_CONTEXT.requestId
        ? API_PIPELINE_CONTEXT.requestId
        : "",
    stage: "googleTokenVerification.tokeninfoFetch",
    code: "AUTH_GOOGLE_TOKEN_VERIFICATION_EXCEPTION",
    exception: exception,
    timestamp: new Date().toISOString()
  };

  Logger.log(
    "GOOGLE_TOKEN_VERIFICATION_EXCEPTION " +
    JSON.stringify(diagnostic)
  );

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

  const forensicStart =
    enterApiForensicFunction(
      "ensureUsersSheet",
      "usersSheetLookup",
      {}
    );

  try {

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.USERS);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.USERS);

  ensureUsersColumns(sheet);

  return sheet;

  }
  catch (err) {
    recordApiForensicException(
      "ensureUsersSheet",
      "usersSheetLookup",
      forensicStart,
      err
    );
    throw err;
  }
  finally {
    exitApiForensicFunction(
      "ensureUsersSheet",
      "usersSheetLookup",
      forensicStart,
      {}
    );
  }

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
    passwordHash: headers.indexOf("Password Hash"),
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
  row[columns.passwordHash] = "";
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

const USER_PASSWORD_HASH_ALGORITHM = "pbkdf2-sha256";
const USER_PASSWORD_HASH_ITERATIONS = 20000;
const USER_PASSWORD_HASH_BYTES = 32;
const NATIVE_SESSION_PROPERTY_PREFIX = "native-session:";
const NATIVE_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const COMMISSIONER_PASSWORD_HASH_PROPERTY = "commissioner:passwordHash";

function hashUserPassword(password) {

  const value = String(password === undefined || password === null ? "" : password);

  if (value === "")
    throw new Error("Password is required.");

  const salt =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.newBlob(
        Utilities.getUuid() + Utilities.getUuid()
      ).getBytes()
    );

  const derived =
    deriveUserPasswordHash(
      value,
      salt,
      USER_PASSWORD_HASH_ITERATIONS
    );

  return [
    USER_PASSWORD_HASH_ALGORITHM,
    USER_PASSWORD_HASH_ITERATIONS,
    Utilities.base64EncodeWebSafe(salt),
    Utilities.base64EncodeWebSafe(derived)
  ].join("$");

}

function setUserPasswordByEmail(email, password) {

  const sheet = ensureUsersSheet();
  const columns = getUsersColumns(sheet);
  const rowNumber = getUserRowNumber(sheet, columns, email);

  if (rowNumber === -1)
    return false;

  const passwordHash = hashUserPassword(password);

  sheet
    .getRange(rowNumber, columns.passwordHash + 1)
    .setValue(passwordHash);

  return true;

}

function verifyUserPasswordByEmail(email, password) {

  const sheet = ensureUsersSheet();
  const columns = getUsersColumns(sheet);
  const rowNumber = getUserRowNumber(sheet, columns, email);

  if (rowNumber === -1)
    return false;

  const stored =
    getAuthString(
      sheet
        .getRange(rowNumber, columns.passwordHash + 1)
        .getValue()
    );

  return verifyUserPasswordHash(password, stored);

}

function verifyUserPasswordHash(password, storedHash) {

  const parts = getAuthString(storedHash).split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== USER_PASSWORD_HASH_ALGORITHM
  )
    return false;

  const iterations = Number(parts[1]);

  if (
    !Number.isInteger(iterations) ||
    iterations < 1
  )
    return false;

  try {
    const salt = Utilities.base64DecodeWebSafe(parts[2]);
    const expected = Utilities.base64DecodeWebSafe(parts[3]);
    const actual = deriveUserPasswordHash(password, salt, iterations);

    return constantTimeByteArraysEqual(actual, expected);
  }
  catch (err) {
    return false;
  }

}

function deriveUserPasswordHash(password, salt, iterations) {

  const passwordBytes =
    Utilities.newBlob(
      String(password === undefined || password === null ? "" : password)
    ).getBytes();
  const hmacKey = createUserPasswordHmacSha256Key(passwordBytes);
  const block = salt.concat([0, 0, 0, 1]);
  let value =
    computeUserPasswordHmacSha256(block, hmacKey);
  const result = value.slice();

  for (let iteration = 1; iteration < iterations; iteration++) {
    value = computeUserPasswordHmacSha256(value, hmacKey);

    for (let index = 0; index < USER_PASSWORD_HASH_BYTES; index++)
      result[index] = (result[index] ^ value[index]) & 255;
  }

  return result;

}

const USER_PASSWORD_SHA256_INITIAL_STATE = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];
const USER_PASSWORD_SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function createUserPasswordHmacSha256Key(key) {

  let normalizedKey = normalizeUserPasswordBytes(key);

  if (normalizedKey.length > 64)
    normalizedKey = computeUserPasswordSha256(normalizedKey);

  while (normalizedKey.length < 64)
    normalizedKey.push(0);

  const innerPad = new Array(64);
  const outerPad = new Array(64);

  for (let index = 0; index < 64; index++) {
    innerPad[index] = normalizedKey[index] ^ 0x36;
    outerPad[index] = normalizedKey[index] ^ 0x5c;
  }

  return { innerPad: innerPad, outerPad: outerPad };

}

function computeUserPasswordHmacSha256(message, key) {

  const preparedKey = key && key.innerPad && key.outerPad
    ? key
    : createUserPasswordHmacSha256Key(key);

  const innerHash =
    computeUserPasswordSha256(
      preparedKey.innerPad.concat(normalizeUserPasswordBytes(message))
    );

  return computeUserPasswordSha256(preparedKey.outerPad.concat(innerHash));

}

function computeUserPasswordSha256(input) {

  const bytes = normalizeUserPasswordBytes(input);
  const bitLength = bytes.length * 8;
  const highBitLength = Math.floor(bitLength / 0x100000000);
  const lowBitLength = bitLength >>> 0;

  bytes.push(0x80);

  while (bytes.length % 64 !== 56)
    bytes.push(0);

  for (let shift = 24; shift >= 0; shift -= 8)
    bytes.push((highBitLength >>> shift) & 255);

  for (let shift = 24; shift >= 0; shift -= 8)
    bytes.push((lowBitLength >>> shift) & 255);

  const state = USER_PASSWORD_SHA256_INITIAL_STATE.slice();
  const words = new Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const position = offset + index * 4;
      words[index] = (
        (bytes[position] << 24) |
        (bytes[position + 1] << 16) |
        (bytes[position + 2] << 8) |
        bytes[position + 3]
      ) >>> 0;
    }

    for (let index = 16; index < 64; index++) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 =
        (rotateUserPasswordWordRight(left, 7) ^
          rotateUserPasswordWordRight(left, 18) ^
          (left >>> 3)) >>> 0;
      const sigma1 =
        (rotateUserPasswordWordRight(right, 17) ^
          rotateUserPasswordWordRight(right, 19) ^
          (right >>> 10)) >>> 0;

      words[index] =
        (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];

    for (let index = 0; index < 64; index++) {
      const sum1 =
        (rotateUserPasswordWordRight(e, 6) ^
          rotateUserPasswordWordRight(e, 11) ^
          rotateUserPasswordWordRight(e, 25)) >>> 0;
      const choice = ((e & f) ^ (~e & g)) >>> 0;
      const temporary1 =
        (h + sum1 + choice + USER_PASSWORD_SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 =
        (rotateUserPasswordWordRight(a, 2) ^
          rotateUserPasswordWordRight(a, 13) ^
          rotateUserPasswordWordRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temporary2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest = [];

  state.forEach(function(word) {
    digest.push((word >>> 24) & 255);
    digest.push((word >>> 16) & 255);
    digest.push((word >>> 8) & 255);
    digest.push(word & 255);
  });

  return digest;

}

function normalizeUserPasswordBytes(bytes) {

  return Array.prototype.map.call(bytes || [], function(value) {
    return Number(value) & 255;
  });

}

function rotateUserPasswordWordRight(value, shift) {

  return ((value >>> shift) | (value << (32 - shift))) >>> 0;

}

function constantTimeByteArraysEqual(left, right) {

  const leftLength = left && left.length ? left.length : 0;
  const rightLength = right && right.length ? right.length : 0;
  const length = Math.max(leftLength, rightLength);
  let difference = leftLength ^ rightLength;

  for (let index = 0; index < length; index++)
    difference |= ((left[index % (leftLength || 1)] || 0) & 255) ^
      ((right[index % (rightLength || 1)] || 0) & 255);

  return difference === 0;

}

function createCommissionerSession(password) {

  const storedHash =
    PropertiesService.getScriptProperties().getProperty(
      COMMISSIONER_PASSWORD_HASH_PROPERTY
    );

  if (!verifyUserPasswordHash(password, storedHash))
    return null;

  return createCommissionerSessionRecord();

}

function commissionerPasswordConfigured() {

  return getAuthString(
    PropertiesService.getScriptProperties().getProperty(
      COMMISSIONER_PASSWORD_HASH_PROPERTY
    )
  ) !== "";

}

function createCommissionerSessionRecord() {

  const token = generateNativeSessionToken();
  const expiresAt = Date.now() + NATIVE_SESSION_LIFETIME_MS;
  const commissioner = buildCommissionerUser();

  PropertiesService.getScriptProperties().setProperty(
    getNativeSessionPropertyKey(token),
    JSON.stringify({
      commissioner: true,
      expiresAt: expiresAt
    })
  );

  return {
    token: token,
    expiresAt: new Date(expiresAt).toISOString(),
    user: commissioner
  };

}

function validateNativeSession(token) {

  const value = getAuthString(token);

  if (value === "")
    return null;

  const properties = PropertiesService.getScriptProperties();
  const propertyKey = getNativeSessionPropertyKey(value);
  const stored = properties.getProperty(propertyKey);

  if (!stored)
    return null;

  try {
    const record = JSON.parse(stored);
    const expiresAt = Number(record.expiresAt);

    if (
      record.commissioner !== true ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      properties.deleteProperty(propertyKey);
      return null;
    }

    return {
      expiresAt: new Date(expiresAt).toISOString(),
      user: buildCommissionerUser()
    };
  }
  catch (err) {
    properties.deleteProperty(propertyKey);
    return null;
  }

}

function destroyNativeSession(token) {

  const value = getAuthString(token);

  if (value === "")
    return false;

  const properties = PropertiesService.getScriptProperties();
  const propertyKey = getNativeSessionPropertyKey(value);
  const existed = properties.getProperty(propertyKey) !== null;

  properties.deleteProperty(propertyKey);

  return existed;

}

function destroyNativeSessionsByEmail(email) {

  const normalizedEmail =
    getAuthString(email)
      .toLowerCase();

  if (normalizedEmail === "")
    return 0;

  const properties = PropertiesService.getScriptProperties();
  const stored = properties.getProperties();
  let destroyed = 0;

  Object.keys(stored).forEach(function(key) {
    if (key.indexOf(NATIVE_SESSION_PROPERTY_PREFIX) !== 0)
      return;

    try {
      const record = JSON.parse(stored[key]);

      if (getAuthString(record.email).toLowerCase() !== normalizedEmail)
        return;

      properties.deleteProperty(key);
      destroyed++;
    }
    catch (err) {
      return;
    }
  });

  return destroyed;

}

function generateNativeSessionToken() {

  const entropy =
    Utilities.newBlob(
      Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()
    ).getBytes();

  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      entropy
    )
  );

}

function getNativeSessionPropertyKey(token) {

  return NATIVE_SESSION_PROPERTY_PREFIX +
    Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        getAuthString(token)
      )
    );

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

  const email =
    getAuthString(row[columns.email]).toLowerCase();
  const leagueIdentity =
    getAuthCanonicalPlayerIdentityByEmail(email);

  return {
    email: email,
    displayName: getAuthString(row[columns.displayName]),
    canonicalPlayer: leagueIdentity.player,
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
        ? buildLeaguePlayerAchievements(getCanonicalPlayerFromUser(user))
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
    getAuthString(getCanonicalPlayerFromUser(user));

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
    getAuthString(getCanonicalPlayerFromUser(user));

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
    getAuthString(getCanonicalPlayerFromUser(user));

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
    getAuthString(getCanonicalPlayerFromUser(user));

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
    getAuthString(getCanonicalPlayerFromUser(user));

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
    getAuthString(getCanonicalPlayerFromUser(user));

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
    getAuthString(getCanonicalPlayerFromUser(user));

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
      value: getAuthString(getCanonicalPlayerFromUser(user))
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

function buildCommissionerUser() {

  const user = buildGuestUser();

  user.displayName = "Commissioner";
  user.role = USER_ROLES.COMMISSIONER;
  user.enabled = true;

  return user;

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
