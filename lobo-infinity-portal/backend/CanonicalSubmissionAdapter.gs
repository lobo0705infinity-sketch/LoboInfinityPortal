function createSubmissionCommand(adapter) {
  const input = adapter || {};

  if (input.source === "google-form")
    return {
      source: "google-form",
      workflow: input.workflow,
      namedValues: input.namedValues,
      timestamp: input.timestamp,
      targetSpreadsheet: input.targetSpreadsheet,
      importLog: input.importLog,
      responseKey: input.responseKey
    };

  return {
    source: "portal",
    workflow: input.workflow,
    params: input.params,
    auth: input.auth,
    commissionerContext: input.commissionerContext
  };
}
