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
  armyIntelligence: read('src/pages/ArmyIntelligence.tsx'),
  navigation: read('src/services/armyIntelligenceNavigation.ts'),
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
      files.component.includes("const pendingFactionLabel = 'Faction Pending'") &&
      files.component.includes('const displayFaction = normalizedFaction || pendingFactionLabel') &&
      /if \(!preferredFaction\?\.trim\(\)\) return LoboDefault/.test(files.icons),
  },
  {
    label: 'PrimaryFactionCard navigates through the shared Army Intelligence route builder',
    pass:
      files.component.includes("import { useNavigate } from 'react-router-dom'") &&
      files.component.includes("import { buildArmyIntelligenceFactionPath } from '../services/armyIntelligenceNavigation'") &&
      files.component.includes('navigate(buildArmyIntelligenceFactionPath(normalizedFaction))') &&
      !files.component.includes("'/army-intelligence'") &&
      !files.component.includes('"/army-intelligence"'),
  },
  {
    label: 'PrimaryFactionCard uses the shared interactive metric affordance only when a faction exists',
    pass:
      files.component.includes('const isInteractive = Boolean(normalizedFaction)') &&
      files.component.includes("isInteractive ? 'interactive-metric-card interactive-metric-card-action is-interactive' : ''") &&
      files.component.includes('role: \'link\'') &&
      files.component.includes('tabIndex: 0') &&
      files.component.includes('onKeyDown: (event: KeyboardEvent<HTMLDivElement>)') &&
      files.component.includes("event.key !== 'Enter' && event.key !== ' '") &&
      files.component.includes('isInteractive') &&
      files.component.includes(': {}'),
  },
  {
    label: 'Army Intelligence accepts Primary Faction navigation preselection',
    pass:
      files.navigation.includes("export const armyIntelligencePath = '/army-intelligence'") &&
      files.navigation.includes("export const armyIntelligenceFactionParam = 'faction'") &&
      files.navigation.includes('URLSearchParams') &&
      files.navigation.includes('readArmyIntelligenceFactionParam') &&
      files.armyIntelligence.includes("import { Link, useSearchParams } from 'react-router-dom'") &&
      files.armyIntelligence.includes("import { readArmyIntelligenceFactionParam } from '../services/armyIntelligenceNavigation'") &&
      files.armyIntelligence.includes('const [searchParams] = useSearchParams()') &&
      files.armyIntelligence.includes('const requestedFaction = readArmyIntelligenceFactionParam(searchParams)') &&
      files.armyIntelligence.includes("const [selectedSectorial, setSelectedSectorial] = useState(requestedFaction)") &&
      /useEffect\(\(\) => \{[\s\S]*setSelectedSectorial\(requestedFaction\)[\s\S]*\}, \[requestedFaction, selectedSectorial\]\)/.test(files.armyIntelligence),
  },
  {
    label: 'Army Intelligence selector includes parent factions and sectorials from the same loaded data',
    pass:
      /const sectorials = useMemo\([\s\S]*buildArmyIntelligenceSelectorOptions\(uniqueDecodedLists\)[\s\S]*\[uniqueDecodedLists\]/.test(
        files.armyIntelligence,
      ) &&
      /function buildArmyIntelligenceSelectorOptions[\s\S]*getIntelligenceParentFaction\(list\)[\s\S]*getDecodedSectorial\(list\)/.test(
        files.armyIntelligence,
      ),
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
  {
    label: 'PrimaryFactionCard styling reuses interactive metric hover and focus behavior',
    pass:
      files.styles.includes('.primary-faction-card.is-interactive') &&
      files.styles.includes('transition:') &&
      files.styles.includes('.primary-faction-card.is-interactive:focus-visible') &&
      files.styles.includes('outline: 0') &&
      files.styles.includes('.primary-faction-card.is-interactive:hover') &&
      files.styles.includes('border-color: rgba(76, 201, 240, 0.58)') &&
      files.styles.includes('transform: translateY(-2px)'),
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
