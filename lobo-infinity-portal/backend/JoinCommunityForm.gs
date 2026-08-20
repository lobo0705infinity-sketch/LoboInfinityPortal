function createJoinCommunityForm(responseSpreadsheetId) {
  const form = lifGetJoinCommunityFormForInstallation_();

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

  lifEnsureJoinCommunityFormDestination_(form, responseSpreadsheetId);

  return form;
}

function lifGetJoinCommunityFormForInstallation_() {
  const properties = lifGetProperties_();
  const existingId = String(
    properties.getProperty(LIF_FORMS.PROPERTIES.JOIN_FORM_ID) || ""
  ).trim();

  if (existingId)
    return FormApp.openById(existingId);

  const files = DriveApp.getFilesByName(LIF_FORMS.FORM_TITLES.JOIN);

  while (files.hasNext()) {
    const file = files.next();

    if (file.getMimeType() !== MimeType.GOOGLE_FORMS)
      continue;

    const form = FormApp.openById(file.getId());
    properties.setProperty(LIF_FORMS.PROPERTIES.JOIN_FORM_ID, form.getId());
    return form;
  }

  const form = FormApp.create(LIF_FORMS.FORM_TITLES.JOIN);
  properties.setProperty(LIF_FORMS.PROPERTIES.JOIN_FORM_ID, form.getId());
  return form;
}

function lifEnsureJoinCommunityFormDestination_(form, responseSpreadsheetId) {
  let destinationId = "";

  try {
    destinationId = String(form.getDestinationId() || "").trim();
  }
  catch (err) {
    if (String(err).toLowerCase().indexOf("no response destination") === -1)
      throw err;
  }

  if (destinationId !== responseSpreadsheetId)
    lifLinkForm_(form, responseSpreadsheetId);
}
