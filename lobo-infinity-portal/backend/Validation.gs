
function lifValidateSubmission_(submission) {
  const errors = [];
  const required = ["mission", "player", "opponent", "playerFaction", "opponentFaction",
    "playerArmyCode", "opponentArmyCode", "gameResult", "firstTurn"];
  required.forEach(function(key) {
    if (!String(submission[key] || "").trim()) errors.push(key + " is required.");
  });
  if (lifNormalize_(submission.player) === lifNormalize_(submission.opponent))
    errors.push("Player and opponent must be different.");
  ["playerTp", "opponentTp", "playerOp", "opponentOp", "playerVp", "opponentVp"]
    .forEach(function(key) {
      const value = Number(submission[key]);
      if (!Number.isInteger(value) || value < 0) errors.push(key + " must be a non-negative whole number.");
    });
  if (Number(submission.playerTp) + Number(submission.opponentTp) > 10)
    errors.push("Tournament Points cannot total more than 10.");
  if (["Player Victory", "Opponent Victory", "Draw"].indexOf(submission.gameResult) < 0)
    errors.push("Game Result is invalid.");
  if (["Player", "Opponent"].indexOf(submission.firstTurn) < 0)
    errors.push("First Turn is invalid.");
  return errors;
}

function lifNormalize_(value) {
  return String(value || "").trim().toLowerCase();
}

function lifNormalizeArmyCode_(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[-_]/g, "");
}

function lifDetermineWinner_(submission) {
  if (submission.gameResult === "Draw") return "Draw";
  return submission.gameResult === "Player Victory" ? submission.player : submission.opponent;
}
