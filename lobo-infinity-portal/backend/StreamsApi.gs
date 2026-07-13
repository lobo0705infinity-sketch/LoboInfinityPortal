/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * StreamsApi.gs
 *
 * Spoiler-free streamed games API endpoint.
 *******************************************************/

const STREAM_HEADERS = [
  "Date",
  "Division",
  "Mission",
  "Player 1",
  "Player 1 Faction",
  "Player 2",
  "Player 2 Faction",
  "YouTube URL",
  "Featured",
  "Stream Title",
  "Streamer",
  "Platform",
  "Description",
  "Thumbnail URL",
  "Active"
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

        return (
          stream.youtubeUrl !== "" &&
          stream.active
        );

      })
      .sort(function(a, b) {

        if (a.featured !== b.featured)
          return a.featured ? -1 : 1;

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
          player1Faction: stream.player1Faction,
          player2: stream.player2,
          player2Faction: stream.player2Faction,
          youtubeUrl: stream.youtubeUrl,
          featured: stream.featured,
          title: stream.title,
          streamer: stream.streamer,
          platform: stream.platform,
          description: stream.description,
          thumbnailUrl: stream.thumbnailUrl,
          active: stream.active
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

  migrateLegacyStreamsSheet(sheet);
  ensureStreamsHeaders(sheet);

  return sheet;

}

function migrateLegacyStreamsSheet(sheet) {

  const lastColumn =
    Math.max(sheet.getLastColumn(), STREAM_HEADERS.length);

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0]
      .map(function(header) {

        return getStreamString(header);

      });

  const hasNewHeaders =
    STREAM_HEADERS.every(function(header, index) {

      return headers[index] === header;

    });

  const hasLegacyLayout =
    headers[0] === STREAM_HEADERS[0] &&
    headers[1] === STREAM_HEADERS[1] &&
    headers[2] === STREAM_HEADERS[2] &&
    headers[3] === STREAM_HEADERS[3] &&
    headers[4] === STREAM_HEADERS[5] &&
    headers[6] === STREAM_HEADERS[7] &&
    headers[7] === STREAM_HEADERS[8];

  if (
    !hasLegacyLayout ||
    hasNewHeaders ||
    sheet.getLastRow() <= 1
  )
    return;

  const rows =
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, STREAM_HEADERS.length)
      .getValues()
      .map(function(row) {

        return [
          row[0],
          row[1],
          row[2],
          row[3],
          "",
          row[4],
          "",
          row[6],
          row[7],
          "",
          "",
          "",
          "",
          "",
          true
        ];

      });

  sheet
    .getRange(2, 1, rows.length, STREAM_HEADERS.length)
    .setValues(rows);

}

function ensureStreamsHeaders(sheet) {

  sheet
    .getRange(1, 1, 1, STREAM_HEADERS.length)
    .setValues([STREAM_HEADERS]);

}

function getStreamColumns(headers) {

  return {
    date: getStreamColumn(headers, "Date"),
    division: getStreamColumn(headers, "Division"),
    mission: getStreamColumn(headers, "Mission"),
    player1: getStreamColumn(headers, "Player 1"),
    player1Faction: getStreamColumn(headers, "Player 1 Faction"),
    player2: getStreamColumn(headers, "Player 2"),
    player2Faction: getStreamColumn(headers, "Player 2 Faction"),
    youtubeUrl: getStreamColumn(headers, "YouTube URL"),
    featured: getStreamColumn(headers, "Featured"),
    title: getStreamColumn(headers, "Stream Title"),
    streamer: getStreamColumn(headers, "Streamer"),
    platform: getStreamColumn(headers, "Platform"),
    description: getStreamColumn(headers, "Description"),
    thumbnailUrl: getStreamColumn(headers, "Thumbnail URL"),
    active: getStreamColumn(headers, "Active")
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

  const stream = {
    sourceIndex: sourceIndex,
    sortDate: sortDate,
    date: formatStreamDate(rawDate, sortDate),
    division: getStreamString(row[columns.division]),
    mission: getStreamString(row[columns.mission]),
    player1: getStreamString(row[columns.player1]),
    player1Faction: canonicalizeArmyName(row[columns.player1Faction]),
    player2: getStreamString(row[columns.player2]),
    player2Faction: canonicalizeArmyName(row[columns.player2Faction]),
    youtubeUrl: getStreamYoutubeUrl(row, columns.youtubeUrl),
    featured: getStreamBoolean(row[columns.featured]),
    title: getStreamString(row[columns.title]),
    streamer: getStreamString(row[columns.streamer]),
    platform: getStreamString(row[columns.platform]),
    description: getStreamString(row[columns.description]),
    thumbnailUrl: getStreamString(row[columns.thumbnailUrl]),
    active: getStreamActiveBoolean(row[columns.active])
  };

  return enrichStreamFromRecentGames(stream);

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

function getStreamYoutubeUrl(row, preferredColumn) {

  const preferred =
    getStreamString(row[preferredColumn]);

  if (isStreamYoutubeUrl(preferred))
    return preferred;

  for (
    let index = 0;
    index < row.length;
    index++
  ) {

    const value =
      getStreamString(row[index]);

    if (isStreamYoutubeUrl(value))
      return value;

  }

  return preferred;

}

function isStreamYoutubeUrl(value) {

  return (
    value.indexOf("youtube.com/watch") !== -1 ||
    value.indexOf("youtube.com/live") !== -1 ||
    value.indexOf("youtube.com/embed") !== -1 ||
    value.indexOf("youtube.com/shorts") !== -1 ||
    value.indexOf("youtu.be/") !== -1
  );

}

function enrichStreamFromRecentGames(stream) {

  if (
    stream.player1Faction !== "" &&
    stream.player2 !== "" &&
    stream.player2Faction !== ""
  )
    return stream;

  const matchingGame =
    getAllRecentGameObjects()
      .filter(function(game) {

        return (
          game.date === stream.date &&
          game.mission === stream.mission &&
          (
            game.winner === stream.player1 ||
            game.loser === stream.player1 ||
            game.winner === stream.player2 ||
            game.loser === stream.player2
          )
        );

      })[0];

  if (!matchingGame)
    return stream;

  const playerOneIsWinner =
    matchingGame.winner === stream.player1;

  const playerOneIsLoser =
    matchingGame.loser === stream.player1;

  if (playerOneIsWinner) {

    stream.player1Faction =
      matchingGame.winnerFaction;

    stream.player2 =
      matchingGame.loser;

    stream.player2Faction =
      matchingGame.loserFaction;

  }
  else if (playerOneIsLoser) {

    stream.player1Faction =
      matchingGame.loserFaction;

    stream.player2 =
      matchingGame.winner;

    stream.player2Faction =
      matchingGame.winnerFaction;

  }

  return stream;

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

function getStreamActiveBoolean(value) {

  const text =
    getStreamString(value)
      .toLowerCase();

  return !(
    text === "false" ||
    text === "no" ||
    text === "0" ||
    text === "hidden" ||
    text === "inactive" ||
    text === "archived"
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
