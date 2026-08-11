/*******************************************************
 * LOBO INFINITY LEAGUE
 * ArmyCodeValidationApi.gs
 *
 * Generic validation for submitted Infinity Army Codes.
 *******************************************************/

const ARMY_CODE_VALIDATION_AUDIT_HEADERS = [
  "Timestamp",
  "Player",
  "Submitter Email",
  "Event",
  "Army Name",
  "Status",
  "Points",
  "SWC",
  "Unit Count",
  "Combat Groups",
  "Warnings",
  "Override",
  "Override By",
  "Override Reason"
];

const ARMY_CODE_VALIDATION_DEFAULTS = {
  expectedPoints: 300,
  minimumPointTolerance: 5,
  maximumPointTolerance: 0,
  errorPointTolerance: 100,
  minimumUnitCount: 8,
  resolverUrl: "https://infinity.2nirwana.de/cards"
};

function validateArmyCode(e) {

  const params =
    getApiParameters(e);

  const validation =
    validateSubmittedArmyCode(
      getApiParameter(params, "armyCode"),
      getApiParameter(params, "event")
    );

  return jsonOutput({
    success: true,
    validation: validation
  });

}

function getFlaggedArmySubmissions(e) {

  const params =
    getApiParameters(e);

  const filters = {
    event: getApiParameter(params, "event"),
    player: getApiParameter(params, "player"),
    warningType: getApiParameter(params, "warningType")
  };

  const lists =
    getArmyListObjects();

  const submissions =
    lists
      .filter(function(list) {
        return list.validation && list.validation.severity !== "Info";
      })
      .filter(function(list) {
        return !filters.event || list.event === filters.event;
      })
      .filter(function(list) {
        return !filters.player || list.player === filters.player;
      })
      .filter(function(list) {
        return !filters.warningType ||
          list.validation.warnings.some(function(warning) {
            return warning.toLowerCase().indexOf(filters.warningType.toLowerCase()) !== -1;
          }) ||
          list.validation.severity.toLowerCase() === filters.warningType.toLowerCase();
      })
      .map(buildFlaggedArmySubmissionSummary);

  return jsonOutput({
    success: true,
    submissions: submissions,
    summary: buildArmyCodeValidationDashboardSummary(lists, submissions)
  });

}

function auditArmyCodeSubmissions(e) {

  const lists =
    getArmyListObjects();

  const results =
    lists
      .map(function(list) {
        const validation =
          validateSubmittedArmyCode(
            list.armyCode,
            list.event
          );

        return {
          id: list.id,
          player: list.player,
          playerDisplayName: list.playerDisplayName,
          event: list.event,
          submitted: list.submissionDate,
          armyName: validation.derived.armyName || list.armyName,
          faction: validation.derived.faction || list.faction,
          sectorial: validation.derived.sectorial || list.sectorial,
          points: validation.derived.points,
          swc: validation.derived.swc,
          unitCount: validation.derived.unitCount,
          combatGroups: validation.derived.combatGroups,
          severity: validation.severity,
          status: validation.status,
          warnings: validation.warnings,
          suspicious: validation.suspicious,
          blocking: validation.blocking,
          issues: validation.issues
        };
      })
      .filter(function(result) {
        return result.suspicious || result.blocking;
      });

  return jsonOutput({
    success: true,
    generatedAt: getArmyCodeValidationTimestamp(),
    count: results.length,
    submissions: results,
    summary: buildArmyCodeValidationDashboardSummary(lists, results)
  });

}

function validateSubmittedArmyCode(armyCode, eventId) {

  const timestamp =
    getArmyCodeValidationTimestamp();

  const thresholds =
    getArmyCodeValidationThresholds(eventId);

  const issues = [];
  const decoded =
    decodeSubmittedArmyCode(armyCode);

  if (!decoded.valid) {
    issues.push(buildArmyCodeValidationIssue(
      "Error",
      "invalid-code",
      "The Army Code could not be decoded."
    ));
  }

  decoded.warnings.forEach(function(warning) {
    issues.push(buildArmyCodeValidationIssue(
      "Warning",
      "decoder-warning",
      warning
    ));
  });

  if (decoded.valid && decoded.derived.combatGroups === 0)
    issues.push(buildArmyCodeValidationIssue(
      "Error",
      "zero-combat-groups",
      "This army contains zero combat groups."
    ));

  if (decoded.valid && decoded.derived.unitCount === 0)
    issues.push(buildArmyCodeValidationIssue(
      "Error",
      "empty-roster",
      "This army contains an empty roster."
    ));

  if (decoded.valid && !decoded.derived.faction)
    issues.push(buildArmyCodeValidationIssue(
      "Error",
      "unknown-faction",
      "Unknown faction."
    ));

  if (decoded.valid && !decoded.derived.sectorial)
    issues.push(buildArmyCodeValidationIssue(
      "Error",
      "unknown-sectorial",
      "Unknown sectorial."
    ));

  if (
    decoded.valid &&
    thresholds.minimumErrorPoints > 0 &&
    decoded.derived.points < thresholds.minimumErrorPoints
  )
    issues.push(buildArmyCodeValidationIssue(
      "Error",
      "points-below-error-floor",
      "This army contains only " +
      decoded.derived.points +
      " points; the configured error floor is " +
      thresholds.minimumErrorPoints +
      "."
    ));
  else if (
    decoded.valid &&
    thresholds.minimumWarningPoints > 0 &&
    decoded.derived.points < thresholds.minimumWarningPoints
  )
    issues.push(buildArmyCodeValidationIssue(
      "Warning",
      "points-below-warning-floor",
      "This army contains only " +
      decoded.derived.points +
      " points; the configured warning floor is " +
      thresholds.minimumWarningPoints +
      "."
    ));

  if (
    decoded.valid &&
    thresholds.maximumPoints > 0 &&
    decoded.derived.points > thresholds.maximumPoints
  )
    issues.push(buildArmyCodeValidationIssue(
      "Error",
      "points-above-maximum",
      "This army contains " +
      decoded.derived.points +
      " points; the configured maximum is " +
      thresholds.maximumPoints +
      "."
    ));

  if (
    decoded.valid &&
    thresholds.minimumUnitCount > 0 &&
    decoded.derived.unitCount < thresholds.minimumUnitCount
  )
    issues.push(buildArmyCodeValidationIssue(
      decoded.derived.unitCount === 0 ? "Error" : "Warning",
      "unit-count-below-minimum",
      "This army contains only " +
      decoded.derived.unitCount +
      " models; the configured minimum is " +
      thresholds.minimumUnitCount +
      "."
    ));

  if (decoded.valid && issues.length === 0)
    issues.push(buildArmyCodeValidationIssue(
      "Info",
      "decoded",
      "Army Code decoded successfully."
    ));

  const severity =
    getArmyCodeValidationSeverity(issues);

  const warnings =
    issues
      .filter(function(issue) {
        return issue.severity !== "Info";
      })
      .map(function(issue) {
        return issue.message;
      });

  return {
    blocking: severity === "Error",
    derived: decoded.derived,
    decoder: decoded.decoder,
    decoderVersion: decoded.decoderVersion,
    exceptions: decoded.exceptions,
    issues: issues,
    severity: severity,
    status:
      severity.toLowerCase(),
    suspicious: severity === "Error" || severity === "Warning",
    thresholds: thresholds,
    timestamp: timestamp,
    valid: decoded.valid && severity !== "Error",
    warnings: warnings
  };

}

function buildArmyCodeValidationIssue(severity, code, message) {

  return {
    code: code,
    message: message,
    severity: severity
  };

}

function getArmyCodeValidationSeverity(issues) {

  if (issues.some(function(issue) { return issue.severity === "Error"; }))
    return "Error";

  if (issues.some(function(issue) { return issue.severity === "Warning"; }))
    return "Warning";

  return "Info";

}

function decodeSubmittedArmyCode(value) {

  return CanonicalDecoderGateway.decode(value);

}

function getArmyCodeValidationThresholds(eventId) {

  const normalizedEvent =
    getArmyCodeValidationString(eventId);

  const defaults = {
    event: normalizedEvent,
    expectedPoints: ARMY_CODE_VALIDATION_DEFAULTS.expectedPoints,
    maximumPointTolerance: ARMY_CODE_VALIDATION_DEFAULTS.maximumPointTolerance,
    maximumPoints:
      ARMY_CODE_VALIDATION_DEFAULTS.expectedPoints +
      ARMY_CODE_VALIDATION_DEFAULTS.maximumPointTolerance,
    minimumErrorPoints:
      ARMY_CODE_VALIDATION_DEFAULTS.expectedPoints -
      ARMY_CODE_VALIDATION_DEFAULTS.errorPointTolerance,
    minimumPointTolerance: ARMY_CODE_VALIDATION_DEFAULTS.minimumPointTolerance,
    minimumWarningPoints:
      ARMY_CODE_VALIDATION_DEFAULTS.expectedPoints -
      ARMY_CODE_VALIDATION_DEFAULTS.minimumPointTolerance,
    minimumUnitCount: ARMY_CODE_VALIDATION_DEFAULTS.minimumUnitCount,
    source: "defaults"
  };

  const fromProperties =
    getArmyCodeValidationThresholdsFromProperties(normalizedEvent);

  if (fromProperties)
    return fromProperties;

  const fromSettings =
    getArmyCodeValidationThresholdsFromSettings(normalizedEvent);

  return fromSettings || defaults;

}

function getArmyCodeValidationThresholdsFromProperties(eventId) {

  if (typeof PropertiesService === "undefined")
    return null;

  const properties =
    PropertiesService.getScriptProperties();

  const prefix =
    eventId
      ? "armyCodeValidation." + eventId + "."
      : "armyCodeValidation.default.";

  const expectedPoints =
    Number(properties.getProperty(prefix + "expectedPoints") || "");

  const minimumPointTolerance =
    Number(properties.getProperty(prefix + "minimumPointTolerance") || "");

  const maximumPointTolerance =
    Number(properties.getProperty(prefix + "maximumPointTolerance") || "");

  const errorPointTolerance =
    Number(properties.getProperty(prefix + "errorPointTolerance") || "");

  const minimumUnitCount =
    Number(properties.getProperty(prefix + "minimumUnitCount") || "");

  if (!expectedPoints && !minimumPointTolerance && !maximumPointTolerance && !errorPointTolerance && !minimumUnitCount)
    return null;

  return buildArmyCodeValidationThresholds({
    event: eventId,
    expectedPoints: expectedPoints || ARMY_CODE_VALIDATION_DEFAULTS.expectedPoints,
    minimumPointTolerance: minimumPointTolerance || ARMY_CODE_VALIDATION_DEFAULTS.minimumPointTolerance,
    maximumPointTolerance: maximumPointTolerance || ARMY_CODE_VALIDATION_DEFAULTS.maximumPointTolerance,
    errorPointTolerance: errorPointTolerance || ARMY_CODE_VALIDATION_DEFAULTS.errorPointTolerance,
    minimumUnitCount: minimumUnitCount || ARMY_CODE_VALIDATION_DEFAULTS.minimumUnitCount,
    source: "scriptProperties"
  });

}

function getArmyCodeValidationThresholdsFromSettings(eventId) {

  try {
    const sheet =
      lifGetTargetSpreadsheet_()
        .getSheetByName(CONFIG.SHEETS.SETTINGS);

    if (!sheet)
      return null;

    const rows =
      sheet
        .getDataRange()
        .getValues();

    for (let index = 1; index < rows.length; index++) {
      const key =
        getArmyCodeValidationString(rows[index][0]);

      if (
        key === "armyCodeValidation." + eventId ||
        (!eventId && key === "armyCodeValidation.default")
      ) {
        return buildArmyCodeValidationThresholds({
          event: eventId,
          expectedPoints: Number(rows[index][1]) || ARMY_CODE_VALIDATION_DEFAULTS.expectedPoints,
          minimumPointTolerance: Number(rows[index][2]) || ARMY_CODE_VALIDATION_DEFAULTS.minimumPointTolerance,
          maximumPointTolerance: Number(rows[index][3]) || ARMY_CODE_VALIDATION_DEFAULTS.maximumPointTolerance,
          errorPointTolerance: Number(rows[index][4]) || ARMY_CODE_VALIDATION_DEFAULTS.errorPointTolerance,
          minimumUnitCount: Number(rows[index][5]) || ARMY_CODE_VALIDATION_DEFAULTS.minimumUnitCount,
          source: "settings"
        });
      }
    }
  }
  catch (err) {
    return null;
  }

  return null;

}

function buildArmyCodeValidationThresholds(values) {

  return {
    event: values.event || "",
    expectedPoints: Number(values.expectedPoints) || 0,
    maximumPointTolerance: Number(values.maximumPointTolerance) || 0,
    maximumPoints:
      (Number(values.expectedPoints) || 0) +
      (Number(values.maximumPointTolerance) || 0),
    minimumErrorPoints:
      Math.max(
        0,
        (Number(values.expectedPoints) || 0) -
        (Number(values.errorPointTolerance) || 0)
      ),
    minimumPointTolerance: Number(values.minimumPointTolerance) || 0,
    minimumWarningPoints:
      Math.max(
        0,
        (Number(values.expectedPoints) || 0) -
        (Number(values.minimumPointTolerance) || 0)
      ),
    minimumUnitCount: Number(values.minimumUnitCount) || 0,
    source: values.source || "defaults"
  };

}

function recordArmyCodeValidationAudit(source, validation, override) {

  const sheet =
    getArmyCodeValidationAuditSheet();

  sheet.appendRow([
    validation.timestamp,
    source.player,
    source.submitterEmail,
    source.event,
    source.armyName,
    validation.status,
    validation.derived.points,
    validation.derived.swc,
    validation.derived.unitCount,
    validation.derived.combatGroups,
    validation.warnings.join("\n"),
    override.override ? "TRUE" : "FALSE",
    override.overrideBy || "",
    override.overrideReason || ""
  ]);

}

function getArmyCodeValidationAuditSheet() {

  const spreadsheet =
    lifGetTargetSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.ARMY_CODE_VALIDATION_AUDIT);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.ARMY_CODE_VALIDATION_AUDIT);

  const range =
    sheet.getRange(1, 1, 1, ARMY_CODE_VALIDATION_AUDIT_HEADERS.length);

  const headers =
    range.getValues()[0];

  const matches =
    ARMY_CODE_VALIDATION_AUDIT_HEADERS.every(function(header, index) {
      return headers[index] === header;
    });

  if (!matches)
    range.setValues([ARMY_CODE_VALIDATION_AUDIT_HEADERS]);

  return sheet;

}

function buildFlaggedArmySubmissionSummary(list) {

  return {
    armyIntelligenceLink:
      "/army-lists?diagnose=" + encodeURIComponent(String(list.id)),
    armyName: list.armyName,
    event: list.event,
    id: list.id,
    player: list.player,
    playerDisplayName: list.playerDisplayName,
    points: list.validation.points,
    submitted: list.submissionDate,
    swc: list.validation.swc,
    unitCount: list.validation.unitCount,
    validationStatus: list.validation.status,
    validationWarnings: list.validation.warnings
  };

}

function buildArmyCodeValidationDashboardSummary(allLists, submissions) {

  const events = {};
  const players = {};
  const warningTypes = {};
  const counts = {
    errors: 0,
    healthy: 0,
    info: 0,
    total: allLists.length,
    warnings: 0
  };

  allLists.forEach(function(list) {
    const severity =
      list.validation && list.validation.severity
        ? list.validation.severity
        : "Info";

    if (severity === "Error")
      counts.errors++;
    else if (severity === "Warning")
      counts.warnings++;
    else {
      counts.info++;
      counts.healthy++;
    }
  });

  submissions.forEach(function(submission) {
    if (submission.event)
      events[submission.event] = true;

    if (submission.player)
      players[submission.player] = true;

    (submission.validationWarnings || submission.warnings || []).forEach(function(warning) {
      warningTypes[warning] = true;
    });
  });

  return {
    counts: counts,
    events: Object.keys(events).sort(),
    players: Object.keys(players).sort(),
    warningTypes: Object.keys(warningTypes).sort()
  };

}

function getArmyCodeValidationString(value) {

  if (value === null || value === undefined)
    return "";

  return String(value).trim();

}

function getArmyListBooleanParameter(parameters, key) {

  const value =
    getApiParameter(parameters, key)
      .toLowerCase();

  return (
    value === "true" ||
    value === "yes" ||
    value === "1"
  );

}
