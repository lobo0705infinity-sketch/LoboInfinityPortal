# Generated battle-story editorial review — 27 September 2026

**Decision: keep the pilot in draft.** The rewritten incidents now refer to
objectives shown on [Infinity Geist](https://infinitygeist.com/), including
[Dead Man’s Switch by Lobo](https://infinitygeist.com/mission/cm_lobo_dead_mans_switch)
and the older [Panic Room](https://infinitygeist.com/mission/s16_panic_room).
B-Pong no longer requires beacon control before movement; Akial no longer invents physical evidence sites, and its unrecorded card draws block runtime generation.
These repairs do not grant editorial approval.

## Method and decision

I generated a 110-scene deterministic sample with
`node --experimental-strip-types scripts/sample-generated-game-stories.mts`,
then refreshed the eleven examples below from its exact output. Each row has
three paragraphs and three alternative endings. There are
five cases per mission, one mirror per mission, all three hero roles across
the sample, and all four incident variants per mission. Each mission family
has a direct source link in `src/data/generatedStoryScenarios.ts`. The source
review was on 27 September 2026, Infinity Geist build
`geist-v2-20260924190254`; pages are live, and game records omit historical
rules versions. These plots avoid disputed point totals between editions.
Corvus Belli's [September 24 ITS 18 hotfix](https://infinityuniverse.com/en/news/its18-hotfix-september)
governs The Dig's console analysis and Player Tokens, Double Bind's selected
objective sets and Engineer/GizmoKit antenna repairs, and Crossing Lines'
absence of an HVT and Classified Deck. The pilot does not simulate The Dig's
token state; reviewers must check the edition and the depicted sequence.

| Dimension | Observed | Editorial decision |
| --- | --- | --- |
| Structure | 22,770 canonical pairings × four incidents × three roles = 273,240 structurally valid compositions; each has three distinct 40–75-word paragraphs and distinct one-sentence endings. | Pass for format, not literary quality. |
| Rendering | 792 synthetic roster, role, and result variants render without unresolved placeholders; authored stories still take priority. | Pass for synthetic behavior; real recorded moves remain untested. |
| Mission premise | All 22 families refer to source objectives in plot and endings. The Dig orders analysis before neutralization; B-Pong uses tracking beacon and consoles. | Improved; still needs mission-version and fine rules review. |
| Setup fidelity | Akial Interference needs the drawn Common Classified cards; Critical Intervention needs attacker/defender assignment; Double Bind needs the chosen objective set. Those fields are absent from public games. | Runtime generation is withheld for these three missions; examples below are previews only. |
| Variety and voice | 110 distinct middle paragraphs among 110 scenes; 40–67 words per paragraph; highest within-mission middle-paragraph trigram Jaccard overlap 0.184. Both army orders occur in first paragraphs. Incident-specific stakes, firefights and consequences reduce exact sentence reuse in the 110-scene reversal packet from 60.5% to 46.3%, or from 48.1% to 24.4% after excluding the paired reversals; mission-neutral faction methods still recur. | Hold for an independent generated-only review. |
| Legacy baseline | All 1,300 authored entries pass the structural check; an automated check requiring mission objectives in their plots and each ending flagged all 1,300 for review. That strict text check is not a human verdict. | Set the legacy entries aside as a comparison group and preserve them unchanged. |
| Actual-game fidelity | No game record proves these shots, object movements, or model actions occurred. | Generated scenes must not be described as a factual match transcript. |

Independent editors should rate the generated-only review set for natural
prose, plot variety, faction voice, scenario-version accuracy, and coherence
under all three outcomes. Legacy authored scenes often pursue separate
literary plots rather than the scenario objectives; they would be a misleading
mission-fidelity comparison. The count stays **1,300 structurally checked
authored entries of 22,770**; objective approval and release coverage remain
open. New batch ingestion requires the mission stake in the plot and
each outcome, rejects a false B-Pong movement prerequisite or invented Akial
evidence marker, and excludes the removed Crossing Lines HVT and Classified Deck. The current authored catalog remains unchanged.

**Reversal check:** The original Next Wave/Tohaa preview changed only two
phrases in paragraph one. All 22 missions now change each army's maneuver,
defense, continuation, and win/loss/draw outcome when their roles reverse.
Area of Interest uses 45 method sets; the other 21 missions use 45
mission-neutral sets so the same faction can act without pretending that
every scenario has a relay switch. Area of Interest was checked across all
30 compatible location/weather settings and ordered army pairings; the other
missions across 510,300 ordered army, incident, and role compositions. These
structural and lexical checks do not establish pair-specific plot originality
or strong voice. Weather and location are fictional narrative settings;
the game record does not confirm conditions on the played table.

## Eleven calibration examples

These are literal templates from the fixed 110-scene sample. Placeholders show
which actors the renderer substitutes; only one ending is appended per match.
Headings show the hero’s faction first; the catalog stores army pairs in
a canonical order that can differ. Akial Interference, Critical Intervention
and Double Bind are editorial previews until their missing setup is recorded.

### 1. Area of Interest — PanOceania vs. Haqqislam (objective)

**Actors:** `{{heroPlayer}}` = PanOceania; `{{otherPlayer}}` = Haqqislam.

**Editorial note:** Location `freightDepot` and weather `rain` affect the approach, the relay controls, and the closing beat. The mission title stays out of the prose.

A relay mast rose between abandoned freight carriers at a depot. Rain ran through the seams of its exposed control housing. {{otherPlayer}}’s field medics and escorts kept a withdrawal route open beside the raised loading platform. {{heroPlayer}}’s armored survey troops charted a route toward a parked cargo carrier. The relay indicator blinked once before the panel went dark, leaving the contested ground without a clear signal.

A fallen brace trapped the antenna switch against the base of the mast. The defenders left room to recover their operator while contesting the antenna. Water pooled beneath the panel, so a loose cable spat sparks whenever anyone reached for the switch. A surveyor marked the safest shot across the mast before the specialist left cover.

A burst of gunfire shifted the brace and briefly exposed the control face. {{hero}} pulled the brace aside and keyed an activation request into the communication antenna. The activation light spread across the empty loading rails. The covering shots tracked each guard who tried to interrupt the specialist. Rain hissed against the exposed wires while the relay clicked between channels.

- Hero wins: {{heroPlayer}}’s squad cleared a precise firing lane to the switch, bringing the communication antenna online with the loading lanes under its control.
- Hero loses: {{otherPlayer}}’s squad held the switch without closing its withdrawal route, bringing the communication antenna online with the loading lanes under its control as {{heroPlayer}} fell back to the parked carriers.
- Draw: {{heroPlayer}}’s crew held the surveyed lane under fire while {{otherPlayer}}’s crew kept an escort ready beside the controls, leaving neither in control of the communication antenna and the loading lanes.

### 6. Akial Interference — Yu Jing vs. ALEPH (gunfighting)

**Actors:** `{{heroPlayer}}` = Yu Jing; `{{otherPlayer}}` = ALEPH.

**Editorial note:** Public Common Classified cards and Akial Antenna replace the invented evidence markers. Actual card draws are unrecorded; this is a preview only.

At the start of the round, both crews saw two new Common Classified cards as they approached the Akial Antenna. {{heroPlayer}}’s disciplined assault teams advanced under covering fire toward the Akial Antenna. The new Common Classified cards could still be pursued while the antenna offered a chance to interfere. {{otherPlayer}}’s algorithm-guided teams tracked movement around the sheltered antenna approach.

A specialist could see the public cards, but gunfire blocked the antenna needed to disrupt the rival plan. Shots struck the aerial guard as the new cards came into view. The defenders adjusted whenever the opposing force found another timing window. An assault team advanced behind alternating volleys, each covering the next crossing.

A gap in the firing lane briefly opened access to the antenna controls. {{hero}} fired at the guard beside the Akial Antenna and covered the operator watching the Common cards. The antenna answered with static; neither operator could confirm the interference attempt. A fresh volley came as the forward fighters reached the exposed ground.

- Hero wins: {{heroPlayer}}’s crew completed its classified objective before the round closed; its staggered line held through the final exchange.
- Hero loses: {{otherPlayer}}’s crew denied {{heroPlayer}}’s classified objective and completed its own; its precise timing protected the decisive advance.
- Draw: {{heroPlayer}}’s crew maintained a disciplined line under pressure while {{otherPlayer}}’s crew measured each opening beneath enemy fire; both crews withdrew with incomplete classified objectives and no clear advantage.

### 12. B-Pong — Haqqislam vs. Yu Jing (objective)

**Actors:** `{{heroPlayer}}` = Haqqislam; `{{otherPlayer}}` = Yu Jing.

**Editorial note:** A specialist in contact may relocate the beacon; an activated console can nudge it while no trooper touches it. The ending remains conditional on the reported result.

A tracking beacon stood between two consoles as fresh smoke rolled over the central lane. {{heroPlayer}}’s field medics and escorts cleared a passage toward the tracking beacon lane. The contact ring offered a direct relocation even without winning access to either console. {{otherPlayer}}’s disciplined assault teams set a shielded line beside the nearest console.

Smoke separated the specialist from the beacon while a guard watched the nearer console. Fire reached through the smoke as the approaching specialist left the console behind. The defenders met the movement with timed shifts of their firing line. An escort guarded the forward group and kept a clear way back.

A gust exposed the beacon base and a clear route to its contact ring. {{hero}} reached the tracking beacon in contact and prepared to relocate it toward the rival half. The exposed beacon remained within reach of either specialist after the smoke shifted. The escort stayed close enough to pull its people clear if fire returned.

- Hero wins: {{heroPlayer}}’s crew relocated the tracking beacon into the enemy half and held its console when the round closed; its protected withdrawal route remained open.
- Hero loses: {{otherPlayer}}’s crew relocated the tracking beacon into {{heroPlayer}}’s half and held its console at the round’s end; its staggered line held through the final exchange.
- Draw: {{heroPlayer}}’s crew kept an escort ready near the front while {{otherPlayer}}’s crew maintained a disciplined line under pressure; the tracking beacon remained near the center and neither crew secured a console as the round closed.

### 21. Critical Intervention — Onyx Contact Force vs. Tunguska Jurisdictional Command (gunfighting)

**Actors:** `{{heroPlayer}}` = Onyx Contact Force; `{{otherPlayer}}` = Tunguska Jurisdictional Command.

**Editorial note:** The server-room data pack fits the source, but the public game record does not identify the attacker; this is a preview only.

The data console reported an unlocked pack, but its cradle stayed shut inside the server room. {{heroPlayer}}’s Onyx assault teams advanced under covering fire toward the server room. The attacker could not extract the data pack until the release bar yielded inside the server room. {{otherPlayer}}’s network security teams tracked movement around the data console.

A bent release bar caught the pack carrier’s glove while defenders closed on the doorway. A defender fired from the racks while the carrier fought the bent release bar. The defenders guarded their access route rather than follow a false opening. An assault line advanced in measured bursts to drive a guard back.

The bar gave a little under pressure, exposing the data pack without freeing it from the cradle. {{hero}} fired at the guard covering the data console and shielded the specialist near the server racks. The release bar held the data pack while the defender reached the server-room door. The line stayed fixed on the guard while the forward element moved.

- Hero wins: {{heroPlayer}}’s crew carried the data pack clear of the server room; its controlled line held the center.
- Hero loses: {{otherPlayer}}’s crew locked the console and held {{heroPlayer}} outside the server room; its guarded access route stayed clear.
- Draw: {{heroPlayer}}’s crew maintained pressure along the center while {{otherPlayer}}’s crew kept the changing watch under scrutiny; the data pack remained near the console while neither crew retained the server room.

### 33. Dead Man's Switch — Neoterra Capitaline Army vs. Neoterra Capitaline Army (closeCombat, mirror)

**Actors:** `{{heroPlayer}}` = Neoterra Capitaline Army; `{{otherPlayer}}` = Neoterra Capitaline Army.

**Editorial note:** Uses the Quantum Core, Data Pack consoles, and the bearer movement restriction from Lobo’s custom mission; a mirror tests actor binding.

The Quantum Core lay between two Stunned fighters near the Objective Room entrance. {{heroPlayer}}’s capital security troops moved in formation toward the Objective Room. Taking the Core would slow its bearer while the Data Pack consoles remained outside the disputed exit. {{otherPlayer}}’s capital security troops guarded the Quantum Core.

The next bearer could not fire or take a second Move while carrying the unstable payload. A bodyguard fired above the Stunned fighters while another trooper approached the Core. The defenders tightened their cordon whenever a fighter tested its edge. A perimeter detail divided the approach into overlapping guarded sectors.

A bodyguard stepped away from the room door and opened a slow route toward the Core. {{hero}} drove a bodyguard away from the Quantum Core and protected the specialist approaching it. The slow bearer’s route remained open for a moment as the bodyguard turned back. The outer guards moved with the front line instead of leaving a gap.

- Hero wins: {{heroPlayer}}’s crew controlled the Quantum Core inside the Objective Room; its outer cordon closed around the decisive ground.
- Hero loses: {{otherPlayer}}’s crew held the Quantum Core as {{heroPlayer}} fell back from the room; its outer cordon closed around the decisive ground.
- Draw: Both crews maintained a cordon beyond the fighting; the Quantum Core remained unclaimed while both crews contested the Objective Room.

### 44. Hardlock — Ramah Taskforce vs. Force de Réponse Rapide Merovingienne (closeCombat)

**Actors:** `{{heroPlayer}}` = Ramah Taskforce; `{{otherPlayer}}` = Force de Réponse Rapide Merovingienne.

**Editorial note:** Enemy beacon control and console activations both affect the stakes; army voice still depends mainly on maneuver and defense beats.

Two consoles stayed active after their beacon guard retreated into the central lane. {{heroPlayer}}’s rescue-trained assault troops cleared a passage toward the enemy beacon position. Two active consoles gave the squad a claim, but the enemy beacon remained exposed. {{otherPlayer}}’s Merovingian response teams watched the flanks of the activated-console line.

A broken barricade blocked the route to the enemy beacon while the other crew rebuilt its line. A rival gunner covered the broken barricade from the active-console line. The defenders covered the return route as carefully as the forward ground. A quick escort crossed first and signaled the rest through the opening.

The barricade shifted under fire and opened a gap beside the nearer console. {{hero}} drove a guard from the enemy beacon and held its position for the advancing specialist. The barricade shifted back toward the passage as the rival console light returned. A fresh escort took the exposed place as the front moved again.

- Hero wins: {{heroPlayer}}’s crew controlled the enemy beacon and kept its activated consoles; its rotating escort preserved the opening.
- Hero loses: {{otherPlayer}}’s crew reclaimed the beacon and denied {{heroPlayer}} the console line; its fallback position protected the last advance.
- Draw: {{heroPlayer}}’s crew held its relief fighters near the front while {{otherPlayer}}’s crew held a reserve within reach of the fight; both crews contested the beacon while the consoles showed rival activations.

### 54. Neutralization — Starmada vs. Tohaa (gunfighting)

**Actors:** `{{heroPlayer}}` = Starmada; `{{otherPlayer}}` = Tohaa.

**Editorial note:** The hyperthermal tech and neutralizing antenna create a failed-command incident; gunfighting protects the specialist.

An active hyperthermal tech indicator remained lit after a neutralizing antenna registered a failed attempt. {{otherPlayer}}’s Tohaa envoys and guards kept a withdrawal route open beside the neutralizing antenna. {{heroPlayer}}’s fleet security teams cleared a passage toward the hyperthermal tech site. A second command would depend on replacing the lead before the opposing squad arrived.

A scorched lead prevented the specialist from repeating the command while an opposing squad crossed the site. A fleet detail opened a safe return lane before sending its front ahead. The defenders tracked the shifting screen and tried to separate its members. A guard fired past the scorched lead toward the specialist at the control tray.

A spare lead appeared beneath the control tray as the tech warning reached its highest pitch. {{hero}} fired at the guard beside the hyperthermal tech and covered the specialist approaching its controls. The spare lead warmed beneath the tray as the warning light stayed on. The return lane remained guarded while the lead fighters moved.

- Hero wins: {{heroPlayer}}’s crew neutralized the hyperthermal tech and held the antenna; its guarded way back stayed open.
- Hero loses: {{otherPlayer}}’s crew held the neutralizing antenna as {{heroPlayer}} withdrew from the tech; its rotating screen kept the advance together.
- Draw: {{heroPlayer}}’s crew maintained a protected way out while {{otherPlayer}}’s crew kept rotating its three-point escort; both crews left the hyperthermal tech active while disputing the antenna.

### 58. Outbreak — Shindenbutai vs. Shindenbutai (gunfighting, mirror)

**Actors:** `{{heroPlayer}}` = Shindenbutai; `{{otherPlayer}}` = Shindenbutai.

**Editorial note:** Scanning and escorting an Infected now drive the plot. This mirror gives both sides the same crew description.

Two Infected patients waited beside a narrow extraction lane as a stabilizer alarm sounded. {{otherPlayer}}’s Shindenbutai fighters watched the flanks of the Alpha Infected position. Both patients remained contested until the medics could finish the scans and stabilize them. {{heroPlayer}}’s Shindenbutai fighters skirted the infected containment lane.

The alarm drowned the medic’s instructions while a rival escort tried to take the nearest patient. The defenders watched for a sudden close move near their post. A guard fired over the stabilizer alarm at the escorts near the patients. A forward fighter found a blind angle and signaled the rest toward it.

The alarm paused, leaving a moment to scan the farther patient before the lane closed. {{hero}} fired at the guard threatening the medics and covered a scan of the Infected. The rival escort reached the nearer patient while the farther scan remained open. The forward fighter stayed close enough to interrupt a counterattack.

- Hero wins: {{heroPlayer}}’s crew scanned and stabilized the Infected before securing the escort; its blind-side advance cleared the final obstacle.
- Hero loses: {{otherPlayer}}’s crew secured the stabilized Infected while {{heroPlayer}} withdrew; its blind-side advance cleared the final obstacle.
- Draw: Both crews held a blind angle beside the fighting; both crews completed scans, but the Infected remained beyond either escort’s control.

### 76. Battleground — Tartary Army Corps vs. Steel Phalanx (objective)

**Actors:** `{{heroPlayer}}` = Tartary Army Corps; `{{otherPlayer}}` = Steel Phalanx.

**Editorial note:** Sector domination drives the plot; the event expresses little distinct identity for either army.

The central sector stood empty after a support beam fell across its closest entrance. {{otherPlayer}}’s phalanx veterans set a shielded line beside the far sector boundary. The central sector could decide control even if the rival patrol reached the far ground. {{heroPlayer}}’s Tartary veterans moved in formation toward the central scoring sector.

A rival patrol reached the far sector first and threatened to occupy the open center from behind. The defenders concentrated on the leader without uncovering the flank. A rival gunner fired along the fallen beam to deny the central sector. Veterans pinned a guard in place before moving along the covered side.

The beam moved under fire and revealed a narrow approach to the sector marker. {{hero}} checked the central sector approach and signaled where the squad could dominate it. The far patrol began crossing toward the center before the beam settled. The pinned guard stayed occupied as the forward group changed position.

- Hero wins: {{heroPlayer}}’s force dominated the central sector at the end of the fight; its steady pressure kept the opposing guard fixed.
- Hero loses: {{otherPlayer}}’s force held the central sector while {{heroPlayer}} withdrew; its leading fighter kept the breach open.
- Draw: {{heroPlayer}}’s crew kept the nearest guard occupied while {{otherPlayer}}’s crew held its front line inside the guard’s reach; both forces held separate sectors while the central ground stayed contested.

### 98. Double Bind — Shock Army of Acontecimento vs. Shock Army of Acontecimento (objective, mirror)

**Actors:** `{{heroPlayer}}` = Shock Army of Acontecimento; `{{otherPlayer}}` = Shock Army of Acontecimento.

**Editorial note:** Antennas and a zone of influence appear, but the selected mode is absent from the game record; this is a preview only.

A zone of influence emptied as both sides tried to reach the antenna beyond it. {{heroPlayer}}’s jungle campaign veterans skirted the antenna and zone-of-influence line. {{otherPlayer}}’s jungle campaign veterans watched the flanks of the contested aerial. The blocked aerial still offered an objective if that side had chosen antenna control.

A disabled carrier blocked the aerial base while a rival squad returned to the scored zone. Both crews fired past the disabled carrier toward the antenna base. Veterans passed from cover to cover without offering one fixed target. The defenders watched the breaks in cover instead of firing at every movement.

The carrier shifted and exposed the controls at the moment both squads crossed the boundary. {{hero}} located the antenna controls and prepared to contest the zone of influence. The carrier settled beside the aerial as the rival squad crossed the zone. Each fighter held the next covered step long enough for another to cross.

- Hero wins: {{heroPlayer}}’s crew secured its chosen antenna or zone objective; its patrol secured successive pockets of cover.
- Hero loses: {{otherPlayer}}’s crew secured its chosen antenna or zone objective as {{heroPlayer}} fell back; its patrol secured successive pockets of cover.
- Draw: Both crews kept advancing through broken cover; neither crew secured its antenna or zone objective before the contest ended.

### 104. The Dig — Kosmoflot vs. Starmada (closeCombat)

**Actors:** `{{heroPlayer}}` = Kosmoflot; `{{otherPlayer}}` = Starmada.

**Editorial note:** The buried tech must be analyzed before neutralization. The close-combat hero secures access without declaring a winner.

A hyperthermal tech indicator glowed beneath the dig while both teams disputed the nearest console. {{heroPlayer}}’s cold-weather raiders skirted the buried hyperthermal tech site. {{otherPlayer}}’s fleet security teams kept a withdrawal route open beside the analysis console. Without a confirmed analysis token, neither crew could neutralize the still-active unit.

Loose rock covered the control face and obscured whether anyone had analyzed the live unit. Shots dislodged more stone onto the contested analysis console. A raider moved outside the main sightline and marked an off-angle crossing. The defenders stayed close enough to protect their route out.

A stone shifted and revealed an unfinished analysis prompt beside the neutralizing command. {{hero}} drove a defender away from the analysis console and held the path to the buried tech. The prompt stayed unfinished while loose stone slid back across the console face. The outside fighter kept that distant angle while the rest moved.

- Hero wins: {{heroPlayer}}’s crew analyzed and neutralized the hyperthermal tech; its off-angle route remained open at the end.
- Hero loses: {{otherPlayer}}’s crew analyzed and neutralized the tech as {{heroPlayer}} withdrew; its guarded way back stayed open.
- Draw: {{heroPlayer}}’s crew held a distant approach under fire while {{otherPlayer}}’s crew maintained a protected way out; both crews withdrew with the hyperthermal tech still active and its analysis unresolved.
