import assert from 'node:assert/strict'
import { extractTtsWorkshopProfiles } from '../bot/tts-workshop-profile-catalog.mjs'

const description = `[b]TAG[/b] ● Regular ● Hackable
[sub]---------Attributes-------
[/sub]
[b]MOV[/b]: 6-4
[b]CC[/b]: 17
[b]BS[/b]: 14
[b]PH[/b]: 16
[b]WIP[/b]: 13
[b]ARM[/b]: 6
[b]BTS[/b]: 6
[B]STR[/B]: 4
[B]S[/B]: 7
[ffdddd][sub]----------Weapons---------
[/sub]
AP Heavy Machine Gun ● Heavy Flamethrower(+1B) ● CC Weapon(PS=6)[-]
[ddffdd][sub]---------Equipment--------
[/sub]
ECM: Guided(-6) ● Repeater[-]
[ddddff][sub]----------Skills ---------
[/sub]
BS Attack(-3) ● BS Attack(SR-1) ● No Wound Incapacitation[-]
[0001F6][-][00017F][-][000001][-][000001][-][000002][-]`

const [iguana] = extractTtsWorkshopProfiles({ ObjectStates: [{ ContainedObjects: [{ Nickname: '[ce181f]IGUANA[-] AP HMG, HFT(+1B)', Description: description }] }] })
assert.equal(iguana.id, '502:383:1:2:1')
assert.equal(iguana.bs, 14)
assert.equal(iguana.structure, 4)
assert.equal(iguana.vitality, null)
assert.deepEqual(iguana.weapons.find((weapon) => weapon.name === 'Heavy Flamethrower').modifiers, ['+1B'])
assert.ok(iguana.skills.includes('BS Attack(-3)'))
console.log('PASS - TTS Workshop profiles map to canonical Army keys and preserve stats, weapons, and modifiers.')
