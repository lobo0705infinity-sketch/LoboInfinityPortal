# Army Identity

Army Identity is the portal boundary for faction and sectorial resolution.

Features should resolve army values through `resolveArmyIdentity()` in `src/services/armyIdentity.ts` instead of normalizing display names, slugs, decoder output, or legacy aliases locally.

```mermaid
flowchart TD
  Registry["Canonical Army Registry\nsrc/config/armies.ts\nid, name, type, parentFaction, aliases"]
  Resolver["Army Identity Service\nresolveArmyIdentity()\ncanonical display + internal id + parent scope"]
  Helpers["Compatibility Helpers\ngetCanonicalArmyName()\nnormalizeArmyForDisplay()\ngetArmyParentFaction()\noption builders"]
  Routing["Army Intelligence Routing\ncanonical ids in query params\ncanonical names in UI"]
  UI["Consumers\nArmy Intelligence\nPrimaryFactionCard\nProfiles\nArmy Lists\nSubmit flows\nTeam Tournament\nFaction portraits"]

  Registry --> Resolver
  Resolver --> Helpers
  Resolver --> Routing
  Helpers --> UI
  Routing --> UI
```

Rules:

- The registry owns available factions, sectorials, parent factions, and aliases.
- `resolveArmyIdentity()` accepts registry ids, display names, slugs, decoder values, and legacy aliases.
- Callers use `identity.id` for internal routing and filtering where an identifier is needed.
- Callers use `identity.displayName` for presentation.
- Feature code must not introduce local army normalization tables or resolver functions.
