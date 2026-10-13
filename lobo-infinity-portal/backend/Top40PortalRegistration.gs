// Top 40's existing registration form also joins the public portal registry.
// This creates Players records only, never login credentials or Users records.
const TOP40_PORTAL_REGISTRATION_TYPE = "top-40-registration";
const TOP40_PORTAL_REGISTRATION_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfCyQ-oaLlZf8-utdWm0Y2iWrU8QZiHLVBhWzmxaCUZj2cMqg/viewform";

function isTop40PortalRegistrationSheet_(sheet) {
  return !!sheet && sheet.getName() === PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET &&
    sheet.getParent().getId() === lifGetTargetSpreadsheet_().getId();
}

function handleTop40RegistrationFormSubmit(e) {
  if (!e || !e.range) throw new Error("A spreadsheet form-submit event is required.");
  const sheet = e.range.getSheet();
  if (!isTop40PortalRegistrationSheet_(sheet)) return { ignored: true };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const result = importTop40PortalRegistrationRow_(sheet, e.range.getRow(), lifEnsureImportLog_(lifGetTargetSpreadsheet_()));
    if (result.created) syncTop40PortalPlayerChoices_();
    return result;
  } finally { lock.releaseLock(); }
}

function readTop40PortalHandle_(headers, values) {
  const aliases = PUBLIC_SNAPSHOT_TOP40_PORTAL_NAME_HEADERS.map(normalizePublicSnapshotTop40Header_);
  const indices = [];
  headers.forEach(function(header, index) {
    if (aliases.indexOf(normalizePublicSnapshotTop40Header_(header)) >= 0) indices.push(index);
  });
  if (!indices.length) throw new Error("Top 40 registration is missing its portal handle field.");
  const handles = indices.map(function(index) { return String(values[index] || "").trim(); }).filter(Boolean);
  if (new Set(handles.map(function(handle) { return handle.toLowerCase(); })).size > 1)
    throw new Error("Conflicting portal handles in the registration response.");
  const handle = handles[0] || "";
  if (!handle) throw new Error("Enter a public portal handle to register.");
  if (handle.length > 80 || /^[=]/.test(handle) || /[\u0000-\u001f\u007f]/.test(handle))
    throw new Error("Portal handles must be plain text, at most 80 characters.");
  return handle;
}

function importTop40PortalRegistrationRow_(sheet, rowNumber, log) {
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow())
    throw new Error("Invalid Top 40 response row.");
  const key = "top40-registration-player:" + sheet.getSheetId() + ":" + rowNumber;
  if (lifWasImported_(log, key)) return { alreadyProcessed: true };
  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, width).getDisplayValues()[0];
  let handle, existing;
  try {
    handle = readTop40PortalHandle_(headers, values);
    existing = findTop40ExistingPortalPlayer_(handle);
  }
  catch (error) {
    lifWriteImportLog_(log, key, TOP40_PORTAL_REGISTRATION_TYPE, rowNumber, "Rejected", error.message);
    return { rejected: true, responseRow: rowNumber };
  }
  const result = existing || createCanonicalPlayer(handle);
  if (!result.success && !result.duplicate) throw new Error("Portal player registration failed.");
  lifWriteImportLog_(log, key, TOP40_PORTAL_REGISTRATION_TYPE, result.row || "", result.duplicate ? "Duplicate" : "Imported",
    result.duplicate ? "Existing portal player retained; no profile changes." : "Top 40 registration created an active portal player.");
  return { created: !result.duplicate, existing: !!result.duplicate, responseRow: rowNumber };
}

function findTop40ExistingPortalPlayer_(handle) {
  const sheet = lifGetTargetSpreadsheet_().getSheetByName(CONFIG.SHEETS.PLAYERS);
  if (!sheet) throw new Error("Players sheet not found.");
  const rows = sheet.getDataRange().getValues();
  const columns = getPlayerRegistryColumns(rows[0] || []);
  const submittedKey = String(handle).trim().toLowerCase();
  // Identity explicitly confirmed by the Commissioner on 2026-10-12.
  const confirmedAliases = { "snakes": "Snakes / Lucas" };
  const key = String(confirmedAliases[submittedKey] || handle).trim().toLowerCase();
  const normalize = function(value) { return String(value || "").trim().toLowerCase(); };
  const candidates = rows.slice(1).map(function(row, index) {
    return { name: String(row[columns.player] || "").trim(), display: String(row[columns.displayName] || "").trim(), row: index + 2 };
  }).filter(function(item) { return item.name; });
  const exact = candidates.filter(function(item) { return normalize(item.name) === key; });
  const matches = exact.length ? exact : candidates.filter(function(item) { return normalize(item.display) === key; });
  if (matches.length > 1) throw new Error("This display name matches multiple players. Enter your canonical portal handle.");
  return matches.length ? { success: false, duplicate: true, player: matches[0].name, row: matches[0].row } : null;
}

function syncTop40PortalPlayerChoices_() {
  if (typeof refreshCasualSubmissionForm !== "function") return;
  try { refreshCasualSubmissionForm(); }
  catch (error) { Logger.log("Top 40 portal registration saved; player-choice refresh needs retry."); }
}

function reconcileTop40PortalRegistrations() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const target = lifGetTargetSpreadsheet_();
    const sheet = target.getSheetByName(PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET);
    if (!sheet) throw new Error("Top 40 registration response sheet not found.");
    const log = lifEnsureImportLog_(target);
    const result = { created: 0, existing: 0, alreadyProcessed: 0, rejectedRows: [] };
    for (let row = 2; row <= sheet.getLastRow(); row += 1) {
      const imported = importTop40PortalRegistrationRow_(sheet, row, log);
      if (imported.created) result.created += 1;
      if (imported.existing) result.existing += 1;
      if (imported.alreadyProcessed) result.alreadyProcessed += 1;
      if (imported.rejected) result.rejectedRows.push(row);
    }
    if (typeof invalidatePlayerRegistryCache === "function") invalidatePlayerRegistryCache();
    if (result.created) syncTop40PortalPlayerChoices_();
    Logger.log("TOP40_PORTAL_REGISTRATION " + JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

function installTop40PortalRegistration() {
  const target = lifGetTargetSpreadsheet_();
  const sheet = target.getSheetByName(PUBLIC_SNAPSHOT_TOP40_REGISTRATION_SHEET);
  if (!sheet || !sheet.getFormUrl()) throw new Error("Top 40 registration form is not linked to its response sheet.");
  const form = FormApp.openByUrl(sheet.getFormUrl());
  if (form.getPublishedUrl().split("?")[0] !== TOP40_PORTAL_REGISTRATION_FORM_URL || form.getDestinationId() !== target.getId())
    throw new Error("The linked form is not the existing Top 40 registration form.");
  const aliases = PUBLIC_SNAPSHOT_TOP40_PORTAL_NAME_HEADERS.map(normalizePublicSnapshotTop40Header_);
  const fields = form.getItems().filter(function(item) { return aliases.indexOf(normalizePublicSnapshotTop40Header_(item.getTitle())) >= 0; });
  if (fields.length !== 1 || fields[0].getType() !== FormApp.ItemType.TEXT)
    throw new Error("Top 40 requires exactly one existing text field for the portal handle.");
  fields[0].asTextItem().setRequired(true).setHelpText("Already on the portal? Enter your existing player handle. New player? Choose your public handle here; this registration also creates your portal player record. No separate portal signup is needed.");
  const notice = "Registering also joins the Lobo Infinity Portal under the public player handle you provide. Existing player records are reused. Your email and Discord contact information are not added to your public player profile.";
  if (form.getDescription().indexOf(notice) < 0) form.setDescription(form.getDescription() + "\n\n" + notice);
  const confirmation = "Your registration also creates your portal player record, or links your existing handle. Public player listings update with the portal's scheduled refresh.";
  if (form.getConfirmationMessage().indexOf(confirmation) < 0) form.setConfirmationMessage(form.getConfirmationMessage() + "\n\n" + confirmation);
  const installed = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === "handleTop40RegistrationFormSubmit" && trigger.getTriggerSourceId() === target.getId();
  });
  if (!installed) ScriptApp.newTrigger("handleTop40RegistrationFormSubmit").forSpreadsheet(target).onFormSubmit().create();
  const reconciled = reconcileTop40PortalRegistrations();
  return { success: true, formUrl: form.getPublishedUrl(), handleRequired: true, triggerInstalled: true, reconciled: reconciled };
}
