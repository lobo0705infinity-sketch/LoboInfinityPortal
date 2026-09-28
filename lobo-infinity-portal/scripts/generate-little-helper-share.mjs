import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#142838"/><stop offset=".6" stop-color="#070e18"/><stop offset="1" stop-color="#271420"/></linearGradient>
    <pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="#2e728a" stroke-opacity=".17"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <circle cx="1035" cy="115" r="240" fill="none" stroke="#55cde7" stroke-opacity=".13" stroke-width="2"/>
  <circle cx="1035" cy="115" r="155" fill="none" stroke="#55cde7" stroke-opacity=".13" stroke-width="2"/>
  <path d="M0 0h1200v630H0z" fill="none" stroke="#4cc9f0" stroke-opacity=".38" stroke-width="8"/>
  <rect x="65" y="58" width="9" height="9" rx="4.5" fill="#60e6a3"/>
  <text x="89" y="69" font-family="Arial, sans-serif" font-weight="700" font-size="19" letter-spacing="4" fill="#87d8ed">LOBO INFINITY PORTAL / DISCORD TOOLS</text>
  <text x="64" y="213" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="95" fill="#f4f8fa">LOBO'S</text>
  <text x="64" y="315" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="95" fill="#e73c55">LITTLE HELPER.</text>
  <text x="69" y="368" font-family="Arial, sans-serif" font-size="24" fill="#c8d9e3">Infinity N5 answers, right where your games happen.</text>
  <g font-family="Arial, sans-serif" font-weight="700" font-size="22">
    <rect x="67" y="425" width="255" height="66" rx="5" fill="#18313f" stroke="#68d2ed" stroke-opacity=".7"/>
    <text x="92" y="465" fill="#f4fbfd">/inf-list</text>
    <rect x="339" y="425" width="255" height="66" rx="5" fill="#18313f" stroke="#68d2ed" stroke-opacity=".7"/>
    <text x="364" y="465" fill="#f4fbfd">/matchup</text>
    <rect x="611" y="425" width="280" height="66" rx="5" fill="#18313f" stroke="#68d2ed" stroke-opacity=".7"/>
    <text x="636" y="465" fill="#f4fbfd">/aro-counter</text>
  </g>
  <path d="M67 549h1066" stroke="#78b8ca" stroke-opacity=".35"/>
  <text x="67" y="585" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2" fill="#8db4c4">ARMY LISTS  /  MATCHUPS  /  REACTIVE ANSWERS</text>
  <text x="1080" y="585" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#f45b70">N5</text>
</svg>`

await writeFile(new URL('../public/assets/little-helper-share.png', import.meta.url), await sharp(Buffer.from(svg)).png({ palette: true, quality: 90 }).toBuffer())
