import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  resolvePlayerFactionPortrait,
  resolvePlayerFactionPortraitDetails,
} from '../src/config/factionPortraits.ts'

const fixtures = [
  {
    expected: 'operations-subsection.png',
    name: 'sectorial outranks parent faction',
    playerCard: {
      playerFaction: 'ALEPH',
      preferredArmy: 'Operations Subsection',
    },
    publicProfile: {
      mostPlayedParentFaction: 'ALEPH',
      playerFaction: 'ALEPH',
      preferredArmy: 'Operations Subsection',
    },
  },
  {
    expected: 'bakunin.png',
    name: 'preferred army priority is shared',
    playerCard: {
      playerFaction: 'Nomads',
      preferredArmy: 'Bakunin Jurisdictional Command',
    },
    publicProfile: {
      favoriteArmy: 'Nomads',
      playerFaction: 'Nomads',
      preferredArmy: 'Bakunin Jurisdictional Command',
    },
  },
  {
    expected: 'aleph.png',
    name: 'current event army is explicit only',
    playerCard: {
      currentEventArmy: 'ALEPH',
      playerFaction: 'Operations Subsection',
      preferredArmy: 'Operations Subsection',
    },
    publicProfile: {
      currentEventArmy: 'ALEPH',
      playerFaction: 'Operations Subsection',
      preferredArmy: 'Operations Subsection',
    },
  },
  {
    expected: 'operations-subsection.png',
    name: 'stale tournament army does not override normal portrait',
    playerCard: {
      playerFaction: 'ALEPH',
      preferredArmy: 'Operations Subsection',
    },
    publicProfile: {
      favoriteArmy: 'ALEPH',
      playerFaction: 'ALEPH',
      preferredArmy: 'Operations Subsection',
    },
  },
  {
    expected: 'frrm.png',
    name: 'alias and accent differences normalize',
    playerCard: {
      preferredArmy: 'Force de Reponse Rapide Merovingienne',
    },
    publicProfile: {
      preferredArmy: 'FRRM',
    },
  },
  {
    expected: '',
    name: 'unsupported factions return no portrait',
    playerCard: {
      preferredArmy: 'Unknown Sectorial',
    },
    publicProfile: {
      favoriteArmy: 'Unknown Sectorial',
    },
  },
]

for (const fixture of fixtures) {
  assert.equal(filename(resolvePlayerFactionPortrait(fixture.playerCard)), fixture.expected, fixture.name)
  assert.equal(filename(resolvePlayerFactionPortrait(fixture.publicProfile)), fixture.expected, fixture.name)
}

const source = [
  readFileSync('src/config/factionPortraits.ts', 'utf8'),
  readFileSync('src/components/PlayerCard.tsx', 'utf8'),
  readFileSync('src/pages/PlayerProfile.tsx', 'utf8'),
  readFileSync('src/pages/MyProfile.tsx', 'utf8'),
].join('\n')

assert.doesNotMatch(
  source,
  /resolvePlayerFactionPortrait\([^)]*(displayName|decodedPlayerName|playerName)\b/,
  'Player portrait resolution must not use player names.',
)

if (existsSync('.tmp/portrait-audit-source.json')) {
  const sourceData = JSON.parse(readFileSync('.tmp/portrait-audit-source.json', 'utf8'))
  const auditRows = buildAuditRows(sourceData)
  const mismatches = auditRows.filter(
    (row) => row.playersPagePortraitFilename !== row.publicProfilePortraitFilename,
  )

  assert.equal(mismatches.length, 0, formatMismatchMessage(mismatches))
  console.log(`real production player portrait audit passed: ${auditRows.length} players`)
}

console.log('player portrait consistency checks passed')

function buildAuditRows(sourceData) {
  const profiles = new Map(
    (sourceData.profiles || []).map((entry) => [entry.name, entry.profile || {}]),
  )

  return (sourceData.playersPayload.divisions || []).flatMap((division) =>
    (division.standings || []).map((standing) => {
      const profile = profiles.get(standing.player) || {}
      const quickStats = profile.careerSummary?.quickStats || {}
      const leagueModel = {
        currentLeague: division.event?.name || division.divisionLabel || '',
        division: standing.division || division.divisionLabel || '',
        preferredArmy: standing.favoriteArmy || standing.faction || '',
      }
      const playersPage = resolvePlayerFactionPortraitDetails({
        currentEventArmy: '',
        playerFaction: standing.faction,
        preferredArmy: standing.favoriteArmy,
      })
      const publicProfile = resolvePlayerFactionPortraitDetails({
        currentEventArmy: leagueModel.preferredArmy,
        favoriteArmy: profile.armyListSummary?.favoriteFaction,
        mostPlayedArmy: quickStats.mostPlayedArmy,
        mostPlayedParentFaction: quickStats.mostPlayedArmyParentFaction,
        preferredArmy: profile.favoriteFaction,
      })

      return {
        canonicalPlayerName: profile.name || standing.player,
        displayName: profile.displayName || standing.displayName,
        playersPagePortraitFilename: filename(playersPage.portrait),
        publicProfilePortraitFilename: filename(publicProfile.portrait),
      }
    }),
  )
}

function filename(portrait) {
  return portrait?.src?.split('/').pop() || ''
}

function formatMismatchMessage(mismatches) {
  return mismatches
    .map(
      (row) =>
        `${row.canonicalPlayerName}: Players=${row.playersPagePortraitFilename || 'none'} Profile=${
          row.publicProfilePortraitFilename || 'none'
        }`,
    )
    .join('\n')
}
