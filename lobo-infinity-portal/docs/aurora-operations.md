# Aurora VII commissioner operations

## Player communication

Anything secret is sent directly to Lobo by Discord DM. The Commander or deputy submits the official faction decision: Turn, faction, choice, target, supported faction / desired outcome where relevant, and Credit bid or purchase. Lobo records it in **Campaign operations**, with the registered representative, optional Discord message link, and explanation. No new bot commands, Discord permissions, or player-side secret submission workflow are required. Existing private claims from recorded games remain supported.

## Commissioner workflow

1. Register each faction's Commander and optional deputy from its actual registration roster. Changes retain an audit entry and do not change Discord roles.
2. Publish the Turn briefing, deadline, starting territory controllers and four vulnerable territories using the public bulletin. Select that Turn in operations and prepare it; this snapshots the start state and VP for rules that depend on them.
3. Record Hidden Hand and Infiltration selections, employer offers, NA2 acceptance and any affordable service from the DMs. An employer offer commits its specialist selection; accepted contracts and purchases cannot change. Reserving a contract immediately removes its bid from available employer Credits. Withdraw only unaccepted offers. If a specialist faction is absent or declines to choose, explicitly record a commissioner waiver with an explanation.
4. Lock choices and open games. No further contract/selection/service changes are accepted. Dossier results are generated privately at this step. Existing games prevent retrospective choice-locking. Once operations is activated, an unprepared or unopened Turn cannot accept submissions.
5. Close reporting. Existing games may still be confirmed, corrected, approved late or rejected. Pending/disputed/duplicate results block final resolution; they cannot silently disappear from the scoring decision.
6. Review the server-computed outcome, approve eligible Doctrines, review objectives with evidence, and record any explained VP correction. Objective rewards are fixed at 2 VP, start in Turn 2, and cap at 6 VP per faction. Doctrine rewards are 1 VP, once per Turn, maximum three awards per faction. An optional approved portal claim can be linked to only one objective completion.
7. Commit the reviewed resolution. The exact preview is hashed so game or ledger changes require another review. The commit writes all awards, settles Credits and stores the result atomically in the same ledger as the games. Repeated commits and further game edits are rejected.
8. Load the resolved public outcome into the bulletin, review the public draft and publish. The transfer contains only territory state and faction VP totals. Secret receipts, balances, offers, purchases, objective titles and evidence never enter the public publication. Advancing to the next Turn requires the previous Turn's committed resolution.

## Scoring

The implementation follows the current 15 October 2026 GM guide, including its Mercenary Contracts appendix, rather than older victory-based support variants. Server rules use confirmed earned game totals. Narrative TP and OP are always separate. Tohaa support uses complete groups of five territorial TP; NA2 support uses complete groups of two contracted-territory TP. Support changes Influence or the CA comparison only, never earned TP or OP. Conquest ties use OP and then retain the existing controller; an unowned complete tie remains unowned. CA complete ties fail and a successful Infiltration never changes normal control.

Contract minimums, outcome tests, reserves, success payments, Insurance, Preparation, Dossier and Logistics are resolved independently. Service spending uses NA2's start-of-Turn balance; income settled at Turn end cannot buy a service in that Turn. No free Credit replenishment or resource-to-VP conversion occurs. Final printed territory VP is awarded only at the end of Turn 6. Narrative winners use TP then OP, with complete ties unresolved; the normal Narrative award is 1 VP (2 in Turn 6). One-off earned Narrative TP bonuses can be entered before games against a unique reward reference.

The commissioner still judges factual objective evidence and narrative reward eligibility. Full objective tables, unreleased missions and future story material are not shipped to the browser. The ledger records every adjustment with its reason; committed history is not edited or deleted. An explained VP amendment may be added after resolution until a successor Turn has been prepared (including after Turn 6); it updates the public outcome draft without changing games or historical awards. Once a successor exists, record the correction in the latest Turn.

## Persistence and access

Private operations are an additive, versioned section of the existing `/data/aurora-vii-games.json` ledger. Existing games, claims, identities, verification links, and Discord registration are preserved. All writes use the existing serialized atomic fsync/rename path. Revision checks reject simultaneous stale actions. Operations read and write endpoints require a valid commissioner session, and writes retain the same-origin checks. Participant and public projections use explicit existing field lists and never include operations.

The public bulletin remains a separate allowlisted publication. Committing private resolution does not itself publish. A publication failure leaves the private outcome durable and the load/publish step retryable without duplicate awards. The normal Railway volume backup procedure must continue to cover the whole game ledger.

Validation: `npm run test:aurora-operations`, existing game/registration/publication checks, TypeScript, production build, and the isolated commissioner browser rehearsal. Tests use temporary ledgers and simulated identities; no production records or messages are created.
