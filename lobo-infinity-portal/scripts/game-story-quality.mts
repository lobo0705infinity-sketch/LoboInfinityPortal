import assert from 'node:assert/strict'
import { CANONICAL_ARMY_REGISTRY } from '../src/config/armies.ts'
import { CANONICAL_MISSIONS } from '../src/config/missions.ts'
import type { GameStoryTemplate, HeroRole } from '../src/services/gameStoryTemplate.ts'

const activeArmies = new Set(CANONICAL_ARMY_REGISTRY.filter((army) => army.active).map((army) => army.name))
const roles = new Set<HeroRole>(['gunfighting', 'closeCombat', 'objective'])
const allowedTokens = new Set(['hero', 'heroPlayer', 'otherPlayer', 'allyGunfighter', 'enemyGunfighter', 'winner', 'loser'])
const roleActionTerms: Record<HeroRole, RegExp> = {
  gunfighting: /\b(?:aim|attack|barrel|cover|driv|drove|fire|fired|gun|held|kept|muzzle|pin|pinned|raider|rifle|shot|shoot|sniper|suppress|target|turret|weapon)\w*\b/i,
  closeCombat: /\b(?:armed|attacker|blade|caught|close|drove|duel|fight|fought|forced|grapple|intercept|melee|opponent|parr|push|shov|strike|struck|struggle|sword|wrestl)\w*\b/i,
  objective: /\b(?:access|analy|calibrat|check|compar|connect|control|copy|cut|decode|discover|examin|find|fit|follow|found|hack|inspect|isolat|listen|map|measur|open|place|read|repair|retriev|scanner|secur|sensor|specialist|trace|traced|work)\w*\b/i,
}

const missionPlotTerms: Record<string, RegExp> = {
  'Area of Interest': /\b(?:approach|arriv|area|boundary|came|claim|converg|control|disput|enter|follow|guard|had|held|hold|insist|move|needed|occup|order|perimeter|plan|prepar|protect|reach|refus|secure|site|sought|territory|tried|wanted|zone)\w*\b/i,
  'Akial Interference': /\b(?:akial|interference|signal|static|echo|pulse|broadcast|carrier|frequency|transmi|relay)\w*\b/i,
  'B-Pong': /\b(?:ball|beacon|goal|court|paddle|score|serve|rebound)\w*\b/i,
  'Corporate Appropriation': /\b(?:asset|cargo|company|contract|corporat|ownership|repossess|vault)\w*\b/i,
  'Critical Intervention': /\b(?:critical|intervention|emergency|rescue|stabiliz|triage)\w*\b/i,
  'Crossing Lines': /\b(?:border|crossing|line|checkpoint|corridor|passage|route)\w*\b/i,
  "Dead Man's Switch": /\b(?:dead man|switch|trigger|detonat|device|failsafe|signal|timer|transmitter)\w*\b/i,
  Evacuation: /\b(?:evacuat|escape|extract|refugee|rescue|shelter)\w*\b/i,
  Hardlock: /\b(?:hardlock|lock|access|console|control|crossroad|door|gate|hatch|held|hold|middle|network|point|seal|system|terminal)\w*\b/i,
  'Last Launch': /\b(?:launch|rocket|shuttle|countdown|gantry|pad|liftoff)\w*\b/i,
  Neutralization: /\b(?:neutraliz|disable|target|threat|weapon|contain)\w*\b/i,
  Outbreak: /\b(?:outbreak|contag|infect|quarantine|sample|vaccine)\w*\b/i,
  'Panic Room': /\b(?:panic room|safe room|shelter|bunker|sealed room|refuge)\w*\b/i,
  Provisioning: /\b(?:provision|supply|ration|cargo|delivery|stockpile)\w*\b/i,
  Annihilation: /\b(?:annihilat|destroy|eliminat|firefight|weapon|surviv)\w*\b/i,
  Battleground: /\b(?:battleground|battlefield|front|position|trench|stronghold)\w*\b/i,
  Cutthroat: /\b(?:cutthroat|betray|ambush|rival|treach|double-cross)\w*\b/i,
  Superiority: /\b(?:superior|dominat|control|sector|position|territory)\w*\b/i,
  'Uplink Center': /\b(?:uplink|antenna|data|network|relay|signal|transmission)\w*\b/i,
  'Double Bind': /\b(?:double bind|choice|dilemma|linked|simultaneous|two)\w*\b/i,
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
