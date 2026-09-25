import { decodeArmyCode } from './infinity-army-decode.mjs'

// The inverse of the version-1 Army-code framing used by Infinity Army.
// Round-trip through the existing decoder before exposing a generated code.
export function encodeArmyCode({ sectorialId, sectorialSlug, listName = 'Generated list', maxPoints = 300, combatGroups }) {
  if (!Array.isArray(combatGroups) || !combatGroups.length || combatGroups.length > 2) throw new Error('Army lists need one or two Combat Groups.')
  const parts = [vli(sectorialId), encodedString(sectorialSlug)]
  const name = Buffer.from(String(listName), 'utf8')
  if (name.length > 127) throw new Error('Army list name is too long.')
  parts.push(Buffer.from([name.length]), name, vli(maxPoints), vli(combatGroups.length))

  for (const [index, group] of combatGroups.entries()) {
    if (!Array.isArray(group.members) || !group.members.length || group.members.length > 15) throw new Error('Invalid Combat Group size.')
    parts.push(vli(index + 1), vli(1), vli(0), vli(group.members.length), vli(0))
    for (const [memberIndex, member] of group.members.entries()) {
      parts.push(vli(member.unitId), vli(member.groupId), vli(member.optionId))
      parts.push(Buffer.from(memberIndex < group.members.length - 1 ? [0, 0, 0] : [0, 0]))
    }
  }

  const code = Buffer.concat(parts).toString('base64')
  const decoded = decodeArmyCode(code)
  if (decoded.sectorialId !== Number(sectorialId) || decoded.maxPoints !== Number(maxPoints)
      || decoded.combatGroups.some((group, index) => group.members.length !== combatGroups[index].members.length)) {
    throw new Error('Generated Army code failed its round-trip check.')
  }
  return code
}

function vli(value) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0 || number > 32767) throw new Error(`Invalid Army-code number: ${value}`)
  return number < 128 ? Buffer.from([number]) : Buffer.from([0x80 | (number >> 8), number & 0xff])
}

function encodedString(value) {
  const bytes = Buffer.from(String(value || ''), 'utf8')
  return Buffer.concat([vli(bytes.length), bytes])
}
