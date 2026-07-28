/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * ArmyListApi.gs
 *
 * Community army list vault and faction matchup APIs.
 *******************************************************/

const ARMY_LIST_HEADERS = [
  "Submission Date",
  "Player",
  "Faction",
  "Sectorial",
  "Mission",
  "Tournament/Event",
  "Infinity Army Code",
  "Infinity Army Link",
  "Army Name",
  "Description",
  "Upvotes",
  "Downvotes",
  "Approved",
  "Submitter Email",
  "Validation Status",
  "Validation Warnings",
  "Validation Points",
  "Validation SWC",
  "Validation Unit Count",
  "Validation Combat Groups",
  "Validation Army Name",
  "Validation Faction",
  "Validation Sectorial",
  "Validation Override",
  "Validation Override By",
  "Validation Override Reason",
  "Validation Timestamp"
];

const ARMY_LIST_COLUMNS = {
  SUBMISSION_DATE: 0,
  PLAYER: 1,
  FACTION: 2,
  SECTORIAL: 3,
  MISSION: 4,
  EVENT: 5,
  ARMY_CODE: 6,
  ARMY_LINK: 7,
  ARMY_NAME: 8,
  DESCRIPTION: 9,
  UPVOTES: 10,
  DOWNVOTES: 11,
  APPROVED: 12,
  SUBMITTER_EMAIL: 13,
  VALIDATION_STATUS: 14,
  VALIDATION_WARNINGS: 15,
  VALIDATION_POINTS: 16,
  VALIDATION_SWC: 17,
  VALIDATION_UNIT_COUNT: 18,
  VALIDATION_COMBAT_GROUPS: 19,
  VALIDATION_ARMY_NAME: 20,
  VALIDATION_FACTION: 21,
  VALIDATION_SECTORIAL: 22,
  VALIDATION_OVERRIDE: 23,
  VALIDATION_OVERRIDE_BY: 24,
  VALIDATION_OVERRIDE_REASON: 25,
  VALIDATION_TIMESTAMP: 26
};

function getArmyLists() {

  const lists =
    getArmyListObjects()
      .filter(function(list) {

        return list.approved;

      });

  return jsonOutput({
    success: true,
    lists: lists,
    community: buildArmyListCommunitySummary(lists)
  });

}

function submitArmyList(e) {

  const parameters =
    getApiParameters(e);

  const auth =
    getRequestUser(e);

  const player =
    getApiParameter(parameters, "player") ||
    (
      auth.authenticated
        ? getCanonicalPlayerFromUser(auth.user)
        : ""
    );

  if (
    !player ||
    !getApiParameter(parameters, "armyCode")
  )
    return jsonOutput({
      success: false,
      error: "Player and Army Code are required."
    });

  const sheet =
    getArmyListSheet();

  const submissionDate =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  const armyCode =
    getApiParameter(parameters, "armyCode");

  const validation =
    validateSubmittedArmyCode(
      armyCode,
      getApiParameter(parameters, "event")
    );

  const overrideRequested =
    getArmyListBooleanParameter(
      parameters,
      "validationOverride"
    ) ||
    getArmyListBooleanParameter(
      parameters,
      "commissionerOverride"
    );

  const canOverride =
    auth.authenticated &&
    typeof userHasPermission === "function" &&
    userHasPermission(auth.user.role, "viewOperations");

  if (validation.suspicious && !(overrideRequested && canOverride)) {
    return jsonOutput({
      success: false,
      error:
        validation.blocking
          ? "Army Code validation failed. Verify or regenerate the Army Code."
          : "The submitted Army Code appears incomplete. Commissioner confirmation is required.",
      validation: validation,
      requiresOverride:
        validation.suspicious &&
        !validation.blocking &&
        canOverride
    });
  }

  sheet.appendRow([
    submissionDate,
    player,
    validation.derived.faction,
    validation.derived.sectorial,
    getApiParameter(parameters, "mission"),
    getApiParameter(parameters, "event"),
    armyCode,
    getApiParameter(parameters, "armyLink"),
    validation.derived.armyName,
    getApiParameter(parameters, "description"),
    0,
    0,
    false,
    auth.authenticated
      ? auth.user.email
      : getApiParameter(parameters, "submitterEmail"),
    validation.status,
    validation.warnings.join("\n"),
    validation.derived.points,
    validation.derived.swc,
    validation.derived.unitCount,
    validation.derived.combatGroups,
    validation.derived.armyName,
    validation.derived.faction,
    validation.derived.sectorial,
    overrideRequested && canOverride ? "TRUE" : "FALSE",
    overrideRequested && canOverride
      ? auth.user.email || getCanonicalPlayerFromUser(auth.user)
      : "",
    overrideRequested && canOverride
      ? getApiParameter(parameters, "validationOverrideReason") ||
        getApiParameter(parameters, "commissionerReason")
      : "",
    validation.timestamp
  ]);

  recordArmyCodeValidationAudit(
    {
      armyName: validation.derived.armyName,
      event: getApiParameter(parameters, "event"),
      player: player,
      submitterEmail:
        auth.authenticated
          ? auth.user.email
          : getApiParameter(parameters, "submitterEmail")
    },
    validation,
    {
      override: overrideRequested && canOverride,
      overrideBy:
        overrideRequested && canOverride
          ? auth.user.email || getCanonicalPlayerFromUser(auth.user)
          : "",
      overrideReason:
        overrideRequested && canOverride
          ? getApiParameter(parameters, "validationOverrideReason") ||
            getApiParameter(parameters, "commissionerReason")
          : ""
    }
  );

  invalidatePortalCacheGroup("armyLists");

  if (typeof evaluateAchievementsForPlayer === "function")
    evaluateAchievementsForPlayer(player);

  if (typeof publishLeagueAutomationEvent === "function") {
    const listId =
      sheet.getLastRow() - 1;

    publishLeagueAutomationEvent({
      eventType: "armyListSubmitted",
      category: "Army Lists",
      priority: "normal",
      player: player,
      division: "",
      message:
        player +
        " submitted an army list: " +
        validation.derived.armyName,
      payload: {
        listId: listId,
        id: listId,
        player: player,
        faction: validation.derived.faction,
        sectorial: validation.derived.sectorial,
        armyName: validation.derived.armyName,
        mission: getApiParameter(parameters, "mission"),
        event: getApiParameter(parameters, "event"),
        submittedAt: submissionDate
      }
    });
  }

  return jsonOutput({
    success: true,
    validation: validation
  });

}

function voteArmyList(e) {

  const parameters =
    getApiParameters(e);

  const id =
    Number(
      getApiParameter(
        parameters,
        "id"
      )
    );

  const vote =
    getApiParameter(
      parameters,
      "vote"
    );

  if (
    !id ||
    (
      vote !== "up" &&
      vote !== "down"
    )
  )
    return jsonOutput({
      success: false,
      error: "A valid list id and vote are required."
    });

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

  const column =
    vote === "up"
      ? ARMY_LIST_COLUMNS.UPVOTES + 1
      : ARMY_LIST_COLUMNS.DOWNVOTES + 1;

  const currentValue =
    Number(
      sheet
        .getRange(
          rowNumber,
          column
        )
        .getValue()
    ) || 0;

  sheet
    .getRange(
      rowNumber,
      column
    )
    .setValue(
      currentValue + 1
    );

  if (typeof incrementUserVotesCast === "function")
    incrementUserVotesCast(e);

  invalidatePortalCacheGroup("armyLists");

  return jsonOutput({
    success: true
  });

}

function diagnoseArmyList(e) {

  const params =
    getApiParameters(e);

  const id =
    Number(
      getApiParameter(
        params,
        "id"
      )
    ) || 0;

  const displayedUnits =
    parseArmyDiagnosticDisplayedUnits(
      getApiParameter(
        params,
        "displayedUnits"
      )
    );

  const source =
    getArmyDiagnosticSourceSubmission(id);

  if (!source.found)
    return jsonOutput({
      success: false,
      error: "Army list not found.",
      report: buildMissingArmyDiagnosticReport(id)
    });

  const decoded =
    buildArmyDiagnosticDecode(
      decodeArmyCode(source.list.armyCode)
    );

  const validation =
    validateStoredArmyCodeForDiagnostics(
      source.list.armyCode,
      decoded.sharedDecode
    );

  const currentSnapshot =
    buildArmyDiagnosticSnapshot(
      source.list,
      decoded
    );

  const comparison =
    compareArmyDiagnosticDecodeToDisplay(
      decoded,
      currentSnapshot,
      displayedUnits
    );

  const cache =
    getArmyDiagnosticCacheStatus(
      e,
      source.list,
      currentSnapshot
    );

  const pipeline =
    buildArmyDiagnosticPipelineTrace(
      source,
      validation,
      decoded,
      currentSnapshot,
      cache
    );

  const selfHealing =
    runArmyDiagnosticSelfHealing(
      source,
      validation,
      decoded,
      currentSnapshot,
      displayedUnits
    );

  const report =
    buildArmyDiagnosticReport(
      source,
      validation,
      decoded,
      currentSnapshot,
      comparison,
      cache,
      pipeline,
      selfHealing
    );

  return jsonOutput({
    success: true,
    report: report
  });

}

function getArmyDiagnosticSourceSubmission(id) {

  const lists =
    getArmyListObjects();

  const list =
    lists.filter(function(candidate) {
      return candidate.id === id;
    })[0] || null;

  return {
    found: Boolean(list),
    list: list,
    rowNumber: id + 1
  };

}

function validateStoredArmyCodeForDiagnostics(value, decoded) {

  const raw =
    value === null || value === undefined
      ? ""
      : String(value);

  const trimmed =
    raw.trim();

  const compact =
    trimmed.replace(/\s+/g, "");

  const encoding =
    decoded.validation || {};

  const flags = {
    empty: trimmed.length === 0,
    truncated: compact.length > 0 && compact.length < 24,
    invalidCharacters: /[^A-Za-z0-9+/_=:\-.?&%#]/.test(trimmed),
    whitespaceCorruption: raw !== trimmed || /\s{2,}|\r|\n|\t/.test(raw),
    clipboardTruncation: /\u2026|\.{3}$/.test(trimmed),
    duplicateEncoding: hasRepeatedArmyCodeEncoding(compact),
    missingFooter: false,
    beginsWithInfinityArmyPrefix: hasInfinityArmyCodePrefix(trimmed),
    validEncoding: false,
    completeLength: false
  };

  const extracted =
    decoded.extractedCode || extractArmyCodePayload(trimmed);

  flags.validEncoding =
    encoding.valid;

  flags.completeLength =
    !flags.empty &&
    !flags.truncated &&
    !flags.clipboardTruncation &&
    flags.validEncoding;

  flags.missingFooter =
    encoding.looksLikeJsonStart && !encoding.looksLikeJsonEnd;

  const issues = [];

  if (flags.empty)
    issues.push("Stored Army Code is empty.");

  if (!flags.beginsWithInfinityArmyPrefix)
    issues.push("Stored value does not include a recognized Infinity Army URL prefix.");

  if (flags.truncated)
    issues.push("Stored Army Code is shorter than the diagnostic minimum length of 24 characters.");

  if (flags.invalidCharacters)
    issues.push("Stored Army Code contains characters outside URL/base64-safe ranges.");

  if (flags.whitespaceCorruption)
    issues.push("Stored Army Code has leading, trailing, or embedded whitespace.");

  if (flags.clipboardTruncation)
    issues.push("Stored Army Code appears to contain ellipsis truncation.");

  if (flags.duplicateEncoding)
    issues.push("Stored Army Code appears to contain the same encoded payload twice.");

  if (!flags.validEncoding && encoding.reason)
    issues.push(encoding.reason);

  if (flags.missingFooter)
    issues.push("Decoded payload appears to start as JSON but does not end as complete JSON.");

  return {
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    compactLength: compact.length,
    extractedCode: extracted,
    extractedLength: extracted.length,
    flags: flags,
    encoding: encoding,
    valid:
      issues.length === 0 ||
      (
        issues.length === 1 &&
        issues[0].indexOf("recognized Infinity Army URL prefix") !== -1 &&
        flags.validEncoding &&
        flags.completeLength
      ),
    issues: issues
  };

}

function buildArmyDiagnosticDecode(sharedDecode) {

  const profiles =
    sharedDecode.roster.map(function(profile, index) {
      return {
        combatGroup: profile.combatGroup || 1,
        decodedProfile: profile.decodedProfile,
        index: index + 1,
        points: profile.points,
        rawProfile: profile.rawProfile,
        swc: profile.swc
      };
    });

  return {
    combatGroups: buildArmyDiagnosticCombatGroups(profiles),
    decoderVersion: sharedDecode.decoderVersion,
    parserFailure: sharedDecode.parserFailure,
    parserTrace: sharedDecode.parserTrace,
    points: sharedDecode.points,
    profiles: profiles,
    sharedDecode: sharedDecode,
    success: sharedDecode.valid,
    swc: sharedDecode.swc,
    trace:
      profiles.map(function(profile) {
        return {
          decodedProfile: profile.decodedProfile,
          parserState: "shared-decoder.roster",
          points: profile.points,
          rawProfile: profile.rawProfile,
          swc: profile.swc,
          unitNumber: profile.index
        };
      }),
    unitCount: sharedDecode.unitCount,
    warnings: sharedDecode.parserWarnings
  };

}

function buildArmyDiagnosticCombatGroups(profiles) {

  const groups = {};

  profiles.forEach(function(profile) {
    const group =
      String(profile.combatGroup || 1);

    if (!groups[group])
      groups[group] = 0;

    groups[group]++;
  });

  return Object.keys(groups)
    .sort()
    .map(function(group) {
      return {
        group: Number(group),
        units: groups[group]
      };
    });

}

function buildArmyDiagnosticSnapshot(list, decoded) {

  return {
    decoderVersion: decoded.decoderVersion,
    id: "army-list-" + list.id,
    timestamp: new Date().toISOString(),
    generated: true,
    source: "Army Lists sheet",
    units: decoded.profiles,
    unitCount: decoded.unitCount,
    points: decoded.points,
    swc: decoded.swc
  };

}

function compareArmyDiagnosticDecodeToDisplay(decoded, snapshot, displayedUnits) {

  const expectedNames =
    decoded.profiles.map(function(profile) {
      return profile.decodedProfile;
    });

  const displayedNames =
    displayedUnits.length > 0
      ? displayedUnits
      : snapshot.units.map(function(profile) {
          return profile.decodedProfile;
        });

  return {
    expectedUnits: expectedNames,
    displayedUnits: displayedNames,
    missingUnits: subtractArmyDiagnosticNames(expectedNames, displayedNames),
    unexpectedUnits: subtractArmyDiagnosticNames(displayedNames, expectedNames),
    missingPoints:
      decoded.points - snapshot.points,
    missingSwc:
      decoded.swc - snapshot.swc,
    displayedPoints: snapshot.points,
    displayedSwc: snapshot.swc,
    displayedUnitCount: displayedNames.length
  };

}

function subtractArmyDiagnosticNames(left, right) {

  const remaining =
    right.slice();

  return left.filter(function(item) {
    const index =
      remaining.indexOf(item);

    if (index === -1)
      return true;

    remaining.splice(index, 1);
    return false;
  });

}

function parseArmyDiagnosticDisplayedUnits(value) {

  if (!value)
    return [];

  try {
    const parsed =
      JSON.parse(value);

    if (Array.isArray(parsed))
      return parsed.map(function(item) {
        return String(item || "").trim();
      }).filter(Boolean);
  }
  catch (err) {
    return String(value).split("|").map(function(item) {
      return item.trim();
    }).filter(Boolean);
  }

  return [];

}

function getArmyDiagnosticCacheStatus(e, list, snapshot) {

  const cacheKey =
    typeof getPortalCacheKey === "function"
      ? getPortalCacheKey(
          {
            parameter: {
              action: "armyLists"
            }
          },
          "armyLists"
        )
      : "";

  const status =
    typeof getPortalCacheStatus === "function"
      ? getPortalCacheStatus()
      : {
          entries: []
        };

  const entry =
    (status.entries || []).filter(function(candidate) {
      return candidate.action === "armyLists";
    })[0] || null;

  return {
    key: cacheKey,
    status: entry ? entry.status : "cold",
    health: entry ? entry.health : "Cold",
    ageSeconds: entry ? entry.ageSeconds : 0,
    served: Boolean(entry),
    snapshotHash: getArmyDiagnosticSnapshotHash(snapshot),
    classification: entry
      ? entry.status === "fresh" ? "Fresh" : "Stale"
      : "Fresh"
  };

}

function getArmyDiagnosticSnapshotHash(snapshot) {

  const text =
    JSON.stringify({
      unitCount: snapshot.unitCount,
      points: snapshot.points,
      swc: snapshot.swc,
      units: snapshot.units.map(function(unit) {
        return unit.decodedProfile;
      })
    });

  let hash = 5381;

  for (let index = 0; index < text.length; index++)
    hash = (hash * 33) ^ text.charCodeAt(index);

  return (hash >>> 0).toString(36);

}

function buildArmyDiagnosticPipelineTrace(source, validation, decoded, snapshot, cache) {

  return [
    {
      stage: "Army Submission",
      received: source.found,
      generated: false,
      stored: true,
      cached: false,
      served: false
    },
    {
      stage: "Decode",
      received: validation.valid,
      generated: decoded.success,
      stored: false,
      cached: false,
      served: false
    },
    {
      stage: "Snapshot Builder",
      received: decoded.success,
      generated: snapshot.generated,
      stored: false,
      cached: false,
      served: false
    },
    {
      stage: "Cache",
      received: snapshot.generated,
      generated: false,
      stored: cache.served,
      cached: cache.served,
      served: cache.served
    },
    {
      stage: "Frontend API",
      received: true,
      generated: true,
      stored: false,
      cached: cache.served,
      served: true
    },
    {
      stage: "Army Intelligence page",
      received: true,
      generated: true,
      stored: false,
      cached: false,
      served: true
    }
  ];

}

function runArmyDiagnosticSelfHealing(source, validation, decoded, snapshot, displayedUnits) {

  const needsRebuild =
    validation.valid &&
    decoded.success &&
    displayedUnits.length > 0 &&
    displayedUnits.length !== decoded.unitCount;

  if (!needsRebuild)
    return {
      attempted: false,
      actions: [],
      result: "No self-healing needed."
    };

  if (typeof invalidatePortalCacheGroup === "function")
    invalidatePortalCacheGroup("armyLists");

  return {
    attempted: true,
    actions: [
      "Deleted generated diagnostic snapshot.",
      "Rebuilt snapshot from stored Army Code.",
      "Invalidated armyLists cache group."
    ],
    result: "Snapshot regenerated from valid Army Code."
  };

}

function buildArmyDiagnosticReport(source, validation, decoded, snapshot, comparison, cache, pipeline, selfHealing) {

  const list =
    source.list;

  const rootCause =
    getArmyDiagnosticRootCause(
      validation,
      decoded,
      comparison,
      cache
    );

  return {
    player: list.player,
    playerDisplayName: list.playerDisplayName,
    playerEmail: list.submitterEmail,
    event: list.event,
    submitted: list.submissionDate,
    army: list.validation.armyName || list.armyName,
    faction: list.validation.faction || list.faction,
    sectorial: list.validation.sectorial || list.sectorial,
    originalArmyCodeLength: validation.rawLength,
    decoderVersion: decoded.decoderVersion,
    snapshotId: snapshot.id,
    snapshotTimestamp: snapshot.timestamp,
    expectedPoints: decoded.points,
    decodedPoints: decoded.points,
    displayedPoints: comparison.displayedPoints,
    expectedUnitCount: decoded.unitCount,
    displayedUnitCount: comparison.displayedUnitCount,
    rootCause: rootCause,
    confidence: rootCause === "No discrepancy detected." ? "High" : "Medium",
    validation: validation,
    decode: decoded,
    comparison: comparison,
    cache: cache,
    pipeline: pipeline,
    selfHealing: selfHealing,
    recommendation:
      decoded.parserFailure
        ? "Fix the stored Army Code or add support for the offending decoded payload format."
        : comparison.missingUnits.length > 0
          ? "Rebuild snapshot and clear only the armyLists cache entry."
          : "No action required."
  };

}

function getArmyDiagnosticRootCause(validation, decoded, comparison, cache) {

  if (!validation.valid)
    return validation.issues.join(" ");

  if (!decoded.success)
    return decoded.parserFailure
      ? decoded.parserFailure.reason + ": " + decoded.parserFailure.token
      : "Decoder failed.";

  if (comparison.missingUnits.length > 0)
    return "Displayed army omitted decoded units.";

  if (comparison.unexpectedUnits.length > 0)
    return "Displayed army contains units not produced by decoder.";

  if (cache.classification === "Stale")
    return "Stale armyLists cache entry was served.";

  return "No discrepancy detected.";

}

function buildMissingArmyDiagnosticReport(id) {

  return {
    requestedId: id,
    rootCause: "No submitted Army List record matched the displayed army id.",
    confidence: "High"
  };

}

function getPlayerArmyLists(playerName) {

  const normalizedPlayer =
    String(playerName || "")
      .trim()
      .toLowerCase();

  if (!normalizedPlayer)
    return {
      lists: [],
      summary: buildPlayerArmyListSummary([])
    };

  const lists =
    getArmyListObjects()
      .filter(function(list) {

        return (
          list.approved &&
          list.player.toLowerCase() === normalizedPlayer
        );

      });

  return {
    lists: lists,
    summary:
      buildPlayerArmyListSummary(
        lists
      )
  };

}

function getFactionArmyLists(factionName) {

  const normalizedFaction =
    canonicalizeArmyName(factionName);

  if (!normalizedFaction)
    return {
      mostPopular: [],
      highestRated: [],
      newest: []
    };

  const lists =
    getArmyListObjects()
      .filter(function(list) {

        return (
          list.approved &&
          list.faction.toLowerCase() === normalizedFaction
        );

      });

  return {
    mostPopular:
      sortArmyListsByScore(
        lists
      ).slice(0, 5),
    highestRated:
      sortArmyListsByRating(
        lists
      ).slice(0, 5),
    newest:
      sortArmyListsByNewest(
        lists
      ).slice(0, 5)
  };

}

function getFactionMatchups(factionName) {

  const normalizedFaction =
    String(factionName || "")
      .trim()
      .toLowerCase();

  const matchups = {};

  getAllRecentGameObjects()
    .forEach(function(game) {

      const winnerFaction =
        canonicalizeArmyName(game.winnerFaction);

      const loserFaction =
        canonicalizeArmyName(game.loserFaction);

      const winnerMatches =
        winnerFaction === normalizedFaction;

      const loserMatches =
        loserFaction === normalizedFaction;

      if (
        !winnerMatches &&
        !loserMatches
      )
        return;

      const opponent =
        winnerMatches
          ? loserFaction
          : winnerFaction;

      if (!opponent)
        return;

      if (!matchups[opponent])
        matchups[opponent] = {
          opponent: opponent,
          games: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          tp: 0,
          op: 0,
          vp: 0
        };

      const matchup =
        matchups[opponent];

      matchup.games++;

      if (isFactionMatchupDraw(game))
        matchup.draws++;
      else if (winnerMatches)
        matchup.wins++;
      else
        matchup.losses++;

      matchup.tp +=
        getFactionMatchupScore(
          game.tp,
          winnerMatches
        );

      matchup.op +=
        getFactionMatchupScore(
          game.op,
          winnerMatches
        );

      matchup.vp +=
        getFactionMatchupScore(
          game.vp,
          winnerMatches
        );

    });

  const rows =
    Object.keys(matchups)
      .map(function(key) {

        const matchup =
          matchups[key];

        return {
          opponent: matchup.opponent,
          games: matchup.games,
          wins: matchup.wins,
          losses: matchup.losses,
          draws: matchup.draws,
          winRate:
            matchup.games === 0
              ? 0
              : roundArmyListNumber(
                  (matchup.wins / matchup.games) * 100
                ),
          averageTP:
            getArmyListAverage(
              matchup.tp,
              matchup.games
            ),
          averageOP:
            getArmyListAverage(
              matchup.op,
              matchup.games
            ),
          averageVP:
            getArmyListAverage(
              matchup.vp,
              matchup.games
            )
        };

      })
      .sort(function(a, b) {

        return (
          b.games - a.games ||
          b.winRate - a.winRate ||
          a.opponent.localeCompare(b.opponent)
        );

      });

  return {
    overall:
      buildFactionMatchupOverall(
        rows
      ),
    rows: rows
  };

}

function buildFactionMatchupOverall(rows) {

  const summary =
    rows.reduce(function(total, row) {

      total.opponents++;
      total.games += row.games;
      total.wins += row.wins;
      total.losses += row.losses;
      total.draws += row.draws;

      if (
        !total.best ||
        row.winRate > total.best.winRate
      )
        total.best = row;

      return total;

    }, {
      opponents: 0,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      best: null
    });

  return {
    opponents: summary.opponents,
    games: summary.games,
    wins: summary.wins,
    losses: summary.losses,
    draws: summary.draws,
    winRate:
      summary.games === 0
        ? 0
        : roundArmyListNumber(
            (summary.wins / summary.games) * 100
          ),
    bestOpponent:
      summary.best
        ? summary.best.opponent
        : ""
  };

}

function isFactionMatchupDraw(game) {

  const explicitResult =
    String(game.gameResult || "")
      .trim()
      .toLowerCase();

  if (explicitResult === "draw")
    return true;

  return (
    isFactionMatchupScoreDraw(game.tp) &&
    isFactionMatchupScoreDraw(game.op) &&
    isFactionMatchupScoreDraw(game.vp)
  );

}

function isFactionMatchupScoreDraw(value) {

  const parts =
    String(value || "")
      .split("-");

  if (parts.length !== 2)
    return false;

  const left =
    Number(parts[0]);

  const right =
    Number(parts[1]);

  return Number.isFinite(left) && Number.isFinite(right) && left === right;

}

function getArmyListObjects() {

  const sheet =
    getArmyListSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return [];

  values.shift();

  return values
    .map(function(row, index) {

      return buildArmyListObject(
        row,
        index + 1
      );

    })
    .filter(function(list) {

      return (
        list.player !== "" &&
        list.faction !== "" &&
        list.armyName !== ""
      );

    });

}

function buildArmyListObject(row, id) {

  // `row` is an Army Lists sheet row indexed by ARMY_LIST_COLUMNS.
  const upvotes =
    Number(
      row[ARMY_LIST_COLUMNS.UPVOTES]
    ) || 0;

  const downvotes =
    Number(
      row[ARMY_LIST_COLUMNS.DOWNVOTES]
    ) || 0;

  return {
    id: id,
    submissionDate:
      formatArmyListDate(
        row[ARMY_LIST_COLUMNS.SUBMISSION_DATE]
      ),
    player:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.PLAYER]
      ),
    playerDisplayName:
      getPlayerDisplayName(
        row[ARMY_LIST_COLUMNS.PLAYER]
      ),
    faction:
      canonicalizeArmyParentFaction(
        row[ARMY_LIST_COLUMNS.FACTION]
      ),
    sectorial:
      canonicalizeArmyName(
        row[ARMY_LIST_COLUMNS.SECTORIAL]
      ),
    mission:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.MISSION]
      ),
    event:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.EVENT]
      ),
    armyCode:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.ARMY_CODE]
      ),
    armyLink:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.ARMY_LINK]
      ),
    armyName:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.ARMY_NAME]
      ),
    description:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.DESCRIPTION]
      ),
    upvotes: upvotes,
    downvotes: downvotes,
    score:
      upvotes - downvotes,
    approved:
      getArmyListApproved(
        row[ARMY_LIST_COLUMNS.APPROVED]
      ),
    submitterEmail:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.SUBMITTER_EMAIL]
      ),
    validation:
      buildArmyListValidationSummary(row)
  };

}

function buildArmyListValidationSummary(row) {

  const warnings =
    getArmyListString(
      row[ARMY_LIST_COLUMNS.VALIDATION_WARNINGS]
    )
      .split(/\r?\n/)
      .map(function(warning) {
        return warning.trim();
      })
      .filter(Boolean);

  return {
    severity:
      getArmyListValidationSeverity(
        getArmyListString(
          row[ARMY_LIST_COLUMNS.VALIDATION_STATUS]
        )
      ),
    status:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.VALIDATION_STATUS]
      ),
    warnings: warnings,
    points:
      Number(row[ARMY_LIST_COLUMNS.VALIDATION_POINTS]) || 0,
    swc:
      Number(row[ARMY_LIST_COLUMNS.VALIDATION_SWC]) || 0,
    unitCount:
      Number(row[ARMY_LIST_COLUMNS.VALIDATION_UNIT_COUNT]) || 0,
    combatGroups:
      Number(row[ARMY_LIST_COLUMNS.VALIDATION_COMBAT_GROUPS]) || 0,
    armyName:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.VALIDATION_ARMY_NAME]
      ),
    faction:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.VALIDATION_FACTION]
      ),
    sectorial:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.VALIDATION_SECTORIAL]
      ),
    override:
      getArmyListApproved(
        row[ARMY_LIST_COLUMNS.VALIDATION_OVERRIDE]
      ),
    overrideBy:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.VALIDATION_OVERRIDE_BY]
      ),
    overrideReason:
      getArmyListString(
        row[ARMY_LIST_COLUMNS.VALIDATION_OVERRIDE_REASON]
      ),
    timestamp:
      formatArmyListDate(
        row[ARMY_LIST_COLUMNS.VALIDATION_TIMESTAMP]
      )
  };

}

function getArmyListValidationSeverity(status) {

  const normalized =
    getArmyListString(status)
      .toLowerCase();

  if (normalized === "error" || normalized === "invalid")
    return "Error";

  if (normalized === "warning" || normalized === "flagged")
    return "Warning";

  return "Info";

}

function buildPlayerArmyListSummary(lists) {

  const sortedByScore =
    sortArmyListsByScore(
      lists
    );

  const newest =
    sortArmyListsByNewest(
      lists
    );

  const totalScore =
    lists.reduce(function(total, list) {

      return total + list.score;

    }, 0);

  return {
    submitted: lists.length,
    highestRated:
      sortedByScore[0] || null,
    newest:
      newest[0] || null,
    averageRating:
      lists.length === 0
        ? 0
        : roundArmyListNumber(
            totalScore / lists.length
          ),
    favoriteFaction:
      getArmyListMostCommon(
        lists,
        "faction"
      )
  };

}

function buildArmyListCommunitySummary(lists) {

  return {
    topContributors:
      buildArmyListCountLeaders(
        lists,
        "player"
      ),
    highestRatedDesigner:
      buildHighestRatedDesigner(
        lists
      ),
    mostPopularFaction:
      getArmyListMostCommon(
        lists,
        "faction"
      ),
    trendingLists:
      sortArmyListsByScore(
        lists
      ).slice(0, 5),
    mostListsSubmitted:
      buildArmyListCountLeaders(
        lists,
        "player"
      ).slice(0, 5)
  };

}

function buildArmyListCountLeaders(lists, field) {

  const counts = {};

  lists.forEach(function(list) {

    const value =
      list[field];

    if (!value)
      return;

    if (!counts[value])
      counts[value] = 0;

    counts[value]++;

  });

  return Object.keys(counts)
    .map(function(name) {

      return {
        name: name,
        displayName:
          field === "player"
            ? getPlayerDisplayName(name)
            : name,
        count: counts[name]
      };

    })
    .sort(function(a, b) {

      return (
        b.count - a.count ||
        a.name.localeCompare(b.name)
      );

    })
    .slice(0, 5);

}

function buildHighestRatedDesigner(lists) {

  const designers = {};

  lists.forEach(function(list) {

    if (!designers[list.player])
      designers[list.player] = {
        name: list.player,
        displayName:
          getPlayerDisplayName(list.player),
        score: 0,
        lists: 0
      };

    designers[list.player].score += list.score;
    designers[list.player].lists++;

  });

  return Object.keys(designers)
    .map(function(player) {

      return designers[player];

    })
    .sort(function(a, b) {

      return (
        b.score - a.score ||
        b.lists - a.lists ||
        a.name.localeCompare(b.name)
      );

    })[0] || null;

}

function getArmyListSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.ARMY_LISTS
    );

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEETS.ARMY_LISTS
      );

  ensureArmyListHeaders(sheet);

  return sheet;

}

function ensureArmyListHeaders(sheet) {

  const headerRange =
    sheet.getRange(
      1,
      1,
      1,
      ARMY_LIST_HEADERS.length
    );

  const headers =
    headerRange.getValues()[0];

  const matches =
    ARMY_LIST_HEADERS.every(function(header, index) {

      return headers[index] === header;

    });

  if (!matches)
    headerRange.setValues([
      ARMY_LIST_HEADERS
    ]);

}

function getApiParameters(e) {

  if (
    e &&
    e.parameter
  )
    return e.parameter;

  return {};

}

function getApiParameter(parameters, key) {

  if (
    !parameters ||
    parameters[key] === undefined ||
    parameters[key] === null
  )
    return "";

  return String(parameters[key])
    .trim();

}

function getArmyListString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value)
    .trim();

}

function getArmyListApproved(value) {

  if (value === true)
    return true;

  const text =
    getArmyListString(value)
      .toLowerCase();

  return (
    text === "true" ||
    text === "yes" ||
    text === "approved"
  );

}

function formatArmyListDate(value) {

  if (
    Object.prototype.toString.call(value) ===
    "[object Date]"
  )
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  return getArmyListString(value);

}

function sortArmyListsByScore(lists) {

  return lists
    .slice()
    .sort(function(a, b) {

      return (
        b.score - a.score ||
        b.upvotes - a.upvotes ||
        b.id - a.id
      );

    });

}

function sortArmyListsByRating(lists) {

  return lists
    .slice()
    .sort(function(a, b) {

      return (
        b.upvotes - a.upvotes ||
        a.downvotes - b.downvotes ||
        b.id - a.id
      );

    });

}

function sortArmyListsByNewest(lists) {

  return lists
    .slice()
    .sort(function(a, b) {

      return b.id - a.id;

    });

}

function getArmyListMostCommon(lists, field) {

  const counts = {};

  lists.forEach(function(list) {

    const value =
      list[field];

    if (!value)
      return;

    if (!counts[value])
      counts[value] = 0;

    counts[value]++;

  });

  let leader = "";
  let leaderCount = 0;

  Object.keys(counts)
    .forEach(function(value) {

      if (
        counts[value] > leaderCount ||
        (
          counts[value] === leaderCount &&
          value < leader
        )
      ) {

        leader = value;
        leaderCount = counts[value];

      }

    });

  return leader;

}

function getFactionMatchupScore(score, factionWasWinner) {

  const parts =
    String(score || "0-0")
      .split("-");

  return Number(
    factionWasWinner
      ? parts[0]
      : parts[1]
  ) || 0;

}

function getArmyListAverage(total, games) {

  if (games === 0)
    return 0;

  return roundArmyListNumber(
    total / games
  );

}

function roundArmyListNumber(value) {

  return Math.round(value * 100) / 100;

}
