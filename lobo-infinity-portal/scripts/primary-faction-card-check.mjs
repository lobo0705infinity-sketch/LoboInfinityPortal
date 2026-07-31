import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

const files = {
  dashboard: read('src/pages/Dashboard.tsx'),
  myProfile: read('src/pages/MyProfile.tsx'),
  playerProfile: read('src/pages/PlayerProfile.tsx'),
  component: read('src/components/PrimaryFactionCard.tsx'),
  styles: read('src/components/PrimaryFactionCard.css'),
  icons: read('src/assets/operator-badges/factions/index.ts'),
}

const checks = [
  {
    label: 'PrimaryFactionCard uses the existing faction artwork registry',
    pass:
      files.component.includes("import { getFactionIcon } from '../assets/operator-badges/factions'") &&
      files.component.includes('const icon = getFactionIcon(normalizedFaction)') &&
      files.component.includes("<img alt=\"\" aria-hidden=\"true\""),
  },
  {
    label: 'PrimaryFactionCard renders the default Lobo badge for pending factions',
    pass:
      files.component.includes("const pendingFactionLabel = 'Faction Pending.'") &&
      files.component.includes('const displayFaction = normalizedFaction || pendingFactionLabel') &&
      /if \(!preferredFaction\?\.trim\(\)\) return LoboDefault/.test(files.icons),
  },
  {
    label: 'Commander Overview renders Primary Faction through the shared card',
    pass:
      files.dashboard.includes("import PrimaryFactionCard from '../components/PrimaryFactionCard'") &&
      /<PrimaryFactionCard faction=\{leader\?\.faction \|\| leader\?\.favoriteArmy\} \/>/.test(files.dashboard) &&
      !files.dashboard.includes('<dt>Primary Faction</dt>'),
  },
  {
    label: 'Public Player Profile renders Primary Faction through the shared card',
    pass:
      files.playerProfile.includes("import PrimaryFactionCard from '../components/PrimaryFactionCard'") &&
      /<PrimaryFactionCard faction=\{player\.favoriteFaction \|\| player\.armyListSummary\.favoriteFaction\} \/>/.test(
        files.playerProfile,
      ) &&
      !files.playerProfile.includes('label="Primary Faction"'),
  },
  {
    label: 'My Profile renders Primary Faction through the shared card',
    pass:
      files.myProfile.includes("import PrimaryFactionCard from '../components/PrimaryFactionCard'") &&
      /<PrimaryFactionCard[\s\S]*faction=\{favoriteArmy\}[\s\S]*variant="readonly"[\s\S]*\/>/.test(files.myProfile) &&
      /<PrimaryFactionCard faction=\{summary\.favoriteFaction\} \/>/.test(files.myProfile),
  },
  {
    label: 'Operations Subsection resolves the OSS badge',
    pass:
      files.icons.includes('import OperationsSubsection from "./operations-subsection.svg";') &&
      files.icons.includes('"Operations Subsection": OperationsSubsection'),
  },
  {
    label: 'Shasvastii resolves the Shasvastii badge',
    pass:
      files.icons.includes('import Shasvastii from "./shasvastii-expeditionary-force.svg";') &&
      files.icons.includes('"Shasvastii Expeditionary Force": Shasvastii'),
  },
  {
    label: 'PrimaryFactionCard styling prevents text-only fallback appearance',
    pass:
      files.styles.includes('.primary-faction-card-value img') &&
      files.styles.includes('object-fit: contain') &&
      files.styles.includes('.primary-faction-card.is-pending .primary-faction-card-value img'),
  },
]

const failures = checks.filter((check) => !check.pass)

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.label}`)
}

if (failures.length > 0) {
  process.exitCode = 1
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}
