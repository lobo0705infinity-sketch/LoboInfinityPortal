import type { CSSProperties, ReactNode } from 'react'
import type { PlayerClassification } from '../services/playerClassification'
import './OperatorBadge.css'

export type OperatorBadgeAchievement = {
  title: string
  unlocked?: boolean
}

export type OperatorBadgePlayer = {
  careerSummary?: {
    records?: {
      league?: { games?: number }
      tournament?: { games?: number }
    }
    totalGames?: number
  }
  displayName?: string
  division?: string
  favoriteFaction?: string
  name: string
  rank?: number
}

type OperatorBadgeProps = {
  achievements?: OperatorBadgeAchievement[]
  classifications?: PlayerClassification[]
  competitiveHome?: string
  player: OperatorBadgePlayer
  preferredFaction?: string
  rank?: number
  showBadges?: boolean
}

function OperatorBadge({
  achievements = [],
  classifications = [],
  competitiveHome = '',
  player,
  preferredFaction,
  rank,
  showBadges = true,
}: OperatorBadgeProps) {
  const playerName = player.displayName || player.name
  const faction = preferredFaction || player.favoriteFaction || 'Neutral Operator Badge'
  const displayRank = rank ?? player.rank ?? 0
  const home = normalizeCompetitiveHome(competitiveHome || player.division || '', classifications)
  const rings = deriveAchievementRings(player, classifications, achievements)
  const variant = factionVariant(faction)
  const ariaLabel = [
    playerName,
    `Preferred faction ${faction}`,
    `Competitive home ${home}`,
    displayRank > 0 ? `Rank ${displayRank}` : 'Unranked',
    classifications.length ? `Classification ${classifications.join(', ')}` : '',
    rings.length ? `Achievement rings ${rings.map(formatRingLabel).join(', ')}` : '',
  ].filter(Boolean).join('. ')

  return (
    <figure
      aria-label={ariaLabel}
      className="operator-badge"
      style={{
        '--operator-accent': variant.accent,
        '--operator-secondary': variant.secondary,
      } as CSSProperties & Record<'--operator-accent' | '--operator-secondary', string>}
    >
      <div className="operator-badge-mark" aria-hidden="true">
        <svg className="operator-badge-svg" viewBox="0 0 320 360" role="img">
          <defs>
            <linearGradient id={`operator-metal-${variant.id}`} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#6f7c86" />
              <stop offset="48%" stopColor="#121a24" />
              <stop offset="100%" stopColor="#050608" />
            </linearGradient>
            <linearGradient id={`operator-core-${variant.id}`} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="var(--operator-accent)" stopOpacity="0.36" />
              <stop offset="55%" stopColor="#050608" stopOpacity="0.94" />
              <stop offset="100%" stopColor="var(--operator-secondary)" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          <path
            className="operator-badge-outer"
            d="M160 22 257 62 298 160 257 258 160 298 63 258 22 160 63 62Z"
          />
          <path
            className="operator-badge-armature"
            d="M160 42 239 75 272 160 239 245 160 278 81 245 48 160 81 75Z"
          />
          <path
            className="operator-badge-core"
            d="M160 66 221 92 246 160 221 228 160 254 99 228 74 160 99 92Z"
            fill={`url(#operator-core-${variant.id})`}
          />
          <path
            className="operator-badge-inner"
            d="M160 84 204 103 222 160 204 217 160 236 116 217 98 160 116 103Z"
          />

          <AchievementArc ring="league-champion" rings={rings} />
          <AchievementArc ring="tournament-champion" rings={rings} />
          <AchievementArc ring="veteran" rings={rings} />
          <AchievementArc ring="hall-of-fame" rings={rings} />
          <AchievementArc ring="commissioner" rings={rings} />

          <FactionCore variant={variant.id} />
          <AchievementModule x={112} y={34} active={rings.includes('league-champion')} tone="league">
            <path d="M12 9h24v10c0 10-5 17-12 21-7-4-12-11-12-21Z" />
            <path d="M18 20h12M24 14v18" />
          </AchievementModule>
          <AchievementModule x={160} y={22} active={rings.includes('hall-of-fame')} tone="command">
            <path d="M10 32 16 13l11 13 11-13 6 19Z" />
            <path d="M12 36h32" />
          </AchievementModule>
          <AchievementModule x={208} y={34} active={rings.includes('tournament-champion')} tone="tournament">
            <path d="M24 9v31M9 24h31M14 14l20 20M34 14 14 34" />
          </AchievementModule>
          <AchievementModule x={55} y={162} active={rings.includes('veteran')} tone="league">
            <path d="M24 9 37 33H11Z" />
            <path d="M24 17v13" />
          </AchievementModule>
          <AchievementModule x={265} y={162} active={rings.includes('commissioner')} tone="tournament">
            <path d="M13 16h22l-4 22H17Z" />
            <path d="M18 11h12M20 22h8M19 29h10" />
          </AchievementModule>

          <g className="operator-badge-rank">
            <path className="operator-badge-rank-shadow" d="M117 270h86l20 20-20 24h-86l-20-24Z" />
            <path className="operator-badge-rank-face" d="M120 268h80l17 22-17 22h-80l-17-22Z" />
            <path className="operator-badge-rank-cut" d="M114 290h92" />
            <text x="160" y="299">{displayRank > 0 ? `#${displayRank}` : '--'}</text>
          </g>
          <g className="operator-badge-plate">
            <path className="operator-badge-plate-shadow" d="M58 309h204l22 21-22 27H58l-22-27Z" />
            <path className="operator-badge-plate-face" d="M63 306h194l21 24-21 24H63l-21-24Z" />
            <path className="operator-badge-plate-trim" d="M78 316h164M78 344h164" />
            <text className="operator-badge-name" x="160" y="335">
              {truncateLabel(playerName, 13)}
            </text>
            <text className="operator-badge-faction" x="160" y="349">
              {truncateLabel(faction, 24)}
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="operator-badge-home">{home}</figcaption>
      {showBadges && classifications.length > 0 ? (
        <div className="operator-badge-classifications" aria-hidden="true">
          {classifications.map((classification) => (
            <span className="player-status-badge operator-badge-classification" key={classification}>
              <i />
              {classification}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  )
}

function AchievementArc({
  ring,
  rings,
}: {
  ring: string
  rings: string[]
}) {
  return rings.includes(ring) ? (
    <circle className={`operator-badge-ring is-${ring}`} cx="160" cy="160" r="128" />
  ) : null
}

function AchievementModule({
  active,
  children,
  tone,
  x,
  y,
}: {
  active: boolean
  children: ReactNode
  tone: 'command' | 'league' | 'tournament'
  x: number
  y: number
}) {
  if (!active) {
    return null
  }

  return (
    <g className={`operator-badge-module is-${tone} is-active`} transform={`translate(${x - 24} ${y - 24})`}>
      <path d="M24 2 44 13v22L24 46 4 35V13Z" />
      <g transform="translate(0 0)">{children}</g>
    </g>
  )
}

function FactionCore({ variant }: { variant: string }) {
  const core = factionCoreLibrary[variant] ?? factionCoreLibrary.operations

  return (
    <g className="operator-badge-faction-mark">
      {core.primary.map((path) => (
        <path d={path} key={path} />
      ))}
      {core.secondary.map((path) => (
        <path className="operator-badge-faction-detail" d={path} key={path} />
      ))}
      {core.nodes.map((node) => (
        <circle
          className="operator-badge-faction-node"
          cx={node.cx}
          cy={node.cy}
          key={`${node.cx}-${node.cy}-${node.r}`}
          r={node.r}
        />
      ))}
    </g>
  )
}

function deriveAchievementRings(
  player: OperatorBadgePlayer,
  classifications: PlayerClassification[],
  achievements: OperatorBadgeAchievement[],
) {
  const rings = new Set<string>()
  const officialGames =
    (player.careerSummary?.records?.league?.games ?? 0) +
    (player.careerSummary?.records?.tournament?.games ?? 0)
  const unlockedAchievements = achievements
    .filter((achievement) => achievement.unlocked !== false)
    .map((achievement) => achievement.title.toLowerCase())

  if (unlockedAchievements.some((title) => title.includes('league champion'))) {
    rings.add('league-champion')
  }

  if (unlockedAchievements.some((title) => title.includes('tournament champion'))) {
    rings.add('tournament-champion')
  }

  if (
    unlockedAchievements.some((title) => title.includes('hall of fame')) ||
    unlockedAchievements.some((title) => title.includes('legend'))
  ) {
    rings.add('hall-of-fame')
  }

  if (
    classifications.includes('Veteran') ||
    officialGames >= 50 ||
    unlockedAchievements.some((title) => title.includes('veteran'))
  ) {
    rings.add('veteran')
  }

  if (
    classifications.includes('Commissioner') ||
    unlockedAchievements.some((title) => title.includes('commissioner'))
  ) {
    rings.add('commissioner')
  }

  return Array.from(rings)
}

function normalizeCompetitiveHome(
  value: string,
  classifications: PlayerClassification[],
) {
  const normalized = value.trim().toLowerCase()

  if (normalized.includes('main man')) {
    return 'Main Man'
  }

  if (normalized.includes('proving grounds a')) {
    return 'Proving Grounds A'
  }

  if (normalized.includes('proving grounds b')) {
    return 'Proving Grounds B'
  }

  if (classifications.includes('Casual Player') || !normalized) {
    return 'Casual Player'
  }

  return 'Casual Player'
}

function factionVariant(faction: string) {
  const key = normalizeFactionKey(faction)
  const direct = factionVariantLibrary[key]

  if (direct) {
    return direct
  }

  const alias = factionAliases.find(([pattern]) => key.includes(normalizeFactionKey(pattern)))

  return alias ? alias[1] : factionVariantLibrary.operations
}

type FactionCoreDefinition = {
  nodes: Array<{ cx: number; cy: number; r: number }>
  primary: string[]
  secondary: string[]
}

type FactionVariantDefinition = {
  accent: string
  id: string
  secondary: string
}

const factionCoreLibrary: Record<string, FactionCoreDefinition> = {
  acontecimento: {
    nodes: [{ cx: 160, cy: 160, r: 10 }],
    primary: ['M113 202 137 111 207 136 184 223 143 215Z'],
    secondary: ['M132 148h57M127 181h50M153 117l-15 91M183 129l-17 87'],
  },
  aleph: {
    nodes: [{ cx: 160, cy: 160, r: 14 }],
    primary: ['M160 89 222 216 160 184 98 216Z'],
    secondary: ['M132 200 160 126 188 200M160 184v38M132 142h56'],
  },
  ariadna: {
    nodes: [],
    primary: ['M112 198 134 111 160 94 186 111 208 198 174 225H146Z'],
    secondary: ['M133 188 160 127 187 188M123 154h74M143 218l17-31 17 31', 'M122 117 105 101M198 117l17-16'],
  },
  bakunin: {
    nodes: [
      { cx: 132, cy: 154, r: 8 },
      { cx: 188, cy: 166, r: 8 },
    ],
    primary: ['M105 191 139 104 217 126 190 218 130 209Z'],
    secondary: ['M127 183 155 128 194 145 173 202M118 151l84 20M145 117l-10 91'],
  },
  caledonia: {
    nodes: [],
    primary: ['M109 201 133 113 160 94 187 113 211 201 176 226H144Z'],
    secondary: ['M123 151h74M132 189h56M160 109v113M133 124l54 83M187 124l-54 83'],
  },
  combined: {
    nodes: [{ cx: 160, cy: 160, r: 20 }],
    primary: ['M160 102c37 9 61 31 66 58-5 27-29 49-66 58-37-9-61-31-66-58 5-27 29-49 66-58Z'],
    secondary: ['M122 160h76M160 122v76M137 137l46 46M183 137l-46 46'],
  },
  corregidor: {
    nodes: [{ cx: 160, cy: 160, r: 11 }],
    primary: ['M107 191 146 101 216 139 177 222 127 205Z'],
    secondary: ['M130 185 159 124 190 142 166 205M121 159h80M139 110l52 105'],
  },
  dashat: {
    nodes: [],
    primary: ['M116 206 137 114 160 98 183 114 204 206 178 224H142Z'],
    secondary: ['M132 199 160 129 188 199M123 166h74M142 118l36 104'],
  },
  druze: {
    nodes: [{ cx: 160, cy: 159, r: 12 }],
    primary: ['M112 196 132 120 160 96 188 120 208 196 180 224H140Z'],
    secondary: ['M126 151h68M134 184h52M160 111v98M136 130l48 62'],
  },
  foreign: {
    nodes: [],
    primary: ['M111 198 160 96 209 198 178 224H142Z'],
    secondary: ['M127 193 160 127 193 193M122 160h76M145 112l30 96'],
  },
  haqqislam: {
    nodes: [{ cx: 160, cy: 160, r: 12 }],
    primary: ['M160 91 201 138 184 220 160 194 136 220 119 138Z'],
    secondary: ['M138 150h44M160 112v78M142 207 160 176 178 207'],
  },
  hassassin: {
    nodes: [],
    primary: ['M160 92 195 141 182 219 160 194 138 219 125 141Z'],
    secondary: ['M139 151h42M160 112v74M143 204 160 176 177 204'],
  },
  ikari: {
    nodes: [],
    primary: ['M110 198 160 95 210 198 178 225H142Z'],
    secondary: ['M160 112v100M126 168h68M138 136l44 64M182 136l-44 64'],
  },
  imperial: {
    nodes: [],
    primary: ['M160 93 210 126 198 203 160 229 122 203 110 126Z'],
    secondary: ['M128 132h64M136 158h48M144 184h32M160 109v103M127 205l33 22 33-22', 'M135 116 116 96M185 116l19-20'],
  },
  invincible: {
    nodes: [],
    primary: ['M113 196 126 119 160 94 194 119 207 196 180 226H140Z'],
    secondary: ['M128 144h64M136 174h48M160 107v111M132 204h56'],
  },
  jsa: {
    nodes: [{ cx: 160, cy: 160, r: 12 }],
    primary: ['M160 94 203 124 197 199 160 229 123 199 117 124Z'],
    secondary: ['M160 112v98M130 160h60M138 130l44 64M182 130l-44 64'],
  },
  kestrel: {
    nodes: [],
    primary: ['M116 205 130 123 160 94 190 123 204 205 176 224H144Z'],
    secondary: ['M124 148 160 113 196 148M132 188 160 130 188 188M141 214l19-28 19 28'],
  },
  kosmoflot: {
    nodes: [{ cx: 160, cy: 154, r: 10 }],
    primary: ['M111 202 132 115 160 94 188 115 209 202 177 226H143Z'],
    secondary: ['M160 113v103M127 162h66M135 127l50 74M185 127l-50 74'],
  },
  merovingienne: {
    nodes: [],
    primary: ['M112 201 134 116 160 95 186 116 208 201 176 225H144Z'],
    secondary: ['M124 144h72M130 178h60M141 118l19 96 19-96'],
  },
  militaryorders: {
    nodes: [],
    primary: ['M160 95 206 126 194 204 160 227 126 204 114 126Z'],
    secondary: ['M160 111v98M128 158h64M143 126h34M136 191h48'],
  },
  morats: {
    nodes: [],
    primary: ['M104 188 124 119 160 93 196 119 216 188 183 226H137Z'],
    secondary: ['M130 170 145 136h30l15 34-30 27ZM128 136l-16-22M192 136l16-22'],
  },
  neoterra: {
    nodes: [{ cx: 160, cy: 160, r: 12 }],
    primary: ['M160 96 211 129 199 201 160 226 121 201 109 129Z'],
    secondary: ['M129 143h62M129 177h62M160 114v93M139 207h42'],
  },
  nextwave: {
    nodes: [
      { cx: 138, cy: 150, r: 8 },
      { cx: 183, cy: 172, r: 8 },
    ],
    primary: ['M99 162c13-39 36-59 61-60 29 1 52 24 62 60-14 36-35 56-62 58-28-2-49-22-61-58Z'],
    secondary: ['M121 160c18-17 35-25 52-23 14 2 25 10 35 23M114 184c17 13 32 19 46 18 16-1 31-8 47-21'],
  },
  nomads: {
    nodes: [],
    primary: ['M105 188 144 101 218 132 184 219 132 207Z'],
    secondary: ['M132 188 157 131 191 145 169 201M124 158h72'],
  },
  o12: {
    nodes: [{ cx: 160, cy: 160, r: 22 }],
    primary: ['M160 96 211 132 197 206 160 226 123 206 109 132Z'],
    secondary: ['M160 116v88M122 160h76M134 132l52 56M186 132l-52 56'],
  },
  oban: {
    nodes: [],
    primary: ['M160 94 205 126 197 203 160 228 123 203 115 126Z'],
    secondary: ['M128 144h64M134 181h52M144 118l16 94 16-94M125 205l35 22 35-22'],
  },
  onyx: {
    nodes: [{ cx: 160, cy: 160, r: 16 }],
    primary: ['M160 100c36 8 58 28 63 60-5 31-27 51-63 60-36-9-58-29-63-60 5-32 27-52 63-60Z'],
    secondary: ['M124 160h72M160 124v72M136 136l48 48M184 136l-48 48'],
  },
  operations: {
    nodes: [{ cx: 160, cy: 160, r: 13 }],
    primary: ['M160 88 219 217 160 185 101 217Z'],
    secondary: ['M132 199 160 130 188 199M160 185v38'],
  },
  pano: {
    nodes: [],
    primary: ['M160 96 209 124 203 197 160 226 117 197 111 124Z'],
    secondary: ['M135 131h50M132 161h56M160 116v93M138 193l22 16 22-16'],
  },
  qapu: {
    nodes: [],
    primary: ['M116 205 136 118 160 96 184 118 204 205 178 225H142Z'],
    secondary: ['M126 157h68M136 190h48M145 119l15 91 15-91'],
  },
  ramah: {
    nodes: [{ cx: 160, cy: 160, r: 13 }],
    primary: ['M160 93 202 138 188 213 160 231 132 213 118 138Z'],
    secondary: ['M134 151h52M142 186h36M160 112v104M137 207l23-27 23 27'],
  },
  shasvastii: {
    nodes: [
      { cx: 143, cy: 154, r: 8 },
      { cx: 178, cy: 170, r: 8 },
    ],
    primary: ['M105 160c11-37 31-57 55-60 30 4 51 24 58 60-7 37-28 56-58 60-24-3-44-23-55-60Z'],
    secondary: ['M126 141c20 15 38 34 55 58M192 138c-16 14-35 33-58 58'],
  },
  shindenbutai: {
    nodes: [],
    primary: ['M160 95 207 130 194 204 160 228 126 204 113 130Z'],
    secondary: ['M160 111v102M129 153h62M138 127l44 74M182 127l-44 74M124 207h72'],
  },
  shock: {
    nodes: [{ cx: 160, cy: 160, r: 11 }],
    primary: ['M116 202 131 121 160 95 189 121 204 202 176 224H144Z'],
    secondary: ['M126 146h68M134 180h52M160 113v99M137 205h46'],
  },
  spiral: {
    nodes: [
      { cx: 144, cy: 151, r: 7 },
      { cx: 176, cy: 176, r: 7 },
    ],
    primary: ['M112 160c8-35 27-57 55-62 28 9 45 29 50 62-7 33-26 53-57 60-29-7-45-27-48-60Z'],
    secondary: ['M132 137c31 2 53 15 66 40M122 178c18 20 43 27 74 20M151 111c-12 34-9 67 9 99'],
  },
  starco: {
    nodes: [],
    primary: ['M160 95 181 138 228 145 194 178 202 225 160 203 118 225 126 178 92 145 139 138Z'],
    secondary: ['M160 120v74M126 160h68M136 188l48-48'],
  },
  starmada: {
    nodes: [{ cx: 160, cy: 160, r: 14 }],
    primary: ['M160 95 208 132 196 205 160 226 124 205 112 132Z'],
    secondary: ['M160 112v96M126 160h68M137 132l46 56M183 132l-46 56'],
  },
  steelphalanx: {
    nodes: [],
    primary: ['M160 93 208 129 196 203 160 228 124 203 112 129Z'],
    secondary: ['M128 153h64M137 184h46M160 111v104M134 128l52 78'],
  },
  svalarheima: {
    nodes: [],
    primary: ['M160 95 207 126 198 201 160 226 122 201 113 126Z'],
    secondary: ['M160 112v96M126 160h68M138 132l44 56M182 132l-44 56M127 201h66'],
  },
  tartary: {
    nodes: [],
    primary: ['M111 200 134 113 160 94 186 113 209 200 176 226H144Z'],
    secondary: ['M125 158h70M137 190h46M160 109v105M129 123l62 84'],
  },
  tohaa: {
    nodes: [
      { cx: 140, cy: 150, r: 8 },
      { cx: 180, cy: 150, r: 8 },
      { cx: 160, cy: 187, r: 8 },
    ],
    primary: ['M160 100c31 10 51 30 59 60-8 30-28 50-59 60-31-10-51-30-59-60 8-30 28-50 59-60Z'],
    secondary: ['M140 150h40M140 150l20 37M180 150l-20 37M121 160h78'],
  },
  torchlight: {
    nodes: [{ cx: 160, cy: 154, r: 12 }],
    primary: ['M160 93 207 131 193 207 160 228 127 207 113 131Z'],
    secondary: ['M160 112v101M128 163h64M137 132l46 71M183 132l-46 71'],
  },
  tunguska: {
    nodes: [{ cx: 160, cy: 160, r: 10 }],
    primary: ['M107 190 146 101 217 132 185 220 130 207Z'],
    secondary: ['M126 147h70M135 181h46M151 121l18 87M185 137l-53 58'],
  },
  usariadna: {
    nodes: [],
    primary: ['M112 200 134 115 160 94 186 115 208 200 176 225H144Z'],
    secondary: ['M126 151h68M134 184h52M160 111v104M137 127l46 75'],
  },
  varuna: {
    nodes: [{ cx: 160, cy: 160, r: 10 }],
    primary: ['M160 96 210 126 198 200 160 226 122 200 110 126Z'],
    secondary: ['M126 150c20-18 43-18 68 0M124 183c22 17 47 17 72 0M160 114v96'],
  },
  whitebanner: {
    nodes: [],
    primary: ['M160 94 207 126 198 203 160 228 122 203 113 126Z'],
    secondary: ['M127 147h66M137 181h46M160 110v105M129 204h62'],
  },
  whitecompany: {
    nodes: [{ cx: 160, cy: 160, r: 12 }],
    primary: ['M112 199 160 96 208 199 178 225H142Z'],
    secondary: ['M126 160h68M160 116v96M136 191l24-64 24 64'],
  },
  yujing: {
    nodes: [],
    primary: ['M160 94 209 127 198 203 160 228 122 203 111 127Z'],
    secondary: ['M128 135h64M136 164h48M144 193h32M160 110v105'],
  },
}

const factionVariantLibrary: Record<string, FactionVariantDefinition> = {
  acontecimento: { accent: '#4d8dff', id: 'acontecimento', secondary: '#f4f6f8' },
  aleph: { accent: '#f4f6f8', id: 'aleph', secondary: '#4cc9f0' },
  ariadna: { accent: '#8f9a93', id: 'ariadna', secondary: '#f2b632' },
  bakuninjurisdictionalcommand: { accent: '#d83b84', id: 'bakunin', secondary: '#4cc9f0' },
  caledonianhighlanderarmy: { accent: '#5f8f6b', id: 'caledonia', secondary: '#f2b632' },
  combinedarmy: { accent: '#9b5cff', id: 'combined', secondary: '#b2122a' },
  corregidorjurisdictionalcommand: { accent: '#e3343f', id: 'corregidor', secondary: '#f2b632' },
  dashatcompany: { accent: '#f2b632', id: 'dashat', secondary: '#5fe38a' },
  druzebayramsecurity: { accent: '#5fe38a', id: 'druze', secondary: '#f2b632' },
  foreigncompany: { accent: '#aab7c2', id: 'foreign', secondary: '#4cc9f0' },
  forcedereponserapidemerovingienne: { accent: '#7e8b95', id: 'merovingienne', secondary: '#4cc9f0' },
  haqqislam: { accent: '#5fe38a', id: 'haqqislam', secondary: '#f2b632' },
  hassassinbahram: { accent: '#b2122a', id: 'hassassin', secondary: '#f2b632' },
  ikaricompany: { accent: '#b2122a', id: 'ikari', secondary: '#f2b632' },
  imperialservice: { accent: '#f2b632', id: 'imperial', secondary: '#d54624' },
  invinciblearmy: { accent: '#f2b632', id: 'invincible', secondary: '#f4f6f8' },
  japanesesecessionistarmy: { accent: '#f4f6f8', id: 'jsa', secondary: '#b2122a' },
  kestrelcolonialforce: { accent: '#4d8dff', id: 'kestrel', secondary: '#f2b632' },
  kosmoflot: { accent: '#8f9a93', id: 'kosmoflot', secondary: '#f2b632' },
  militaryorders: { accent: '#f4f6f8', id: 'militaryorders', secondary: '#4d8dff' },
  morataggressionforce: { accent: '#f26a21', id: 'morats', secondary: '#f2b632' },
  neoterracapitalinearmy: { accent: '#4d8dff', id: 'neoterra', secondary: '#f4f6f8' },
  nextwave: { accent: '#9b5cff', id: 'nextwave', secondary: '#5fe38a' },
  nomads: { accent: '#e3343f', id: 'nomads', secondary: '#4cc9f0' },
  oban: { accent: '#f4f6f8', id: 'oban', secondary: '#b2122a' },
  o12: { accent: '#4cc9f0', id: 'o12', secondary: '#f4f6f8' },
  onyxcontactforce: { accent: '#9b5cff', id: 'onyx', secondary: '#4cc9f0' },
  operations: { accent: '#4cc9f0', id: 'operations', secondary: '#f2b632' },
  operationssubsection: { accent: '#4cc9f0', id: 'operations', secondary: '#f2b632' },
  panoceania: { accent: '#4d8dff', id: 'pano', secondary: '#f4f6f8' },
  qapukhalqi: { accent: '#5fe38a', id: 'qapu', secondary: '#f2b632' },
  ramahtaskforce: { accent: '#5fe38a', id: 'ramah', secondary: '#f4f6f8' },
  shasvastiiexpeditionaryforce: { accent: '#9b5cff', id: 'shasvastii', secondary: '#5fe38a' },
  shindenbutai: { accent: '#f4f6f8', id: 'shindenbutai', secondary: '#b2122a' },
  shockarmyofacontecimento: { accent: '#4d8dff', id: 'shock', secondary: '#5fe38a' },
  spiralcorps: { accent: '#9b5cff', id: 'spiral', secondary: '#5fe38a' },
  starco: { accent: '#e3343f', id: 'starco', secondary: '#f2b632' },
  starmada: { accent: '#4cc9f0', id: 'starmada', secondary: '#f4f6f8' },
  steelphalanx: { accent: '#f4f6f8', id: 'steelphalanx', secondary: '#f2b632' },
  svalarheimawinterforce: { accent: '#4d8dff', id: 'svalarheima', secondary: '#f4f6f8' },
  tartaryarmycorps: { accent: '#8f9a93', id: 'tartary', secondary: '#b2122a' },
  tohaa: { accent: '#5fe38a', id: 'tohaa', secondary: '#9b5cff' },
  torchlightbrigade: { accent: '#4cc9f0', id: 'torchlight', secondary: '#f2b632' },
  tunguskajurisdictionalcommand: { accent: '#e3343f', id: 'tunguska', secondary: '#f2b632' },
  usariadnarangerforce: { accent: '#8f9a93', id: 'usariadna', secondary: '#f2b632' },
  varunaimmediatereactiondivision: { accent: '#4d8dff', id: 'varuna', secondary: '#4cc9f0' },
  whitebanner: { accent: '#f2b632', id: 'whitebanner', secondary: '#f4f6f8' },
  whitecompany: { accent: '#f4f6f8', id: 'whitecompany', secondary: '#4cc9f0' },
  yujing: { accent: '#f2b632', id: 'yujing', secondary: '#d54624' },
}

const factionAliases: Array<[string, FactionVariantDefinition]> = [
  ['pano', factionVariantLibrary.panoceania],
  ['pan o', factionVariantLibrary.panoceania],
  ['militaryorder', factionVariantLibrary.militaryorders],
  ['winter', factionVariantLibrary.svalarheimawinterforce],
  ['svalarheima', factionVariantLibrary.svalarheimawinterforce],
  ['varuna', factionVariantLibrary.varunaimmediatereactiondivision],
  ['acontecimento', factionVariantLibrary.shockarmyofacontecimento],
  ['neoterra', factionVariantLibrary.neoterracapitalinearmy],
  ['yu jing', factionVariantLibrary.yujing],
  ['yujing', factionVariantLibrary.yujing],
  ['imperial', factionVariantLibrary.imperialservice],
  ['invincible', factionVariantLibrary.invinciblearmy],
  ['white banner', factionVariantLibrary.whitebanner],
  ['ariadna', factionVariantLibrary.ariadna],
  ['caledonia', factionVariantLibrary.caledonianhighlanderarmy],
  ['merovingienne', factionVariantLibrary.forcedereponserapidemerovingienne],
  ['kosmoflot', factionVariantLibrary.kosmoflot],
  ['tartary', factionVariantLibrary.tartaryarmycorps],
  ['usariadna', factionVariantLibrary.usariadnarangerforce],
  ['haqq', factionVariantLibrary.haqqislam],
  ['hassassin', factionVariantLibrary.hassassinbahram],
  ['ramah', factionVariantLibrary.ramahtaskforce],
  ['qapu', factionVariantLibrary.qapukhalqi],
  ['nomad', factionVariantLibrary.nomads],
  ['bakunin', factionVariantLibrary.bakuninjurisdictionalcommand],
  ['corregidor', factionVariantLibrary.corregidorjurisdictionalcommand],
  ['tunguska', factionVariantLibrary.tunguskajurisdictionalcommand],
  ['combined', factionVariantLibrary.combinedarmy],
  ['morat', factionVariantLibrary.morataggressionforce],
  ['shasvastii', factionVariantLibrary.shasvastiiexpeditionaryforce],
  ['onyx', factionVariantLibrary.onyxcontactforce],
  ['next wave', factionVariantLibrary.nextwave],
  ['aleph', factionVariantLibrary.aleph],
  ['operations', factionVariantLibrary.operationssubsection],
  ['steel phalanx', factionVariantLibrary.steelphalanx],
  ['o 12', factionVariantLibrary.o12],
  ['o12', factionVariantLibrary.o12],
  ['starmada', factionVariantLibrary.starmada],
  ['torchlight', factionVariantLibrary.torchlightbrigade],
  ['japanese', factionVariantLibrary.japanesesecessionistarmy],
  ['jsa', factionVariantLibrary.japanesesecessionistarmy],
  ['oban', factionVariantLibrary.oban],
  ['shindenbutai', factionVariantLibrary.shindenbutai],
  ['tohaa', factionVariantLibrary.tohaa],
  ['dashat', factionVariantLibrary.dashatcompany],
  ['druze', factionVariantLibrary.druzebayramsecurity],
  ['foreign company', factionVariantLibrary.foreigncompany],
  ['ikari', factionVariantLibrary.ikaricompany],
  ['spiral', factionVariantLibrary.spiralcorps],
  ['starco', factionVariantLibrary.starco],
  ['white company', factionVariantLibrary.whitecompany],
  ['kestrel', factionVariantLibrary.kestrelcolonialforce],
]

function normalizeFactionKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function formatRingLabel(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function truncateLabel(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}.` : value
}

export default OperatorBadge
