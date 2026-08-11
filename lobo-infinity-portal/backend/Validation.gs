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
