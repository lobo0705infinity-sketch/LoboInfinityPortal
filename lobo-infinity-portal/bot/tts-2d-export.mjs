import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { randomBytes, randomInt } from 'node:crypto'
import { encodeArmyCode } from '../scripts/infinity-army-encode.mjs'
import { decodeArmyCode } from '../scripts/infinity-army-decode.mjs'
import { resolveExactProfileGroup } from '../scripts/infinity-army-profile-resolution.mjs'
import { buildSubmittedProfiles } from './inf-list-tactical.mjs'

let catalogue
function loadCatalog() {
  if (catalogue) return catalogue
  const data = JSON.parse(gunzipSync(readFileSync(new URL('./tts-2d-catalog.json.gz', import.meta.url))))
  const index = new Map()
  for (const row of data.library.rows) { const bucket = index.get(row[0]) || []; bucket.push(row); index.set(row[0], bucket) }
  const cache = new Map()
  function expand(text, depth = 0) {
    if (depth > 60) throw Error('TTS catalogue reference cycle')
    return text.replace(/\$\{(\d+)\}\$/g, (_, id) => {
      if (!cache.has(id)) cache.set(id, expand(data.library.pool[Number(id) - 1], depth + 1))
      return cache.get(id)
    })
  }
  catalogue = { ...data, index, expand }
  return catalogue
}
const keyOf = m => `${m.unitId}/${m.groupId}/${m.optionId}`
const cleanName = text => String(text || '').replace(/\[[^\]]*\]/g, '').trim()
// Bright tints from the spawner palette keep standee artwork readable.
const GROUP_PALETTE = [
  { name:'Red',color:{r:0.86,g:0.12,b:0.10} },
  { name:'Blue',color:{r:0.15,g:0.53,b:1.00} },
  { name:'Green',color:{r:0.20,g:0.70,b:0.17} },
  { name:'Orange',color:{r:1.00,g:0.55,b:0.10} },
  { name:'Yellow',color:{r:0.93,g:0.85,b:0.20} },
  { name:'Teal',color:{r:0.13,g:0.70,b:0.67} },
  { name:'Purple',color:{r:0.63,g:0.27,b:0.79} },
  { name:'Pink',color:{r:0.96,g:0.44,b:0.81} },
]
function chooseGroupColors(groups,pickIndex) {
  const available = [...GROUP_PALETTE]
  return groups.map(group => {
    const index = pickIndex(available.length)
    if (!Number.isInteger(index) || index < 0 || index >= available.length) throw Error('Invalid group color selection')
    return { combatGroup:group.combatGroup,...available.splice(index,1)[0] }
  })
}
function tintObject(object,color) {
  object.ColorDiffuse = { ...color }
  for (const child of [...Object.values(object.States || {}),...(object.AttachedObjects || []),...(object.ContainedObjects || [])]) tintObject(child,color)
}
function sanitize(object) {
  object.GUID = randomBytes(3).toString('hex')
  object.LuaScript = ''; object.LuaScriptState = ''; object.XmlUI = ''
  object.Locked = false; object.Hands = false
  for (const child of [...Object.values(object.States || {}), ...(object.AttachedObjects || [])]) sanitize(child)
  return object
}
function representationRules(profile,object) {
  // Current Army skills/equipment take precedence over catalogue descriptions.
  const text = profile ? [...(profile.skills || []),...(profile.equipment || [])].join(' ● ') : cleanName(object.Description)
  const decoy = text.match(/\bDecoy(?:\s*\(\s*\+?\s*([12])\s*\)|\s+\+?\s*([12])\b)/i)
  return { decoys:Number(decoy?.[1] || decoy?.[2] || 0), holoprojector:/\bHoloprojector\b/i.test(text) }
}
function labelRepresentation(object,label) {
  object.Nickname = `${object.Nickname} · ${label}`
  // Keep the number visible when switching to a silhouette/alternate form.
  for (const state of Object.values(object.States || {})) labelRepresentation(state,label)
}
function score(row, faction) { return (row[4] === 5 ? 0 : row[4] === 4 ? 20 : 10) + (row[5] === faction ? 0 : Math.floor(row[5]/100) === Math.floor(faction/100) ? 1 : 2) }
function resolveRows(key, faction, data) {
  const native = key.replace(/^\d+/, id => Number(id) >= 10000 ? Number(id) - 10000 : id)
  const rows = data.index.get(key) || data.index.get(native) || data.index.get(data.remaps[key] || data.remaps[native]) || data.index.get(data.peripheralFallbacks?.[key] || data.peripheralFallbacks?.[native]) || []
  if (!rows.length) return []
  const best = Math.min(...rows.map(row => score(row, faction))), profiles = new Map()
  for (const row of rows.filter(row => score(row, faction) === best).sort((a,b) => a[5]-b[5])) if (!profiles.has(row[6])) profiles.set(row[6], row)
  return [...profiles.values()].sort((a,b) => a[6]-b[6])
}
function officialMember(member, payload) {
  const unit = payload?.units?.find(u => Number(u.id) === Number(member.unitId))
  const group = resolveExactProfileGroup(unit, member, { allowAmbiguousLegacy: true })
  const option = group?.options?.find(o => Number(o.id) === member.optionId)
  return { unit, group, option, base: group?.profiles?.[0] }
}
function silhouette(size, data) {
  const template = data.silhouettes[String(size)]
  if (!template) throw Error(`No verified silhouette template for S${size}`)
  const object = JSON.parse(template); delete object.States
  return object
}
function publicDescription(profile, base, option) {
  if (!profile || !base || !option) return null
  const stats = [['CC',base.cc],['BS',base.bs],['PH',base.ph],['WIP',base.wip],['ARM',base.arm],['BTS',base.bts],[base.str?'STR':'V',base.w],['S',base.s]]
  return `${profile.unitName}\n${stats.map(([k,v]) => `[b]${k}[/b]: ${v ?? '?'}`).join(' · ')}\nWeapons: ${profile.weapons.map(w => w.name + (w.mode ? ` (${w.mode})` : '')).join(' ● ')}\nEquipment: ${profile.equipment.join(' ● ')}\nSkills: ${profile.skills.join(' ● ')}\nPoints: ${option.points} · SWC: ${option.swc}`
}
function applySilhouette(object, size, skills, data) {
  const states = object.States || {}
  // Preserve the catalogue's camouflage/IMP/transform states; a normal
  // Mimetism profile never acquires camouflage merely from its modifier.
  const hasCamo = skills ? skills.some(s => /^Camouflage(?:\s*\(|$)/i.test(s)) : /Camouflage/.test(object.Description || '')
  for (const [k,state] of Object.entries(states)) if (/^Camouflage/.test(cleanName(state.Nickname)) && !hasCamo) delete states[k]
  if (size === 0) { object.States = states; return }
  const exists = Object.values(states).some(s => cleanName(s.Nickname) === `Silhouette ${size}`)
  if (!exists) states[String(Math.max(1,...Object.keys(states).map(Number))+1)] = silhouette(size,data)
  if (hasCamo) {
    const modifier = skills?.find(s => /^Mimetism/.test(s)) || object.Description?.match(/Mimetism[^●\n]*/)?.[0] || ''
    const mim = /[-−]\s*6/.test(modifier) ? '-6' : /[-−]\s*3/.test(modifier) ? '-3' : '0'
    const expected = `Camouflage (${mim}) S${size}`
    for (const [k,state] of Object.entries(states)) if (/^Camouflage/.test(cleanName(state.Nickname)) && cleanName(state.Nickname) !== expected) delete states[k]
    let marker = Object.values(states).find(s => cleanName(s.Nickname) === expected)
    if (!marker) {
      // Source marker artwork is selected by Mimetism, never substituted with
      // an unrelated trooper or a 3D sculpt.
      for (const row of data.library.rows) {
        const template = JSON.parse(data.expand(row[11]))
        marker = Object.values(template.States || {}).find(s => cleanName(s.Nickname) === expected)
        if (marker) break
      }
      if (!marker) throw Error(`No verified ${expected} marker artwork`)
      states[String(Math.max(1,...Object.keys(states).map(Number))+1)] = structuredClone(marker)
    }
  }
  object.States = states
}

export function exportTtsArmy({ armyCode, payload, metadata, catalog = loadCatalog(), pickColorIndex = randomInt }) {
  const decoded = decodeArmyCode(armyCode), warnings = [], objects = []
  let decoyCount = 0, hologramCount = 0
  const groupColors = chooseGroupColors(decoded.combatGroups,pickColorIndex)
  const colorByGroup = new Map(groupColors.map(group => [group.combatGroup,group.color]))
  const colorLegend = groupColors.map(group => `Group ${group.combatGroup}: ${group.name}`).join(' · ')
  const groups = decoded.combatGroups.map(group => ({ ...group, members: group.members.flatMap(member => {
    if (member.groupId !== 0) return [member]
    const unit = payload?.units?.find(u => Number(u.id) === member.unitId)
    const includes = unit?.options?.find(o => Number(o.id) === member.optionId)?.includes
    if (!includes?.length) return [member]
    return includes.flatMap(child => Array.from({length:Number(child.q)||1}, () => ({unitId:member.unitId,groupId:Number(child.group),optionId:Number(child.option)})))
  }) }))
  const expanded = { ...decoded, combatGroups: groups.map(group => ({ ...group, members: group.members.map(member => ({ ...member, combinedId:`${decoded.sectorialId}-${member.unitId}-${member.groupId}-${member.optionId}-1` })) })) }
  const profiles = []
  if (payload && metadata) for (const group of groups) for (let offset=0;offset<group.members.length;offset+=15) {
    const code = encodeArmyCode({ ...decoded, combatGroups:[{members:group.members.slice(offset,offset+15)}] })
    profiles.push(...buildSubmittedProfiles({ armyCode:code,metadata,officialPayloads:[payload] }))
  }
  const profileMap = new Map(profiles.map(p => [p.combinedId,p]))
  const add = (member, combatGroup, peripheral = false) => {
    const key = keyOf(member), official = officialMember(member,payload)
    const rows = resolveRows(key,decoded.sectorialId,catalog)
    const profile = profileMap.get(member.combinedId || `${decoded.sectorialId}-${member.unitId}-${member.groupId}-${member.optionId}-1`)
    const size = Number(official.base?.s ?? rows[0]?.[9])
    let object, catalogueDescription
    if (rows.length) {
      object = JSON.parse(catalog.expand(rows[0][11]))
      catalogueDescription = object.Description
      const states = object.States || {}; let slot = Math.max(1,...Object.keys(states).map(Number))
      for (const row of rows.slice(1)) { const alternate = JSON.parse(catalog.expand(row[11])); if (!Object.values(states).some(s=>s.Nickname===alternate.Nickname)) states[String(++slot)] = alternate }
      object.States = states
      if (rows[0][4] !== 5) {
        const updated = publicDescription(profile,official.base,official.option)
        object.Description = updated || 'Rules unavailable: this is catalogue artwork only. Consult the current Infinity Army profile.'
        for (const state of Object.values(object.States || {})) if (/\[b\]S\[\/b\]/i.test(state.Description || '')) state.Description = 'Alternate form artwork from an older catalogue. Consult the current Infinity Army profile for this form’s rules.'
        warnings.push(`${cleanName(object.Nickname)}: ${updated ? 'older catalogue artwork; current Army profile used' : 'current rules unavailable'}`)
      }
    } else {
      if (!Number.isInteger(size)) throw Error(`No model or verified silhouette size for ${official.unit?.name || key}`)
      object = silhouette(size,catalog)
      object.Nickname = `${official.unit?.name || key} · 2D silhouette proxy`
      object.Description = publicDescription(profile,official.base,official.option) || `Missing 2D artwork for ${key}. Consult Infinity Army.`
      warnings.push(`${official.unit?.name || key}: 2D silhouette proxy`)
    }
    if (catalog.peripheralFallbacks?.[key] && !catalog.index.has(key)) {
      object.Nickname = `${official.group?.isc || official.unit?.name || key} · 2D peripheral proxy`
      object.Description = publicDescription(profile,official.base,official.option) || `Peripheral proxy for ${key}. Consult Infinity Army for its rules.`
      warnings.push(`${cleanName(object.Nickname)}: substitute peripheral artwork`)
    }
    applySilhouette(object,size,profile?.skills,catalog)
    object.Nickname = `${cleanName(object.Nickname)} · Group ${combatGroup}${peripheral ? ' · Peripheral' : ''}`
    object.GMNotes = JSON.stringify({ armyProfile:key,combatGroup,peripheral })
    tintObject(object,colorByGroup.get(combatGroup))
    const rules = representationRules(profile,{ Description:catalogueDescription || object.Description })
    const template = structuredClone(object)
    const metadata = { armyProfile:key,combatGroup,peripheral }
    const setId = randomBytes(6).toString('hex')
    if (rules.holoprojector) {
      labelRepresentation(object,'1')
      object.GMNotes = JSON.stringify({ ...metadata,representation:'holoprojector',setId,copy:1 })
    }
    sanitize(object); objects.push(object)
    if (rules.holoprojector) for (let copy=2;copy<=3;copy++) {
      const hologram = structuredClone(template)
      labelRepresentation(hologram,String(copy))
      hologram.GMNotes = JSON.stringify({ ...metadata,representation:'holoprojector',setId,copy })
      sanitize(hologram); objects.push(hologram); hologramCount++
    }
    for (let copy=1;copy<=rules.decoys;copy++) {
      const decoy = structuredClone(template)
      labelRepresentation(decoy,`Decoy ${copy}`)
      decoy.GMNotes = JSON.stringify({ ...metadata,representation:'decoy',setId,copy })
      sanitize(decoy); objects.push(decoy); decoyCount++
    }
    return key
  }
  for (const group of expanded.combatGroups) for (const member of group.members) {
    const key = keyOf(member)
    const nativeKey = key.replace(/^\d+/,id=>Number(id)>=10000?Number(id)-10000:id)
    const peripheralKeys = catalog.peripherals[key] || catalog.peripherals[nativeKey] || []
    const composite = member.groupId === 0 && peripheralKeys.length > 0
    if (!composite) add(member,group.combatGroup)
    for (const childKey of peripheralKeys) {
      const [unitId,groupId,optionId] = childKey.split('/').map(Number)
      add({unitId,groupId,optionId},group.combatGroup,!composite || childKey !== peripheralKeys[0])
    }
    const rule = catalog.minelayers[`${decoded.sectorialId}/${key}`]
    if (rule && catalog.deployables[rule.model]) for (let n=0;n<rule.count;n++) {
      const object = sanitize(JSON.parse(catalog.deployables[rule.model])); tintObject(object,colorByGroup.get(group.combatGroup)); object.Nickname = `${cleanName(object.Nickname)} · Group ${group.combatGroup}`; objects.push(object)
    }
  }
  const name = decoded.listName || 'Infinity army'
  const bag = { Name:'Bag',GUID:randomBytes(3).toString('hex'),Transform:{posX:0,posY:1,posZ:0,rotX:0,rotY:0,rotZ:0,scaleX:1,scaleY:1,scaleZ:1},
    Nickname:`${name} · 2D army`,Description:`2D army models. Take models from this bag; combat groups appear in their names.\n${colorLegend}`,ColorDiffuse:{r:0.2,g:0.3,b:0.5},Locked:false,ContainedObjects:objects }
  const saved = { SaveName:bag.Nickname,VersionNumber:'',GameMode:'',Gravity:0.5,PlayArea:0.5,ObjectStates:[bag],LuaScript:'',LuaScriptState:'' }
  const filename = `${name.replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,65) || 'infinity-army'}-tts-2d.json`
  const attachment = Buffer.from(JSON.stringify(saved))
  if (attachment.length > 9_000_000) throw Error('TTS army exceeds the Discord attachment size limit')
  return { file:{ attachment,name:filename }, warnings:[...new Set(warnings)], modelCount:objects.length, decoyCount, hologramCount, groupColors, colorLegend, saved }
}

export function ttsDiscordAttachment(options) {
  try {
    const result = exportTtsArmy(options)
    const extras = [result.decoyCount ? `${result.decoyCount} decoy${result.decoyCount === 1 ? '' : 's'}` : '',result.hologramCount ? `${result.hologramCount} Holoprojector copies` : ''].filter(Boolean).join(' · ')
    const notes = result.warnings.length ? `\nTTS asset notes: ${result.warnings.slice(0,4).join('; ')}${result.warnings.length>4?`; plus ${result.warnings.length-4} more (see model descriptions)`:''}` : ''
    return { files:[result.file], text:`**TTS 2D army attached** · ${result.modelCount} objects. Save the JSON in TTS’s Saved Objects folder, then open Objects → Saved Objects.\n${result.colorLegend}${extras ? `\nIncluded: ${extras}.` : ''}${notes}` }
  } catch (error) {
    console.error('TTS 2D export failed:',error.message)
    return { files:[],text:`TTS export unavailable: ${error.message}. Your army list is still available.` }
  }
}

export function appendTtsEmbed(embeds, tts) {
  const used = embeds.reduce((total,embed) => total + (embed.title?.length || 0) + (embed.description?.length || 0)
    + (embed.footer?.text?.length || 0) + (embed.author?.name?.length || 0)
    + (embed.fields || []).reduce((sum,field) => sum + field.name.length + field.value.length,0),0)
  const room = Math.min(4000,6000-used)
  return room > 0 ? [...embeds,{description:tts.text.slice(0,room)}] : embeds
}
