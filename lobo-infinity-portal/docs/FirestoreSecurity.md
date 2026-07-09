# Firestore Security

Version 7.3.2 replaces the default Firestore deny-all placeholder with a
version-controlled rule set in `firestore.rules`.

## Security Model

Firestore rules mirror the portal role model:

- Anonymous
- League Member
- Assistant Commissioner
- Commissioner

Rules evaluate Firebase Auth custom claims:

```text
role
leaguePlayer
```

The frontend continues to authenticate through the existing Google Identity
Services and Apps Script session flow. When Firebase is configured, the portal
also signs the same Google ID token into Firebase Auth so Firestore can evaluate
rules. This bridge does not replace portal authentication.

Version 7.3.3 centralizes this comparison in the Identity Service. Firestore
Rules consume synchronized Firebase claims; Apps Script remains the
authoritative source used to determine the expected claim values.

Version 7.3.4 ensures Firestore Bootstrap runs after Firebase Auth. If the
browser has no Firebase current user, Firestore rules are expected to deny
access and Diagnostics reports the authentication bridge failure rather than a
generic permission failure.

Commissioner-level Firestore writes require Firebase Auth custom claims. Until
claims are issued for production Commissioners, Google Sheets remains the
authoritative provider and Firestore remains a pre-cutover verification target.

## Permission Matrix

| Collection | Public | Player | Assistant Commissioner | Commissioner |
| --- | --- | --- | --- | --- |
| `events` | Read public events | Read | Read | Create, update, archive |
| `players` | Read public profiles | Update own player document | Read | Manage |
| `games` | Read public games | Submit games | Update/approve results | Full management |
| `registrations` | Read public registration summaries | Create/update own registration | Manage registrations | Full management |
| `teams` | Read public teams | Read | Manage teams and rosters | Full management |
| `pairings` | Read public pairings | Read | Manage pairings | Full management |
| `notifications` | No public access | Read/update own notification state | Create/manage operational notifications | Full management |
| `missions` | Read | Read | Manage reference data | Full management |
| `factions` | Read | Read | Manage reference data | Full management |
| `analytics` | Read public analytics | Read | Update analytics | Full management |
| `settings` | Read public bootstrap settings | Read public bootstrap settings | No system writes | Manage schema, security, migration |

## Bootstrap Authorization

Bootstrap can create only tightly scoped setup documents while the user is
signed into Firebase Auth:

- collection `__schema` marker documents
- `settings/schema`
- `settings/defaults`
- `settings/bootstrapProbe`
- `analytics/default`
- `events/event-current-league`

The catch-all rule remains deny-all. There is no global `allow read, write: if
true` rule.

## Migration Authorization

Firestore mirror migration writes require Commissioner custom claims and a
`migrationSource` value of `google-sheets`. Migration never requires insecure
allow-all rules.

## Deployment

Deploy rules through Firebase tooling:

```text
firebase deploy --only firestore:rules
```

Rules are source-controlled in `firestore.rules`; do not edit production rules
manually in the Firebase console.

## Validation

Run:

```text
npm run rules:check
```

This repository check verifies:

- every required collection has explicit rules
- the final catch-all deny remains present
- no broad public write is introduced
- the rules version marker is present

Commissioner Diagnostics displays:

- security rules version
- current Firebase Auth role claim
- collection access matrix
- bootstrap read/write probe status
