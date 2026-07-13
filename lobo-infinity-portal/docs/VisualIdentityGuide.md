# Lobo Infinity Portal Visual Identity Guide

## Direction

The Lobo Infinity Portal is a tactical command console for running and playing Infinity events. It should feel like professional military operations software that has been customized by Lobo: industrial, mercenary, competitive, fast, and legible under pressure.

The interface must not copy Corvus Belli artwork. It uses original HUD geometry, grids, angular panels, faction-inspired accents, and command-console language.

## Palette

- Tactical Black: `#030609`
- Deep Console: `#050911`
- Command Panel: `#0B1219`
- Gunmetal Panel: `#101923`
- Raised Panel: `#162331`
- Industrial Border: `#223447`
- HUD Cyan: `#42D9FF`
- Lobo Crimson: `#D2192D`
- Warning Amber: `#F2B84B`
- Promotion Green: `#2DC653`
- Relegation Red: `#EF233C`
- Primary Text: `#F5FBFF`
- Secondary Text: `#C4D3DF`
- Muted Text: `#8798A7`

Use black and gunmetal as the base. Cyan is the operational HUD color. Crimson is for Lobo identity, active navigation, and destructive or decisive operations. Amber is reserved for warnings, empty states, pending status, and cautionary information.

## Typography

Headings use uppercase tactical language with moderate letter spacing. Body text remains system sans-serif for performance and readability.

Use larger type only for page banners, profile names, battle report outcomes, and command-center summaries. Dense operational panels should use compact, readable hierarchy.

## Shape Language

- Panels use 6px radius or less.
- Borders are thin and cyan-tinted.
- Use angular corner accents through CSS pseudo-elements.
- Use grid overlays sparingly on major banners and command surfaces.
- Avoid soft consumer card styling.

## Banner System

Every major page should have a cinematic command banner using existing lightweight SVG assets:

- `command-hero.svg`: Dashboard, Event Manager, Command Center, Diagnostics.
- `industrial-banner.svg`: Battle Reports, Submit Game, Streams, League Operations.
- `profile-hero.svg`: Player Profiles, My Profile, Community Players.
- `faction-banner.svg`: Army Lists, Factions, Missions.

Banners should include a title, a short operational subtitle, and any critical status chips. They must not become marketing hero sections.

## Card System

All cards and panels use the same base family:

- Thin cyan border.
- Dark metal background.
- Subtle scanline or HUD texture.
- Optional crimson active edge.
- Compact padding on mobile.

Cards may elevate slightly on hover, but they should never bounce, wobble, or animate heavily.

## Tables

Tables resemble operations boards:

- Sticky or visually distinct headers where practical.
- Uppercase labels.
- Row hover highlight using low-opacity HUD cyan.
- Rank, promotion, warning, and relegation states use consistent chips or edge accents.

## Forms

Forms should feel like command inputs:

- Dark fields.
- Cyan focus rings.
- Clear validation states.
- Large touch targets.
- No decorative motion.

## Icons

Use the custom `PortalIcon` system for navigation and major actions. Icons should feel like HUD glyphs: thin strokes, geometric, consistent size, and no emoji.

Future icons should follow the existing hex-frame style and remain SVG/code-native rather than image assets.

## Achievement Badges

Achievement badges should use non-emoji tier language:

- Common: muted gunmetal with cyan edge.
- Rare: cyan glow.
- Epic: crimson and cyan dual accent.
- Legendary: gold edge with restrained glow.

Badges should read as medals or operation marks, not stickers.

## Rank Insignia

Rank treatment should use:

- Compact geometric glyphs.
- Cyan for neutral rank.
- Gold for leaders and champions.
- Crimson for high-risk or contested states.
- Green/red only for promotion/relegation zones.

## Faction Branding

Faction styling may use accent colors, abstract watermarks, and geometric motifs. Do not use official faction logos or artwork unless separately licensed.

Display canonical army names first. Parent faction can appear as secondary metadata.

## Mission Identity

Missions may receive:

- A unique HUD glyph.
- Accent color.
- Abstract tactical motif.
- Briefing-card language.

Mission identity must be generated from the canonical Mission Registry and not from duplicated mission lists.

## Motion

Allowed:

- 150-250ms hover/focus transitions.
- Subtle scan line.
- Skeleton shimmer.
- Low-intensity status pulse.
- Drawer fade/slide.

Avoid:

- Heavy animation libraries.
- Large parallax effects.
- Bright neon pulsing.
- Motion required to understand state.

Always respect `prefers-reduced-motion`.

## Loading Language

Use command-console language:

- Accessing Tactical Network...
- Synchronizing Combat Logs...
- Decrypting Battle Records...
- Loading Cube Memory...
- Verifying Command Authorization...
- Preparing Event Workspace...

Do not use "Loading live league data" as a full-page blocker.

## Empty States

Empty states should feel intentional and operational:

- No Recent Games: "No combat logs filed yet."
- No Streams Available: "No active broadcast uplinks."
- No Army Lists Yet: "No approved loadouts in the archive."
- No News Today: "No incoming transmissions."

Use amber accents for empty/pending states.

## Audio

The visual system may later support optional UI sounds, but audio must be off by default. Sound hooks should be centralized, user-controlled, and never tied to critical comprehension.

## Performance Rules

- Prefer CSS over JavaScript.
- Reuse existing SVG assets.
- Do not add startup requests.
- Lazy-load heavy visuals if ever introduced.
- Keep page-specific visual assets small and cacheable.
- Do not duplicate route components to achieve visual variation.
