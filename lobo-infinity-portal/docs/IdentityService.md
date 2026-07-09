# Identity Service

Version 7.3.3 establishes the portal's unified identity layer across Google
OAuth, Apps Script session validation, Firebase Authentication, and Firestore
Rules.

Version 7.3.4 repairs the authentication bridge ordering. The portal now waits
for Apps Script session validation and Firebase Authentication synchronization
before Firestore Bootstrap runs read/write probes.

## Authority

During the Firestore migration window, Apps Script remains the authoritative
identity and permissions source.

The authoritative session contains:

- Google account email
- League player
- Player display name
- Role
- Portal permissions
- Session validation stage

Firebase Authentication is a synchronized consumer of that identity so
Firestore Security Rules can evaluate authenticated requests.

## Authentication Flow

```text
Google Sign-In
-> Apps Script session validation
-> League player resolution
-> Portal role and permissions
-> Firebase Auth bridge
-> Claim comparison
-> Firestore Bootstrap
-> Identity diagnostics
```

Users still sign in once. There is no second Firebase login screen.

## Expected Claims

The Identity Service derives the expected Firestore claim set from the
authoritative Apps Script session:

```text
role
leaguePlayer
playerId
commissioner
assistantCommissioner
registeredEvents
```

Existing portal roles remain unchanged:

- `League Member`
- `Assistant Commissioner`
- `Commissioner`

## Claim Synchronization

The browser can authenticate with Firebase using the Google ID token, but it
cannot write Firebase custom claims. Claims must be issued by a trusted backend
or Firebase Admin process.

Until that trusted claim issuer is available, Diagnostics may report:

```text
SYNC_REQUIRED
```

This means Apps Script identified the user correctly, Firebase Auth is
available, but Firestore custom claims do not yet match the portal identity.

## Authentication Bridge Failures

Diagnostics surfaces Firebase Auth token-exchange failures with a concrete
code. Common examples:

- `auth/operation-not-allowed`: Google sign-in is not enabled in Firebase
  Authentication.
- `auth/invalid-credential`: Firebase rejected the Google credential.
- `auth/invalid-id-token`: Firebase rejected the Google ID token.
- `auth/network-request-failed`: Firebase Authentication could not be reached.

Firestore Bootstrap does not run schema initialization, read probes, or write
probes until Firebase Auth has a current user.

## Diagnostics

Commissioner Diagnostics displays:

- Google OAuth status
- Apps Script session status
- Portal session status
- League player mapping
- Firebase Authentication status
- Expected claims
- Actual Firebase claims
- Claim mismatches
- Overall identity health

Healthy state:

```text
Identity Health: PASS
Claims: SYNCHRONIZED
```

Pre-cutover claim gap:

```text
Identity Health: SYNC_REQUIRED
```

## Failure Handling

If Firebase Auth or claims synchronization fails:

- Portal authentication remains available.
- Google Sheets remains authoritative.
- Player-facing permissions continue to come from Apps Script.
- Firestore migration and cutover remain blocked.
- Commissioners receive actionable diagnostics.

The portal must never grant broader Firestore permissions than Apps Script
authorizes.
