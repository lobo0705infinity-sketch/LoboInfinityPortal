# Impetuous Dodge correction — 2026-09-20

The reported answer allowed unrestricted sideways Dodge movement during an Impetuous activation. Dodge has the Movement label, so Impetuous movement priorities apply. Sideways movement can still be legal when it satisfies those priorities (for example reaching an enemy), or within the enemy Deployment Zone while remaining inside it. AROs and regular Orders are not Impetuous activations.

## Cause and repair

- The bounded page 97 extraction ended before the Impetuous movement priorities; a page 88 Climbing Plus excerpt was also mislabeled as Impetuous.
- Restored the movement restrictions and Dodge label/effects through the existing rules-supplement mechanism, checked against the official N5.3 wiki: https://infinitythewiki.com/Impetuous and https://infinitythewiki.com/Dodge.
- Added Impetuous to retrieval terms, Dodge inflection aliases, and explicit label/restriction guidance to the AI evidence prompt.
- Added approved case `new-topic-2-514`, with ten distinct phrasings, routed before AI. The answer retains the legal exceptions and cites N5.3 pages 79 and 97.

## Ten benchmark phrasings

1. Can I dodge sideways during an impetuous activation?
2. Can an Impetuous trooper Dodge to the side during its Impetuous Order?
3. Am I allowed to Dodge laterally in the Impetuous Phase?
4. If I declare Move plus Dodge for my Impetuous activation, can the Dodge go sideways?
5. During an Impetuous activation, can I use Dodge to sidestep instead of advancing?
6. Can my model Dodge left or right when spending its Impetuous token?
7. Does Dodge let me ignore the direction restrictions of an Impetuous move?
8. Is sideways Dodge movement unrestricted during an Impetuous activation?
9. Can I Dodge in any direction during the Impetuous Phase?
10. Impetuous Move + Dodge: can the Dodge movement go sideways?

## Verification

- Approved benchmark routing: 1,394 trusted rulings; all ten new phrasings pass with no AI calls.
- Routing checks assert the label, restrictions, exceptions, citations, and untruncated Discord answer; reactive and regular-order questions do not inherit the new activation answer.
- AI-adapter checks pass with mocked requests; independent unfamiliar phrasings receive both the Dodge label and complete Impetuous restrictions.
- Production corpus checks, V2 retrieval (30/30), V3 clauses (21/21), and current Discord formatter checks pass.
- Existing `infinity-rules-interaction-check.mjs` fails at line 41 (`STATUS` versus `ANSWER`) on both the unchanged baseline and this patch. This legacy formatter expectation is unrelated to the correction.
- No live paid AI call or Discord message was used for verification.
