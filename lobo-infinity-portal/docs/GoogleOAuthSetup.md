# Google OAuth Setup for Lobo Infinity Portal

This is the only manual setup required after Version 1.2.3. No code changes are needed after these values are entered.

## 1. Create the OAuth Client

1. Open `https://console.cloud.google.com/`.
2. Select the Google Cloud project used for the Lobo Infinity League.
3. Open `APIs & Services`.
4. Open `OAuth consent screen`.
5. Choose `External` unless all users are inside one Google Workspace.
6. Enter the app name: `Lobo Infinity Portal`.
7. Enter the support email.
8. Enter the developer contact email.
9. Save and continue through Scopes.
10. Open `APIs & Services` -> `Credentials`.
11. Click `Create Credentials`.
12. Choose `OAuth client ID`.
13. Application type: `Web application`.
14. Name: `Lobo Infinity Portal Web`.

## 2. Authorized JavaScript Origins

Add these origins:

1. `https://lobo-infinity-portal.vercel.app`
2. `https://lobo-infinity-portal-lobo0705infinity-5309s-projects.vercel.app`
3. `http://localhost:5173`

Do not add a trailing slash.

## 3. Authorized Redirect URIs

Google Identity Services ID-token sign-in does not require a redirect URI for this portal. If Google Cloud requires at least one redirect URI, add:

1. `https://lobo-infinity-portal.vercel.app`

## 4. Copy the Client ID

1. Click the OAuth client you created.
2. Copy `Client ID`.
3. No client secret is used by this implementation.

## 5. Vercel Environment Variable

Use this when you want the frontend to know the Client ID at build time.

1. Open Vercel.
2. Open the `lobo-infinity-portal` project.
3. Go to `Settings`.
4. Go to `Environment Variables`.
5. Add:
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Value: the Google OAuth Client ID
   - Environments: Production, Preview, Development
6. Save.
7. Redeploy the latest production deployment.

If both Vercel and the Settings sheet contain a Client ID, the frontend uses `VITE_GOOGLE_CLIENT_ID`.

## 6. Settings Sheet

The portal supports either `VITE_GOOGLE_CLIENT_ID` or the Settings sheet key `googleOAuthClientId`. If both are set, `VITE_GOOGLE_CLIENT_ID` wins.

1. Open the league Google Sheet.
2. Open the `Settings` tab.
3. Find or add key: `googleOAuthClientId`.
4. Paste the OAuth Client ID in `Value` if you are not using Vercel `VITE_GOOGLE_CLIENT_ID`.
5. Find or add key: `commissionerEmails`.
6. Enter commissioner Google emails, comma-separated.
   Example: `commissioner@gmail.com,assistant@gmail.com`

## 7. Users Sheet

The portal creates the `Users` sheet automatically. It must include:

- Google Email
- Display Name
- Role
- Enabled
- Favorite Faction
- Avatar URL
- Created
- Last Login
- Last Seen
- Notification Preferences
- Theme Preference

New unknown users are created as disabled League Members unless their email is listed in `commissionerEmails`. Enable members by setting `Enabled` to `TRUE`.

## 8. Test Procedure

1. Visit `https://lobo-infinity-portal.vercel.app`.
2. Click `Sign in with Google`.
3. Choose the commissioner Google account.
4. Confirm the header shows avatar and display name.
5. Open `My Profile`.
6. Confirm email, role, avatar, and preferences load.
7. Open `Commissioner Dashboard`.
8. Confirm Season Control, League Audit, and Cache Management are visible.
9. Sign out from the profile menu.
10. Refresh the page.
11. Confirm the user remains signed out.
12. Sign in again.
13. Refresh the page.
14. Confirm the session restores.
15. Submit an army list.
16. Confirm it appears in the Commissioner approval queue.
17. Vote on an army list.
18. Confirm `Votes Cast` increases in My Profile.
19. Dismiss a notification.
20. Refresh and confirm the dismissed notification does not reappear.

## Troubleshooting

- Missing Client ID: the header shows Guest / OAuth pending.
- Invalid token: sign out and sign in again after verifying `googleOAuthClientId`.
- Disabled user: set `Enabled` to `TRUE` in `Users`.
- Unknown email: add the user to `Users` or let first sign-in create the disabled row, then enable it.
- Permission denied: set the correct Role in `Users`.
