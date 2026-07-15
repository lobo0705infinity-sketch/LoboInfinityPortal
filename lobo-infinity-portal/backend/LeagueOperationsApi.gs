/*******************************************************
 * LOBO INFINITY LEAGUE
 * Weekly League Operations API
 *******************************************************/

const LEAGUE_OPERATIONS_HEADERS = [
  "Week Number",
  "Mission 1",
  "Mission 1 Map A",
  "Mission 1 Map B",
  "Mission 2",
  "Mission 2 Map A",
  "Mission 2 Map B",
  "Updated At",
  "Updated By"
];

function getLeagueOperations() {

  const row =
    getLeagueOperationsCurrentRow();

  return jsonOutput({
    success: true,
    operations: buildLeagueOperationsPayload(row)
  });

}

function saveLeagueOperations(e) {

  return requireApiPermission(e, "manageEvents", function(auth) {

    const params =
      getApiParameters(e);

    const weekNumber =
      getLeagueOperationsString(params.weekNumber);

    const mission1 =
      getCanonicalMissionName(params.mission1);

    const mission2 =
      getCanonicalMissionName(params.mission2);

    const mission1MapA =
      getLeagueOperationsString(params.mission1MapA);

    const mission1MapB =
      getLeagueOperationsString(params.mission1MapB);

    const mission2MapA =
      getLeagueOperationsString(params.mission2MapA);

    const mission2MapB =
      getLeagueOperationsString(params.mission2MapB);

    const missing = [];

    if (weekNumber === "")
      missing.push("Week Number");

    if (mission1 === "")
      missing.push("Mission 1");

    if (mission1MapA === "")
      missing.push("Mission 1 Map A");

    if (mission1MapB === "")
      missing.push("Mission 1 Map B");

    if (mission2 === "")
      missing.push("Mission 2");

    if (mission2MapA === "")
      missing.push("Mission 2 Map A");

    if (mission2MapB === "")
      missing.push("Mission 2 Map B");

    if (missing.length > 0)
      return jsonOutput({
        success: false,
        error:
          "League Operations requires: " +
          missing.join(", ") +
          "."
      });

    const sheet =
      ensureLeagueOperationsSheet();

    const updatedAt =
      getEventManagerTimestamp();

    const updatedBy =
      auth && auth.user
        ? auth.user.email || getCanonicalPlayerFromUser(auth.user) || "Commissioner"
        : "Commissioner";

    const row = [
      weekNumber,
      mission1,
      mission1MapA,
      mission1MapB,
      mission2,
      mission2MapA,
      mission2MapB,
      updatedAt,
      updatedBy
    ];

    const nextRow =
      getLeagueOperationsCurrentRowNumber(sheet);

    if (nextRow === -1)
      sheet.appendRow(row);
    else
      sheet
        .getRange(nextRow, 1, 1, row.length)
        .setValues([row]);

    invalidatePortalCacheGroup("leagueOperations");

    if (typeof recordEventManagerAudit === "function")
      recordEventManagerAudit(
        auth,
        EVENT_ENGINE_DEFAULT_EVENT_ID,
        "League Operations updated",
        "Week " + weekNumber
      );

    return getLeagueOperations();

  });

}

function buildLeagueOperationsPayload(row) {

  const safeRow =
    row || [];

  return {
    weekNumber: getLeagueOperationsString(safeRow[0]),
    missions: [
      {
        mission: getLeagueOperationsString(safeRow[1]),
        maps: [
          getLeagueOperationsString(safeRow[2]),
          getLeagueOperationsString(safeRow[3])
        ]
      },
      {
        mission: getLeagueOperationsString(safeRow[4]),
        maps: [
          getLeagueOperationsString(safeRow[5]),
          getLeagueOperationsString(safeRow[6])
        ]
      }
    ],
    updatedAt: getLeagueOperationsString(safeRow[7]),
    updatedBy: getLeagueOperationsString(safeRow[8]),
    missionOptions: getCanonicalMissionsForOperations()
  };

}

function getCanonicalMissionsForOperations() {

  return getCanonicalMissions();

}

function getLeagueOperationsCurrentRow() {

  const sheet =
    ensureLeagueOperationsSheet();

  const rowNumber =
    getLeagueOperationsCurrentRowNumber(sheet);

  if (rowNumber === -1)
    return [];

  return sheet
    .getRange(rowNumber, 1, 1, LEAGUE_OPERATIONS_HEADERS.length)
    .getValues()[0];

}

function getLeagueOperationsCurrentRowNumber(sheet) {

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2)
    return -1;

  return lastRow;

}

function ensureLeagueOperationsSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.LEAGUE_OPERATIONS);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.LEAGUE_OPERATIONS);

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, LEAGUE_OPERATIONS_HEADERS.length)
      .setValues([LEAGUE_OPERATIONS_HEADERS]);
  }

  return sheet;

}

function getLeagueOperationsString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
