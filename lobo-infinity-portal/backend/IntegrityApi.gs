/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * IntegrityApi.gs
 *
 * League integrity monitoring, reporting, and safe repair.
 *******************************************************/

const INTEGRITY_VERSION = "2.0.2";
const INTEGRITY_LAST_AUDIT_KEY = "integrityLastAudit";
const INTEGRITY_LAST_REPAIR_KEY = "integrityLastRepair";

function getIntegrityDashboard() {

  const audit =
    buildLeagueIntegrityAudit(false);

  setIntegrityProperty(
    INTEGRITY_LAST_AUDIT_KEY,
    audit.timestamp
  );

  return jsonOutput({
    success: true,
    integrity: audit
  });

}

function repairLeagueIntegrity(e) {

  const params =
    getOperationsParams(e);

  const repair =
    getOperationsString(params.repair || "safe");

  const start =
    new Date();

  const repairs = [];

  if (
    repair === "safe" ||
    repair === "formulas"
  )
    repairs.push(repairIntegrityFormulas());

  if (
    repair === "safe" ||
    repair === "standings"
  )
    repairs.push(repairIntegrityStandings());

  if (repair === "analytics")
    repairs.push(repairIntegrityAnalytics());

  if (repair === "statistics")
    repairs.push(repairIntegrityStatistics());

  if (repair === "identity")
    repairs.push(repairIntegrityIdentity());

  if (repair === "cache")
    repairs.push(repairIntegrityCache());

  if (repair === "all") {
    repairs.push(repairIntegrityFormulas());
    repairs.push(repairIntegrityStandings());
    repairs.push(repairIntegrityAnalytics());
    repairs.push(repairIntegrityIdentity());
    repairs.push(repairIntegrityCache());
  }

  SpreadsheetApp.flush();

  const timestamp =
    getIntegrityTimestamp();

  setIntegrityProperty(
    INTEGRITY_LAST_REPAIR_KEY,
    timestamp
  );

  const audit =
    buildLeagueIntegrityAudit(false);

  return jsonOutput({
    success: true,
    repairedAt: timestamp,
    durationMs:
      new Date().getTime() - start.getTime(),
    repairs: repairs,
    integrity: audit
  });

}

function getIntegrityReport() {

  const audit =
    buildLeagueIntegrityAudit(false);

  setIntegrityProperty(
    INTEGRITY_LAST_AUDIT_KEY,
    audit.timestamp
  );

  return jsonOutput({
    success: true,
    report: {
      timestamp: audit.timestamp,
      leagueVersion: INTEGRITY_VERSION,
      portalVersion:
        getSettingsObject().portalVersion || "",
      errors: audit.summary.errors,
      warnings: audit.summary.warnings,
      repairs:
        audit.sections.reduce(function(items, section) {
          return items.concat(
            section.issues
              .filter(function(issue) {
                return issue.repairable;
              })
              .map(function(issue) {
                return {
                  section: section.title,
                  issue: issue.title,
                  repairAction: issue.repairAction
                };
              })
          );
        }, []),
      durationMs: audit.durationMs,
      healthScore: audit.healthScore,
      sections: audit.sections
    }
  });

}

function buildLeagueIntegrityAudit(includeSamples) {

  const start =
    new Date();

  const context =
    buildIntegrityContext();

  const sections = [
    auditIntegrityFormulas(context, includeSamples),
    auditIntegrityStandings(context),
    auditIntegrityGameEngine(context),
    auditIntegrityIdentity(context),
    auditIntegrityDivisions(context),
    auditIntegrityArmyLists(context),
    auditIntegrityStreams(context),
    auditIntegrityNews(context)
  ];

  const summary =
    getIntegritySummary(sections);

  const durationMs =
    new Date().getTime() - start.getTime();

  const timestamp =
    getIntegrityTimestamp();

  return {
    version: INTEGRITY_VERSION,
    timestamp: timestamp,
    lastAudit:
      getIntegrityProperty(INTEGRITY_LAST_AUDIT_KEY) || "Never",
    lastRepair:
      getIntegrityProperty(INTEGRITY_LAST_REPAIR_KEY) || "Never",
    durationMs: durationMs,
    healthScore:
      getIntegrityHealthScore(summary),
    healthStatus:
      getIntegrityHealthStatus(
        getIntegrityHealthScore(summary)
      ),
    summary: summary,
    sections: sections
  };

}

function buildIntegrityContext() {

  clearLeagueData();
  loadLeagueData();

  const registry =
    buildPlayerRegistry();

  updateRegistryStatistics(registry);

  return {
    spreadsheet: SpreadsheetApp.getActive(),
    settings: getSettingsObject(),
    games: getLeagueData(),
    recentGames: getAllRecentGameObjects(),
    registry: registry,
    players:
      Object
        .values(registry),
    identity:
      getOperationsIdentityManagement(),
    armyLists:
      getArmyListObjects(),
    streams:
      getOperationsStreams(),
    news:
      getOperationsNews()
  };

}

function auditIntegrityFormulas(context, includeSamples) {

  const sheetNames = [
    "Main Man Data",
    "Proving Grounds A Data",
    "Proving Grounds B Data",
    CONFIG.SHEETS.PLAYER_ANALYTICS,
    CONFIG.SHEETS.FACTION_ANALYTICS,
    CONFIG.SHEETS.MISSION_ANALYTICS
  ];

  const checks = [];
  const issues = [];

  sheetNames.forEach(function(sheetName) {

    const sheet =
      context.spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      issues.push(
        buildIntegrityIssue(
          "error",
          "Missing sheet",
          sheetName + " does not exist.",
          sheetName,
          "formulas",
          true
        )
      );
      checks.push(buildIntegrityCheck(sheetName, "Error", "Missing sheet"));
      return;
    }

    const audit =
      auditIntegrityFormulaSheet(sheet);

    audit.inconsistent.forEach(function(item) {
      issues.push(
        buildIntegrityIssue(
          "error",
          "Formula drift",
          "Row " + item.row + ", column " + item.column + " differs from the column formula pattern.",
          sheetName,
          "formulas",
          true
        )
      );
    });

    checks.push(
      buildIntegrityCheck(
        sheetName,
        audit.inconsistent.length === 0
          ? "Healthy"
          : "Error",
        audit.checkedColumns.length +
          " formula columns checked",
        includeSamples
          ? audit.checkedColumns
          : []
      )
    );

  });

  return buildIntegritySection(
    "formula-integrity",
    "Formula Integrity",
    "Spreadsheet formulas and formula drift",
    checks,
    issues,
    "formulas"
  );

}

function auditIntegrityFormulaSheet(sheet) {

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (
    lastRow < 3 ||
    lastColumn < 2
  )
    return {
      checkedColumns: [],
      inconsistent: []
    };

  const range =
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      lastColumn
    );

  const values =
    range.getDisplayValues();

  const formulas =
    range.getFormulasR1C1();

  const playerRows =
    values
      .filter(isIntegrityPopulatedRow)
      .length;

  const checkedColumns = [];
  const inconsistent = [];

  for (
    let col = 0;
    col < lastColumn;
    col++
  ) {

    const template =
      getIntegrityFormulaTemplate(
        formulas,
        col,
        playerRows
      );

    if (template.template === "")
      continue;

    checkedColumns.push({
      column: col + 1,
      formulaRows: template.count,
      template: template.template
    });

    formulas.forEach(function(row, index) {

      if (!isIntegrityPopulatedRow(values[index]))
        return;

      if (row[col] !== template.template)
        inconsistent.push({
          row: index + 2,
          column: col + 1,
          formula: row[col]
        });

    });

  }

  return {
    checkedColumns: checkedColumns,
    inconsistent: inconsistent
  };

}

function auditIntegrityStandings(context) {

  const checks = [];
  const issues = [];

  [
    {
      division: CONFIG.DIVISIONS.MAIN_MAN,
      sheet: CONFIG.SHEETS.MAIN_MAN
    },
    {
      division: CONFIG.DIVISIONS.PGA,
      sheet: CONFIG.SHEETS.PGA
    },
    {
      division: CONFIG.DIVISIONS.PGB,
      sheet: CONFIG.SHEETS.PGB
    }
  ].forEach(function(item) {

    const audit =
      auditIntegrityStandingsSheet(
        context,
        item.division,
        item.sheet
      );

    audit.mismatches.forEach(function(mismatch) {
      issues.push(
        buildIntegrityIssue(
          "error",
          "Stale standings",
          mismatch.field +
            " mismatch on row " +
            mismatch.row +
            ": expected " +
            mismatch.expected +
            ", found " +
            mismatch.actual +
            ".",
          item.sheet,
          "standings",
          true
        )
      );
    });

    checks.push(
      buildIntegrityCheck(
        item.division,
        audit.mismatches.length === 0
          ? "Healthy"
          : "Error",
        audit.rowsChecked + " rows checked"
      )
    );

  });

  return buildIntegritySection(
    "standings-integrity",
    "Standings Integrity",
    "Rankings, TP, OP, VP, wins, losses, and sorting",
    checks,
    issues,
    "standings"
  );

}

function auditIntegrityGameEngine(context) {

  const checks = [];
  const issues = [];
  const seen = {};

  context.games.forEach(function(game, index) {

    const rowNumber =
      index + 2;

    const division =
      getIntegrityCell(game, CONFIG.ENGINE.DIVISION);

    const date =
      getIntegrityCell(game, CONFIG.ENGINE.DATE);

    const mission =
      getIntegrityCell(game, CONFIG.ENGINE.MISSION);

    const player =
      getIntegrityCell(game, CONFIG.ENGINE.PLAYER);

    const opponent =
      getIntegrityCell(game, CONFIG.ENGINE.OPPONENT);

    const result =
      getIntegrityCell(game, CONFIG.ENGINE.RESULT);

    const key =
      [
        division,
        date,
        mission,
        player,
        opponent
      ].join("|").toLowerCase();

    if (seen[key])
      issues.push(
        buildIntegrityIssue(
          "warning",
          "Duplicate game row",
          "Game Engine row " + rowNumber + " appears duplicated.",
          "Game Engine",
          "statistics",
          true
        )
      );

    seen[key] = true;

    if (division === "")
      issues.push(buildIntegrityGameIssue("Missing division", rowNumber));

    if (date === "")
      issues.push(buildIntegrityGameIssue("Missing date", rowNumber));

    if (mission === "")
      issues.push(buildIntegrityGameIssue("Missing mission", rowNumber));

    if (player === "")
      issues.push(buildIntegrityGameIssue("Missing player", rowNumber));

    if (opponent === "")
      issues.push(buildIntegrityGameIssue("Missing opponent", rowNumber));

    if (["W", "L", "D"].indexOf(result) === -1)
      issues.push(buildIntegrityGameIssue("Missing winner/result", rowNumber));

    [
      ["TP", CONFIG.ENGINE.TP],
      ["OP", CONFIG.ENGINE.OP],
      ["VP", CONFIG.ENGINE.VP]
    ].forEach(function(score) {
      if (game[score[1]] === "" || game[score[1]] === null)
        issues.push(buildIntegrityGameIssue("Missing " + score[0], rowNumber));
    });

    if (getIntegrityCell(game, CONFIG.ENGINE.FACTION) === "")
      issues.push(buildIntegrityGameIssue("Missing faction", rowNumber));

    if (player && !context.registry[player])
      issues.push(
        buildIntegrityIssue(
          "error",
          "Broken player reference",
          player + " is in Game Engine but not in Players.",
          "Game Engine",
          "statistics",
          false
        )
      );

  });

  checks.push(
    buildIntegrityCheck(
      "Game Engine",
      issues.filter(function(issue) {
        return issue.severity === "error";
      }).length === 0
        ? "Healthy"
        : "Error",
      context.games.length + " player rows checked"
    )
  );

  return buildIntegritySection(
    "game-engine-integrity",
    "Game Engine Integrity",
    "Duplicate games, missing scores, winners, factions, missions, and references",
    checks,
    issues,
    "statistics"
  );

}

function auditIntegrityIdentity(context) {

  const checks = [];
  const issues = [];

  context.identity.audits.forEach(function(audit) {
    issues.push(
      buildIntegrityIssue(
        audit.severity === "critical"
          ? "error"
          : audit.severity === "warning"
            ? "warning"
            : "info",
        audit.type,
        audit.message,
        audit.player || audit.googleEmail || "Identity",
        "identity",
        audit.type !== "Duplicate Email" &&
          audit.type !== "Duplicate Player"
      )
    );
  });

  checks.push(
    buildIntegrityCheck(
      "Portal Identity",
      issues.filter(function(issue) {
        return issue.severity === "error";
      }).length === 0
        ? "Healthy"
        : "Error",
      context.identity.records.length + " identity records checked"
    )
  );

  return buildIntegritySection(
    "identity-integrity",
    "Identity Integrity",
    "Google Email to Players and Users sheet mapping",
    checks,
    issues,
    "identity"
  );

}

function auditIntegrityDivisions(context) {

  const checks = [];
  const issues = [];
  const counts = {};
  const players = {};

  context.players.forEach(function(player) {

    if (!counts[player.division])
      counts[player.division] = 0;

    counts[player.division]++;

    const key =
      String(player.player || "").toLowerCase();

    players[key] =
      (players[key] || 0) + 1;

    if (!player.division)
      issues.push(
        buildIntegrityIssue(
          "error",
          "Missing division",
          player.player + " does not have a division.",
          player.player,
          "identity",
          false
        )
      );

  });

  Object
    .keys(players)
    .forEach(function(player) {
      if (players[player] > 1)
        issues.push(
          buildIntegrityIssue(
            "error",
            "Duplicate player",
            player + " appears more than once.",
            player,
            "identity",
            false
          )
        );
    });

  [
    CONFIG.DIVISIONS.MAIN_MAN,
    CONFIG.DIVISIONS.PGA,
    CONFIG.DIVISIONS.PGB
  ].forEach(function(division) {
    checks.push(
      buildIntegrityCheck(
        division,
        counts[division] > 0
          ? "Healthy"
          : "Warning",
        (counts[division] || 0) + " players"
      )
    );
  });

  checks.push(
    buildIntegrityCheck(
      "Promotion Eligibility",
      "Healthy",
      getIntegrityPromotionSummary(context)
    )
  );

  checks.push(
    buildIntegrityCheck(
      "Relegation Eligibility",
      "Healthy",
      getIntegrityRelegationSummary(context)
    )
  );

  return buildIntegritySection(
    "division-integrity",
    "Division Integrity",
    "Division counts, duplicates, missing divisions, promotion, and relegation",
    checks,
    issues,
    "identity"
  );

}

function auditIntegrityArmyLists(context) {

  const checks = [];
  const issues = [];
  const players = {};

  context.players.forEach(function(player) {
    players[String(player.player || "").toLowerCase()] = true;
  });

  context.armyLists.forEach(function(list) {

    const target =
      list.armyName || "Army list " + list.id;

    if (!players[String(list.player || "").toLowerCase()])
      issues.push(
        buildIntegrityIssue(
          "error",
          "Broken player reference",
          target + " references " + list.player + ".",
          target,
          "armyLists",
          false
        )
      );

    if (!list.faction)
      issues.push(
        buildIntegrityIssue(
          "warning",
          "Missing faction",
          target + " has no faction.",
          target,
          "armyLists",
          false
        )
      );

    if (!list.submitterEmail)
      issues.push(
        buildIntegrityIssue(
          "warning",
          "Missing owner",
          target + " has no submitter email.",
          target,
          "armyLists",
          false
        )
      );

    if (Number(list.score) !== (Number(list.upvotes) || 0) - (Number(list.downvotes) || 0))
      issues.push(
        buildIntegrityIssue(
          "warning",
          "Rating total drift",
          target + " score does not match upvotes minus downvotes.",
          target,
          "armyLists",
          false
        )
      );

  });

  checks.push(
    buildIntegrityCheck(
      "Army Lists",
      issues.length === 0
        ? "Healthy"
        : "Warning",
      context.armyLists.length + " lists checked"
    )
  );

  return buildIntegritySection(
    "army-list-integrity",
    "Army List Integrity",
    "Player, faction, owner, and rating references",
    checks,
    issues,
    "armyLists"
  );

}

function auditIntegrityStreams(context) {

  const checks = [];
  const issues = [];

  context.streams.forEach(function(stream) {

    const target =
      stream.mission || "Stream " + stream.id;

    if (!stream.date)
      issues.push(buildIntegrityStreamIssue("Missing date", target));

    if (!stream.mission)
      issues.push(buildIntegrityStreamIssue("Missing mission", target));

    if (!stream.player1 || !stream.player2)
      issues.push(buildIntegrityStreamIssue("Missing player", target));

    if (!stream.youtubeUrl)
      issues.push(buildIntegrityStreamIssue("Missing link", target));
    else if (!isStreamYoutubeUrl(stream.youtubeUrl))
      issues.push(
        buildIntegrityIssue(
          "error",
          "Invalid stream link",
          target + " is not a YouTube URL.",
          target,
          "streams",
          false
        )
      );

  });

  checks.push(
    buildIntegrityCheck(
      "Streams",
      issues.filter(function(issue) {
        return issue.severity === "error";
      }).length === 0
        ? "Healthy"
        : "Error",
      context.streams.length + " streams checked"
    )
  );

  return buildIntegritySection(
    "streams-integrity",
    "Streams Integrity",
    "Valid game references, dates, and links",
    checks,
    issues,
    "streams"
  );

}

function auditIntegrityNews(context) {

  const checks = [];
  const issues = [];

  context.news.forEach(function(item) {

    const target =
      item.title || "News " + item.id;

    if (!item.date)
      issues.push(
        buildIntegrityIssue(
          "warning",
          "Missing date",
          target + " has no date.",
          target,
          "news",
          false
        )
      );

    if (!item.title)
      issues.push(
        buildIntegrityIssue(
          "warning",
          "Missing title",
          "A news item has no title.",
          target,
          "news",
          false
        )
      );

    if (
      item.link &&
      item.link.indexOf("/") !== 0 &&
      !/^https?:\/\/[^\s]+$/i.test(item.link)
    )
      issues.push(
        buildIntegrityIssue(
          "error",
          "Broken link",
          target + " has an invalid link.",
          target,
          "news",
          false
        )
      );

  });

  checks.push(
    buildIntegrityCheck(
      "News",
      issues.filter(function(issue) {
        return issue.severity === "error";
      }).length === 0
        ? "Healthy"
        : "Error",
      context.news.length + " news records checked"
    )
  );

  return buildIntegritySection(
    "news-integrity",
    "News Integrity",
    "Links, dates, and broken references",
    checks,
    issues,
    "news"
  );

}

function repairIntegrityFormulas() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  const sheets = [
    "Main Man Data",
    "Proving Grounds A Data",
    "Proving Grounds B Data",
    CONFIG.SHEETS.PLAYER_ANALYTICS,
    CONFIG.SHEETS.FACTION_ANALYTICS,
    CONFIG.SHEETS.MISSION_ANALYTICS
  ];

  let changed = 0;

  sheets.forEach(function(sheetName) {

    const sheet =
      spreadsheet.getSheetByName(sheetName);

    if (sheet)
      changed += repairIntegrityFormulaSheet(sheet).changed;

  });

  return {
    repair: "formulas",
    changed: changed
  };

}

function repairIntegrityFormulaSheet(sheet) {

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (
    lastRow < 3 ||
    lastColumn < 2
  )
    return {
      changed: 0
    };

  const range =
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      lastColumn
    );

  const values =
    range.getDisplayValues();

  const formulas =
    range.getFormulasR1C1();

  const populatedRows =
    values.filter(isIntegrityPopulatedRow).length;

  let changed = 0;

  for (
    let col = 0;
    col < lastColumn;
    col++
  ) {

    const template =
      getIntegrityFormulaTemplate(
        formulas,
        col,
        populatedRows
      );

    if (template.template === "")
      continue;

    formulas.forEach(function(row, index) {

      if (!isIntegrityPopulatedRow(values[index]))
        return;

      if (row[col] === template.template)
        return;

      sheet
        .getRange(index + 2, col + 1)
        .setFormulaR1C1(template.template);

      changed++;

    });

  }

  return {
    changed: changed
  };

}

function repairIntegrityStandings() {

  clearLeagueData();
  loadLeagueData();
  rebuildStandings();
  invalidatePortalCacheGroup("standings");

  return {
    repair: "standings",
    changed: 1
  };

}

function repairIntegrityAnalytics() {

  clearLeagueData();
  loadLeagueData();
  rebuildPlayerAnalytics();
  rebuildFactionAnalytics();
  rebuildMissionAnalytics();
  invalidatePortalCacheGroup("analytics");

  return {
    repair: "analytics",
    changed: 1
  };

}

function repairIntegrityStatistics() {

  rebuildEverything();

  return {
    repair: "statistics",
    changed: 1
  };

}

function repairIntegrityIdentity() {

  repairMissingIdentityAccounts();
  enableLinkedIdentityUsers();
  invalidatePortalCacheGroup("all");

  return {
    repair: "identity",
    changed: 1
  };

}

function repairIntegrityCache() {

  invalidatePortalCacheGroup("all");

  return {
    repair: "cache",
    changed: 1
  };

}

function auditIntegrityStandingsSheet(context, division, sheetName) {

  const sheet =
    context.spreadsheet.getSheetByName(sheetName);

  const expected =
    buildDivisionTable(
      context.registry,
      division
    );

  const mismatches = [];

  if (!sheet)
    return {
      rowsChecked: 0,
      mismatches: [
        {
          row: 0,
          field: "sheet",
          actual: "missing",
          expected: sheetName
        }
      ]
    };

  const actual =
    sheet
      .getDataRange()
      .getDisplayValues();

  for (
    let row = 1;
    row < expected.length;
    row++
  ) {

    const actualRow =
      actual[row] || [];

    const expectedRow =
      expected[row];

    [
      ["rank", 0],
      ["player", 1],
      ["games", 2],
      ["wins", 3],
      ["losses", 4],
      ["tp", 5],
      ["op", 6],
      ["vp", 7]
    ].forEach(function(check) {

      const actualValue =
        check[1] === 1
          ? String(actualRow[check[1]] || "")
          : Number(actualRow[check[1]]) || 0;

      const expectedValue =
        check[1] === 1
          ? String(expectedRow[check[1]] || "")
          : Number(expectedRow[check[1]]) || 0;

      if (actualValue !== expectedValue)
        mismatches.push({
          row: row + 1,
          field: check[0],
          actual: actualValue,
          expected: expectedValue
        });

    });

  }

  return {
    rowsChecked: Math.max(0, expected.length - 1),
    mismatches: mismatches
  };

}

function getIntegrityFormulaTemplate(formulas, col, populatedRows) {

  const counts = {};
  let best = "";
  let bestCount = 0;

  formulas.forEach(function(row) {

    const formula =
      String(row[col] || "").trim();

    if (formula === "")
      return;

    counts[formula] =
      (counts[formula] || 0) + 1;

    if (counts[formula] > bestCount) {
      best = formula;
      bestCount = counts[formula];
    }

  });

  if (
    bestCount < 2 ||
    bestCount < Math.max(2, Math.floor(populatedRows * 0.5))
  )
    return {
      template: "",
      count: bestCount
    };

  return {
    template: best,
    count: bestCount
  };

}

function isIntegrityPopulatedRow(row) {

  return row
    .slice(0, 12)
    .some(function(value) {
      return String(value || "").trim() !== "";
    });

}

function buildIntegritySection(id, title, description, checks, issues, repairAction) {

  const errors =
    issues.filter(function(issue) {
      return issue.severity === "error";
    }).length;

  const warnings =
    issues.filter(function(issue) {
      return issue.severity === "warning";
    }).length;

  return {
    id: id,
    title: title,
    description: description,
    status:
      errors > 0
        ? "Error"
        : warnings > 0
          ? "Warning"
          : "Healthy",
    errors: errors,
    warnings: warnings,
    repairAction: repairAction,
    repairable:
      issues.some(function(issue) {
        return issue.repairable;
      }),
    checks: checks,
    issues: issues
  };

}

function buildIntegrityCheck(target, status, detail, data) {

  return {
    target: target,
    status: status,
    detail: detail,
    data: data || []
  };

}

function buildIntegrityIssue(severity, title, detail, target, repairAction, repairable) {

  return {
    id:
      [
        severity,
        title,
        target,
        detail
      ]
        .join("|")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    severity: severity,
    title: title,
    detail: detail,
    target: target,
    repairAction: repairAction || "",
    repairable: repairable === true
  };

}

function getIntegritySummary(sections) {

  return {
    errors:
      sections.reduce(function(total, section) {
        return total + section.errors;
      }, 0),
    warnings:
      sections.reduce(function(total, section) {
        return total + section.warnings;
      }, 0),
    repairable:
      sections.reduce(function(total, section) {
        return total +
          section.issues.filter(function(issue) {
            return issue.repairable;
          }).length;
      }, 0),
    sections:
      sections.length
  };

}

function getIntegrityHealthScore(summary) {

  return Math.max(
    0,
    Math.round(
      100 -
      summary.errors * 12 -
      summary.warnings * 3
    )
  );

}

function getIntegrityHealthStatus(score) {

  if (score >= 95)
    return "Green";

  if (score >= 80)
    return "Yellow";

  return "Red";

}

function buildIntegrityGameIssue(title, rowNumber) {

  return buildIntegrityIssue(
    "error",
    title,
    title + " on Game Engine row " + rowNumber + ".",
    "Game Engine",
    "statistics",
    true
  );

}

function buildIntegrityStreamIssue(title, target) {

  return buildIntegrityIssue(
    "warning",
    title,
    target + " needs stream metadata.",
    target,
    "streams",
    false
  );

}

function getIntegrityPromotionSummary(context) {

  const pga =
    buildDivisionTable(
      context.registry,
      CONFIG.DIVISIONS.PGA
    );

  const pgb =
    buildDivisionTable(
      context.registry,
      CONFIG.DIVISIONS.PGB
    );

  return [
    pga[1] ? pga[1][1] : "None",
    pga[2] ? pga[2][1] : "None",
    pgb[1] ? pgb[1][1] : "None",
    pgb[2] ? pgb[2][1] : "None"
  ].join(", ");

}

function getIntegrityRelegationSummary(context) {

  const main =
    buildDivisionTable(
      context.registry,
      CONFIG.DIVISIONS.MAIN_MAN
    );

  return main
    .slice(-2)
    .map(function(row) {
      return row[1];
    })
    .join(", ");

}

function getIntegrityCell(row, index) {

  return String(row[index] || "").trim();

}

function getIntegrityProperty(key) {

  return PropertiesService
    .getScriptProperties()
    .getProperty(key);

}

function setIntegrityProperty(key, value) {

  PropertiesService
    .getScriptProperties()
    .setProperty(key, value);

}

function getIntegrityTimestamp() {

  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );

}
