// ITS 18 objectives: https://experience.corvusbelli.com/en/infinity/its
// September update: https://infinityuniverse.com/en/news/its18-hotfix-september
// Cross-checked with https://infinitygeist.com/ for action eligibility.
// Panic Room uses its archived ITS 16 rules. Dead Man's Switch has no verified
// rules in either catalog, so it deliberately uses the general-purpose plan.
const plans = {
  'akial interference': { target: 5, focus: 'diverse specialists for repeated Classifieds', weights: { classified: 8, objectives: 2 } },
  annihilation: { target: 0, focus: 'killing power and surviving Army Points', weights: { combat: 8, survive: 6 }, lieutenantKills: true, deprioritizeFOandSO: true },
  'area of interest': { target: 2, focus: 'area presence and Antenna activation', weights: { zones: 6, objectives: 5, classified: 2 } },
  battleground: { target: 0, focus: 'central and far sector control with capable attackers', weights: { zones: 8, combat: 5 }, deprioritizeFOandSO: true },
  'b pong': { target: 3, focus: 'move the Beacon and control Consoles', weights: { courier: 6, objectives: 6, classified: 2 } },
  'corporate appropriation': { target: 2, focus: 'recover and protect Prototypes; contest Panoplies', weights: { courier: 6, objectives: 3, demolition: 3, classified: 2 } },
  'critical intervention': { target: 2, focus: 'reach the Data Console and hold the Server Room', weights: { courier: 5, objectives: 5, zones: 4, combat: 2 } },
  'crossing lines': { target: 3, focus: 'dominate Dead Zones and activate Antennas', weights: { zones: 3, objectives: 3, baggage: 2 } },
  // Reinforced Tactical Link makes the Lieutenant public and removes Loss of Lieutenant.
  // Cutthroat also scores kills made by the Lieutenant and kills of enemy Lieutenants.
  cutthroat: { target: 0, focus: 'kill enemy leaders and preserve attacking power', weights: { combat: 8, survive: 5, midfield: 2 }, lieutenantKills: true, tacticalLink: true, deprioritizeFOandSO: true },
  'data harvest': { target: 3, focus: 'extract Data-Harvesters and advance into the enemy half', weights: { objectives: 5, courier: 5, midfield: 4, baggage: 2, classified: 2 } },
  'double bind': [
    { target: 3, focus: 'Encryption: activate and hold Antennas', weights: { objectives: 7, zones: 3, classified: 2 } },
    { target: 2, focus: 'Sabotage: destroy Antennas with D-Charges or anti-materiel CC', weights: { demolition: 10, combat: 3, classified: 2 }, seed: 'demolition' },
    { target: 1, focus: 'Secure Vector: dominate Zones of Influence', weights: { zones: 8, combat: 3, classified: 2 } },
  ],
  evacuation: { target: 2, focus: 'extract Civilians with eligible, mobile carriers', weights: { civEvac: 9, classified: 4 } },
  // The N5.3 Firefight scenario also uses Reinforced Tactical Link.
  firefight: { target: 3, focus: 'kill enemy leaders and Specialists while preserving your own', weights: { combat: 7, survive: 4, objectives: 2 }, lieutenantKills: true, tacticalLink: true },
  hardlock: { target: 4, focus: 'activate Consoles and reach the enemy Beacon', weights: { objectives: 7, courier: 3, classified: 2 } },
  'last launch': { target: 4, focus: 'extract specialists and Army Points; hold the Tower', weights: { objectives: 5, courier: 4, classified: 5, zones: 2 } },
  neutralization: { target: 3, focus: 'extract Hyperthermal Tech and control Antennas', weights: { objectives: 4, courier: 5, baggage: 3, zones: 3, classified: 2 } },
  outbreak: { target: 2, focus: 'scan and stabilize Infected; escort Civilians', weights: { medical: 10, civEvac: 6 }, seed: 'medical' },
  'panic room': { target: 1, focus: 'hold the central room with Essential Personnel', weights: { room: 8, essential: 6, survive: 3 } },
  provisioning: { target: 2, focus: 'carry Supply Boxes into the safe area', weights: { courier: 7, objectives: 3, classified: 2 } },
  superiority: { target: 2, focus: 'dominate quadrants and hack Consoles', weights: { zones: 6, objectives: 5, hacker: 3 } },
  'the dig': { target: 3, focus: 'analyze Hyperthermal Tech before neutralizing it', weights: { objectives: 8, courier: 3, classified: 3 } },
  'uplink center': { target: 3, focus: 'activate Antennas, control the Tech-Coffin, keep the Lt active', weights: { objectives: 6, zones: 5, leadership: 5 } },
}

const key = value => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const cap = (value, limit) => Math.min(limit, value)
const best = (profiles, limit, value) => profiles.map(value).sort((a, b) => b - a).slice(0, limit)
  .reduce((sum, item) => sum + item, 0)
const grade = value => ({ S: 1.3, A: 1, B: .5 })[value] || 0

export function missionPlan(mission, variant = 0) {
  const choices = plans[key(mission)]
  if (!choices) return { target: 3, focus: 'general-purpose roster; mission rules not verified', weights: {}, verified: false }
  return { ...(Array.isArray(choices) ? choices[variant % choices.length] : choices),
    variant: Array.isArray(choices) ? variant % choices.length : 0, verified: true }
}

export function missionRoleScore(profiles, role) {
  const eligible = profiles.filter(item => item.slots === 1 && !item.startsOffTable)
  const onRoster = profiles.filter(item => item.slots === 1)
  switch (role) {
    case 'objectives':
      return best(eligible.filter(item => item.specialist), 3, item => cap((item.mobility || 25) / 48, 1.4))
    case 'classified': {
      const roles = ['hacker', 'doctor', 'engineer', 'paramedic', 'forwardObserver', 'specialistOperative', 'chainOfCommand']
      return cap(roles.filter(role => profiles.some(item => item[role])).length, 4)
    }
    case 'medical':
      return best(eligible.filter(item => item.doctor || item.paramedic || item.specialistOperative), 3,
        item => item.doctor || item.paramedic ? 1 : .8)
    case 'civEvac':
      return best(eligible.filter(item => item.civEvacEligible), 3,
        item => cap((item.mobility || 25) / 48, 1.4))
    case 'courier':
      return best(eligible, 3, item => cap((item.mobility || 25) / 52, 1.25))
    case 'zones':
      return best(eligible, 3, item => cap((item.points + (item.baggage ? 20 : 0)) / 38, 1.5))
    case 'room':
      return best(eligible.filter(item => item.troopType !== 5 && item.troopType !== 8), 3,
        item => cap((item.points + (item.armor || 0) * 3) / 42, 1.5))
    case 'demolition':
      return best(onRoster.filter(item => item.demolition), 2,
        item => .7 + cap((item.mobility || 20) / 80, .6))
    case 'midfield':
      return best(eligible.filter(item => item.forwardDeployment), 2, item => 1)
    case 'combat': {
      const distinct = new Map()
      for (const item of onRoster) distinct.set(item.unitId, Math.max(distinct.get(item.unitId) || 0,
        grade(item.gunfighterGrade), grade(item.ccGrade)))
      return [...distinct.values()].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0)
    }
    case 'survive':
      return best(onRoster.filter(item => item.points >= 20), 2,
        item => cap(((item.wounds || 1) - 1) * .55 + (item.armor || 0) / 8, 1.25))
    case 'essential':
      return best(eligible.filter(item => item.essentialPersonnel), 2,
        item => item.lieutenant ? .5 : 1)
    case 'leadership':
      return cap(profiles.filter(item => item.chainOfCommand).length, 1)
        + best(profiles.filter(item => item.lieutenant), 1, item => cap(((item.wounds || 1) - 1) * .5 + (item.armor || 0) / 8, 1))
    case 'baggage':
      return cap(eligible.filter(item => item.baggage).length, 2)
    case 'hacker':
      return cap(eligible.filter(item => item.hacker).length, 2)
    default: return 0
  }
}

export function missionScore(profiles, plan) {
  return Object.entries(plan.weights).reduce((score, [role, weight]) =>
    score + missionRoleScore(profiles, role) * weight, 0)
}

export function missionSummary(profiles, plan) {
  const parts = []
  if (plan.weights.medical) parts.push(`${profiles.filter(item => item.doctor || item.paramedic || item.specialistOperative).length} medical specialists`)
  if (plan.weights.demolition) parts.push(`${profiles.filter(item => item.demolition).length} demolition options`)
  if (plan.weights.civEvac) parts.push(`${profiles.filter(item => item.civEvacEligible && !item.startsOffTable).length} eligible escorts`)
  if (plan.weights.baggage) parts.push(`${profiles.filter(item => item.baggage).length} Baggage`)
  return `${plan.focus}${parts.length ? ` · ${parts.join(', ')}` : ''}`
}
