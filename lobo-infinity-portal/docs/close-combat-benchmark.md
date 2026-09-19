# Close-Combat Benchmark v1

The close-combat benchmark is a deterministic N5.3 combat model built from the official Infinity Army payloads. It ranks canonical CC loadouts by their normal active-turn performance and reports conditional states separately.

## Inputs

- Official Infinity Army payload version `7.26246.159` (the newest version present across the 58 captured payloads).
- Exact CC Attribute, ARM, BTS, PH, VITA/STR, skills, equipment, and weapon records for each profile.
- Exact weapon PS from the weapon/profile record. PH is never substituted for weapon PS.
- Canonical combat identity deduplication. Sectorial aliases and ranged-loadout variants with identical CC behavior do not occupy repeated ranking positions.

## Defender suite

1. Line Trooper: CC 14, ARM 1, one VITA.
2. Armored Veteran: CC 17, ARM 5/BTS 6, two VITA.
3. Martial Artist: CC 22, Martial Arts L2, DA CC Weapon.
4. Natural Born Warrior: CC 21, NBW, AP CC Weapon.
5. PARA Specialist: CC 18, PARA CC Weapon (-6).
6. Elite Duelist: CC 24, Martial Arts L4, EXP CC Weapon.
7. NWI Veteran: CC 20, Martial Arts L1, NWI.
8. TAG: CC 18, ARM 8/BTS 6, three STR, E/M CC Weapon.

## Resolution

Every d20 result is enumerated. The engine handles Burst, Special Dice and discarded dice, Face-to-Face cancellation, Success Values over 20, Criticals, Saving Rolls, repeated Continuous Damage saves, AP, DA, EXP, T2, Shock, Monofilament, PARA, E/M states, NWI/Dogged, and Immunities represented by the profile data.

The engine applies Martial Arts 1–5, Natural Born Warrior, CC Attack positive and negative MODs, CC Attack (+B)/(+SD), Surprise Attack, Berserk, allied-Trooper CC Burst, and weapon-imposed MODs. Guard is retained as a profile access trait; once the attack is legal, Guard does not change the opposed dice calculation.

## Reported states

- Normal active-turn CC: primary rating and grade.
- Reactive-turn CC.
- Surprise Attack, when available.
- Berserk, when available.
- One and two allied Troopers engaged.
- Protheion Power-Up 1 and 2, when available.

Protheion never changes the weapon's PS. Power-Up is resolved after the attack and is capped by wounds that can affect the target before it reaches Dead, following FAQ v0.1.

## Independent validation

Supported baseline cases are checked against [Infinity the Calculator](https://infinitythecalculator.com/). The retained cases and observed values are stored in `data/infinity-army/close-combat-calculator-validation.json`. Interactions the public calculator does not support directly, including Protheion, are covered by official-rule regression tests.
