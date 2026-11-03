/** Private machine-to-machine list resolution and accepted-game receipts. */
function resolveListExchangeSubmission_(command) {
  const params = command.params || {};
  const code = normalizeListExchangeReportCode_(params.listExchangeCode);
  if (!code) return;
  const token = PropertiesService.getScriptProperties().getProperty("ARMY_INTELLIGENCE_WORKER_TOKEN");
  if (!token) throw new Error("Private list exchange verification is not configured.");
  const response = UrlFetchApp.fetch("https://loboinfinityportal-production.up.railway.app/list-exchange/resolve", {
    method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ code: code, players: [params.player, params.opponent], submittedAt: params.listExchangeSubmittedAt == null ? Date.now() : Number(params.listExchangeSubmittedAt) }), muteHttpExceptions: true
  });
  let result;
  try { result = JSON.parse(response.getContentText()); } catch (error) { throw new Error("Private list exchange verification is unavailable."); }
  if (response.getResponseCode() !== 200 || !result || result.success !== true || !Array.isArray(result.armyCodes) ||
      result.armyCodes.length !== 2 || result.armyCodes.some(function(value) { return typeof value !== "string" || !value; }))
    throw new Error("The LLH game code must match two locked lists and the exact portal player names.");
  // The backend receives committed codes directly. The submitter never needs
  // to see or enter the opponent's private list to report the result.
  params.player1ArmyCode = result.armyCodes[0]; params.player2ArmyCode = result.armyCodes[1];
  params.playerArmyCode = result.armyCodes[0]; params.opponentArmyCode = result.armyCodes[1];
  params.listExchangeCode = code; command.params = params;
}

function getListExchangeReports(e) {
  if (!isAuthorizedArmyIntelligenceWorkerRequest(e))
    return jsonOutput({ success: false, error: "Background worker authentication is required." });
  const params = getApiParameters(e);
  let codes;
  try { codes = JSON.parse(String(params.codes || "[]")); }
  catch (error) { return jsonOutput({ success: false, error: "Invalid game codes." }); }
  if (!Array.isArray(codes) || codes.length > 50 || codes.some(function(code) {
    return typeof code !== "string" || !/^LLH-[A-F0-9]{16}$/.test(code);
  })) return jsonOutput({ success: false, error: "Invalid game codes." });
  if (!codes.length) return jsonOutput({ success: true, reports: [] });
  const sheet = lifGetTargetSpreadsheet_().getSheetByName(CONFIG.SHEETS.FORM);
  if (!sheet) return jsonOutput({ success: false, error: "Game receipts are unavailable." });
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift() || [];
  if (headers[28] !== "LLH List Exchange Code" || headers[29] !== "LLH Report Submitted At")
    return jsonOutput({ success: true, reports: [] });
  const reports = rows.filter(function(row) { return codes.indexOf(row[28]) >= 0; }).map(function(row) {
    return { code: row[28], id: "portal:" + canonicalGameId_(row, 0), players: [String(row[FORM.PLAYER1] || ""), String(row[FORM.PLAYER2] || "")],
      submittedAt: Number(row[29]), accepted: Number(row[25]) > 0 && validateGame(row) === true };
  });
  return jsonOutput({ success: true, reports: reports });
}

// Run once after deploying both services. Update only the exchange question
// and the two Army Code requirements; retain question IDs and destinations.
function installListExchangeFormFields() {
  return ["LEAGUE_FORM_ID", "TEAM_FORM_ID", "CASUAL_FORM_ID", "TOP40_FORM_ID"].map(function(key) {
    const form = FormApp.openById(lifRequireProperty_(LIF_FORMS.PROPERTIES[key]));
    ensureListExchangeFormField_(form);
    return { formId: form.getId(), url: form.getPublishedUrl() };
  });
}

function ensureListExchangeFormField_(form) {
  const title = "LLH Game Code";
  const found = form.getItems().filter(function(item) { return item.getTitle() === title; });
  if (found.length > 1 || (found.length && String(found[0].getType()) !== String(FormApp.ItemType.TEXT)))
    throw new Error("LLH Game Code question is ambiguous; no questions were removed.");
  const codeItems = [LIF_FORMS.FIELDS.PLAYER_ARMY_CODE, LIF_FORMS.FIELDS.OPPONENT_ARMY_CODE].map(function(codeTitle) {
    const items = form.getItems(FormApp.ItemType.TEXT).filter(function(item) { return item.getTitle() === codeTitle; });
    if (items.length !== 1) throw new Error("Expected one Army Code question per player.");
    return items[0].asTextItem();
  });
  const field = found.length ? found[0].asTextItem() : form.addTextItem().setTitle(title);
  field.setRequired(false).setHelpText("Optional: if both players locked lists with LLH, enter the game code here and leave both Army Code fields blank. Otherwise enter both Army Codes. LLH exchanges locked lists after the game is accepted.");
  field.setValidation(FormApp.createTextValidation().requireTextMatchesPattern("[Ll][Ll][Hh]-[A-Fa-f0-9]{16}").build());
  codeItems.forEach(function(item) { item.setRequired(false).setHelpText("Required unless you provide an LLH Game Code for two locked lists."); });
}
