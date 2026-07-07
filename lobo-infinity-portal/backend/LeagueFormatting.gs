/*******************************************************
 * LOBO INFINITY LEAGUE 3.0
 * LeagueFormatting.gs
 *
 * Central presentation helpers for league scores and
 * common league display values.
 *******************************************************/

const LEAGUE_SCORE_TYPE = {
  TP: "TP",
  OP: "OP",
  VP: "VP"
};

function formatObjectiveScore(game) {

  return formatLeagueScore(
    game,
    LEAGUE_SCORE_TYPE.OP
  );

}

function formatVictoryScore(game) {

  return formatLeagueScore(
    game,
    LEAGUE_SCORE_TYPE.VP
  );

}

function formatTournamentScore(game) {

  return formatLeagueScore(
    game,
    LEAGUE_SCORE_TYPE.TP
  );

}

function formatGameSummary(game) {

  const result =
    formatLeagueResult(game);

  return (
    result.winner +
    " defeated " +
    result.loser +
    "\non " +
    result.mission +
    "\n" +
    result.op
  );

}

function formatLeagueResult(game) {

  return {
    winner:
      getLeagueFormatValue(game.winnerDisplayName) ||
      getLeagueFormatValue(game.winner),
    loser:
      getLeagueFormatValue(game.loserDisplayName) ||
      getLeagueFormatValue(game.loser),
    mission: getLeagueFormatValue(game.mission),
    division: getLeagueFormatValue(game.division),
    tp: formatTournamentScore(game),
    op: formatObjectiveScore(game),
    vp: formatVictoryScore(game)
  };

}

function formatLeagueScore(game, scoreType) {

  const type =
    getLeagueScoreType(scoreType);

  return (
    getLeagueFormatValue(
      game[
        type.toLowerCase()
      ]
    ) +
    " " +
    type
  );

}

function formatPercentage(value) {

  const numberValue =
    Number(value) || 0;

  return numberValue + "%";

}

function formatRank(value) {

  const rank =
    Number(value) || 0;

  return rank > 0
    ? "#" + rank
    : "Unranked";

}

function formatRecord(wins, losses) {

  return (
    (Number(wins) || 0) +
    "-" +
    (Number(losses) || 0)
  );

}

function formatStreak(value) {

  return getLeagueFormatValue(value);

}

function formatDivision(value) {

  return getLeagueFormatValue(value);

}

function formatDate(value) {

  return getLeagueFormatValue(value);

}

function formatRelativeTime(value) {

  return getLeagueFormatValue(value);

}

function getLeagueScoreType(scoreType) {

  const type =
    getLeagueFormatValue(scoreType)
      .toUpperCase();

  if (
    type === LEAGUE_SCORE_TYPE.TP ||
    type === LEAGUE_SCORE_TYPE.OP ||
    type === LEAGUE_SCORE_TYPE.VP
  )
    return type;

  return LEAGUE_SCORE_TYPE.OP;

}

function getLeagueFormatValue(value) {

  return String(
    value === undefined ||
    value === null
      ? ""
      : value
  ).trim();

}
