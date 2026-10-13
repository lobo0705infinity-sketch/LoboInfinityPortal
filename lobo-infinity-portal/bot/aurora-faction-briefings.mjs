import { AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'
import { AURORA_DOCTRINES } from '../shared/aurora-public.mjs'
import { ARIADNA_BRIEFING, ARIADNA_BRIEFING_MARKER } from './aurora-ariadna-briefing.mjs'

const welcome = name => `Welcome to ${name}’s campaign headquarters. Use this channel to coordinate games, discuss targets, share lists, and keep our plans within the faction.`
const conquest = `• Every **Tournament Point generates 1 Influence** in the territory where that game was reported.
• Only the Turn’s announced **Vulnerable Territories** can change hands.
• Highest faction Influence controls the territory at Turn end. **Objective Points break ties**; a complete tie preserves the current controller.
• Territories held **at the end of Turn 6** award their printed Campaign VP.`
const narrative = `Narrative Mission games contribute to a **separate faction total**, not territorial Influence. Decide together how much effort to commit to each contest.`
const confidential = `**Keep our plans here**
Discuss targets, match scheduling, and any GM-issued Secret Objective in this channel. Don’t share private objectives or faction briefings outside it.

**Before each game:** confirm the mission, Campaign Location, and current Event rules. Afterwards, report the result accurately.`
const profiles = {
  pano: {
    title: '🔵 PANOCEANIA — COLONIAL SUPREMACY', color: 0x4a9bc8,
    why: `PanOceanian investment has helped build Aurora VII’s transport, communications, and colonial infrastructure. Our forces are here to protect those interests and turn them into lasting influence over the colony’s future.

Rivals want to limit our reach. We must keep the developed regions functioning while ensuring the resources and facilities we helped establish do not become bargaining chips for another power.`,
    plan: `Our Doctrine rewards taking or holding a **3 VP territory**. Nova Prospect, Korin Range, and Crystal Frontier are the three possible targets, when announced as Vulnerable.

Concentrate our games where they can secure one of these valuable positions. Coordinate its defence as well as its capture, and remember that territorial VP is awarded for what we still control at campaign end.`,
    motto: 'Protect our investments. Secure the colony. Make our influence last.',
  },
  'o-12': {
    title: '⚖️ O-12 — BALANCE OF POWER', color: 0xc5a44a,
    why: `The Aurora Initiative was meant to let rival powers share this colony under a functioning framework of arbitration and restraint. Territorial competition is now threatening that order.

Our forces must protect the colony’s institutions and prevent any one participant from turning the Initiative into a legal cover for unchecked dominance. We are here to preserve a future in which disputes can still be settled without unrestricted war.`,
    plan: `A territorial victory alone does not satisfy our Doctrine. We must also end the Turn with the **four Vulnerable Territories controlled by at least three different Conquest factions**.

Track the balance across all four announced territories. Choose our own target carefully, discuss diplomatic arrangements, and avoid concentrating ownership so heavily that our victory leaves the Doctrine unmet. The condition counts controllers at Turn end, not the number of factions that played games.`,
    motto: 'Preserve order. Prevent domination. Keep the Initiative alive.',
  },
  jsa: {
    title: '⚔️ JSA — RISING POWER', color: 0xc74646,
    why: `Aurora VII offers JSA an opportunity to build influence on ground whose future remains unsettled. We cannot allow PanOceania and Yu Jing to make every decisive choice while the rest of the colony adjusts to their plans.

Our forces fight for an independent position: territorial access, a credible military presence, and victories that others must acknowledge. We are here to give JSA a voice in the colony’s future and the leverage to make that voice count.`,
    plan: `Our Doctrine requires us to **capture a territory from a faction that began the Turn ahead of JSA in Campaign VP**. Defending our own territory does not fulfil it.

Check the published standings at Turn start, then identify qualifying enemy holdings among the announced Vulnerable Territories. If no qualifying target is available, focus on territorial value and the other announced scoring opportunities rather than assuming every capture earns the bonus.`,
    motto: 'Claim our independence. Challenge the leaders. Make our victories count.',
  },
  aleph: {
    title: '🟣 ALEPH — STRATEGIC ANALYSIS', color: 0x9270bd,
    requirement: 'Control a Vulnerable Territory with the highest total TP from all factions’ territory games that Turn. If several territories share that highest total, controlling any one qualifies. Narrative Mission TP is excluded.',
    why: `Aurora VII’s unexplained Signal presents a problem that cannot responsibly be dismissed. Understanding it requires reliable information, access, and the ability to separate observations from claims shaped by factional interests.

Our forces seek the conditions in which that investigation can continue and its risks can be assessed. Colonial competition threatens to obstruct research precisely when reliable analysis matters most.`,
    plan: `Add together the TP earned by **every faction** in each of the four Vulnerable Territories. The territory with the biggest total is the one we must control when the Turn resolves.

For example, at Korin Range, ALEPH earns 9 TP, PanOceania earns 6, and Ariadna earns 3: **18 TP altogether**. If Nova Prospect totals 12 TP and the other two territories each total 9, Korin Range is the qualifying territory. **If ALEPH controls it at Turn end, we earn +1 Campaign VP.**

If Nova Prospect also totals 18 TP, controlling either Nova Prospect or Korin Range qualifies. Controlling both still earns only +1 VP that Turn.

These are two separate checks: **all factions’ TP identifies the qualifying territory; normal Conquest Influence and OP decide who controls it.** We do not need to earn all, or a majority, of its combined TP. Watch the published totals and coordinate our games around the developing contest.`,
    motto: 'Gather reliable evidence. Secure access. Turn analysis into control.',
  },
  haqqislam: {
    title: '🌙 HAQQISLAM — SEARCH FOR KNOWLEDGE', color: 0x55935a,
    why: `Aurora VII’s ecosystems, resources, and unexplained phenomena offer knowledge of exceptional value. Our researchers need the freedom to reach those discoveries and continue their work without another power deciding what they may study.

Our military presence protects laboratories, expeditions, and routes through contested regions. We fight to preserve scientific access and prevent discoveries from becoming the exclusive property of whichever army arrives first.`,
    plan: `Before the first Precursor Ruin is discovered, our Doctrine requires capturing or successfully defending a **3 VP territory**. Once a Ruin has been discovered, the target must instead be a territory containing a **discovered Precursor Ruin**.

Use only discoveries and territory tags released by the GM. A Ruin does not grant an automatic battlefield bonus or additional territory VP. Coordinate our games around the qualifying territory when it is Vulnerable, while protecting the holdings that matter for final scoring.`,
    motto: 'Protect the expedition. Preserve access. Let knowledge endure.',
  },
}

const special = {
  na2: `## 💰 NA2 — CONTRACT WARFARE
**Aurora VII: Race for the Gate**

${welcome('NA2')}

**Why we’re here**
Aurora VII’s governments, corporations, researchers, and private interests need military capabilities without always attaching official forces to their operations. Our companies provide them.

We fight to become the contractors a client cannot afford to do without: capable enough to deliver and useful enough to be hired again.

**How we win**
NA2 follows **Contract Warfare**, rather than territorial Conquest:

• We generate **no territorial Influence**.
• Eligible Conquest factions may privately offer a Contract naming an Employer and one Vulnerable Territory. NA2 accepts **one Contract**.
• To succeed, our faction must finish above **every non-Employer faction** in that territory by total TP. OP breaks TP ties; a complete tie fails.
• The Employer’s totals are ignored when checking our performance.
• Success awards **NA2 +2 Campaign VP** and the Employer **+1 Campaign VP**. Each Employer can benefit from only one successful NA2 Contract during the campaign.

**Our approach**
Agree on the accepted Contract before committing our games. Concentrate our effort in the contracted territory and track every non-Employer competitor. Beating the Employer is not the success condition.

Confirm eligibility and our private selection with the GM. Keep the accepted Contract and its Employer private until resolution.

**Narrative operations**
We can also play the announced Narrative Mission. Its TP and OP count only towards our separate Narrative Mission total and **do not count towards the Contract**. Decide together where our games will produce the best return.

${confidential}

**Choose the client. Deliver the result. Collect the reward.**`,
  tohaa: `## 🌀 TOHAA — THE HIDDEN HAND
**Aurora VII: Race for the Gate**

${welcome('Tohaa')}

**Why we’re here**
Our operations on Aurora VII are directed towards shaping outcomes rather than building a conventional colonial empire. Which powers advance, which positions endure, and how the balance develops all matter.

Our influence need not look like occupation. The other factions may see the result of an intervention without understanding the choices behind it. Keep those choices within this channel and the GM’s private briefing.

**How we win**
Tohaa follows **The Hidden Hand**:

• Privately select **one Vulnerable Territory**, a Desired Outcome of **INSTALL or PRESERVE**, and a supported Conquest faction. Confirm the declaration with the GM.
• Every **complete 5 Tohaa TP** in that territory gives **+1 Influence** to the supported faction before control resolves.
• Remainder TP does not carry over. We do not convert our TP into ordinary territorial Influence at 1:1.
• If our declared Desired Outcome occurs, Tohaa earns **+2 Campaign VP**.

**Our approach**
Choose a supported faction and an outcome that our games can realistically help produce. Coordinate enough games in the selected territory to reach complete five-TP thresholds, then assess the wider Influence contest.

Our own battlefield success must contribute to the declared outcome. Keep the target, supported faction, and INSTALL/PRESERVE choice private.

**Narrative operations**
We can also play the announced Narrative Mission. Its TP and OP count only towards our separate Narrative Mission total and **do not generate Hidden Hand TP**. Separate that effort from the games supporting our declared territorial outcome.

${confidential}

**Choose the outcome. Shape the balance. Keep our hand concealed.**`,
  'combined-army': `## 👁️ COMBINED ARMY — INFILTRATION
**Aurora VII: Race for the Gate**

${welcome('the Combined Army')}

**Why we’re here**
Our forces are establishing operational footholds and investigating Aurora VII while the colonial powers compete for conventional control. A position from which we can observe and continue operating matters more than claiming a human settlement as its ordinary ruler.

Keep our target selections and operational plans within this channel. Further intelligence will come through the GM’s faction briefings as the campaign develops.

**How we win**
The Combined Army follows **Infiltration**:

• We generate **no territorial Influence**.
• Privately choose **one Vulnerable Territory that is not already Infiltrated** and confirm it with the GM.
• To succeed, our faction must finish above **every opposing faction** in that territory by total TP. OP breaks TP ties; a complete tie fails.
• Success awards **+2 Campaign VP** and permanent **Infiltrated** status, unless a specific story effect removes it.
• Infiltration **does not change normal territorial ownership**.

**Our approach**
Concentrate our games in the selected target and track all competing faction totals. A battlefield win contributes to the operation, but success is decided by the faction’s combined Turn performance.

Previously Infiltrated territories cannot be selected again under the normal rule. Plan new footholds using the GM’s published map, while keeping our current target private until resolution.

**Narrative operations**
We can also play the announced Narrative Mission. Its TP and OP count only towards our separate Narrative Mission total and **do not count towards Infiltration**. Decide together how to divide our effort.

${confidential}

**Establish the foothold. Gather intelligence. Complete the operation.**`,
}

export const YU_JING_BRIEFING = `## 🐉 YU JING — FACTION BRIEFING
**Aurora VII: Race for the Gate**

Welcome to Yu Jing’s campaign headquarters. Use this channel to coordinate games, discuss targets, share lists, and keep our plans within the faction.

**Why we’re here**
Aurora VII offers the State Empire an opportunity to establish a lasting strategic foothold. It also presents a familiar danger: PanOceanian economic strength becoming political authority before anyone has formally agreed to it.

A colony can remain neutral on paper while its infrastructure, trade routes, and security increasingly answer to one power. Our forces are here to prevent that outcome and secure Yu Jing’s place in the colony’s future.

**How we win**
Yu Jing uses territorial **Conquest**:

${conquest}

**Our Doctrine: Strategic Expansion**
**Capture a territory and lose no territory during the same Campaign Turn** to earn **+1 Campaign VP**—once per Turn, up to three times across the campaign.

Taking new ground is only half the task. We must protect what we already hold.

**Our approach**
At Turn start, identify which of our territories are Vulnerable and agree on an expansion target. Coordinate our games so an offensive does not leave existing holdings undefended.

Our Doctrine does not require a particular territory value. Choose targets based on their printed VP, the opposition’s activity, and our ability to preserve the rest of our position.

Narrative Mission games contribute to a **separate faction total**, not territorial Influence. Decide together how much effort to commit to discovery without neglecting territorial control.

${confidential}

**Secure our foothold. Defend our gains. Advance the State Empire.**`

export const AURORA_FACTION_BRIEFINGS = AURORA_REGISTRATION_FACTIONS.map(faction => {
  let content, color = 0x71854a
  if (faction.id === 'ariadna') content = ARIADNA_BRIEFING
  else if (faction.id === 'yu-jing') { content = YU_JING_BRIEFING; color = 0xe2a34a }
  else if (special[faction.id]) content = special[faction.id]
  else {
    const profile = profiles[faction.id], doctrine = AURORA_DOCTRINES.find(item => item.faction === faction.name)
    color = profile.color
    content = `## ${profile.title}
**Aurora VII: Race for the Gate**

${welcome(faction.name)}

**Why we’re here**
${profile.why}

**How we win**
${faction.name} uses territorial **Conquest**:

${conquest}

**Our Doctrine: ${doctrine.name}**
${profile.requirement || doctrine.requirement} Success awards **+1 Campaign VP**—once per Turn, up to three times across the campaign.

**Our approach**
${profile.plan}

${narrative}

${confidential}

**${profile.motto}**`
  }
  return { ...faction, content, color,
    marker: faction.id === 'ariadna' ? ARIADNA_BRIEFING_MARKER : `Aurora VII · ${faction.name} faction briefing · ${faction.id === 'aleph' ? 'v2' : 'v1'}`,
    path: `/data/aurora-vii-${faction.id}-briefing${faction.id === 'aleph' ? '-v2' : ''}.json`,
  }
})
