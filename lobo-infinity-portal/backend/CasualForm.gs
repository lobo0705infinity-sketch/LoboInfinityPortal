
function createCasualSubmissionForm(responseSpreadsheetId) {
  const form = lifCreateBaseForm_(
    LIF_FORMS.FORM_TITLES.CASUAL,
    "Submit a completed casual Infinity game for portal lifetime analytics."
  );
  lifAddCommonGameFields_(form);
  return lifLinkForm_(form, responseSpreadsheetId);
}
