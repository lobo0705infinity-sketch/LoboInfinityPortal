import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const app = read('src/App.tsx')
const css = read('src/App.css')
const header = read('src/components/Header.tsx')
const bottom = read('src/components/MobileBottomNavigation.tsx')
const menu = read('src/pages/MobileMenu.tsx')
const sidebar = read('src/components/sidebarNavigation.ts')

assert.match(app, /path="\/menu"[\s\S]*?<MobileMenu/)
assert.match(app, /<MobileBottomNavigation \/>/)
assert.doesNotMatch(header, /MobileNavigationDrawer|mobile-menu-button|isMobileMenuOpen|body\.style\.position|scrollTo\(scrollX/)
assert.doesNotMatch(app, /MobileNavigationDrawer/)

for (const [label, route] of [
  ['Home', '/'],
  ['Players', '/players'],
  ['Submit', '/submit-game'],
  ['Intelligence', '/army-intelligence'],
  ['More', '/menu'],
]) {
  assert.ok(bottom.includes(`label: '${label}'`) || bottom.includes(`<span>${label}</span>`), `${label} bottom item must exist`)
  assert.ok(bottom.includes(`to: '${route}'`) || bottom.includes(`to="${route}"`), `${route} bottom route must exist`)
}

for (const sharedExport of ['topLevelItems', 'authenticatedTopLevelItems', 'communityItems', 'commissionerItems', 'getJoinCommunityNavigationItem']) {
  assert.ok(sidebar.includes(`export const ${sharedExport}`) || sidebar.includes(`export function ${sharedExport}`))
  assert.ok(menu.includes(sharedExport), `More must reuse ${sharedExport}`)
}
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

for (const route of ['/', '/submit-game', '/players', '/hall-of-fame', '/compare', '/missions', '/streams', '/army-intelligence']) {
  assert.ok(sidebar.includes(`to: '${route}'`), `${route} must remain canonical navigation metadata`)
}

console.log('Mobile bottom navigation and full-page More regression passed.')
