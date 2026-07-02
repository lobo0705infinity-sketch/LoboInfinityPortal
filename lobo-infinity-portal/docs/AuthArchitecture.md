# Lobo Infinity Portal Authentication Architecture

## Authentication Flow

1. React loads Google Identity Services when a Google OAuth Client ID exists in `VITE_GOOGLE_CLIENT_ID` or the Settings sheet key `googleOAuthClientId`.
2. Google returns an ID token to the browser after sign in.
3. The API client stores the ID token locally for session restoration and sends it to Apps Script as `authToken`.
4. Apps Script verifies the token with Google tokeninfo and checks the token audience against the selected OAuth Client ID. The selected ID comes from `VITE_GOOGLE_CLIENT_ID` when present, otherwise the Settings sheet key `googleOAuthClientId`.
5. Apps Script looks up the verified email in the `Users` sheet.
6. Only enabled users receive an authenticated session.
7. The first verified user in an empty `Users` sheet is bootstrapped as enabled `Commissioner`.

## Authorization Flow

Privileged Apps Script endpoints call `requireApiPermission(e, permission, handler)`.

The helper verifies:

- A Google token is present.
- The token is valid.
- The user exists in `Users`.
- The user is enabled.
- The user's role satisfies the required permission.

Unauthorized requests return JSON with `success: false`, an error message, and the required role.

## Roles

- Guest
- League Member
- Assistant Commissioner
- Commissioner

## Permission Model

- Guests: read-only portal access.
- League Members: vote, submit army lists, update profile, manage their notification state.
- Assistant Commissioners: manage news, manage streams, approve/reject lists.
- Commissioners: modify settings, run cache tools, run audits, execute season control.

## Session Management

React stores the Google ID token under `lobo-google-id-token` for restoration. On page load the auth provider sends that token to `?action=session`. If the backend rejects the token or the user is disabled, the client clears the stored credential and returns to Guest mode.

## OAuth Configuration

1. Create a Google Cloud OAuth Web Client for the production domain.
2. Add the Vercel production domain to Authorized JavaScript origins.
3. Add the local development origin when needed, usually `http://localhost:5173`.
4. Enter the client ID in the Settings sheet as `googleOAuthClientId`, or expose it as `VITE_GOOGLE_CLIENT_ID` at build time.
5. If both exist, the frontend and backend token-audience check use `VITE_GOOGLE_CLIENT_ID`.
6. Enter comma-separated commissioner emails in Settings as `commissionerEmails`.
7. Redeploy the frontend after changing build-time environment variables.

No OAuth client secret is required for Google Identity Services ID-token sign in.
