import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'

const read = (path) => readFileSync(path, 'utf8')
const app = read('src/App.tsx')
const snapshotApp = read('src/public/SnapshotPublicApp.tsx')
const css = read('src/App.css')
const header = read('src/components/Header.tsx')
const bottom = read('src/components/MobileBottomNavigation.tsx')
const menu = read('src/pages/MobileMenu.tsx')
const sidebar = read('src/components/sidebarNavigation.ts')
const explore = read('src/pages/Explore.tsx')

assert.match(app, /path="\/menu"[\s\S]*?<MobileMenu/)
assert.match(snapshotApp, /const MobileMenu = lazy\(\(\) => import\('\.\.\/pages\/MobileMenu'\)\)/)
assert.match(snapshotApp, /path="\/menu"[\s\S]*?<MobileMenu/)
assert.match(app, /<MobileBottomNavigation \/>/)
assert.doesNotMatch(header, /MobileNavigationDrawer|mobile-menu-button|isMobileMenuOpen|body\.style\.position|scrollTo\(scrollX/)
assert.doesNotMatch(app, /MobileNavigationDrawer/)

for (const [label, route] of [
  ['Home', '/'],
  ['Explore', '/explore'],
  ['Events', '/events'],
  ['Submit', '/submit-game'],
  ['More', '/menu'],
]) {
  assert.ok(bottom.includes(`label: '${label}'`) || bottom.includes(`<span>${label}</span>`), `${label} bottom item must exist`)
  assert.ok(bottom.includes(`to: '${route}'`) || bottom.includes(`to="${route}"`), `${route} bottom route must exist`)
}

for (const sharedExport of ['topLevelItems', 'authenticatedTopLevelItems', 'communityItems', 'commissionerItems', 'getJoinCommunityNavigationItem']) {
  assert.ok(sidebar.includes(`export const ${sharedExport}`) || sidebar.includes(`export function ${sharedExport}`))
  assert.ok(menu.includes(sharedExport), `More must reuse ${sharedExport}`)
}
assert.doesNotMatch(sidebar, /to: '\/(?:rivalries|hall-of-fame)'/, 'Retired sections must not appear in the shared desktop and mobile navigation')
assert.match(explore, /const directory = communityItems\.filter/, 'Explore must reuse the shared navigation list')
assert.match(menu, /useSelectedEventNavigation/)
assert.match(menu, /buildCapabilityNavigation\(event\)/)
assert.match(menu, /auth\.isAtLeastRole\('Commissioner'\)/)
assert.match(menu, /<main className="portal-shell mobile-navigation-page">/)
assert.doesNotMatch(menu, /createPortal|aria-modal|role="dialog"|backdrop|position:\s*fixed|overflow:\s*hidden/)

assert.match(css, /@media \(max-width: 920px\) \{[\s\S]*?\.mobile-bottom-navigation \{[\s\S]*?position: fixed;/)
assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/)
assert.match(css, /env\(safe-area-inset-bottom, 0px\)/)
assert.match(css, /padding-bottom: calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\) \+ 18px\)/)
assert.doesNotMatch(css, /@media \(min-width: 921px\)[\s\S]*?\.mobile-bottom-navigation[\s\S]*?display: (?:grid|flex)/)

for (const route of ['/', '/events', '/games', '/submit-game', '/league-operations', '/players', '/factions', '/missions', '/streams', '/army-intelligence']) {
  assert.ok(sidebar.includes(`to: '${route}'`), `${route} must remain canonical navigation metadata`)
}

console.log('Mobile bottom navigation and full-page More regression passed.')

assert.doesNotMatch(header, /auth\.authenticated \? \([\s\S]*?<GlobalSearch/, 'Public mobile search must not require sign-in')
assert.doesNotMatch(css, /padding-bottom: calc\(16px \+ var\(--mobile-safe-bottom\)\)/, 'Narrow screens must retain bottom navigation clearance')
assert.match(css, /padding-left: max\(4px, env\(safe-area-inset-left, 0px\)\)/)
assert.match(css, /padding-right: max\(4px, env\(safe-area-inset-right, 0px\)\)/)

// Check the final cascade: an earlier correct rule can be undone by a phone override.
const stylesheet = postcss.parse(css)
function mobileValue(selector, property, width, height) {
  let value
  stylesheet.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== 'atrule' || parent.name !== 'media') continue
      for (const [, kind, axis, pixels] of parent.params.matchAll(/(max|min)-(width|height):\s*(\d+)px/g)) {
        const size = axis === 'width' ? width : height
        if (kind === 'max' ? size > Number(pixels) : size < Number(pixels)) return
      }
      if (parent.params.includes('orientation: landscape') && height >= width) return
    }
    rule.walkDecls(property, declaration => { value = declaration.value })
  })
  return value
}
for (const [width, height] of [[320, 568], [375, 812], [390, 844], [430, 932], [760, 1024], [768, 1024], [844, 390], [920, 540]]) {
  assert.match(mobileValue('.app-main', 'padding-bottom', width, height), /mobile-nav-height/, `${width}px must clear the fixed navigation`)
  assert.equal(mobileValue('.mobile-search-trigger', 'height', width, height), '44px')
  assert.equal(mobileValue('.notification-center-compact .notification-trigger', 'height', width, height), '44px')
}
console.log('Mobile cascade checks passed at 320–920px, including landscape.')
