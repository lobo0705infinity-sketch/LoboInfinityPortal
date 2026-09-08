# Infinity Rules Adjudicator — Final Approval Report

## Outcome

The benchmark is mechanically complete, but it should **not be formally approved yet**. The **3 blocking answer/metadata issues have been corrected**. **9 rulings still deserve one focused rules review**. The other **88 cases require no further manual rereading** before approval.

This report does not approve the benchmark, run a paid model, deploy code, or modify production.

## Audit coverage

| Check | Result |
|---|---:|
| Benchmark cases | 100/100 complete |
| Citation references | 197 validated |
| Semantic contracts | 100/100 complete |
| Adversarial mutations rejected | 390/390 |
| Formal approvals | 0/100 |
| Paid provider calls during audit | 0 |

## Corrected blockers

These corrections are complete on `rules-adjudicator-v2`.

| Case | Question | Problem | Required correction |
|---|---|---|---|
| `timing_sequence-01` | MSV1 shooting through Smoke when the target shoots back | Certainty corrected to `EVIDENCE-BOUNDED INTERPRETATION`; −3 result retained. | Complete |
| `timing_sequence-02` | MSV1 shooting through Smoke when the target Dodges | Certainty corrected to `EVIDENCE-BOUNDED INTERPRETATION`; −6 result retained. | Complete |
| `timing_sequence-03` | Does declaring Dodge break Stealth? | Answer now leads with the Active/Reactive Turn distinction; certainty is `EVIDENCE-BOUNDED INTERPRETATION`. Stored conclusion remains schema-valid `INTERPRETATION`, while the candidate expectation remains conditional. | Complete |

## Focused rules review

These are plausible drafts, but each depends on interpretation, an exhaustive corpus claim, or policy for obsolete terminology. Review only these nine; the report makes no claim that they are wrong.

| Case | Question | Why it merits review |
|---|---|---|
| `direct_definition-16` | What does Total Immunity do? | Requires a deliberate policy for obsolete/invalid terminology rather than a direct definition. |
| `two_rule_interaction-06` | Can a Repeater extend Hacking Area through another Repeater? | The “no daisy-chain” conclusion is inferred from how Hacking Area is constructed. |
| `two_rule_interaction-07` | Does Total Immunity ignore AP Ammunition? | Combines obsolete terminology with a proposed mapping to specific N5 Immunities. |
| `two_rule_interaction-10` | Does a Direct Template Weapon cancel Camouflaged State? | Depends on legal targeting, incidental template coverage, Saving Rolls, and cancellation timing. |
| `two_rule_interaction-14` | Does Viral Ammunition interact with Immunity (Shock)? | Treats both names as incomplete or legacy terminology and redirects to exact profiles. |
| `timing_sequence-13` | Fireteam member enters a Null State mid-Order | The non-retroactivity and later composition statements are timing interpretations. |
| `timing_sequence-19` | Peripheral disconnected during an Order | Result changes with the cause and timing of disconnection. |
| `faq_its_override-08` | What FAQ changes affect Hidden Deployment? | Claims an exhaustive FAQ review found no amendment; negative claims need source-level confirmation. |
| `faq_its_override-10` | Which ITS Season 18 rules restrict Combat Jump? | Claims an exhaustive mission list and page-specific restrictions; verify completeness once. |

## Approval recommendation

1. Resolve or explicitly accept the nine focused-review records.
2. Re-run the zero-cost benchmark, citation, adversarial, model-gate, and approval checks.
3. Only then use the existing one-action approval command.
4. After approval, authorize at most one paid candidate request as a smoke test; do not run a paid batch automatically.

## Release boundary

All work remains on `rules-adjudicator-v2`. Production branch `visual-only-polish-20260831` remains outside this approval process unless separately authorized.
