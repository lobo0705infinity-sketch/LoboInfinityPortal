function buildCanonicalGameRow(command) {
  const input = command || {};
  const player = canonicalGameString_(input.player);
  const opponent = canonicalGameString_(input.opponent);
  const outcome = canonicalGameOutcome_(input);
  const playerIsWinner = outcome !== "opponent";
  const canonicalizeFactions = input.canonicalizeFactions !== false;
  const playerFaction = canonicalizeFactions && typeof canonicalizeArmyName === "function"
    ? canonicalizeArmyName(input.playerFaction)
    : canonicalGameString_(input.playerFaction);
  const opponentFaction = canonicalizeFactions && typeof canonicalizeArmyName === "function"
    ? canonicalizeArmyName(input.opponentFaction)
    : canonicalGameString_(input.opponentFaction);
  const playerArmyCode = canonicalGameArmyCode_(input.playerArmyCode);
  const opponentArmyCode = canonicalGameArmyCode_(input.opponentArmyCode);
  const playerArmyListId = canonicalGameArmyListId_(input, "playerArmyListId", playerArmyCode);
  const opponentArmyListId = canonicalGameArmyListId_(input, "opponentArmyListId", opponentArmyCode);

  return [
    canonicalGameTimestamp_(input),
    canonicalGameString_(input.division),
    canonicalGameDate_(input),
    canonicalGameString_(input.mission),
    player,
    opponent,
    Number(input.playerTp),
    Number(input.opponentTp),
    Number(input.playerOp),
    Number(input.opponentOp),
    Number(input.playerVp),
    Number(input.opponentVp),
    canonicalGameFirstTurn_(input, player, opponent),
    playerIsWinner ? playerFaction : opponentFaction,
    playerIsWinner ? opponentFaction : playerFaction,
    canonicalGameString_(input.bestMoment),
    canonicalGameString_(input.eventId),
    canonicalGameString_(input.gameType) || "league",
    canonicalGameResult_(input, outcome, player, opponent),
    playerArmyCode,
    opponentArmyCode,
    playerIsWinner ? playerArmyListId : opponentArmyListId,
    playerIsWinner ? opponentArmyListId : playerArmyListId
  ];
}

function canonicalGameResult_(command, outcome, player, opponent) {
  if (command.gameResultMode === "winner-name") {
    if (outcome === "draw")
      return "Draw";

    return outcome === "player"
      ? player
      : opponent;
  }

  if (outcome === "draw")
    return "Draw";

  return outcome === "player"
    ? "Player 1 Victory"
    : "Player 2 Victory";
}

function canonicalGameOutcome_(command) {
  const explicit = canonicalGameString_(command.outcome).toLowerCase();

  if (explicit === "draw" || explicit === "player" || explicit === "opponent")
    return explicit;

  if (command.gameResult === "Draw")
    return "draw";

  return command.gameResult === "Player Victory"
    ? "player"
    : "opponent";
}

function canonicalGameTimestamp_(command) {
  if (canonicalGameHasOwn_(command, "timestamp"))
    return command.timestamp;

  return canonicalGameFormatDate_(new Date(), "yyyy-MM-dd HH:mm:ss");
}

function canonicalGameDate_(command) {
  if (canonicalGameHasOwn_(command, "date"))
    return command.date;

  return canonicalGameFormatDate_(new Date(), "yyyy-MM-dd");
}

function canonicalGameFirstTurn_(command, player, opponent) {
  const firstTurn = canonicalGameString_(command.firstTurn);

  if (command.firstTurnMode === "legacy-casual")
    return firstTurn === "Player" ? player : opponent;

  if (command.firstTurnMode !== "canonical")
    return firstTurn;

  const normalized = canonicalGameNormalize_(firstTurn);

  if (normalized === "player" || normalized === canonicalGameNormalize_(player))
    return player;

  if (normalized === "opponent" || normalized === canonicalGameNormalize_(opponent))
    return opponent;

  return firstTurn;
}

function canonicalGameArmyCode_(value) {
  return canonicalGameString_(value)
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");
}

function canonicalGameArmyListId_(command, key, armyCode) {
  if (canonicalGameHasOwn_(command, key))
    return command[key];

  if (command.deriveArmyListIds === false || !armyCode || typeof buildCanonicalArmyCodeArmyListId !== "function")
    return "";

  return String(buildCanonicalArmyCodeArmyListId(armyCode));
}

function canonicalGameFormatDate_(date, format) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), format);
}

function canonicalGameString_(value) {
  return String(value || "").trim();
}

function canonicalGameNormalize_(value) {
  return canonicalGameString_(value).toLowerCase();
}

function canonicalGameHasOwn_(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
