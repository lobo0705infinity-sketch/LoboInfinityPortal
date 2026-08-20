function createJoinCommunityForm(responseSpreadsheetId) {
  const existingId = String(
    lifGetProperties_().getProperty(LIF_FORMS.PROPERTIES.JOIN_FORM_ID) || ""
  ).trim();
  const form = existingId
    ? FormApp.openById(existingId)
    : FormApp.create(LIF_FORMS.FORM_TITLES.JOIN);

  form.getItems().slice().reverse().forEach(function(item) {
    form.deleteItem(item);
  });

  form
    .setTitle(LIF_FORMS.FORM_TITLES.JOIN)
    .setDescription("Join the Lobo Infinity community with your public Infinity handle. This form creates a player record; it does not create a login account.")
    .setCollectEmail(false)
    .setConfirmationMessage("Welcome to the Lobo Infinity community. Your player record was submitted.")
    .setProgressBar(false)
    .setShowLinkToRespondAgain(false);

  lifAddText_(
    form,
    LIF_FORMS.FIELDS.PLAYER_HANDLE,
    true,
    "Enter the public Lobo/Infinity handle you use for games."
  );

  if (form.getDestinationId() !== responseSpreadsheetId)
    lifLinkForm_(form, responseSpreadsheetId);

  return form;
}
