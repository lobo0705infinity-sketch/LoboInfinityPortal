/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * CommissionerNews.gs
 *
 * Commissioner news endpoint.
 *******************************************************/

const NEWS_LIMIT = 5;

function getCommissionerNews() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet)
    return jsonOutput({
      success: true,
      news: []
    });

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (values.length <= 1)
    return jsonOutput({
      success: true,
      news: []
    });

  const headers =
    values.shift()
      .map(function(header) {

        return String(header).trim();

      });

  const columns =
    getNewsColumns(headers);

  const news =
    values
      .map(function(row, index) {

        return buildNewsItem(
          row,
          index + 1,
          columns
        );

      })
      .filter(function(item) {

        return (
          item.title !== "" &&
          item.body !== ""
        );

      })
      .sort(function(a, b) {

        return (
          getRecentGameDate(b.date).getTime() -
          getRecentGameDate(a.date).getTime()
        );

      })
      .slice(0, NEWS_LIMIT);

  return jsonOutput({
    success: true,
    news: news
  });

}

function getNewsColumns(headers) {

  return {
    title:
      getNewsColumn(
        headers,
        ["Title", "News Title", "Headline"]
      ),
    body:
      getNewsColumn(
        headers,
        ["Body", "Message", "Content"]
      ),
    date:
      getNewsColumn(
        headers,
        ["Date", "Published", "Timestamp"]
      ),
    link:
      getNewsColumn(
        headers,
        ["Link", "Url", "URL"]
      )
  };

}

function getNewsColumn(headers, labels) {

  for (
    let index = 0;
    index < labels.length;
    index++
  ) {

    const column =
      headers.indexOf(labels[index]);

    if (column !== -1)
      return column;

  }

  return -1;

}

function buildNewsItem(row, sourceIndex, columns) {

  const rawDate =
    columns.date === -1
      ? ""
      : row[columns.date];

  const sortDate =
    getRecentGameDate(rawDate);

  return {
    id: sourceIndex,
    title:
      columns.title === -1
        ? ""
        : getRecentGameString(
            row[columns.title]
          ),
    body:
      columns.body === -1
        ? ""
        : getRecentGameString(
            row[columns.body]
          ),
    date:
      rawDate === ""
        ? ""
        : formatRecentGameDate(
            rawDate,
            sortDate
          ),
    link:
      columns.link === -1
        ? ""
        : getRecentGameString(
            row[columns.link]
          )
  };

}
