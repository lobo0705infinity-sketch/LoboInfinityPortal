import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const playerCard = read('src/components/PlayerCard.tsx')
const portraits = read('src/config/factionPortraits.ts')
const css = read('src/App.css')
const myProfile = read('src/pages/MyProfile.tsx')

const registryDeclarations = [
  playerCard,
  portraits,
  css,
  myProfile,
].join('\n').match(/\bFACTION_PORTRAIT_REGISTRY\b/g) ?? []

assert.equal(
  registryDeclarations.length,
  2,
  'Only the centralized faction portrait registry module should declare/export the registry.',
)

assert.match(
  playerCard,
  /resolveFactionPortraitFromArmyPriority\(\s*player\.faction,\s*player\.favoriteArmy,\s*\)/,
  'Player cards must resolve portraits from current faction before preferred army.',
)

assert.doesNotMatch(
  playerCard,
  /resolveFactionPortrait(?:FromArmyPriority)?\([^)]*(player\.player|displayName|playerName)/,
  'Player cards must not assign portraits by player name or display name.',
)

assert.match(
  playerCard,
  /className="division-badge player-card-division"[\s\S]*<h2>\{playerName\}<\/h2>/,
  'Player cards must keep the division badge and player name.',
)

assert.match(
  playerCard,
  /<img[\s\S]*loading="lazy"[\s\S]*onError=\{onError\}[\s\S]*src=\{portrait\.src\}/,
  'Player portraits must lazy-load and hide on image errors.',
)

assert.match(
  css,
  /\.player-card\.has-faction-portrait[\s\S]*linear-gradient/,
  'Portrait player cards must include a text-protecting gradient treatment.',
)

assert.match(
  css,
  /\.player-card\.has-faction-portrait[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(104px, 30%\)/,
  'Portrait player cards must use defined content and portrait columns.',
)

assert.match(
  playerCard,
  /<div className="player-card-content">[\s\S]*<PlayerCardPortrait/,
  'Player card content must be separated from the portrait column.',
)

assert.match(
  css,
  /\.player-card-portrait img[\s\S]*object-fit: cover[\s\S]*object-position: center top/,
  'Portrait images must use a deliberate upper-body crop.',
)

assert.match(
  playerCard,
  /className="player-card-stat-wide"[\s\S]*<dt>Army<\/dt>/,
  'Army stat must use a wide stat tile for readable faction names.',
)

assert.match(
  css,
  /@media \(max-width: 640px\)[\s\S]*\.player-card\.has-faction-portrait[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(68px, 22%\)/,
  'Mobile player cards must constrain the portrait column to avoid horizontal scrolling.',
)

assert.match(
  myProfile,
  /resolveFactionPortrait\(\s*data\.user\.favoriteFaction \|\| leagueModel\?\.preferredArmy,\s*\)/,
  'My Profile portrait behavior must remain on the existing resolver call.',
)

console.log('players portrait checks passed')
