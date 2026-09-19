export function resolveExactProfileGroup(unit, member, { allowAmbiguousLegacy = false, profileName = '' } = {}) {
  const groups = Array.isArray(unit?.profileGroups) ? unit.profileGroups : []
  const groupId = Number(member?.groupId)
  const optionId = Number(member?.optionId)
  const profileId = Number(String(member?.combinedId || '').split('-').at(-1))
  const exact = groups.find((item) => Number(item.id) === groupId)
  if (exact || groupId !== 0) return exact

  const candidates = groups.filter((group) =>
    (group.options || []).some((option) => Number(option.id) === optionId)
      && (group.profiles || []).some((profile) => Number(profile.id) === profileId),
  )
  if (candidates.length === 1) return candidates[0]

  const wanted = normalizeProfileName(profileName)
  if (wanted) {
    const exactOptionMatches = candidates.filter((group) =>
      (group.options || []).some((option) =>
        Number(option.id) === optionId && normalizeProfileName(option.name) === wanted,
      ),
    )
    if (exactOptionMatches.length === 1) return exactOptionMatches[0]

    const nameMatches = candidates.filter((group) => [
      group.isc,
      ...(group.profiles || []).map((profile) => profile.name),
      ...(group.options || []).filter((option) => Number(option.id) === optionId).map((option) => option.name),
    ].some((name) => profileNamesMatch(wanted, normalizeProfileName(name))))
    if (nameMatches.length === 1) return nameMatches[0]
  }

  if (allowAmbiguousLegacy && candidates.length) return candidates[0]
  return groups.length === 1 ? groups[0] : undefined
}

function normalizeProfileName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function profileNamesMatch(left, right) {
  return Boolean(left && right) && (left === right || left.includes(right) || right.includes(left))
}
