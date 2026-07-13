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
  "Submitter Email"
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
  SUBMITTER_EMAIL: 13
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
        ? auth.user.leaguePlayer
        : ""
    );

  const faction =
    canonicalizeArmyParentFaction(
      getApiParameter(parameters, "faction")
    );

  const sectorial =
    canonicalizeArmyName(
      getApiParameter(parameters, "sectorial")
    );

  const armyName =
    getApiParameter(parameters, "armyName");

  if (
    !player ||
    !faction ||
    !armyName
  )
    return jsonOutput({
      success: false,
      error: "Player, faction, and army name are required."
    });

  const sheet =
    getArmyListSheet();

  sheet.appendRow([
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    ),
    player,
    faction,
    sectorial,
    getApiParameter(parameters, "mission"),
    getApiParameter(parameters, "event"),
    getApiParameter(parameters, "armyCode"),
    getApiParameter(parameters, "armyLink"),
    armyName,
    getApiParameter(parameters, "description"),
    0,
    0,
    false,
    auth.authenticated
      ? auth.user.email
      : getApiParameter(parameters, "submitterEmail")
  ]);

  invalidatePortalCacheGroup("armyLists");

  if (typeof evaluateAchievementsForPlayer === "function")
    evaluateAchievementsForPlayer(player);

  return jsonOutput({
    success: true
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
      )
  };

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
