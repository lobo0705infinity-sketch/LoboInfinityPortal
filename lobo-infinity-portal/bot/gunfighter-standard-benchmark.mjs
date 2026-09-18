import { weaponChartRecordToGunfighterWeapon } from './infinity-weapon-chart.mjs'

export const GUNFIGHTER_BENCHMARK_VERSION = 'gunfighter-benchmark-v1'

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
  return [
    defender('flash-pulse-bot', 'Flash Pulse REM', { bs: 8, wip: 13, ph: 10, arm: 0, bts: 3, structure: 1 }, [weapon('Flash Pulse')]),
    defender('bs12-mim3', 'BS12 Mimetism (-3)', { bs: 12, wip: 12, ph: 11, arm: 2, bts: 3, vitality: 1, skills: ['Mimetism (-3)'] }, [weapon('Combi Rifle')]),
    defender('swiss-guard', 'Swiss Guard archetype', { bs: 15, wip: 13, ph: 11, arm: 5, bts: 6, vitality: 2, skills: ['Mimetism (-6)'] }, [weapon('AP Heavy Machine Gun')]),
    defender('black-air', 'Black A.I.R. archetype', { bs: 13, wip: 13, ph: 12, arm: 3, bts: 6, vitality: 1, skills: ['Mimetism (-6)'] }, [weapon('Submachine Gun')]),
    defender('riot-grrrl-core', 'Riot Grrl Core ARO', { bs: 13, wip: 12, ph: 13, arm: 3, bts: 6, vitality: 2, skills: ['BS Attack (+1SD)'] }, [weapon('Missile Launcher')]),
    defender('template-guard', 'Direct-template guard', { bs: 11, wip: 12, ph: 12, arm: 3, bts: 3, vitality: 1 }, [weapon('Heavy Flamethrower')]),
  ]
}

function defender(id, name, stats, weapons) {
  return { id, name, equipment: [], skills: [], ...stats, weapons }
}
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function canonicalWeaponName(value) { return normalize(value).replace(/heavy machine gun/g, 'hmg') }
