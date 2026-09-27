import assert from 'node:assert/strict'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import { SOURCED_STORY_SCENARIOS } from '../src/data/generatedStoryScenarios.ts'
import type { GameStoryTemplate, HeroRole } from '../src/services/gameStoryTemplate.ts'

const activeArmies = new Set(CANONICAL_ARMY_REGISTRY.filter((army) => army.active).map((army) => army.name))
const roles = new Set<HeroRole>(['gunfighting', 'closeCombat', 'objective'])
const allowedTokens = new Set(['hero', 'heroPlayer', 'otherPlayer', 'allyGunfighter', 'enemyGunfighter', 'winner', 'loser'])
const roleActionTerms: Record<HeroRole, RegExp> = {
  gunfighting: /\b(?:aim|attack|barrel|cover|driv|drove|fire|fired|gun|held|kept|muzzle|pin|pinned|raider|rifle|shot|shoot|sniper|suppress|target|turret|weapon)\w*\b/i,
  closeCombat: /\b(?:armed|attacker|blade|caught|close|drove|duel|fight|fought|forced|grapple|intercept|melee|opponent|parr|push|shov|strike|struck|struggle|sword|wrestl)\w*\b/i,
  objective: /\b(?:access|analy|calibrat|check|compar|connect|control|copy|cut|decode|direct|discover|examin|find|fit|follow|found|guid|hack|identif|inspect|isolat|listen|locat|map|measur|open|place|read|repair|retriev|scanner|secur|sensor|specialist|trace|traced|work)\w*\b/i,
}

const missionPlotTerms: Record<string, RegExp> = {
  'Area of Interest': /\b(?:approach|arriv|area|boundary|came|claim|converg|control|disput|enter|follow|guard|had|held|hold|insist|move|needed|occup|order|perimeter|plan|prepar|protect|reach|refus|secure|site|sought|territory|tried|wanted|zone)\w*\b/i,
  'Akial Interference': /\b(?:akial|interference|signal|static|echo|pulse|broadcast|carrier|frequency|transmi|relay)\w*\b/i,
  'B-Pong': /\b(?:ball|beacon|goal|court|paddle|score|serve|rebound)\w*\b/i,
  'Corporate Appropriation': /\b(?:asset|cargo|company|contract|corporat|ownership|repossess|vault|prototype|panoply)\w*\b/i,
  'Critical Intervention': /\b(?:critical|intervention|emergency|rescue|stabiliz|triage|data pack|data console|server room)\w*\b/i,
  'Crossing Lines': /\b(?:border|crossing|line|checkpoint|corridor|passage|route|dead zone|antenna)\w*\b/i,
  "Dead Man's Switch": /\b(?:dead man|switch|trigger|detonat|device|failsafe|signal|timer|transmitter|quantum core|data pack|objective room|resonance)\w*\b/i,
  Evacuation: /\b(?:evacuat|escape|extract|refugee|rescue|shelter)\w*\b/i,
  Hardlock: /\b(?:hardlock|lock|access|console|control|crossroad|door|gate|hatch|held|hold|middle|network|point|seal|system|terminal)\w*\b/i,
  'Last Launch': /\b(?:launch|rocket|shuttle|countdown|gantry|pad|liftoff)\w*\b/i,
  Neutralization: /\b(?:neutraliz|disable|target|threat|weapon|contain)\w*\b/i,
  Outbreak: /\b(?:outbreak|contag|infect|quarantine|sample|vaccine)\w*\b/i,
  'Panic Room': /\b(?:panic room|safe room|shelter|bunker|sealed room|refuge)\w*\b/i,
  Provisioning: /\b(?:provision|supply|ration|cargo|delivery|stockpile)\w*\b/i,
  Annihilation: /\b(?:annihilat|destroy|eliminat|firefight|weapon|surviv)\w*\b/i,
  Battleground: /\b(?:battleground|battlefield|front|position|trench|stronghold|sector)\w*\b/i,
  Cutthroat: /\b(?:cutthroat|betray|ambush|rival|treach|double-cross|lieutenant|army points)\w*\b/i,
  Superiority: /\b(?:superior|dominat|control|sector|position|territory)\w*\b/i,
  'Uplink Center': /\b(?:uplink|antenna|data|network|relay|signal|transmission)\w*\b/i,
  'Double Bind': /\b(?:double bind|choice|dilemma|linked|simultaneous|two|antenna|zone of influence)\w*\b/i,
  'The Dig': /\b(?:dig|dug|excavat|buried|below|chamber|earth|miner|quarry|shaft|soil|stone|tunnel|underground)\w*\b/i,
  'Data Harvest': /\b(?:data|harvest|archive|download|record|server|storage)\w*\b/i,
}

const words = (value: string) => value.trim().split(/\s+/).filter(Boolean).length
const normalized = (value: string) => value.toLocaleLowerCase().replace(/\{\{\w+\}\}/g, 'token').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const sentenceCount = (value: string) => value.trim().split(/(?<=[.!?])(?:["'”’)]*)\s+/u).filter(Boolean).length

export function assertGameStoryQuality(story: GameStoryTemplate, key: string): void {
  assert.ok(CANONICAL_MISSIONS.includes(story.mission as never), `${key}: noncanonical mission`)
  assert.ok(Array.isArray(story.factions) && story.factions.length === 2 && story.factions.every((faction) => activeArmies.has(faction)), `${key}: inactive or alias faction`)
  assert.ok(story.factions.includes(story.heroFaction), `${key}: hero faction must be in the matchup`)
  assert.ok(roles.has(story.role), `${key}: invalid hero role`)
  assert.ok(Array.isArray(story.paragraphs) && story.paragraphs.length === 3, `${key}: expected exactly three paragraphs`)

  const paragraphShapes = new Set<string>()
  for (const [index, paragraph] of story.paragraphs.entries()) {
    assert.equal(typeof paragraph, 'string', `${key}: paragraph ${index + 1} must be text`)
    const wordCount = words(paragraph)
    assert.ok(wordCount >= 40 && wordCount <= 75, `${key}: paragraph ${index + 1} must contain 40-75 words (found ${wordCount})`)
    const shape = normalized(paragraph)
    assert.ok(shape && !paragraphShapes.has(shape), `${key}: paragraphs must be distinct`)
    paragraphShapes.add(shape)
  }

  const scene = story.paragraphs.join(' ')
  const tokens = [...scene.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1])
  assert.ok(tokens.includes('hero'), `${key}: missing roster-selected hero`)
  assert.ok(tokens.includes('heroPlayer') && tokens.includes('otherPlayer'), `${key}: scene must identify both players`)
  assert.ok(tokens.every((token) => allowedTokens.has(token)), `${key}: scene contains an unsupported placeholder`)
  const heroParagraph = story.paragraphs.find((paragraph) => paragraph.includes('{{hero}}')) ?? ''
  assert.match(heroParagraph, roleActionTerms[story.role], `${key}: {{hero}} action does not fit ${story.role}`)
  assert.match(scene, missionPlotTerms[story.mission], `${key}: scene lacks mission-specific plot evidence`)

  assert.ok(story.endings && typeof story.endings === 'object', `${key}: missing endings`)
  assert.deepEqual(Object.keys(story.endings).sort(), ['draw', 'heroLoses', 'heroWins'], `${key}: endings must contain only win, loss, and draw`)
  const endings = [story.endings.heroWins, story.endings.heroLoses, story.endings.draw]
  assert.ok(endings.every((ending) => typeof ending === 'string' && ending.trim() && sentenceCount(ending) === 1), `${key}: each ending must be one sentence`)
  assert.equal(new Set(endings.map(normalized)).size, 3, `${key}: win, loss, and draw endings must be distinct`)
  const endingTokens = endings.flatMap((ending) => [...ending.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]))
  assert.ok(endingTokens.every((token) => allowedTokens.has(token)), `${key}: ending contains an unsupported placeholder`)
}

// New writing must carry the actual scenario objective through the plot and
// every possible outcome. The legacy 1,300-entry catalog is audited separately
// and cannot be retroactively called mission-verified by its format check.
export function assertGameStoryMissionObjective(story: GameStoryTemplate, key: string): void {
  const scenario = SOURCED_STORY_SCENARIOS[story.mission as keyof typeof SOURCED_STORY_SCENARIOS]
  assert.ok(scenario, `${key}: no sourced mission premise`)
  const scene = story.paragraphs.join(' ')
  const specific: Record<string, { scene: readonly RegExp[]; endings: readonly RegExp[] }> = {
    'Area of Interest': {
      scene: [/\b(?:communication antenna|relay mast|antenna)\b/i,
        /\b(?:control|hold|held|claim|dominat|contes|scor|zone|area|ground)\w*\b/i],
      endings: [/\b(?:communication antenna|relay mast|antenna)\b/i,
        /\b(?:control|held|hold|claim|dominat|contes|scor|area|ground|zone)\w*\b/i],
    },
    'Akial Interference': {
      scene: [/\bclassified\s+(?:objectives?|cards?)\b/i],
      endings: [/\bclassified\s+objectives?\b/i],
    },
    'B-Pong': {
      scene: [/\btracking\s+beacon\b/i, /\bconsoles?\b/i],
      endings: [/\btracking\s+beacon\b/i, /\bconsoles?\b/i],
    },
    "Dead Man's Switch": {
      scene: [/\b(?:Quantum Core|Objective Room)\b/i, /\b(?:Data Pack|Quantum Resonance)\b/i],
      endings: [/\b(?:Quantum Core|Objective Room|Data Pack|Quantum Resonance)\b/i],
    },
    Hardlock: {
      scene: [/\b(?:enemy )?beacon\b/i, /\bconsoles?\b/i],
      endings: [/\bbeacon\b/i, /\bconsoles?\b/i],
    },
    'The Dig': {
      scene: [/\bhyperthermal\s+tech\b/i, /\banaly[sz]\w*\b/i,
        /\b(?:neutraliz\w*|neutralis\w*)\b/i, /\bconsoles?\b/i],
      endings: [/\b(?:hyperthermal\s+tech|the tech)\b/i,
        /\banaly[sz]\w*\b/i, /\bneutraliz\w*\b/i],
    },
  }
  const rules = specific[story.mission] ?? { scene: [scenario.anchor], endings: [scenario.anchor] }
  for (const signal of rules.scene) {
    assert.match(scene, signal, `${key}: plot misses the mission objective (${signal})`)
  }
  for (const [result, ending] of Object.entries(story.endings)) {
    for (const signal of rules.endings) {
      assert.match(ending, signal, `${key}: ${result} ending misses the mission objective (${signal})`)
    }
  }
  if (story.mission === 'Crossing Lines') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '), /\b(?:HVT|classified(?:\s+deck|\s+objective)?)\b/i,
      `${key}: ITS 18 Crossing Lines has no HVT or Classified Deck after the September 24 hotfix`)
  }
  if (story.mission === 'B-Pong') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\b(?:beacon\s+(?:had|has|must)\s+to\s+be\s+controlled\s+before|(?:must|has|had|needed)\s+(?:to\s+)?control\s+(?:the\s+)?(?:tracking\s+)?beacon\s+before\s+(?:it|anyone|they)\s+(?:can|could)\s+(?:move|relocat))/i,
      `${key}: B-Pong permits a specialist in contact to relocate the beacon without prior control`)
  }
  if (story.mission === 'Akial Interference') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\b(?:classified\s+objective\s+(?:marker|site|evidence)|objective\s+(?:marker|evidence)|evidence\s+marker)\b/i,
      `${key}: Akial public cards do not establish a fixed physical evidence marker`)
  }
  if (story.mission === 'Evacuation' || story.mission === 'Last Launch') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\bextraction\s+(?:line|marker)\b/i,
      `${key}: ${story.mission} uses a console or ID Checker, not an extraction line or marker`)
  }
  if (story.mission === 'Neutralization') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\b(?:neutraliz\w*\s+antenna\s+command|antenna\s+command|neutraliz\w*\s+(?:the\s+)?tech\s+(?:through|with)\s+(?:the\s+)?antenna)\b/i,
      `${key}: carried tech neutralizes inside a Neutralization Area, not by antenna command`)
  }
  if (story.mission === 'The Dig') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\b(?:neutraliz\w*\s+command|command\s+to\s+neutraliz\w*)\b/i,
      `${key}: The Dig neutralizes an analyzed tech in contact, not by console command`)
  }
  if (story.mission === 'Outbreak') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\b(?:scan(?:ned|ning)?\s+(?:is\s+)?(?:needed|required|before)|(?:clear\s+)?scan\s+before)\s+stabili[sz]/i,
      `${key}: scanning is not a prerequisite to stabilizing an Infected`)
  }
  if (story.mission === 'Uplink Center') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\bTech-Coffin(?:'s)?\s+(?:lid|latch|contents|lock)\b|\b(?:opening|unlocking)\s+(?:the\s+)?Tech-Coffin\b/i,
      `${key}: Uplink Center controls the Tech-Coffin by sole contact, not by opening it`)
  }
  if (story.mission === 'Battleground') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\bsector\s+marker\b/i,
      `${key}: Battleground sectors are marked out only when the game ends`)
  }
  if (story.mission === 'Data Harvest') {
    assert.doesNotMatch(scene + ' ' + Object.values(story.endings).join(' '),
      /\b(?:replac\w*\s+(?:the\s+)?power\s+cell|harvester\s+stopped\s+transmitting\s+at\s+the\s+designated\s+zone\s+boundary)\b/i,
      `${key}: deposited harvesters activate inside a zone; cell replacement is not an objective skill`)
  }
}
