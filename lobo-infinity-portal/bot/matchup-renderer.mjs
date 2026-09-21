import { chromium } from 'playwright'

const WIDTH = 1600
const HEIGHT = 1420

export async function renderMatchupImages({ result, browserFactory = () => chromium.launch({ headless: true }) } = {}) {
  const browser = await browserFactory()
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
    try {
      const output = []
      for (let index = 0; index < result.directions.length; index += 1) {
        await page.setContent(markup(result.directions[index], index), { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        output.push({ imageBuffer: await page.locator('.sheet').screenshot({ type: 'png', animations: 'disabled' }), name: `matchup-${String(index + 1).padStart(2, '0')}.png` })
      }
      return output
    } finally { await page.close() }
  } finally { await browser.close() }
}

function markup(direction, index) {
  const attacker = shortName(direction.attacker.name)
  const defender = shortName(direction.defender.name)
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles()}</style></head><body><main class="sheet"><header><div class="brand">LOBO'S LITTLE HELPER <span>•</span> MATCHUP</div><div class="title"><div><p class="label">${index === 0 ? 'MODEL 1 ATTACKS' : 'MODEL 2 ATTACKS'}</p><h1>${esc(attacker)} <b>→</b> ${esc(defender)}</h1></div><div class="cover">BOTH TROOPERS IN COVER<br>WHERE ELIGIBLE</div></div><div class="legend"><b>F2F WIN</b> ATTACKER WINS FACE-TO-FACE <i>•</i> <b>1 / 2 / 3+</b> WOUND OR STATE EFFECTS <i>•</i> <b>SURVIVE</b> DEFENDER REMAINS ON TABLE</div></header><section class="card"><div class="combatants"><div><small>ATTACKER</small><strong>${esc(attacker)}</strong></div><span>VS</span><div><small>DEFENDER</small><strong>${esc(defender)}</strong></div></div><table><thead><tr><th>RANGE</th><th>BEST WEAPON</th><th>F2F WIN</th><th>1 EFFECT</th><th>2 EFFECTS</th><th>3+ EFFECTS</th><th>SURVIVE</th></tr></thead><tbody>${direction.bands.map(row).join('')}</tbody></table></section><footer><span>ACTIVE TURN • BEST LEGAL WEAPON AT EACH RANGE</span><span>PAGE ${index + 1} / 2</span><span>STATES COUNT AS ONE EFFECT</span></footer></main></body></html>`
}

function row(band) { return `<tr><td>${esc(band.range)}″</td><td class="weapon">${esc(cleanWeaponName(band.weapon))}</td><td>${pct(band.f2fWin)}</td><td class="damage">${pct(band.oneEffect)}</td><td class="damage">${pct(band.twoEffects)}</td><td class="damage">${pct(band.threePlusEffects)}</td><td class="survival">${pct(band.defenderSurvival)}</td></tr>` }

function styles() { return `*{box-sizing:border-box}html,body{margin:0;background:#07111c;color:#edf8ff;font-family:Arial,Helvetica,sans-serif}.sheet{width:${WIDTH}px;min-height:${HEIGHT}px;padding:54px 60px 34px;background:radial-gradient(circle at 88% 0%,#103757 0,transparent 34%),linear-gradient(145deg,#081724,#061019 56%,#091826);border:5px solid #00b8e6;position:relative;overflow:hidden}.sheet:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 5px,rgba(117,226,255,.018) 5px 6px);pointer-events:none}header,.card,footer{position:relative}.brand{font-size:22px;font-weight:900;letter-spacing:4px;color:#72e5ff}.brand span{color:#ffbf3f}.title{display:flex;align-items:end;justify-content:space-between;gap:30px;border-bottom:2px solid rgba(114,229,255,.55);padding:22px 0 20px}.label{margin:0 0 9px;color:#72e5ff;font-size:15px;font-weight:900;letter-spacing:2px}.title h1{margin:0;font-size:44px;line-height:1.04;letter-spacing:.4px}.title h1 b{color:#ffbf3f}.cover{color:#a9c9d8;font-size:17px;font-weight:800;line-height:1.5;letter-spacing:1.5px;text-align:right}.legend{margin:18px 0 25px;padding:13px 17px;background:#0d2638;border-left:7px solid #ffbf3f;color:#b8d6e3;font-size:15px;letter-spacing:.6px}.legend b{color:#fff}.legend i{color:#00b8e6;font-style:normal;margin:0 8px}.card{border:1px solid #2d6b87;background:linear-gradient(100deg,rgba(14,44,63,.94),rgba(9,27,41,.94));box-shadow:0 8px 24px rgba(0,0,0,.22)}.combatants{display:grid;grid-template-columns:1fr 90px 1fr;align-items:center;padding:22px 28px;border-bottom:1px solid rgba(124,205,231,.3)}.combatants div:last-child{text-align:right}.combatants small{display:block;margin-bottom:6px;color:#76dff8;font-size:13px;font-weight:900;letter-spacing:1.6px}.combatants strong{font-size:27px;line-height:1;text-transform:uppercase}.combatants span{text-align:center;color:#ffbf3f;font-size:22px;font-weight:900;letter-spacing:1px}table{width:100%;border-collapse:collapse;font-size:20px}th{padding:14px 13px;background:#102f43;color:#80dff7;text-align:right;font-size:13px;letter-spacing:1px;white-space:nowrap}th:first-child,th:nth-child(2),td:first-child,td:nth-child(2){text-align:left}td{padding:17px 13px;border-bottom:1px solid rgba(124,205,231,.16);text-align:right;font-weight:800;white-space:nowrap}tbody tr:nth-child(even){background:rgba(89,171,205,.075)}.weapon{color:#ffcf69;font-size:17px}.damage{color:#ffcf69}.survival{color:#77e6b1}footer{display:flex;justify-content:space-between;margin-top:24px;padding-top:15px;border-top:1px solid rgba(114,229,255,.38);color:#88aab9;font-size:13px;font-weight:800;letter-spacing:1px}` }
function shortName(value) { return String(value || '').split('—').at(-1).trim() || String(value || '').trim() }
function cleanWeaponName(value) { return String(value || '').replace(/:[^:]+\s*—\s*/, ' · ').replace(/\s*—\s*/g, ' · ') }
function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
