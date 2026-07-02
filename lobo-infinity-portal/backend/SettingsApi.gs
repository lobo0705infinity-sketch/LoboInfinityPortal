/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * SettingsApi.gs
 *
 * Administrator-editable portal configuration.
 *******************************************************/

const SETTINGS_HEADERS = [
  "Key",
  "Value",
  "Description"
];

const DEFAULT_SETTINGS = [
  [
    "currentSeason",
    "July 2026 Season",
    "Current league season displayed by the portal."
  ],
  [
    "leagueName",
    "Lobo Infinity League",
    "Public league name."
  ],
  [
    "googleFormUrl",
    "",
    "Match Submission Google Form URL."
  ],
  [
    "discordInvite",
    "",
    "Discord invite URL."
  ],
  [
    "leagueWebsite",
    "",
    "Primary league website URL."
  ]
];

function getSettings() {

  const sheet =
    ensureSettingsSheet();

  const columns =
    getSettingsColumns(sheet);

  const values =
    sheet
      .getDataRange()
      .getValues();

  const settings = {};

  values
      .slice(1)
      .forEach(function(row) {

        const key =
        getSettingsString(row[columns.key]);

      if (key === "")
        return;

      settings[key] =
        getSettingsString(row[columns.value]);

    });

  return jsonOutput({
    success: true,
    settings: settings
  });

}

function ensureSettingsSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.SETTINGS);

  const columns =
    ensureSettingsColumns(sheet);

  ensureDefaultSettings(
    sheet,
    columns
  );

  return sheet;

}

function ensureSettingsColumns(sheet) {

  const lastColumn =
    Math.max(sheet.getLastColumn(), 1);

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0]
      .map(function(header) {

        return getSettingsString(header);

      });

  const columns = {
    key: headers.indexOf("Key"),
    value: headers.indexOf("Value"),
    description: headers.indexOf("Description")
  };

  let nextColumn =
    headers.length === 1 && headers[0] === ""
      ? 0
      : headers.length;

  SETTINGS_HEADERS.forEach(function(header) {

    if (headers.indexOf(header) !== -1)
      return;

    sheet
      .getRange(1, nextColumn + 1)
      .setValue(header);

    if (header === "Key")
      columns.key = nextColumn;

    if (header === "Value")
      columns.value = nextColumn;

    if (header === "Description")
      columns.description = nextColumn;

    nextColumn++;

  });

  return columns;

}

function ensureDefaultSettings(sheet, columns) {

  const values =
    sheet
      .getDataRange()
      .getValues();

  const existingKeys = {};

  values
    .slice(1)
      .forEach(function(row) {

        const key =
        getSettingsString(row[columns.key]);

      if (key !== "")
        existingKeys[key] = true;

    });

  const rowsToAdd =
    DEFAULT_SETTINGS.filter(function(row) {

      return !existingKeys[row[0]];

    });

  if (rowsToAdd.length === 0)
    return;

  rowsToAdd.forEach(function(row) {

    const targetRow =
      sheet.getLastRow() + 1;

    sheet
      .getRange(targetRow, columns.key + 1)
      .setValue(row[0]);

    sheet
      .getRange(targetRow, columns.value + 1)
      .setValue(row[1]);

    sheet
      .getRange(targetRow, columns.description + 1)
      .setValue(row[2]);

  });

}

function getSettingsColumns(sheet) {

  const headers =
    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(function(header) {

        return getSettingsString(header);

      });

  return {
    key: headers.indexOf("Key"),
    value: headers.indexOf("Value"),
    description: headers.indexOf("Description")
  };

}

function getSettingsString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}
