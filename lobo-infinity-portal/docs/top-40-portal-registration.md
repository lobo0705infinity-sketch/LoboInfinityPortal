# Top 40 registration also joins the portal

Top 40 retains its existing Google registration form and uncapped event registration. A submitted public portal handle also creates an active record in Players, using the same canonical player-creation function as Join Community. Case-insensitive canonical handles and unique existing display-name matches reuse existing players without changing their profile, division, or active status. No login credentials or Users records are created. Email and Discord contact fields remain outside public player records.

The dedicated spreadsheet submission handler ignores unrelated sheets and spreadsheets. Script locking and the import log prevent duplicates from overlapping legacy and dedicated triggers or retries. Missing, conflicting, ambiguous display names, or formula-like handles are rejected and logged without guessing from contact details.

Activation: push the Apps Script source, then run `installTop40PortalRegistration` in the existing project. This verifies the current form URL and response destination, makes its existing portal-handle field required, adds an explanation and confirmation, installs one dedicated submission trigger if absent, and reconciles previous responses. Existing blank/invalid responses are reported by row number for manual correction. Run `reconcileTop40PortalRegistrations` again after correcting a rejected response or to retry processing. Existing successful responses remain idempotent.

Player creation invalidates the existing public player projections. Public lists appear with the portal's existing scheduled refresh; this change does not introduce another recurring job. The registration form's existing email and tournament-rules fields are retained.

Validation: `npm run test:top-40-portal-registration` and `npm run release:apps-script:syntax`. Activation is required in Apps Script; a GitHub/Vercel deployment alone does not install the trigger or update the Google Form.
