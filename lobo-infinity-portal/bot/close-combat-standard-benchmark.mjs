export const CLOSE_COMBAT_BENCHMARK_VERSION = 'close-combat-benchmark-v3-berserk-face-to-face'

const weapon = (name, power, options = {}) => ({
  name,
  power,
  burst: 1,
  ammo: 'N',
  save: 'ARM',
  savingRolls: 1,
  opponentMod: 0,
  attackMod: 0,
  states: [],
  ...options,
})

export function buildStandardCloseCombatDefenders() {
  return [
    defender('line-trooper', 'Line Trooper', { cc: 14, ph: 10, arm: 1, bts: 0, vitality: 1 }, [weapon('CC Weapon (PS 7)', 7)]),
    defender('armored-veteran', 'Armored Veteran', { cc: 17, ph: 13, arm: 5, bts: 6, vitality: 2 }, [weapon('AP CC Weapon (PS 6)', 6, { ammo: 'AP', ap: true })]),
    defender('martial-artist', 'Martial Artist', { cc: 22, ph: 13, arm: 2, bts: 3, vitality: 1, skills: ['Martial Arts L2'] }, [weapon('DA CC Weapon (PS 6)', 6, { ammo: 'DA', savingRolls: 2 })]),
    defender('natural-born-warrior', 'Natural Born Warrior', { cc: 21, ph: 13, arm: 3, bts: 3, vitality: 1, skills: ['Natural Born Warrior'] }, [weapon('AP CC Weapon (PS 6)', 6, { ammo: 'AP', ap: true })]),
    defender('para-specialist', 'PARA Specialist', { cc: 18, ph: 12, arm: 2, bts: 3, vitality: 1 }, [weapon('PARA CC Weapon (-6)', 0, { ammo: 'PARA', save: 'PH', saveModifier: -6, nonLethal: true, opponentMod: -6, states: ['IMM-A'] })]),
    defender('elite-duelist', 'Elite Duelist', { cc: 24, ph: 14, arm: 3, bts: 3, vitality: 2, skills: ['Martial Arts L4'] }, [weapon('EXP CC Weapon (PS 5)', 5, { ammo: 'EXP', savingRolls: 3 })]),
    defender('nwi-veteran', 'NWI Veteran', { cc: 20, ph: 12, arm: 3, bts: 3, vitality: 1, skills: ['Martial Arts L1', 'No Wound Incapacitation'] }, [weapon('Shock CC Weapon (PS 6)', 6, { ammo: 'Shock', shock: true })]),
    defender('tag', 'TAG', { cc: 18, ph: 16, arm: 8, bts: 6, structure: 3, skills: ['Immunity (Shock)'] }, [weapon('E/M CC Weapon (PS 5)', 5, { ammo: 'N+E/M', save: 'BTS', ap: true, savingRolls: 2, states: ['IMM-B', 'Isolated'] })]),
  ]
}

function defender(id, name, stats, weapons) { return { id, name, skills: [], ...stats, weapons } }
