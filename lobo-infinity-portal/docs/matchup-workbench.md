# Interactive combat matchup

Use `/combat matchup model-1:<exact profile> model-2:<exact profile>`. Both profiles use Discord autocomplete. Optional inputs: `alternative` (another attacker against the same defender), `calculator-link`, `range`, `combat-type` (`shooting`, `cc`, `hacking`), and `goal` (`neutralize`, `damage`, `kill`, `state`). If a calculator link supplies both profiles, the model inputs can be omitted.

The first response shows the selected range and attack, cumulative 1+/2+/3+ wounds, unconscious/dead outcomes, NWI/Dogged continuation where applicable, disabling-state probability, and retaliation risk. Weapon selection optimizes the chosen goal against the ARO which minimizes that goal; ties prefer stronger retaliation. Forced weapons and AROs are available through menus. A state goal includes states such as Targeted; the neutralization/disable goal includes lethal incapacitation, Isolated, Immobilized, Stunned and Possessed, but does not count Targeted as disabling.

Views: Summary, All ranges, Weapons/ammunition, Compare AROs, Explain calculation, Repeated orders. Swap turns exchanges active/reactive roles while retaining each model's own conditions. Changing combat type or range clears forced weapon/ARO choices. Combat controls are restricted to the original requester in the original server.

Conditions uses two comma-separated values in model 1/model 2 order:

- Cover: `on,off`. Ineligible profiles still receive no cover.
- Fireteam +1SD: `off,on`. Defaults off; eligible exact army/profile membership is required. This represents the +1SD bonus, not every possible Fireteam composition/BS bonus.
- Remaining W/STR: `full,1`. The printed maximum remains unchanged for immunity and Shock semantics.
- Starting states: `normal`, `targeted`, `nwi`, `dogged`, `isolated`, `imm-a`, `imm-b`. NWI/Dogged requires the corresponding skill. Each model has one selected starting state; combined states are not represented.
- External Firewall: `0,3`. Values 0/3/6. Intrinsic equipment Firewalls are also detected; use the stronger applicable Firewall, never stack them. Firewalls add +3 to saves after AP reduction.

Save preset stores both profiles and conditions under a name in the requester's server-specific preset collection. Load preset accepts the saved name and lists available names on a miss. Up to 20 presets per requester/server; reuse a name to replace it. Presets and seven-day interactive sessions persist on the Railway volume. Session storage is bounded to 2,000 records and expired records are pruned.

Calculator imports parse locally, without fetching the supplied URL. Only HTTPS infinitythecalculator.com links are accepted. Its range parameter represents centimeters: `range=100` selects 32–40 inches; `range=40` selects 8–16 inches. Exact profiles and cover are imported. The response explicitly requires weapon/ammunition and Fireteam selection because their serialization was not established. No unverified options are silently inferred.

Shooting supports the existing exact gunfighter engine, including native +B/+SD, MSV/Mimetism, ammunition/immunities, legal Dodge/template/weapon responses, separate cover, Targeted, and immobilized-state restrictions. CC supports engaged ordinary CC attacks with canonical CC weapons, Martial Arts, native bonuses, weapon/opponent modifiers, Dodge and no ARO. It does not model shooting into an engagement, allied CC Burst, Surprise/Berserk declarations or Protheion transitions. Hacking uses the bundled Army program chart and exact device/upgrades (including +B/+SD, PS overrides, AP, SR penalties and opponent MODs), Reset, Zero Pain, legal target types, ECM and Firewall. It assumes valid Hacking Areas, model-form targets and legal ARO access; it does not establish those from a battlefield map. Supportware and targetless programs are not offensive exchanges.

Repeated-order planning is explicitly conditional: the position/weapon/ARO/pools remain fixed, damage accumulates on both models, and a neutralized attacker cannot spend another order. Opposed damage is mutually exclusive; simultaneous normal-roll damage uses independent saving rolls. A disabling state terminates the sequence. It does not model movement, newly inflicted state MODs, cancellation of states, transformed profiles, disposable ammunition or other resource consumption. Disposable weapons do not receive this estimate. NWI/Dogged is assumed to continue until another incapacitating wound. A single exchange does not follow Escape System/Transmutation into another physical profile.

## Verification

`npm run test:matchup-workbench` checks the externally observed Bagh-Mari DA Sniper versus Iguana AP HMG at 32–40 inches (81.24% active roll win, 51.690194% at least one wound, 18.114682% at least two wounds), independent normal/critical damage fixtures, probability normalization, wounded and NWI targets, separate cover, Targeted, Fireteam eligibility, hacking program upgrades/Firewall, CC, conditional repeated orders, alternative attackers, imports, Discord component limits, ownership and persistent preset controls. Existing gunfighter/ARO/CC and command regression checks remain required. The Railway Docker build also runs the workbench regression before startup.
