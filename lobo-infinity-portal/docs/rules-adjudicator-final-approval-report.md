# Infinity Rules Adjudicator — Final Approval Report

## Outcome

The benchmark is mechanically complete, but it should **not be formally approved yet**. The **3 blocking issues, 3 legacy-terminology rulings, and 2 core interaction rulings have now been resolved**. **4 rulings still deserve focused rules review**. The other **96 cases require no further manual rereading** before approval.

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

These are plausible drafts, but each depends on timing interpretation or an exhaustive corpus claim. Review only these four; the report makes no claim that they are wrong.

| Case | Question | Why it merits review |
|---|---|---|
| `timing_sequence-13` | Fireteam member enters a Null State mid-Order | The non-retroactivity and later composition statements are timing interpretations. |
| `timing_sequence-19` | Peripheral disconnected during an Order | Result changes with the cause and timing of disconnection. |
| `faq_its_override-08` | What FAQ changes affect Hidden Deployment? | Claims an exhaustive FAQ review found no amendment; negative claims need source-level confirmation. |
| `faq_its_override-10` | Which ITS Season 18 rules restrict Combat Jump? | Claims an exhaustive mission list and page-specific restrictions; verify completeness once. |

## Resolved core-interaction cases

| Case | Resolution |
|---|---|
| `two_rule_interaction-06` | Hacking Area directly includes the ZoC of every allied Repeater; Repeaters do not recursively relay one another. The answer now states this distinction explicitly. |
| `two_rule_interaction-10` | A Camouflaged Marker can be indirectly affected by a legal Template, and a forced Saving Roll cancels the State. The current FAQ citation was added and certainty corrected to `EXPLICIT RULES ANSWER`. |

## Resolved legacy-terminology cases

| Case | Resolution |
|---|---|
| `direct_definition-16` | `Total Immunity` is not treated as a current standalone N5.3 Skill. The answer safely requests the exact printed Immunity. Certainty corrected to `SAFE ESCALATION`. |
| `two_rule_interaction-07` | The bot will not assume that legacy `Total Immunity` means a particular current Immunity against AP. Certainty corrected to `SAFE ESCALATION`. |
| `two_rule_interaction-14` | N5.3 uses exact ammunition, weapon-trait, and Immunity entries; Viral-named profiles cannot be resolved from legacy shorthand alone. Existing `SAFE ESCALATION` retained. |

## Approval recommendation

1. Resolve or explicitly accept the four focused-review records.
2. Re-run the zero-cost benchmark, citation, adversarial, model-gate, and approval checks.
3. Only then use the existing one-action approval command.
4. After approval, authorize at most one paid candidate request as a smoke test; do not run a paid batch automatically.

## Release boundary

All work remains on `rules-adjudicator-v2`. Production branch `visual-only-polish-20260831` remains outside this approval process unless separately authorized.
