
function createTeamTournamentSubmissionForm(responseSpreadsheetId) {
  const f = LIF_FORMS.FIELDS;
  const form = lifCreateBaseForm_(
    LIF_FORMS.FORM_TITLES.TEAM,
    "Submit an individual table result for a Lobo Infinity Team Tournament."
  );
  form.addSectionHeaderItem().setTitle("Tournament Match Information");
  lifAddText_(form, f.EVENT_ID, true);
  lifAddText_(form, f.ROUND, true);
  lifAddText_(form, f.TEAM, true);
  lifAddText_(form, f.OPPONENT_TEAM, true);
  lifAddText_(form, f.TABLE, true);
  lifAddCommonGameFields_(form);
  return lifLinkForm_(form, responseSpreadsheetId);
}
