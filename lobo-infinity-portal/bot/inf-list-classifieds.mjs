// The current 20-card Operations Deck, as shown on the physical cards. The older
// classified-deck-en.pdf predates this deck and must not be used for its objectives.
// Season 18 selection, Long Service, CivEvac, and Secure HVT:
// https://experience.corvusbelli.com/en/infinity/its
export const CLASSIFIED_DECK_URL = 'https://store.corvusbelli.com/en/organized-play/infinity/all/operations-deck'

const classifiedCards = [
  ['HVT: Follow-Up', 'Medium or Heavy Infantry', mediumOrHeavy],
  ['Net-Undermine', 'Veteran/Elite Troop or Chain of Command', veteranOrElite],
  ['HVT: Identity Check', 'Biometric Visor, Multispectral Visor, or Sensor', p => equipment(p, 'Biometric Visor') || equipment(p, 'Multispectral Visor') || skill(p, 'Sensor')],
  ['Capture', 'Veteran/Elite Troop or Chain of Command', veteranOrElite],
  ['HVT: Kidnapping', 'Veteran/Elite Troop or Chain of Command able to CivEvac', p => veteranOrElite(p) && canCivEvac(p)],
  ['HVT: Inoculation', 'Doctor or Paramedic', medic],
  ['Sabotage', 'D-Charges', p => (p.weapons || []).some(w => token(w.name, 'D-Charges')) || equipment(p, 'D-Charges')],
  ['Combat Support', 'Doctor/Paramedic with an allied VITA trooper, or Engineer with an allied STR trooper', combatSupport,
    'Needs an allied trooper to regain a VITA/STR point; a Peripheral (Servant) cannot complete it.'],
  ['HVT: Espionage', 'Hacker', hacker],
  ['HVT: Reverse Engineering', 'Engineer', engineer],
  ['Industrial Espionage', 'Engineer, Forward Observer, Veteran Troop, or Elite Troop',
    p => engineer(p) || skill(p, 'Forward Observer') || veteranOrEliteTroop(p), 'Needs an enemy HI, REM, TAG, or Engineer.'],
  ['Nanoespionage', 'Engineer, Doctor, or Paramedic with MediKit or GizmoKit',
    p => (engineer(p) || medic(p)) && (equipment(p, 'MediKit') || equipment(p, 'GizmoKit') || skill(p, 'MediKit') || skill(p, 'GizmoKit')),
    'Requires a BS Attack with MediKit/GizmoKit against an enemy Specialist Troop.'],
  ['Mapping', 'Forward Observer or Hacker', p => skill(p, 'Forward Observer') || hacker(p)],
  ['Data Scan', 'Hacker', hacker],
  ['HVT: Designation', 'Forward Observer or Spotlight', observerOrSpotlight,
    'Requires two successful rolls against the same enemy HVT.'],
  ['Telemetry', 'Forward Observer or Spotlight', observerOrSpotlight],
  ['Predator', 'Two enemy troopers put into Unconscious or Dead State by CC Attack', activeTrooper,
    'Needs two enemy troopers put into Unconscious or Dead State by CC Attack.'],
  ['Suspected Infiltration', 'Doctor, Hacker, Veteran Troop, or Elite Troop',
    p => skill(p, 'Doctor') || hacker(p) || veteranOrEliteTroop(p), 'Needs an enemy trooper that is not a REM or TAG.'],
  ['Vigilance', 'Medium or Heavy Infantry', mediumOrHeavy,
    'Needs any enemy trooper wholly in the enemy half of the table and within ZoC.'],
  ['HVT: Assassination', 'Lieutenant, NCO, or Chain of Command',
    p => skill(p, 'Lieutenant') || skill(p, 'NCO') || skill(p, 'Chain of Command'),
    'Needs the enemy HVT in LoF and ZoC; Silhouette contact gives +3 to the WIP roll.'],
]

export function assessInfListClassifieds(profiles = []) {
  const cards = classifiedCards.map(([name, requirement, predicate, detail = ''], index) => {
    const eligible = profiles.filter((p, i) => predicate(p, profiles, i))
    if (index === 16) eligible.sort((a, b) => (b.cc || 0) - (a.cc || 0))
    return {
      number: index + 1,
      name,
      requirement,
      eligible: uniqueProfiles(eligible),
      detail,
      possible: eligible.length > 0,
    }
  })
  const secureHvt = uniqueProfiles(profiles.filter(activeTrooper))
  return {
    cards,
    possible: cards.filter(card => card.possible).length,
    total: cards.length,
    secureHvt,
  }
}

export function formatInfListClassifiedEmbeds(coverage) {
  if (!coverage?.cards?.length) return []
  const header = `Profile capability: ${coverage.possible}/${coverage.total} deck cards. All 20 cards are listed below; scroll down for the rest. A checkmark means the list has the required tools; mission rules, targets, positioning and successful actions still matter.`
  return [{
    title: 'ITS 18 · Classified coverage',
    url: CLASSIFIED_DECK_URL,
    color: 0xa91e27,
    description: header,
    fields: coverage.cards.map(card => ({
      name: `${card.possible ? '✓' : '—'} ${card.number}. ${card.name}`,
      value: card.possible
        ? `${shorten(profileLabels(card.eligible), 220 - (card.detail ? card.detail.length + 1 : 0))}${card.detail ? `\n${card.detail}` : ''}`
        : shorten(`No qualifying profile: ${card.requirement}.`, 220),
      inline: false,
    })).concat([{
      name: `${coverage.secureHvt.length ? '✓' : '—'} Optional · Secure HVT`,
      value: coverage.secureHvt.length
        ? `${shorten(profileLabels(coverage.secureHvt), 135)}\nAt game end, cover the enemy HVT and keep enemies away from your own HVT. Optional substitute when the scenario allows it.`
        : 'No active trooper identified.',
      inline: false,
    }]),
  }]
}

function shorten(value, limit) {
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value
}

function profileLabels(profiles) {
  const unique = [...new Set(profiles.map(p => {
    const unit = p.unitName || p.profileName || 'Unknown profile'
    return p.profileName && !token(p.profileName, unit) ? `${unit} (${p.profileName})` : unit
  }))]
  return `${unique.slice(0, 3).join(' · ')}${unique.length > 3 ? ` · +${unique.length - 3} more` : ''}`
}

function uniqueProfiles(profiles) {
  return [...new Map(profiles.map(p => [p.combinedId || `${p.unitName}:${p.profileName}`, p])).values()]
}

function norm(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function token(value, wanted) { return norm(value) === norm(wanted) }
function named(values, wanted) { return (values || []).some(value => token(value, wanted) || norm(value).startsWith(`${norm(wanted)} `)) }
function skill(p, wanted) { return named(p.skills, wanted) }
function equipment(p, wanted) { return named(p.equipment, wanted) }
function medic(p) { return skill(p, 'Doctor') || skill(p, 'Paramedic') }
function engineer(p) { return skill(p, 'Engineer') }
function hacker(p) { return skill(p, 'Hacker') || (p.equipment || []).some(value => /^(?:evo |killer |white |assault |defensive )?hacking device(?: |$)/.test(norm(value))) }
// ITS 18 Long Service grants every Character the Veteran Troop classification.
function veteranOrEliteTroop(p) { return [4, 5, 10].includes(p.troopClassification) }
function veteranOrElite(p) { return veteranOrEliteTroop(p) || skill(p, 'Chain of Command') }
function mediumOrHeavy(p) { return [2, 3].includes(p.troopType) }
function combatSupport(p, profiles, index) {
  if (skill(p, 'Peripheral')) return false
  return profiles.some((ally, allyIndex) => allyIndex !== index
    && ((medic(p) && ally.vita === true) || (engineer(p) && ally.structure === true)))
}
function activeTrooper(p) { return Number.isFinite(p.cc) && p.cc > 0 && !skill(p, 'Peripheral') }
function canCivEvac(p) { return ![5, 8].includes(p.troopType) && !skill(p, 'Impetuous') && !skill(p, 'Peripheral') }
function observerOrSpotlight(p) { return skill(p, 'Forward Observer') || (p.hackingPrograms || []).some(name => token(name, 'Spotlight')) }
