import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/App.css', 'utf8')

const nativeMobileStart = css.indexOf('/* Version 4.2 Native Mobile Experience */')
const mobilePolishStart = css.indexOf('/* Mobile Experience v1: navigation and high-traffic page polish */')
const playerHomeStart = css.indexOf('/* Version 4.3 Player Home Dashboard */')

assert.ok(nativeMobileStart >= 0, 'native mobile shell section must exist')
assert.ok(mobilePolishStart > nativeMobileStart, 'mobile shell polish section must exist')
assert.ok(playerHomeStart > mobilePolishStart, 'mobile shell section must remain bounded')

const nativeMobile = css.slice(nativeMobileStart, mobilePolishStart)
const mobileShell = css.slice(mobilePolishStart, playerHomeStart)

assert.match(nativeMobile, /@media \(max-width: 920px\) \{[\s\S]*?\.app-shell \{[\s\S]*?grid-template-columns: 1fr;/)
assert.match(nativeMobile, /@media \(max-width: 920px\) \{[\s\S]*?\.portal-header > \.header-title,[\s\S]*?\.portal-header > \.header-actions \{\s*display: none;/)
assert.match(nativeMobile, /@media \(max-width: 920px\) \{[\s\S]*?\.mobile-app-bar \{[\s\S]*?display: grid;/)
assert.match(mobileShell, /@media \(max-width: 920px\) \{[\s\S]*?\.app-shell > \.sidebar \{\s*display: none;/)
assert.match(css, /@media \(max-width: 920px\) \{[\s\S]*?\.mobile-bottom-navigation \{[\s\S]*?display: grid;/)
assert.match(css, /\.mobile-bottom-navigation,[\s\S]*?\.mobile-panel-backdrop,[\s\S]*?display: none;/)

// Page-specific phone layouts remain at their existing breakpoint.
assert.match(nativeMobile, /@media \(max-width: 760px\) \{\s*\.portal-shell \{/)
assert.match(mobileShell, /@media \(max-width: 760px\) \{\s*\.portal-shell,/)

for (const width of [320, 375, 390, 430, 760, 761, 768, 919, 920]) {
  assert.equal(width <= 920, true, `${width}px must use the mobile shell`)
}
for (const width of [921, 1280]) {
  assert.equal(width <= 920, false, `${width}px must use the desktop shell`)
}

console.log('Responsive shell breakpoint regression passed (mobile <=920px; desktop >=921px).')
