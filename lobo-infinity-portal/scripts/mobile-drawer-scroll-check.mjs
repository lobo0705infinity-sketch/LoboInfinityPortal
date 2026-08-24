import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/App.css', 'utf8')
const header = readFileSync('src/components/Header.tsx', 'utf8')
const drawer = readFileSync('src/components/MobileNavigationDrawer.tsx', 'utf8')

const mobilePolishStart = css.indexOf('/* Mobile Experience v1: drawer navigation and high-traffic page polish */')
const playerHomeStart = css.indexOf('/* Version 4.3 Player Home Dashboard */')
const mobileDrawerCss = css.slice(mobilePolishStart, playerHomeStart)

assert.match(mobileDrawerCss, /@media \(max-width: 920px\)/)
assert.match(mobileDrawerCss, /\.mobile-menu-sheet\.sidebar \{[\s\S]*?height: calc\(100dvh - var\(--mobile-header-height\) - var\(--mobile-safe-top, 0px\)\);/)
assert.match(mobileDrawerCss, /\.mobile-menu-sheet\.sidebar \{[\s\S]*?overflow-y: auto;/)
assert.match(mobileDrawerCss, /\.mobile-menu-sheet\.sidebar \{[\s\S]*?overscroll-behavior-y: contain;/)
assert.match(mobileDrawerCss, /\.mobile-menu-sheet\.sidebar \{[\s\S]*?touch-action: pan-y;/)
assert.match(css, /\.mobile-panel-backdrop \{[\s\S]*?overscroll-behavior: contain;[\s\S]*?touch-action: none;/)

assert.match(header, /useEffect\(\(\) => \{\s*if \(!isMobileMenuOpen\)/)
assert.match(header, /const scrollX = window\.scrollX[\s\S]*?const scrollY = window\.scrollY/)
assert.match(header, /root\.style\.overflow = 'hidden'/)
assert.match(header, /body\.style\.position = 'fixed'/)
assert.match(header, /body\.style\.top = `-\$\{scrollY\}px`/)
assert.match(header, /return \(\) => \{[\s\S]*?body\.style\.position = previousBodyStyles\.position/)
assert.match(header, /window\.scrollTo\(scrollX, scrollY\)/)
assert.match(header, /\}, \[isMobileMenuOpen\]\)/)

assert.match(drawer, /className="mobile-menu-sheet sidebar"/)
assert.match(drawer, /<MobileEventSelector/)
assert.match(drawer, /onClick=\{onNavigate\}/)
assert.match(header, /onClick=\{\(\) => setActiveMobilePanel\(null\)\}/)
assert.match(header, /setActiveMobilePanel\(null\)[\s\S]*?\[location\.pathname, location\.search, location\.hash\]/)

console.log('Mobile drawer scroll ownership regression passed.')
