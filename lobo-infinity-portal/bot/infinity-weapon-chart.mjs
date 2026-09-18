export const WEAPON_CHART_SCHEMA_VERSION = 'infinity-official-weapon-chart-v1'

export function normalizeWeaponChartRows(rows = []) {
  if (!Array.isArray(rows)) throw new Error('Weapon chart rows must be an array.')
  return rows.map(normalizeWeaponChartRow).filter(Boolean)
}

export function normalizeWeaponChartRow(row = {}) {
  const name = clean(row.name)
  if (!name) return null
  const ranges = normalizeRanges(row.ranges)
  const saving = parseSavingAttribute(row.saving)
  const traits = asArray(row.traits).map(clean).filter(Boolean)
  const attackType = traits.some((trait) => /direct template/i.test(trait)) ? 'direct-template' : 'bs-attack'
  const smoke = /(?:^|\+)smoke(?:$|\+)/i.test(clean(row.ammo))
  const eclipse = /eclipse/i.test(clean(row.ammo))
  const attackAttribute = inferAttackAttribute(name, traits, smoke || eclipse)
  return {
    id: finiteInteger(row.id),
    name,
    mode: clean(row.mode) || null,
    ranges,
    damage: parseDamage(row.damage),
    burst: parseNullableNumber(row.burst),
    ammo: clean(row.ammo) || null,
    save: saving.attribute,
    saveDivisor: saving.divisor,
    saveFixed: saving.fixed,
    saveModifier: saving.modifier,
    savingRolls: parseNullableNumber(row.savingRolls) ?? inferSavingRolls(row.ammo),
    traits,
    attackType,
    attackAttribute,
    smoke: smoke || eclipse,
    eclipse,
    nonLethal: traits.some((trait) => /non-lethal/i.test(trait)),
    ignoresCover: traits.some((trait) => /no cover/i.test(trait)),
    continuousDamage: traits.some((trait) => /contin(?:u|ou)ous damage/i.test(trait)),
    disposableUses: inferDisposableUses(traits),
    state: inferState(traits, row.ammo),
  }
}

export async function extractWeaponChartRows(page) {
  const rows = page.locator('tr').filter({ has: page.locator('.imp_armas_nombre') })
  return rows.evaluateAll((elements) => elements.map((row) => {
    const weaponIds = new Map([...row.ownerDocument.querySelectorAll('#filtro_armas option')].map((option) => [option.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), Number(option.value)]))
    const cells = [...row.querySelectorAll(':scope > td')]
    const nameCell = cells[0]
    const rawName = nameCell?.innerText?.trim() || ''
    const modeElement = nameCell?.querySelector('.imp_sub_nombre, .arma_modo, .modo, small')
    const mode = modeElement?.textContent?.trim() || null
    const ranges = []
    let previous = null
    for (const segment of row.querySelectorAll('.imp_distancia')) {
      const boundaries = [...segment.querySelectorAll('.imp_dist_sup')].map((item) => Number(item.textContent.trim())).filter(Number.isFinite)
      const modifier = Number(segment.querySelector('.imp_dist_txt')?.textContent?.replace('+', '').trim())
      const min = boundaries.length > 1 ? boundaries[0] : previous
      const max = boundaries.at(-1)
      if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(modifier)) ranges.push({ min, max, modifier })
      if (Number.isFinite(max)) previous = max
    }
    const name = mode && rawName.endsWith(mode) ? rawName.slice(0, -mode.length).trim() : rawName
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    return {
      id: Number(nameCell?.querySelector('[data-arma]')?.getAttribute('data-arma')) || weaponIds.get(normalizedName) || null,
      name,
      mode,
      ranges,
      damage: cells[2]?.innerText,
      burst: cells[3]?.innerText,
      ammo: cells[4]?.innerText,
      saving: cells[5]?.innerText,
      savingRolls: cells[6]?.innerText,
      traits: (cells[7]?.innerText || '').split(/\s+-\s+|\n+/).map((value) => value.trim()).filter(Boolean),
    }
  }))
}

export function weaponChartRecordToGunfighterWeapon(record) {
  const modeName = [record.mode, record.ammo].filter(Boolean).join(' — ') || 'Default'
  return {
    id: record.id,
    name: record.name,
    modes: [{
      name: modeName,
      ranges: record.ranges,
      power: record.damage,
      burst: record.burst,
      ammo: record.ammo,
      save: record.save,
      saveDivisor: record.saveDivisor,
      saveFixed: record.saveFixed,
      saveModifier: record.saveModifier,
      saves: record.savingRolls,
      traits: record.traits,
      attackType: record.attackType,
      attackAttribute: record.attackAttribute,
      smoke: record.smoke,
      eclipse: record.eclipse,
      nonLethal: record.nonLethal,
      ignoresCover: record.ignoresCover,
      continuousDamage: record.continuousDamage,
      disposableUses: record.disposableUses,
      states: record.state ? [record.state] : [],
    }],
  }
}

function normalizeRanges(ranges) {
  return asArray(ranges).map((range) => ({
    min: Number(range.min),
    max: Number(range.max),
    modifier: Number(range.modifier),
  })).filter((range) => Number.isFinite(range.min) && Number.isFinite(range.max) && Number.isFinite(range.modifier) && range.max > range.min)
}

function parseSavingAttribute(value) {
  const text = clean(value).toUpperCase()
  const attribute = text.match(/^(ARM|BTS|PH)/)?.[1] || null
  const divisor = Number(text.match(/\/(\d+)/)?.[1]) || 1
  const fixed = Number(text.match(/=(\d+)/)?.[1])
  const signed = text.match(/(?:ARM|BTS|PH)([+-]\d+)/)?.[1]
  return { attribute, divisor, fixed: Number.isFinite(fixed) ? fixed : null, modifier: signed ? Number(signed) : 0 }
}

function parseDamage(value) {
  const text = clean(value)
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : text || null
}

function inferSavingRolls(ammo) {
  const value = clean(ammo).toUpperCase()
  if (value.includes('EXP')) return 3
  if (value.includes('DA')) return 2
  return 1
}

function inferState(traits, ammo) {
  const explicit = traits.map((trait) => trait.match(/State:\s*([^\s-]+(?:-[A-Z])?)/i)?.[1]).find(Boolean)
  if (explicit) return explicit.toLowerCase()
  const value = clean(ammo).toUpperCase()
  if (value.includes('E/M')) return 'isolated'
  if (value.includes('PARA')) return 'immobilized'
  if (value.includes('STUN')) return 'stunned'
  return null
}

function inferAttackAttribute(name, traits, smoke) {
  if (/flash pulse/i.test(name) || traits.some((trait) => /technical weapon/i.test(trait))) return 'wip'
  if (smoke || traits.some((trait) => /BS Weapon \(PH\)/i.test(trait))) return 'ph'
  return 'bs'
}

function inferDisposableUses(traits) {
  const trait = traits.find((value) => /disposable/i.test(value))
  if (!trait) return null
  const count = Number(trait.match(/disposable\s*\(?\s*(\d+)/i)?.[1])
  return Number.isFinite(count) ? count : 1
}

function parseNullableNumber(value) {
  if (value == null || clean(value) === '-' || clean(value) === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function finiteInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function asArray(value) { return Array.isArray(value) ? value : value == null ? [] : [value] }
function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim() }
