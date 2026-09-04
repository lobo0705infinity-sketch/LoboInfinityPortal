import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sponsor = readFileSync('src/components/SponsorCredit.tsx', 'utf8')
const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8')
const mobileMenu = readFileSync('src/pages/MobileMenu.tsx', 'utf8')
const css = readFileSync('src/App.css', 'utf8')

assert.match(sponsor, /const BIG_CHECK_STORE_URL = 'https:\/\/www\.bigcheckstore\.com\/'/)
assert.match(sponsor, />Summer 2026 Lobo League</)
assert.match(sponsor, />Sponsored by</)
assert.match(sponsor, /Big Check Store/)
assert.match(sponsor, /href=\{BIG_CHECK_STORE_URL\}/)
assert.match(sponsor, /target="_blank"/)
assert.match(sponsor, /rel="noopener noreferrer sponsored"/)

const brandIndex = sidebar.indexOf('className="sidebar-brand"')
const sponsorIndex = sidebar.indexOf('<SponsorCredit placement="sidebar" />')
const navigationIndex = sidebar.indexOf('<nav className="sidebar-nav"')
assert.ok(brandIndex >= 0 && sponsorIndex > brandIndex && navigationIndex > sponsorIndex)
assert.match(mobileMenu, /<SponsorCredit placement="mobile-menu" \/>[\s\S]*?<nav className="mobile-navigation-directory"/)
assert.match(css, /\.sponsor-credit\s*\{[\s\S]*?overflow-wrap: anywhere/)
assert.match(css, /\.sponsor-credit a\s*\{[\s\S]*?width: fit-content/)
assert.match(css, /\.sponsor-credit--mobile-menu a\s*\{[\s\S]*?min-height: 44px/)
assert.doesNotMatch(sponsor, /react-router-dom|<Link|to=/)

console.log('Big Check Store sponsorship backlink regression passed (shared desktop/mobile treatment).')
