/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * StreamsApi.gs
 *
 * Streamed games API endpoint.
 *******************************************************/

const STREAM_HEADERS = [
  "Date",
  "Division",
  "Mission",
  "Player 1",
  "Player 2",
  "Winner",
  "YouTube URL",
  "Featured",
  "Notes"
];

function getStreams() {

  const sheet =
    ensureStreamsSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return jsonOutput({
      success: true,
      streams: []
    });

  const headers =
    values.shift();

  const columns =
    getStreamColumns(headers);

  const streams =
    values
      .map(function(row, index) {

        return buildStream(
          row,
          index + 1,
          columns
        );

      })
      .filter(function(stream) {

        return stream.youtubeUrl !== "";

      })
      .sort(function(a, b) {

        const dateOrder =
          b.sortDate.getTime() -
          a.sortDate.getTime();

        if (dateOrder !== 0)
          return dateOrder;

        return (
          b.sourceIndex -
          a.sourceIndex
        );

      })
      .map(function(stream, index) {

        return {
          id: index + 1,
          date: stream.date,
          division: stream.division,
          mission: stream.mission,
          player1: stream.player1,
          player2: stream.player2,
          winner: stream.winner,
          youtubeUrl: stream.youtubeUrl,
          featured: stream.featured,
          notes: stream.notes
        };

      });

  return jsonOutput({
    success: true,
    streams: streams
  });

}

function ensureStreamsSheet() {

  const spreadsheet =
    SpreadsheetApp.getActive();

  let sheet =
    spreadsheet.getSheetByName(CONFIG.SHEETS.STREAMS);

  if (!sheet)
    sheet =
      spreadsheet.insertSheet(CONFIG.SHEETS.STREAMS);

  const headerRange =
    sheet.getRange(1, 1, 1, STREAM_HEADERS.length);

  const headers =
    headerRange.getValues()[0];

  const hasHeaders =
    STREAM_HEADERS.every(function(header, index) {

      return headers[index] === header;

    });

  if (!hasHeaders)
    headerRange.setValues([STREAM_HEADERS]);

  return sheet;

}

function getStreamColumns(headers) {

  return {
    date: getStreamColumn(headers, "Date"),
    division: getStreamColumn(headers, "Division"),
    mission: getStreamColumn(headers, "Mission"),
    player1: getStreamColumn(headers, "Player 1"),
    player2: getStreamColumn(headers, "Player 2"),
    winner: getStreamColumn(headers, "Winner"),
    youtubeUrl: getStreamColumn(headers, "YouTube URL"),
    featured: getStreamColumn(headers, "Featured"),
    notes: getStreamColumn(headers, "Notes")
  };

}

function buildStream(
  row,
  sourceIndex,
  columns
) {

  const rawDate =
    row[columns.date];

  const sortDate =
    getStreamDate(rawDate);

  return {
    sourceIndex: sourceIndex,
    sortDate: sortDate,
    date: formatStreamDate(rawDate, sortDate),
    division: getStreamString(row[columns.division]),
    mission: getStreamString(row[columns.mission]),
    player1: getStreamString(row[columns.player1]),
    player2: getStreamString(row[columns.player2]),
    winner: getStreamString(row[columns.winner]),
    youtubeUrl: getStreamString(row[columns.youtubeUrl]),
    featured: getStreamBoolean(row[columns.featured]),
    notes: getStreamString(row[columns.notes])
  };

}

function getStreamColumn(headers, label) {

  return headers.indexOf(label);

}

function getStreamString(value) {

  if (
    value === null ||
    value === undefined
  )
    return "";

  return String(value).trim();

}

function getStreamBoolean(value) {

  const text =
    getStreamString(value).toLowerCase();

  return (
    value === true ||
    text === "true" ||
    text === "yes" ||
    text === "y" ||
    text === "featured"
  );

}

function getStreamDate(value) {

  if (
    Object.prototype.toString.call(value) ===
    "[object Date]"
  )
    return value;

  const parsed =
    new Date(value);

  if (!isNaN(parsed.getTime()))
    return parsed;

  return new Date(0);

}

function formatStreamDate(
  rawDate,
  sortDate
) {

  if (
    Object.prototype.toString.call(rawDate) ===
    "[object Date]"
  )
    return Utilities.formatDate(
      sortDate,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  return getStreamString(rawDate);

}
