import { chromium } from 'playwright'

const WIDTH = 2200
const HEIGHT = 1660

export async function renderMatchupImages({ result, browserFactory = () => chromium.launch({ headless: true }) } = {}) {
  const browser = await browserFactory()
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
    try {
      const pages = result.directions.flatMap((direction, directionIndex) => direction.variants.map((variant) => ({ direction, directionIndex, variant })))
      const output = []
      for (let index = 0; index < pages.length; index += 1) {
        const item = pages[index]
        await page.setContent(markup(item.direction, item.variant, item.directionIndex, index, pages.length), { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        output.push({ imageBuffer: await page.locator('.sheet').screenshot({ type: 'png', animations: 'disabled' }), name: `matchup-${String(index + 1).padStart(2, '0')}.png` })
      }
      return output
    } finally { await page.close() }
  } finally { await browser.close() }
}

function markup(direction, variant, directionIndex, index, total) {
  const attacker = shortName(direction.attacker.name)
  const defender = shortName(direction.defender.name)
  const attackerState = variant.attackerState === 'fireteam' ? 'LINKED (+1SD)' : 'UNLINKED'
  const defenderState = variant.defenderState === 'fireteam' ? 'LINKED (+1SD)' : 'UNLINKED'
  return `<!doctype html><html><head><meta charset="utf-8"><style>${styles()}</style></head><body><main class="sheet"><header><div class="brand">LOBO'S LITTLE HELPER <span>•</span> MATCHUP</div><div class="title"><div><p class="label">${directionIndex === 0 ? 'MODEL 1 ATTACKS' : 'MODEL 2 ATTACKS'}</p><h1>${esc(attacker)} <b>→</b> ${esc(defender)}</h1></div><div class="cover">BOTH TROOPERS IN COVER<br>WHERE ELIGIBLE</div></div><div class="states"><span><b>ATTACKER:</b> ${attackerState}</span><span><b>DEFENDER:</b> ${defenderState}</span></div><div class="legend"><b>F2F WIN</b> ATTACKER WINS FACE-TO-FACE <i>•</i> BOTH WEAPONS, DICE POOLS, AND APPLIED MODIFIERS ARE SHOWN <i>•</i> STATES COUNT AS ONE EFFECT</div></header><section class="card"><div class="combatants"><div><small>ATTACKER</small><strong>${esc(attacker)}</strong></div><span>VS</span><div><small>DEFENDER / ARO</small><strong>${esc(defender)}</strong></div></div><table><thead><tr><th>RANGE</th><th>ATTACKER: WEAPON &amp; MODIFIERS</th><th>DEFENDER: ARO &amp; MODIFIERS</th><th>F2F WIN</th><th>1 EFFECT</th><th>2 EFFECTS</th><th>3+ EFFECTS</th><th>SURVIVE</th></tr></thead><tbody>${variant.bands.map(row).join('')}</tbody></table></section><footer><span>ACTIVE TURN • BEST LEGAL ACTIVE WEAPON / BEST DEFENSIVE ARO</span><span>PAGE ${index + 1} / ${total}</span><span>ALL MODIFIERS APPLIED TO THE DISPLAYED ROLL</span></footer></main></body></html>`
}

function row(band) {
  return `<tr><td>${esc(band.range)}″</td><td class="action">${action(band.attackerAction, band.attackerPool)}</td><td class="action defender">${action(band.defenderAction, band.defenderPool)}</td><td>${pct(band.f2fWin)}</td><td class="damage">${pct(band.oneEffect)}</td><td class="damage">${pct(band.twoEffects)}</td><td class="damage">${pct(band.threePlusEffects)}</td><td class="survival">${pct(band.defenderSurvival)}</td></tr>`
}
function action(name, pool) {
  if (!pool) return `<b>${esc(cleanWeaponName(name))}</b><em>No roll</em>`
  const modifierText = (pool.modifierSources || []).filter(Boolean).join(' · ') || 'No MOD'
  const baseBurst = Number(pool.burst || 0)
  const specialDice = Math.max(0, Number(pool.specialDice || 0))
  const resolvedBurst = baseBurst + specialDice
  const burstBreakdown = specialDice ? `base B${baseBurst} + ${specialDice}SD` : `base B${baseBurst}`
  const dice = `BS ${pool.baseTarget}${Number(pool.modifiers) ? (Number(pool.modifiers) > 0 ? ' + ' : ' − ') + Math.abs(Number(pool.modifiers)) : ''} = ${pool.target} · B${resolvedBurst} (${burstBreakdown})`
  return `<b>${esc(cleanWeaponName(name || pool.source))}</b><small>${esc(dice)}</small><em>${esc(modifierText)}</em>`
}

function styles() { return `*{box-sizing:border-box}html,body{margin:0;background:#07111c;color:#edf8ff;font-family:Arial,Helvetica,sans-serif}.sheet{width:${WIDTH}px;min-height:${HEIGHT}px;padding:48px 56px 30px;background:radial-gradient(circle at 88% 0%,#103757 0,transparent 34%),linear-gradient(145deg,#081724,#061019 56%,#091826);border:5px solid #00b8e6;position:relative;overflow:hidden}.sheet:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 5px,rgba(117,226,255,.018) 5px 6px);pointer-events:none}header,.card,footer{position:relative}.brand{font-size:22px;font-weight:900;letter-spacing:4px;color:#72e5ff}.brand span{color:#ffbf3f}.title{display:flex;align-items:end;justify-content:space-between;gap:30px;border-bottom:2px solid rgba(114,229,255,.55);padding:18px 0}.label{margin:0 0 8px;color:#72e5ff;font-size:14px;font-weight:900;letter-spacing:2px}.title h1{margin:0;font-size:42px;line-height:1.04}.title h1 b{color:#ffbf3f}.cover{color:#a9c9d8;font-size:15px;font-weight:800;line-height:1.5;letter-spacing:1.5px;text-align:right}.states{display:flex;gap:16px;margin:16px 0 12px}.states span{padding:9px 13px;border:1px solid #277896;background:#0c283a;color:#80dff7;font-weight:900;letter-spacing:1px;font-size:14px}.states b{color:#fff}.legend{margin:0 0 20px;padding:12px 16px;background:#0d2638;border-left:7px solid #ffbf3f;color:#b8d6e3;font-size:14px;letter-spacing:.5px}.legend b{color:#fff}.legend i{color:#00b8e6;font-style:normal;margin:0 8px}.card{border:1px solid #2d6b87;background:linear-gradient(100deg,rgba(14,44,63,.94),rgba(9,27,41,.94));box-shadow:0 8px 24px rgba(0,0,0,.22)}.combatants{display:grid;grid-template-columns:1fr 90px 1fr;align-items:center;padding:18px 24px;border-bottom:1px solid rgba(124,205,231,.3)}.combatants div:last-child{text-align:right}.combatants small{display:block;margin-bottom:5px;color:#76dff8;font-size:12px;font-weight:900;letter-spacing:1.6px}.combatants strong{font-size:25px;line-height:1;text-transform:uppercase}.combatants span{text-align:center;color:#ffbf3f;font-size:22px;font-weight:900}table{width:100%;border-collapse:collapse;font-size:17px}th{padding:12px 11px;background:#102f43;color:#80dff7;text-align:right;font-size:12px;letter-spacing:.8px}th:first-child,th:nth-child(2),th:nth-child(3),td:first-child,td:nth-child(2),td:nth-child(3){text-align:left}td{padding:12px 11px;border-bottom:1px solid rgba(124,205,231,.16);text-align:right;font-weight:800;vertical-align:top;white-space:nowrap}tbody tr:nth-child(even){background:rgba(89,171,205,.075)}.action{white-space:normal;min-width:330px;color:#ffcf69}.action b{display:block;font-size:17px}.action small{display:block;margin-top:4px;color:#e7f7ff;font-size:14px}.action em{display:block;margin-top:3px;color:#88b8ca;font-style:normal;font-size:12px;line-height:1.25}.defender b{color:#9ee8ff}.damage{color:#ffcf69}.survival{color:#77e6b1}footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:13px;border-top:1px solid rgba(114,229,255,.38);color:#88aab9;font-size:12px;font-weight:800;letter-spacing:.8px}` }
function shortName(value) { return String(value || '').split('—').at(-1).trim() || String(value || '').trim() }
function cleanWeaponName(value) { return String(value || '').replace(/:[^:]+\s*—\s*/, ' · ').replace(/\s*—\s*/g, ' · ') }
function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;') }
