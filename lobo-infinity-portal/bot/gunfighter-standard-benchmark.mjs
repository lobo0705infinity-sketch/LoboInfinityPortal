import { weaponChartRecordToGunfighterWeapon } from './infinity-weapon-chart.mjs'

export const GUNFIGHTER_BENCHMARK_VERSION = 'gunfighter-benchmark-v5'

export function buildStandardGunfighterDefenders(weaponChart) {
  const weapon = (names, modes) => {
    const aliases = (Array.isArray(names) ? names : [names]).map(canonicalWeaponName)
    const matches = weaponChart.filter((record) => {
      const officialName = canonicalWeaponName(record.name)
      return aliases.some((alias) => officialName === alias || officialName.startsWith(`${alias} `)) && (!modes || modes.includes(record.mode))
    })
    if (!matches.length) {
      const candidates = weaponChart.map((record) => record.name).filter((name) => /multi|hmg|machine gun/i.test(name)).slice(0, 20)
      throw new Error(`Official weapon chart is missing benchmark weapon: ${aliases.join(' / ')}. Candidates: ${candidates.join(', ')}`)
    }
    const built = matches.map(weaponChartRecordToGunfighterWeapon)
    return { ...built[0], modes: built.flatMap((item) => item.modes) }
  }
  const modifyModes = (profileWeapon, modifiers) => ({
    ...profileWeapon,
    modes: profileWeapon.modes.map((mode) => ({ ...mode, ...modifiers })),
  })
  return [
    defender('transductor-zond', 'Transductor Zond', {
      bs: 8, wip: 13, ph: 11, arm: 0, bts: 3, structure: 1,
      skills: ['Courage', 'Mimetism (-3)', 'Remote Presence'], equipment: ['Repeater'],
    }, [weapon('Flash Pulse')]),
    defender('fusilier', 'Fusilier', {
      bs: 12, wip: 12, ph: 10, arm: 1, bts: 0, vitality: 1,
    }, [weapon('Combi Rifle'), weapon('Pistol')]),
    defender('swiss-guard-ml', 'Swiss Guard Missile Launcher', {
      bs: 15, wip: 13, ph: 14, arm: 5, bts: 6, vitality: 2,
      skills: ['Stealth', 'Mimetism (-6)', 'Surprise Attack (-3)', 'Camouflage', 'Hidden Deployment'],
    }, [modifyModes(weapon('Missile Launcher'), { specialDice: 1 })]),
    defender('black-air-msr', 'Black A.I.R. MULTI Sniper', {
      bs: 13, wip: 13, ph: 11, arm: 2, bts: 3, vitality: 1,
      skills: ['Combat Instinct', 'Mimetism (-3)', 'Number 2', 'Terrain (Total)', 'Neurocinetics'],
      equipment: ['Multispectral Visor L2'],
    }, [weapon('MULTI Sniper Rifle')]),
    defender('riot-grrrl-core-ml', 'Riot Grrl Core Missile Launcher', {
      bs: 13, wip: 13, ph: 13, arm: 3, bts: 3, vitality: 2,
      skills: ['Combat Instinct', 'Dodge (+3)', 'BS Attack (SR-1)', 'Frenzy', 'BS Attack (+1SD)'],
      equipment: ['Multispectral Visor L1'],
    }, [weapon('Missile Launcher')]),
    defender('reaktion-zond-hmg', 'Reaktion Zond HMG', {
      bs: 11, wip: 13, ph: 10, arm: 0, bts: 3, structure: 1,
      skills: ['Climbing Plus', 'Courage', 'Remote Presence', 'Total Reaction'], equipment: ['360º Visor'],
    }, [weapon('Heavy Machine Gun')]),
  ]
}

function defender(id, name, stats, weapons) {
  return { id, name, equipment: [], skills: [], ...stats, weapons }
}
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function canonicalWeaponName(value) { return normalize(value).replace(/heavy machine gun/g, 'hmg') }
