import { chromium } from 'playwright'

const WIDTH = 2200
const HEIGHT = 1660
const ENTRIES_PER_PAGE = 3

export async function renderAroCounterImages({ result, browserFactory = () => chromium.launch({ headless: true }) } = {}) {
  const pages = chunk(result.results, ENTRIES_PER_PAGE)
  const browser = await browserFactory()
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
    try {
      const output = []
      for (let index = 0; index < pages.length; index += 1) {
        await page.setContent(markup({ result, entries: pages[index], pageIndex: index, totalPages: pages.length }), { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        const imageBuffer = await page.locator('.sheet').screenshot({ type: 'png', animations: 'disabled' })
        output.push({ imageBuffer, name: `aro-counter-${String(index + 1).padStart(2, '0')}.png` })
      }
      return output
    } finally { await page.close() }
  } finally { await browser.close() }
}

function markup({ result, entries, pageIndex, totalPages }) {
  const target = shortName(result.target.name)
  const range = result.range === 'all' ? '0–48 INCHES' : `${result.range} INCHES`
  const army = result.army ? ` · ${String(result.army.name).toUpperCase()}` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles()}</style></head><body><main class="sheet"><header><div class="brand">LOBO'S LITTLE HELPER <span>•</span> ARO COUNTER</div><div class="title"><div><p class="label">TOP 10 REACTIVE RESPONSES</p><h1>COUNTERS TO ${esc(target)}</h1></div><p class="scope">${esc(range)}${esc(army)}<br>BOTH TROOPERS IN COVER WHERE ELIGIBLE</p></div><div class="legend"><b>F2F WIN</b> REACTIVE TROOPER WINS FACE-TO-FACE <i>•</i> <b>EFFECT</b> WOUND / STR OR MEANINGFUL STATE <i>•</i> <b>SURVIVE</b> REMAINS ON TABLE</div></header><section class="cards">${entries.map((entry, index) => card(entry, pageIndex * ENTRIES_PER_PAGE + index + 1)).join('')}</section><footer><span>DIRECT TEMPLATE WEAPONS EXCLUDED</span><span>PAGE ${pageIndex + 1} / ${totalPages}</span><span>FIRETEAM +1SD ONLY WHEN LEGAL</span></footer></main></body></html>`
}

function card(entry, rank) {
  const rows = entry.bands.map((band) => `<tr><td>${esc(band.range)}″</td><td class="weapon">${esc(cleanWeaponName(band.targetWeapon))}</td><td class="weapon">${esc(cleanWeaponName(band.aroWeapon))}</td><td>${pct(band.reactiveWin)}</td><td>${pct(band.meaningfulEffect)}</td><td>${pct(band.survival)}</td></tr>`).join('')
  return `<article class="card"><div class="rank">${rank}</div><div class="card-main"><div class="card-head"><div><h2>${esc(shortName(entry.name))}</h2><p>BEST REACTIVE PROFILE · ${esc(cleanWeaponName(entry.weapon))}</p></div>${entry.state === 'fireteam' ? '<span class="badge">FIRETEAM +1SD</span>' : '<span class="badge muted">NON-LINKED</span>'}</div><table><thead><tr><th>RANGE</th><th>TARGET WEAPON</th><th>ARO WEAPON</th><th>F2F WIN</th><th>EFFECT</th><th>SURVIVE</th></tr></thead><tbody>${rows}</tbody></table></div></article>`
}

function styles() { return `*{box-sizing:border-box}html,body{margin:0;background:#07111c;color:#edf8ff;font-family:Arial,Helvetica,sans-serif}.sheet{width:${WIDTH}px;min-height:${HEIGHT}px;padding:48px 56px 30px;background:radial-gradient(circle at 88% 0%,#103757 0,transparent 34%),linear-gradient(145deg,#081724,#061019 56%,#091826);border:5px solid #00b8e6;position:relative;overflow:hidden;display:flex;flex-direction:column}.sheet:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 5px,rgba(117,226,255,.018) 5px 6px);pointer-events:none}header,.cards,footer{position:relative}.brand{font-size:22px;font-weight:900;letter-spacing:4px;color:#72e5ff}.brand span{color:#ffbf3f}.title{display:flex;align-items:end;justify-content:space-between;gap:30px;border-bottom:2px solid rgba(114,229,255,.55);padding:18px 0}.label{margin:0 0 8px;color:#72e5ff;font-size:14px;font-weight:900;letter-spacing:2px}.title h1{margin:0;font-size:46px;line-height:1.04;letter-spacing:.5px}.title .scope{margin:0;color:#a9c9d8;font-size:16px;font-weight:800;line-height:1.5;letter-spacing:1.5px;text-align:right}.legend{margin:16px 0 20px;padding:12px 16px;background:#0d2638;border-left:7px solid #ffbf3f;color:#b8d6e3;font-size:14px;letter-spacing:.5px}.legend b{color:#fff}.legend i{color:#00b8e6;font-style:normal;margin:0 8px}.cards{display:grid;gap:18px}.card{display:grid;grid-template-columns:125px 1fr;min-height:360px;border:1px solid #2d6b87;background:linear-gradient(100deg,rgba(14,44,63,.94),rgba(9,27,41,.94));box-shadow:0 8px 24px rgba(0,0,0,.22)}.rank{display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#00b8e6,#087da4);color:#06131c;font-size:68px;font-weight:900}.card-main{padding:20px 26px}.card-head{display:flex;align-items:start;justify-content:space-between;gap:24px;margin-bottom:14px}.card h2{margin:0;font-size:34px;line-height:1;text-transform:uppercase;letter-spacing:.8px}.card p{margin:9px 0 0;color:#ffcf69;font-size:19px;font-weight:800}.badge{flex:0 0 auto;margin-top:2px;padding:9px 13px;border:1px solid #78dcf5;color:#9eeaff;font-size:14px;font-weight:900;letter-spacing:1px}.badge.muted{border-color:#5f7884;color:#aac0c9}table{width:100%;border-collapse:collapse;font-size:18px}th{padding:9px 12px;background:#102f43;color:#80dff7;text-align:right;font-size:13px;letter-spacing:.8px;white-space:nowrap}th:first-child,th:nth-child(2),th:nth-child(3),td:first-child,td:nth-child(2),td:nth-child(3){text-align:left}td{padding:8px 12px;border-bottom:1px solid rgba(124,205,231,.16);text-align:right;font-weight:800;white-space:nowrap}tbody tr:nth-child(even){background:rgba(89,171,205,.075)}.weapon{color:#ffcf69;font-size:17px}td:nth-child(4){color:#f4fbff}td:nth-child(5){color:#ffcf69}td:nth-child(6){color:#77e6b1}footer{display:flex;justify-content:space-between;margin-top:auto;padding-top:15px;border-top:1px solid rgba(114,229,255,.38);color:#88aab9;font-size:12px;font-weight:800;letter-spacing:.8px}` }
function shortName(value) { return String(value || '').split('—').at(-1).trim() || String(value || '').trim() }
function cleanWeaponName(value) { return String(value || '').replace(/:[^:]+\s*—\s*/, ' · ').replace(/:\s*/g, ' · ').replace(/\s*—\s*/g, ' · ') }
function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function chunk(values, size) { const result = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result }
