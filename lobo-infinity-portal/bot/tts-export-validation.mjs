// Structural checks run before any JSON is attached. Asset URLs are checked
// for valid references here; this does not claim remote CDN availability.
export function validateTtsExport(saved, { expectedCount, groupColors, manifest = [], decoyCount = 0, hologramCount = 0 }) {
  const bag = saved?.ObjectStates?.[0]
  const objects = bag?.ContainedObjects || []
  const errors = [], guids = new Set(), groups = new Map(groupColors.map(g => [g.combatGroup, g.color]))
  if (objects.length !== expectedCount || manifest.length !== expectedCount) errors.push('Object count differs from the expansion manifest')
  const visit = object => {
    if (!/^[a-f0-9]{6}$/.test(object.GUID || '') || guids.has(object.GUID)) errors.push('Missing or duplicate object GUID')
    guids.add(object.GUID)
    if (object.CustomAssetbundle) errors.push('Unexpected 3D sculpt bundle')
    if (object.LuaScript || object.LuaScriptState || object.XmlUI) errors.push('Unexpected embedded script/UI')
    const checkAssets = value => {
      if (!value || typeof value !== 'object') return
      for (const [key, field] of Object.entries(value)) {
        if (/(?:URL|Url)$/.test(key) && field && (typeof field !== 'string' || !/^https?:\/\//.test(field))) errors.push(`Invalid asset reference: ${key}`)
        else if (field && typeof field === 'object') checkAssets(field)
      }
    }
    checkAssets(object.CustomMesh); checkAssets(object.CustomImage); checkAssets(object.CustomDeck)
    if (object.Name === 'Custom_Model' && !object.CustomMesh?.MeshURL) errors.push('Missing model mesh asset')
    if (object.Name === 'Custom_Token' && !object.CustomImage?.ImageURL) errors.push('Missing token image asset')
    for (const child of [...Object.values(object.States || {}), ...(object.AttachedObjects || []), ...(object.ContainedObjects || [])]) visit(child)
  }
  if (!bag) errors.push('Missing army bag'); else visit(bag)
  let decoys = 0, holograms = 0
  const sets = new Map()
  for (const [index, object] of objects.entries()) {
    const expected = manifest[index]
    if (!expected) continue
    const color = groups.get(expected.combatGroup)
    if (!color || JSON.stringify(object.ColorDiffuse) !== JSON.stringify(color) || !object.Nickname.includes(`Group ${expected.combatGroup}`)) errors.push(`Wrong combat group on object ${index + 1}`)
    const names = [object, ...Object.values(object.States || {})].map(x => x.Nickname || '').join(' ')
    const checkTint = item => {
      if (JSON.stringify(item.ColorDiffuse) !== JSON.stringify(color)) errors.push('Alternate state has the wrong group color')
      for (const child of [...Object.values(item.States || {}), ...(item.AttachedObjects || []), ...(item.ContainedObjects || [])]) checkTint(child)
    }
    checkTint(object)
    if (expected.camo && !/camo|camouflage/i.test(names)) errors.push(`Missing camouflage state on ${object.Nickname}`)
    if (expected.profile) {
      let meta
      try { meta = JSON.parse(object.GMNotes) } catch { errors.push('Invalid model metadata'); continue }
      if (meta.armyProfile !== expected.profile || meta.combatGroup !== expected.combatGroup) errors.push('Profile/group metadata mismatch')
      if (meta.representation !== expected.representation || (meta.copy || 0) !== (expected.copy || 0)) errors.push('Representation differs from the manifest')
      if (meta.representation === 'decoy') {
        decoys++
        if (!object.Nickname.endsWith(`· Decoy ${meta.copy}`)) errors.push('Unlabelled decoy')
      }
      if (meta.representation === 'holoprojector') {
        if (meta.copy > 1) holograms++
        const copies = sets.get(meta.setId) || []; copies.push(meta.copy); sets.set(meta.setId, copies)
        if (!object.Nickname.endsWith(`· ${meta.copy}`)) errors.push('Unlabelled Holoprojector copy')
      }
    }
  }
  if (decoys !== decoyCount || holograms !== hologramCount) errors.push('Decoy/Holoprojector totals differ')
  for (const copies of sets.values()) if (copies.sort().join(',') !== '1,2,3') errors.push('Incomplete Holoprojector set')
  if (errors.length) throw Error(`TTS validation failed: ${[...new Set(errors)].join('; ')}`)
  return `Validated ${objects.length} objects, ${groups.size} combat groups, camouflage states and ${decoys} decoys / ${holograms} extra Holoprojector copies; asset reference syntax checked.`
}
