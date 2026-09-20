import { gunfighterWeaponsFromTtsProfile } from './gunfighter-profile-canonicalizer.mjs'

export const GUNFIGHTER_BENCHMARK_VERSION = 'gunfighter-benchmark-v15-opportunities'

export const DEFENSIVE_ARCHETYPE_WEIGHTS = Object.freeze({
  'ordinary-linked': 0.20,
  'visual-modifiers': 0.15,
  'dedicated-aro': 0.20,
  'durable-targets': 0.20,
  'templates-visibility-dodge': 0.10,
  'control-effects': 0.10,
  'extreme-stress': 0.05,
})

export const DEFENDER_SPECS = Object.freeze([
  spec('transductor-zond', '501:412:1:1:1', 'control-effects'),
  spec('fusilier-linked', '101:1:1:1:1', 'ordinary-linked', { linked: true }),
  spec('swiss-guard-ml', '101:9:1:3:1', 'visual-modifiers'),
  spec('bao-msr', '202:166:1:3:1', 'visual-modifiers'),
  spec('black-friar-hrl', '103:771:1:4:1', 'visual-modifiers'),
  spec('bolt-msv1-msr-linked', '101:4:1:10:1', 'ordinary-linked', { linked: true }),
  spec('nisse-msr', '101:3:1:3:1', 'visual-modifiers'),
  spec('aquila-hmg', '101:8:1:3:1', 'visual-modifiers'),
  spec('teutonic-ml-linked', '101:30:1:3:1', 'ordinary-linked', { linked: true }),
  spec('nokk-msv1-bsg', '101:1484:1:6:1', 'visual-modifiers'),
  spec('reaktion-zond-hmg', '501:409:1:1:1', 'dedicated-aro'),
  spec('q-drone-hmg', '601:509:1:1:1', 'dedicated-aro'),
  spec('black-air-msr-linked', '101:1808:1:3:1', 'dedicated-aro', { linked: true }),
  spec('rudra-k1-linked', '701:1197:1:2:1', 'durable-targets', { linked: true }),
  spec('vystrel-ap-sniper', '301:1846:1:3:1', 'dedicated-aro', { variantGroup: 'vystrel-ap-sniper' }),
  spec('vystrel-ap-sniper-linked', '301:1846:1:3:1', 'dedicated-aro', { linked: true, variantGroup: 'vystrel-ap-sniper' }),
  spec('teucer-plasma-neuro', '605:1860:1:3:1', 'dedicated-aro', { variantGroup: 'teucer' }),
  spec('teucer-fto-feuerbach-linked', '605:1860:1:2:1', 'dedicated-aro', { linked: true, variantGroup: 'teucer' }),
  spec('atalanta-tr-msr', '702:605:1:2:1', 'dedicated-aro'),
  spec('miranda-emitter', '202:51:1:3:1', 'control-effects'),
  spec('blackheart-contender', '605:1888:1:1:1', 'durable-targets'),
  spec('kosmosoldat-autocannon-linked', '306:1521:1:3:1', 'durable-targets', { linked: true }),
  spec('crux-knight-mmr-linked', '101:1815:1:4:1', 'durable-targets', { linked: true }),
  spec('cameronian', '302:254:1:1:1', 'templates-visibility-dodge'),
  spec('makaul-hft-linked', '801:653:1:1:1', 'templates-visibility-dodge', { linked: true }),
  spec('coyote-khd-emitter-linked', '502:1896:1:9:1', 'control-effects', { linked: true }),
  spec('iguana-ap-hmg', '502:383:1:1:1', 'durable-targets', { variantGroup: 'iguana' }),
  spec('iguana-ap-hmg-bs-attack-minus-3', '502:383:1:2:1', 'durable-targets', { variantGroup: 'iguana' }),
  spec('skyhound-x-visor', '605:1889:1:2:1', 'extreme-stress'),
  spec('yan-huo-hrmc', '201:128:1:2:1', 'durable-targets'),
  spec('karakuri-mk12-linked', '904:154:1:4:1', 'durable-targets', { linked: true }),
])

export function buildStandardGunfighterDefenders(weaponChart, ttsProfiles = [], { canonicalProfiles = null } = {}) {
  const profiles = new Map((canonicalProfiles || ttsProfiles).map((profile) => [String(profile.id), profile]))
  return DEFENDER_SPECS.map((definition) => {
    const source = profiles.get(definition.sourceId)
    if (!source) throw new Error(`TTS catalog is missing defensive benchmark profile ${definition.sourceId} (${definition.id}).`)
    const weapons = canonicalProfiles ? source.weapons : gunfighterWeaponsFromTtsProfile(source, weaponChart)
    const unresolved = source.weapons.map((weapon) => weapon.name).filter((name) => !isNonRangedAroWeapon(name) && !weapons.some((candidate) => normalize(candidate.name) === normalize(name)))
    if (unresolved.length) throw new Error(`Official weapon chart is missing ${definition.id} weapon data: ${unresolved.join(', ')}.`)
    return {
      ...source,
      id: definition.id,
      sourceProfileId: source.id,
      name: `${definition.linked ? 'Linked ' : ''}${source.name}`,
      skills: [...source.skills],
      weapons,
      archetype: definition.archetype,
      archetypeWeight: DEFENSIVE_ARCHETYPE_WEIGHTS[definition.archetype],
      variantGroup: definition.variantGroup,
      linked: definition.linked,
      fireteamSpecialDice: definition.linked ? 1 : 0,
    }
  })
}

function spec(id, sourceId, archetype, { linked = false, variantGroup = id } = {}) {
  return { id, sourceId, archetype, linked, variantGroup }
}

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function isNonRangedAroWeapon(value) { return /^(?:.+ )?cc weapon(?: .+)?$|^d charges$|^(?:para |shock |viral )?mine$|^mine dispenser$|^drop bears$/i.test(normalize(value)) }
