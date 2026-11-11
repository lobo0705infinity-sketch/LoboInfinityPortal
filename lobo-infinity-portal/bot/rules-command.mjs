import { ApplicationCommandOptionType } from 'discord.js'
import { loadProductionRulesCorpus, normalizeRuleText } from './infinity-rules-service.mjs'
import { createDeepSeekRulesAnswer } from './deepseek-rules.mjs'
import { findApprovedRulesAnswer } from './rules-benchmark.mjs'
import { resolveRulesModelMentions } from './rules-model-context.mjs'

export const RULES_COMMAND = 'rules'
export const RULES_OPTION = 'question'
export const RULES_COMMAND_DEFINITION = Object.freeze({ name: RULES_COMMAND, description: 'Ask the current official Infinity rules', options: [{ name: RULES_OPTION, description: 'Infinity rules question', required: true, type: ApplicationCommandOptionType.String, max_length: 1000 }] })

export async function ensureRulesCommand(client) {
  if (!client?.guilds?.cache) return []
  const registered = []
  for (const guild of client.guilds.cache.values()) {
    const commands = await guild.commands.fetch(); let command = commands.find((candidate) => candidate.name === RULES_COMMAND)
    if (!command) command = await guild.commands.create(RULES_COMMAND_DEFINITION); else if (!matches(command)) command = await command.edit(RULES_COMMAND_DEFINITION)
    registered.push({ applicationId: command.applicationId, guildId: guild.id, id: command.id })
  }
  const globals = await client.application.commands.fetch(); const obsolete = globals.find((command) => command.name === RULES_COMMAND); if (obsolete) await obsolete.delete()
  return registered
}

export async function retrieveRulesReference({ question, deepSeek = createDeepSeekRulesAnswer() }) {
  const corpus = await loadProductionRulesCorpus()
  const localRuling = loboBerserkFireteamRuling(question, corpus)
  if (localRuling) return localRuling
  const verified = verifiedRulesInteraction(question, corpus)
  if (verified) return verified
  const modelResolution = await resolveRulesModelMentions(question)
  // Approved benchmark answers describe rules concepts, not the selected Army
  // profile. A named model must take the evidence-bounded path so its actual
  // profile facts participate in the answer.
  // Unhandled Berserk/Fireteam exceptions must not fuzzy-match an older
  // leader-only benchmark answer. They need the full evidence path.
  const berserkFireteam = /\bberserk\b/i.test(question) && /\b(?:fireteams?|link(?:ed)? teams?)\b/i.test(question)
  const benchmark = modelResolution.models.length || berserkFireteam ? null : await findApprovedRulesAnswer(question)
  if (benchmark) return benchmarkResult(question, benchmark, corpus)
  if (!modelResolution.models.length && asksIfElectromagneticDestroysDeployable(question))
    return electromagneticDeployableResult(question, corpus)
  if (!modelResolution.models.length && asksAboutPublicFireteamIdentity(question))
    return publicFireteamIdentityResult(question, corpus)
  return deepSeek({ question, corpus, modelResolution })
}

/** Lobo's approved TO ruling, deliberately separate from official answers. */
export function loboBerserkFireteamRuling(question, corpus) {
  const words = normalizeRuleText(String(question).replace(/[’']/g, ''))
    .replace(/\blink(?:ed)? teams?\b/g, 'fireteam')
    .replace(/[()?.,]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^(?:(?:if|when) )?(?:a|the) fireteam leader declares berserk /, '')
  // Anchor the entire question. Named profiles, states, scenario exceptions,
  // reactive-turn questions and compound interactions retain full retrieval.
  const permission = /^(?:can|may|do) (?:(?:all |the |all the |other |the other )?fireteam members|(?:all |the |all the |other |the other )?members of (?:a |the |my )?fireteam|(?:a |the |my |our |your )?(?:whole |entire )?fireteam) (?:all )?(?:declare |use |perform )?berserk(?: (?:against |at )?(?:the same|different|separate|multiple)(?: enemy)? targets?)?$/.test(words)
  const explanation = /^(?:(?:how does|how do) berserk(?: and fireteams)? work (?:in|with|for) (?:a |the )?fireteam|(?:how does|how do) (?:a |the )?fireteam berserk work|(?:what is|whats) (?:the )?(?:lobo )?(?:to )?ruling (?:on|for) berserk (?:in|with) (?:a |the )?fireteam|can fireteam members without berserk (?:join a berserk charge|declare berserk)|(?:must|do) fireteam members (?:using berserk |declaring berserk )?(?:all )?(?:berserk |charge |attack |target )(?:the )?same (?:enemy )?target|can fireteam members (?:all )?(?:make|perform|resolve) (?:their own |separate )?cc (?:attacks|rolls) (?:with|when using|after declaring) berserk)$/.test(words)
  if (!permission && !explanation) return null
  return {
    question: String(question).trim(),
    versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
    status: 'LOBO TO RULING', answerSource: 'LOBO_TO_RULING',
    deepSeek: {
      questionType: 'EXPLANATORY', conclusion: 'INTERPRETATION',
      certainty: 'EVIDENCE-BOUNDED INTERPRETATION', interpretationRequired: true,
      answer: 'When the Fireteam Leader declares Berserk, members who also have Berserk may charge different targets and resolve their attacks in separate combats. Members without Berserk Idle. Each user needs LoF to their target when declaring and must reach Silhouette contact using their combined MOV values; otherwise that user Idles without moving or attacking. If several members join the same CC, only the Fireteam Leader makes the CC Roll, applying Close Combat with Multiple Troopers. Normal coherency rules still apply. The specific Sibylla clarification permits eligible members to declare and perform Berserk, which includes Move + CC Attack. The nearby reminder says “except Berserk,” creating conflicting wording. This is Lobo’s TO ruling pending official clarification, not an unambiguous official answer.',
      sources: ['Berserk', 'Fireteams:_Basic_Rules', 'Fireteams_in_the_Active_Turn'].map((page, index) => ({ id: 'LB' + index, title: 'Official Infinity Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })),
    },
  }
}


/** Verified N5.3 interactions. Keep compound questions on the evidence path. */
export function verifiedRulesInteraction(question, corpus) {
  const words = normalizeRuleText(String(question).replace(/[’']/g, ''))
    .replace(/\bimmobili[sz]ed\b/g, 'immobilized')
    .replace(/\bimmobili[sz]ation\b/g, 'immobilized')
    .replace(/[()?.,]/g, '').replace(/\s+/g, ' ').trim()
  const dropBearDodge = [
    /^my trooper declares throw drop bear nearby an enemy the enemy declares dodge both my trooper and the enemy pass their rolls can the enemy dodge to the placement of the drop bear to make it an illegal placement and thus stop the drop bear from being placed at all$/,
    /^(?:can|may) (?:an? |the )?(?:enemy|reactive trooper|trooper|model) dodge (?:into|onto|to) (?:the |a )?(?:(?:declared |chosen )?(?:spot|space|position|location|placement) (?:of|for) (?:a |the )?(?:thrown )?drop bear|(?:thrown )?drop bear(?:s)? (?:declared |chosen )?(?:spot|space|position|location|placement))(?: (?:and|to) (?:block|prevent|stop) (?:its |the |drop bear )?placement)?$/,
    /^what happens if (?:an? |the )?(?:enemy|reactive trooper|trooper|model) (?:dodges|ends (?:its|a) dodge) (?:into|onto|on|in) (?:the |a )?(?:declared |chosen )?(?:spot|space|position|location) for (?:a |the )?(?:thrown )?drop bear$/,
  ].some(pattern => pattern.test(words))
  if (dropBearDodge) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'VERIFIED RULES ANSWER', answerSource: 'VERIFIED_RULES',
      deepSeek: {
        conclusion: 'YES', certainty: 'EXPLICIT RULES ANSWER', interpretationRequired: false,
        answer: 'Yes. A successful Dodge can end on the exact spot declared for a thrown Drop Bear. Dodge movement happens during Effects. Drop Bears in BS Mode are placed during Conclusion. The official FAQ allows the thrower to place the Drop Bear at another legal position if a trooper occupies the declared spot. If there is no legal alternative, the Drop Bear is lost.',
        sources: [
          { id: 'DB0', title: 'Official Infinity N5.3 Wiki', section: 'Drop Bears (BS Mode) and placement FAQ', url: 'https://infinitythewiki.com/Drop_Bears#FAQs' },
          { id: 'DB1', title: 'Official Infinity N5.3 Wiki', section: 'Dodge — Effects', url: 'https://infinitythewiki.com/Dodge' },
        ],
      },
    }
  }
  // Keep airborne blast geometry separate from special template exceptions.
  const airborneTemplate = /\b(?:template|blast|hrl|heavy rocket launcher)\b/.test(words)
    && /\b(?:mid[ -]?air|airborne|jumping|in the air)\b/.test(words)
    && /\b(?:shape|form|expand|upward|upwards|downward|downwards|sphere|hemisphere|cylinder|dome)\b/.test(words)
    && !/\b(?:smoke|eclipse|teardrop|direct template|flamethrower|chain rifle|speculative|mine|critical|crit|dodge)\b/.test(words)
  if (airborneTemplate) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'EVIDENCE-BOUNDED INTERPRETATION', answerSource: 'EVIDENCE_BOUNDED_RULES',
      deepSeek: {
        questionType: 'EXPLANATORY', conclusion: 'INTERPRETATION',
        certainty: 'EVIDENCE-BOUNDED INTERPRETATION', interpretationRequired: true,
        answer: 'An HRL’s circular blast forms a hemisphere (a dome), not a cylinder. Its height equals the template’s radius. Center it on the underside of the main target’s base at the chosen point along its movement, including in mid-air. Other troopers are affected if their base or Silhouette touches the blast volume and scenery does not block LoF from the Blast Focus. Airborne interpretation: applying the official dome diagram at that position, the blast extends upward from the target’s base, without a second hemisphere below it. The rules do not explicitly illustrate the airborne case; that direction is an interpretation of the placement rule and diagram.',
        sources: [
          { id: 'AT0', title: 'Official Infinity N5.3 Wiki', section: 'Template Weapons and Equipment — Types and Area of Effect', url: 'https://infinitythewiki.com/Template_Weapons_and_Equipment' },
          { id: 'AT1', title: 'Official Infinity N5.3 Wiki', section: 'Impact Template Weapons — underside of Main Target’s base', url: 'https://infinitythewiki.com/Impact_Template_Weapons' },
          { id: 'AT2', title: 'Official Corvus Belli diagram', section: 'Template geometry — dome and height', url: 'https://assets.corvusbelli.net/wiki/dual-types-of-templates-1024.jpg' },
        ],
      },
    }
  }
  // Bound the deterministic correction to the reported scenario. Different
  // numbers, targets or extra conditions must retain profile/evidence retrieval.
  const pandoraReport = [
    'OK here is something that had me puzzled: A noctifer crits model A in F2F on a 6, the template goes down and splashes Pandora, who is around the corner. She declares dodge, rolls like a 14. What happens? Does the -6 makes her unhittable? we ended up playing she gets away scot-free',
    'A Noctifer crits model A on a 6. The template splashes Pandora around the corner. She Dodges and rolls 14. Does her Dodge -6 make her unhittable?',
  ].some(report => normalizeRuleText(report.replace(/[’']/g, '')).replace(/[()?.,]/g, '').replace(/\s+/g, ' ').trim() === words)
  if (pandoraReport) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'VERIFIED RULES ANSWER', answerSource: 'VERIFIED_RULES',
      deepSeek: {
        questionType: 'EXPLANATORY', conclusion: 'NO', certainty: 'EXPLICIT RULES ANSWER', interpretationRequired: false,
        answer: 'Pandora is hit, provided the blast reaches her. Model A is the Main Target, so Pandora’s Dodge (-6) does not modify the Noctifer’s attack. MODs change the Success Value, never the die result: the rolled 6 stays 6. With PH 12 and no LoF, Pandora Dodges on 9; her 14 fails. The Noctifer’s Critical counts only against model A; against Pandora it is an ordinary success. She takes the weapon’s normal Saving Rolls, with no extra Critical save. Resolve each target independently. If scenery blocks LoF from the Blast Focus to Pandora, she is outside the template’s effect instead. Playing her as escaping because of Dodge (-6) was incorrect.',
        sources: ['Impact_Template_Weapons', 'Template_Weapons_and_Equipment', 'Dodge', 'Rolls'].map((page, index) => ({ id: 'IT' + index, title: 'Official Infinity N5.3 Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })),
      },
    }
  }
  let answer, conclusion, pages
  let certainty = 'EVIDENCE-BOUNDED INTERPRETATION'
  // Only plain placement questions use this verified response. Named profiles,
  // extra conditions and compound interactions retain the full evidence path.
  const dispenserCamo = /^(?:can|may) (?:you|i|a trooper|a model) (?:shoot|fire|launch|place) (?:a |the )?mine (?:with|using|from) (?:a |the )?mine dispenser (?:underneath|under|next to|near|within trigger (?:area|range) of) (?:an? |the )?(?:enemy )?(?:camo|camouflage|camouflaged) marker$/.test(words)
    || /^(?:can|may) (?:you|i) (?:shoot|fire|use) (?:a |the )?mine dispenser (?:underneath|under|next to|near) (?:an? |the )?(?:enemy )?(?:camo|camouflage|camouflaged) marker$/.test(words)
  if (dispenserCamo) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'VERIFIED RULES ANSWER', answerSource: 'VERIFIED_RULES',
      deepSeek: {
        conclusion: 'DEPENDS', certainty: 'EXPLICIT RULES ANSWER', interpretationRequired: false,
        answer: 'It depends. No if the enemy Camouflage Marker is the only enemy in the mine’s Trigger Area. A Mine Dispenser follows Drop Bears in BS Mode: you cannot place its mine with an enemy Camouflage Marker inside its Trigger Area unless a valid, non-camouflaged enemy is also inside that area. Targetless lets you choose a location; it does not waive this restriction. If the valid enemy is also present, placement is allowed subject to normal placement requirements. Total Cover is excluded from the Trigger Area, so merely being nearby is not enough. The mine cannot detonate during the Order in which it is fired.',
        sources: ['Mine_Dispenser', 'Drop_Bears', 'Mines'].map((page, index) => ({ id: 'MD' + index, title: 'Official Infinity N5.3 Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })),
      },
    }
  }
  const retreatConsole = /^(?:can|may) (?:you|i|(?:a |the |my )?(?:trooper|model|specialist)) (?:still )?(?:click|activate|use|hit|press|push) (?:a |the )?(?:console|button) (?:(?:while|when|if) )?(?:(?:you|i|it|the trooper|my army|your army|the army) (?:are|am|is) )?in retreat(?: state| situation)?$/.test(words)
  if (retreatConsole) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'VERIFIED RULES ANSWER', answerSource: 'VERIFIED_RULES',
      deepSeek: {
        conclusion: 'DEPENDS', certainty: 'EXPLICIT RULES ANSWER', interpretationRequired: false,
        answer: 'A trooper in Retreat! State cannot declare Activate Console. If your army is in Retreat!, a trooper that ignores Retreat! State, such as one with Courage, Religious Troop, or Warhorse, can activate the console if it meets the mission requirements. You can also spend a Command Token to cancel a trooper’s Retreat! State. Loss of Lieutenant still applies separately: Courage and Religious Troop do not exempt a trooper from it, while Warhorse lets the trooper remain Regular.',
        sources: ['Retreat_State', 'Retreat!_and_Loss_of_Lieutenant_Summary_Chart'].map((page, index) => ({ id: 'RC' + index, title: 'Official Infinity N5.3 Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })),
      },
    }
  }
  // Bound this correction to a single plain T2 Critical with both saves failed.
  // Other failure combinations, extra hits and special interactions need evidence.
  const t2BothFailed = /^(?:if (?:you|i) get crit by t2(?: ammunition)? and fail both (?:saves|saving rolls) how many wounds (?:do|would) (?:you|i) take|(?:how many wounds (?:do|would) (?:you|i) take|what happens) (?:if|when|from) (?:you|i) (?:get|am|are) (?:crit by t2|hit by a t2 critical)(?: ammunition)? and fail both (?:saves|saving rolls)|(?:a |one |single )?t2 crit(?:ical)?(?: hit)? (?:and |with )?(?:both|all two) (?:saves|saving rolls) fail(?:ed)?(?: how many wounds)?)$/.test(words)
  if (t2BothFailed) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'VERIFIED RULES ANSWER', answerSource: 'VERIFIED_RULES',
      deepSeek: {
        questionType: 'EXPLANATORY', conclusion: 'INTERPRETATION', certainty: 'EXPLICIT RULES ANSWER', interpretationRequired: false,
        answer: '3 Wounds. A single T2 Critical requires two Saving Rolls: one for the hit and one additional roll for the Critical. Failing the hit’s save inflicts 2 Wounds; failing the extra Critical save inflicts only 1 Wound. Failing both therefore causes 2 + 1 = 3 Wounds. Identify which die is which before rolling. T2 does not cause two saves per ordinary hit.',
        sources: [{ id: 'T2', title: 'Official Infinity Wiki', section: 'T2 Ammunition — Roll and Effects', url: 'https://infinitythewiki.com/T2_Ammunition' }],
      },
    }
  }
  // Cover continues to modify the repeated Saving Rolls of the same attack.
  // Anchor the supported questions so unrelated compound exceptions use evidence.
  const continuousCover = /^(?:when rolling (?:a )?sav(?:e|ing roll) from continuous damage do you still roll with cover|if shot in cover with a continuous(?: damage)? weapon do you get the bonus to armo[u]?r on subsequent saves|(?:do|does|can) (?:you|i|a trooper|a model) (?:still )?(?:get|keep|receive|apply) (?:the )?(?:partial )?cover(?: bonus| modifier| mod)? (?:on|for|to|against) (?:(?:subsequent|repeated|additional) )?(?:continuous damage )?(?:saves|saving rolls)(?: (?:from|against|for) continuous damage)?|does (?:partial )?cover(?: bonus)? (?:apply|carry over) (?:to|on|against) (?:(?:subsequent|repeated|additional) )?continuous damage(?: saves| saving rolls)?|do continuous damage (?:saves|saving rolls) (?:get|benefit from) (?:partial )?cover)$/.test(words)
  if (continuousCover && /\bcontinuous\b/.test(words)) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'EVIDENCE-BOUNDED RULES ANSWER', answerSource: 'EVIDENCE_BOUNDED_RULES',
      deepSeek: {
        conclusion: 'YES', certainty: 'EVIDENCE-BOUNDED INTERPRETATION', interpretationRequired: true,
        answer: 'Yes. If Partial Cover applied to the original attack, keep its +3 Saving Roll MOD on every subsequent Continuous Damage save. Cover affects Saving Rolls as well as the attacker’s BS Roll; Continuous Damage requires further Saving Rolls and does not remove that MOD. This follows from combining the Cover and Continuous Damage rules. Exception: Template Weapons do not grant the +3 Partial Cover Saving Roll MOD, so there is no cover bonus on their initial or subsequent saves. Other rules that deny the cover bonus still apply.',
        sources: ['Ballistic_Skills#Cover', 'Saving_Roll_(SR)', 'Traits#Continuous_Damage', 'Template_Weapons_and_Equipment'].map((page, index) => ({ id: 'V' + index, title: 'Official Infinity N5.3 Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })),
      },
    }
  }
  // Match only the general elevation question; named rules and scenario
  // exceptions must still go through the complete evidence path.
  const heightCover = /^(?:(?:when|how) (?:do|does|can) (?:you|i|a trooper|a model) (?:get|gain|receive|benefit from) (?:partial )?cover (?:from|due to|because of) (?:height|elevation|high ground)|(?:does|can) (?:height|elevation|high ground) (?:give|grant|provide) (?:you )?(?:partial )?cover|(?:do|does|can) (?:you|i|a trooper|a model) (?:get|gain|receive|benefit from) (?:partial )?cover (?:on|from) (?:a |an |the )?(?:roof|rooftop|platform|elevated position|higher position))$/.test(words)
  if (heightCover) {
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'EVIDENCE-BOUNDED RULES ANSWER', answerSource: 'EVIDENCE_BOUNDED_RULES',
      deepSeek: {
        conclusion: 'DEPENDS', certainty: 'EXPLICIT RULES ANSWER', interpretationRequired: false,
        answer: 'It depends on Line of Fire. You get Partial Cover when scenery you are touching obscures part of your Silhouette from the attacker. The roof or platform you stand on can itself provide that cover against an enemy below: you do not need a parapet or to be Prone. A typical example is your entire Silhouette being above the attacker’s, with the roof blocking their view of its lower part. Merely being higher is not automatic cover: if the attacker can see your whole Silhouette, you need another qualifying obstruction. If scenery blocks all LoF, you have Total Cover. Partial Cover normally gives -3 to the attacker’s BS Roll and +3 to your Saving Roll; cover-denying rules still apply.',
        sources: [
          { id: 'H1', title: 'Official Infinity N5.3 Wiki', section: 'Cover — Partial Cover', url: 'https://infinitythewiki.com/Ballistic_Skills#Cover' },
          { id: 'H2', title: 'Official Infinity N5.3 Wiki', section: 'Line of Fire and Cover — elevated-position diagrams', url: 'https://infinitythewiki.com/Ballistic_Skills#Line_of_Fire_and_Cover' },
        ],
      },
    }
  }
  const cautiousImpersonation = /^(?:can|may) (?:a unit|unit|a trooper|a model|i|you)(?: (with|without) stealth)? (?:use |declare |perform )?cautious (?:move|movement) (?:inside|within|in) (?:an? |the )?(?:enemys? |enemy )?(?:zoc|zone of control) (?:but (?:(?:the|that|this) )?enemy is in impersonation(?: state)?|of (?:an? |the )?(?:enemy )?(?:impersonation(?:-1|-2)? marker|impersonator)(?: in impersonation state)?)(?: (with|without) stealth| if (?:it|i|the trooper) (has|have|uses|use) stealth(?: and (?:stays?|remains?) (?:outside|out of) (?:the markers? |its )?(?:lof|line of fire))?)?$/.exec(words)
  if (cautiousImpersonation) {
    const usesStealth = !cautiousImpersonation.includes('without') && (cautiousImpersonation.includes('with') || Boolean(cautiousImpersonation[3]))
    conclusion = usesStealth ? 'YES' : 'NO'
    answer = (usesStealth
      ? 'Yes, with applicable Stealth while remaining outside the marker’s LoF and meeting the other Cautious Movement conditions. '
      : 'No without Stealth: starting or ending in the opposing Impersonation Marker’s ZoC prevents Cautious Movement from suppressing AROs. With applicable Stealth and outside its LoF, yes. ')
      + 'Recommended table ruling, not an explicit official clarification: count it as an enemy Marker for this check; allied targeting protection does not override that. A marker declining to react changes nothing: other enemies with an ARO opportunity may react normally. You may still declare the Skill without its ARO protection. Stealth allows ZoC/Hacking Area exceptions but does not work against Sixth Sense or Combat Instinct. Other endpoint LoF/ZoC, Hackable model Hacking Area, and user eligibility restrictions still apply as modified by Stealth.'
    pages = ['Cautious_Movement', 'Impersonation_State', 'Stealth', 'Alignment']
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'EVIDENCE-BOUNDED RULES ANSWER', answerSource: 'EVIDENCE_BOUNDED_RULES',
      deepSeek: { answer, conclusion, certainty, interpretationRequired: true,
        sources: pages.map((page, index) => ({ id: 'V' + index, title: 'Official Infinity N5.3 Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })) },
    }
  }
  const engineerPossessed = /^(?:can|could|may|does|will) (?:a |an |the |my |your )?engineer(?: skill| special skill)? (?:clear|cancel|remove|repair|fix|end)(?:s)? (?:the |a )?(?:state of )?(?:total control(?: possessed(?: state)?)?|possessed(?: state)?|possession)(?: state)?(?: (?:from|on|of) (?:a |an |the |my |your |our )?(?:tag|trooper|model))?$/.test(words)
  if (engineerPossessed) {
    conclusion = 'NO'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'No. An Engineer cannot cancel Possessed State, including when Total Control caused it. Engineer only cancels states whose own rules allow it. To regain control of your TAG, spend 1 Command Token during your Tactical Phase’s Executive Use of Command Tokens step, or successfully use your own Total Control against the Possessed TAG and cause it to fail a Saving Roll. A Normal WIP Engineer Roll in Silhouette contact does not remove Possessed.'
    pages = ['Possessed_State', 'Engineer', 'Total_Control']
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'EVIDENCE-BOUNDED RULES ANSWER', answerSource: 'EVIDENCE_BOUNDED_RULES',
      deepSeek: { answer, conclusion, certainty, interpretationRequired: false,
        sources: pages.map((page, index) => ({ id: 'V' + index, title: 'Official Infinity N5.3 Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })) },
    }
  }
  const voluntaryFireteam = /^(?:(?:when|how) (?:can|may|do) |(?:can|may) )(?:i|you|we|a player) (?:voluntarily )?(?:break|cancel|disband|dissolve) (?:a |the |my |your |our )?(?:fireteam|link team|linked team|link)(?: voluntarily)?(?: for free| in (?:the )?(?:active|reactive) turn)?$/.test(words)
  if (voluntaryFireteam) {
    conclusion = 'YES'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'You may voluntarily cancel the entire Fireteam in either the Active or Reactive Turn, without spending an Order or Command Token. Announce the cancellation before either player spends the next Order. You cannot wait until an enemy Order has been spent and then voluntarily cancel the Fireteam during that Order. This cancels the whole Fireteam; an individual member leaving follows separate Fireteam Integrity rules.'
    pages = ['Fireteam_Integrity']
    return {
      question: String(question).trim(),
      versions: corpus.manifest.sources.map(source => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
      status: 'EVIDENCE-BOUNDED RULES ANSWER', answerSource: 'EVIDENCE_BOUNDED_RULES',
      deepSeek: { answer, conclusion, certainty, interpretationRequired: false, sources: [{ id: 'V0', title: 'Official Infinity N5.3 Wiki', section: 'Fireteam Integrity', url: 'https://infinitythewiki.com/Fireteam_Integrity' }] },
    }
  }
  const camoSubject = '(?:(?:a |the )?(?:models?|troopers?|units?) (?:in|while in) (?:the )?(?:camo|camouflaged|camouflage)(?: state)?|(?:a |the )?(?:camouflaged|camo) (?:models?|troopers?|units?))'
  const baggageRange = '(?:(?:a|an|the) (?:(?:allied|friendly) )?(?:unit|trooper|model) with baggage is (?:within|in) (?:(?:their|its|the) )?(?:zone of control|zoc)|(?:they are|it is) (?:within|in) (?:the )?(?:zone of control|zoc) of (?:(?:a|an|the) )?(?:(?:allied|friendly) )?(?:baggage (?:unit|trooper|model)|(?:unit|trooper|model) with baggage))'
  const nanoscreenSubject = '(?:(?:a|the|my) nanoscreen (?:model|trooper|unit)|(?:a|the|my) (?:model|trooper|unit) with (?:a )?nanoscreen)'
  const targetedSubject = '(?:(?:a |the |my )?targeted (?:model|trooper|unit)|(?:a |the |my )?(?:model|trooper|unit) (?:in|while in) (?:the )?targeted(?: state)?)'
  if (new RegExp('^(?:can|may|could) ' + targetedSubject + ' (?:enter|re-enter|reenter|return to|regain) (?:the )?impersonation(?:[- ](?:1|2))?(?: state)?$').test(words)
    || new RegExp('^(?:can|may|could) ' + targetedSubject + ' (?:use|declare) cyber ?mask$').test(words)) {
    conclusion = 'YES'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'Yes. Targeted State does not prevent entering Impersonation, and being Targeted does not mean the Trooper is currently in enemy LoF. A Trooper with Impersonation can return to that state in its Active Turn by spending a Long Skill while outside the LoF of enemy Markers or Troopers. A Hacker with Cybermask can likewise enter IMP-2 by meeting that program’s requirements. Targeted remains in effect: entering Impersonation or using Cybermask does not cancel it. The +3 Discover MOD against the Targeted Trooper still applies, and Targeted still prohibits Stealth and Cautious Movement.'
    pages = ['Targeted_State', 'Impersonation_State', 'Cybermask']
  } else if (/^(?:when does|when will|when can|at what point does) (?:nfb|negative feedback)(?: suppression)? (?:stop applying|end|stop|cease applying)$/.test(words)) {
    conclusion = 'DEPENDS'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'NFB prevents simultaneous use of multiple NFB abilities. Activating one overrides the trooper’s other NFB abilities until the new effect is canceled or voluntarily deactivated. The exact cancellation condition depends on that ability. For Cybermask, its NFB suppresses Mimetism while the hacker is in IMP-2; revealing the hacker ends Cybermask and its suppression.'
    pages = ['Labels#Negative_Feedback_(NFB)', 'Cybermask']
  } else if (/\bcyber ?mask\b/.test(words) && /\b(?:mimetism|mim)\b/.test(words)
    && /discover/.test(words) && /shoot|shot|bs attack/.test(words)
    && /reactivat|regain|return|apply|applies/.test(words)
    && /successful|succeeds|success/.test(words)
    && !/imp-1|impersonation-1|biometric|exception|scenario|white noise|albedo|holoprojector/.test(words)) {
    conclusion = 'YES'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'Mimetism applies to the BS Attack after a successful Discover in the same Order. Cybermask’s NFB suppresses Mimetism for the Discover Roll while the hacker is in IMP-2. Successful Discover cancels IMP-2 and ends Cybermask, so Mimetism applies to the subsequent shot; it does not wait until the next Order. Discover + BS Attack is expressly allowed against IMP-2, and Impersonation cancellation applies to the entire Order.'
    pages = ['Cybermask', 'Labels#Negative_Feedback_(NFB)', 'Impersonation_State', 'Discover']
  } else if (new RegExp('^(?:does|can|may|will) ' + nanoscreenSubject + ' (?:gain|receive|get|benefit from|claim) (?:the )?(?:\\+?6(?: (?:to )?(?:save|saving rolls?))?|saving roll bonus|cover bonus) from (?:a |the )?vitroferro(?: deployable)? cover$').test(words)
    || /^(?:does|can|will) nanoscreen stack with (?:the )?(?:\+6(?: save)? from )?vitroferro(?: deployable)? cover$/.test(words)
    || /^(?:can|does|will) (?:a |the )?(?:model|trooper|unit) with no cover (?:gain|receive|get|benefit from|claim) (?:the )?(?:\+?6(?: (?:to )?(?:save|saving rolls?))?|saving roll bonus|cover bonus) from (?:a |the )?vitroferro(?: deployable)? cover$/.test(words)) {
    conclusion = 'NO'
    answer = 'No. Standard Nanoscreen troopers have No Cover. No Cover prohibits Partial Cover MODs, and Deployable Cover (Vitroferro) grants a variant of Partial Cover, so these troopers cannot gain its +6 Saving Roll MOD, even in Silhouette contact. Against an ordinary BS Attack, Nanoscreen still imposes -3 BS on the attacker and grants +3 to the user’s Saving Roll; it does not produce +9 by stacking with Vitroferro. Nanoscreen does not apply against BS Attacks with the Comms Attack Trait or against CC Attacks. If a scenario explicitly changes No Cover or the profile, that exception must be checked separately.'
    pages = ['No_Cover', 'Deployable_Cover', 'Nanoscreen']
  } else if (new RegExp('^(?:do|does|can|may|will) ' + camoSubject + ' (?:reload|replenish ammunition|regain disposable uses) (?:during|in) (?:the )?states phase (?:if|when|while) ' + baggageRange + '$').test(words)) {
    conclusion = 'YES'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'Yes. During the States Phase, a Camouflaged Trooper in the Zone of Control of an allied non-Null Baggage provider automatically cancels Unloaded or regains spent Disposable uses. This is Baggage’s automatic effect, not a declaration of the Reload Short Skill/ARO. Camouflaged does not prevent Automatic Equipment from functioning, and this replenishment does not reveal the marker. Non-Reloadable weapons or Equipment cannot be replenished. Already deployed items remain on the table.'
    pages = ['Baggage', 'Unloaded_State', 'Camouflaged_State', 'Reload']
  } else if (new RegExp('^(?:can|may) ' + camoSubject + ' declare (?:the )?reload(?: skill| short skill| short skill/aro)? (?:during|in) (?:the )?states phase$').test(words)) {
    conclusion = 'NO'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'No. You cannot declare the Reload Short Skill/ARO during the States Phase. However, a Camouflaged Trooper can automatically regain spent Disposable uses through an allied non-Null Baggage provider in Zone of Control during that phase, without declaring Reload or revealing. Non-Reloadable items are excluded.'
    pages = ['Reload', 'Baggage', 'Camouflaged_State']
  } else if (/^(?:can|may) (?:you|a trooper|a model) (?:guts prone|go prone (?:through|with|via|by failing) (?:a )?guts(?: roll)?) (?:if|when|while) (?:you are|they are|it is|in|youre) (?:in )?(?:the )?immobilized(?:[- ](?:a|b))?(?: state)?$/.test(words)) {
    conclusion = 'NO'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'No. A Trooper in Immobilized-A or Immobilized-B cannot make a Guts Roll, so it cannot voluntarily fail one or go Prone through Guts. The Guts Roll requirements explicitly exclude IMM States. A separate successful PH-6 Dodge can cancel ordinary IMM-A and permit Dodge movement, including going Prone; merely declaring Dodge does not allow that movement.'
    pages = ['Guts_Roll', 'Immobilized-A_State', 'Dodge', 'General_Movement_Rules']
  } else if (/^(?:can|may) you (?:target|attack) (?:a|an|the|enemy) (?:model|trooper) with ?a (?:template weapon|template) if it would (?:hit|affect|overlap) (?:your|my|an|the) (?:own )?hvt$/.test(words)) {
    conclusion = 'DEPENDS'
    certainty = 'EXPLICIT RULES ANSWER'
    answer = 'For a damaging or State-inflicting template, no: if it would affect your HVT, that shot is cancelled because the HVT is Neutral. Other shots in the same Burst remain valid if their templates do not affect allied or neutral Troopers. The exception is a template with no PS value that inflicts no States, such as Smoke or Eclipse: it may overlap the HVT. If a cancelled shot used a Disposable weapon, that use is still consumed.'
    pages = ['Template_Weapons_and_Equipment']
  } else if (/^(?:does|do|can|will) speculative attack(?:s)? (?:ignore|bypass)(?:s)? (?:the )?dodge\s*-?\s*3(?: skill| mod| modifier)?$/.test(words)) {
    conclusion = 'YES'
    answer = 'Yes. If you mean the Dodge (-3) profile Skill, its penalty to the attacker is ignored by Speculative Attack, which applies its own -6 and Range MODs but excludes other negative MODs. This is different from the defender’s -3 PH penalty for Dodging a Template without LoF to the attacker: that penalty still applies to the defender’s Dodge Roll.'
    pages = ['Speculative_Attack', 'Template:Modifiers-explained']
  } else if (/^(?:can|may) (?:you|a trooper|a model) reset (?:if|when|while) (?:you are|they are|it is|in|youre) (?:in )?(?:the )?immobilized[- ]a(?: state)?(?: and (?:in )?(?:the )?immobilized[- ]b(?: state)?)?$/.test(words)
    || /^(?:can|may) (?:you|a trooper|a model) reset(?: against hacking)? (?:in|while in) (?:the )?immobilized[- ]a state(?: in (?:the )?(?:active|reactive) turn)?$/.test(words)) {
    const both = /immobilized[- ]b/.test(words)
    conclusion = 'NO'
    answer = both
      ? 'No. With Immobilized-A and Immobilized-B simultaneously, both restrictions apply: IMM-A permits only Dodge, while IMM-B permits only Reset. IMM-A therefore prohibits Reset and IMM-B prohibits Dodge, in both Active and Reactive Turns. The Trooper cannot cancel either state by its own Dodge or Reset; an Engineer (or equivalent Skill) can cancel the states.'
      : 'No. Immobilized-A prohibits declaring any Skill or ARO except Dodge, applying PH -6. This restriction applies in both the Active and Reactive Turns, so Reset cannot be declared, including against Hacking. A successful Dodge can cancel IMM-A; an Engineer (or equivalent Skill) can also cancel it.'
    pages = both ? ['Immobilized-A_State', 'Immobilized-B_State'] : ['Immobilized-A_State']
  } else if (/^(?:does|can|will) discover(?:ing)? through white noise (?:trigger|triggers|allow|allows|permit|permits)(?: a| an)? bs attack aro (?:from|by)(?: a| an)? (?:msv ?1|multispectral visor(?: level)? 1)(?: model| trooper)?$/.test(words)) {
    conclusion = 'NO'
    answer = 'No. MSV1 cannot draw LoF through White Noise. Discover is not a BS Attack and does not trigger the exception allowing a Trooper targeted by a BS Attack through the zone to treat it as Poor Visibility (-6) when drawing LoF to the attacker. MSV1’s ability to see through ordinary Smoke does not bypass White Noise. A separate unobstructed LoF could allow a BS Attack ARO normally.'
    pages = ['White_Noise', 'Visibility_Conditions', 'Multispectral_Visor']
  } else if (/^(?:what happens (?:if|when)|what do you do (?:if|when)) (?:you (?:do a |use |perform )?|a trooper (?:uses |performs )?)?transmut(?:ation|e)(?: happens)? (?:but |and |if |when )?(?:the (?:new|replacement) (?:model|silhouette) |you |it )?(?:cant|cannot|does not|doesnt|won t|wont)(?: physically)? fit(?: in (?:the )?(?:available )?space)?$/.test(words)) {
    conclusion = 'DEPENDS'
    answer = 'It depends on whether the transformation is mandatory. For a mandatory and inevitable replacement, if the new Silhouette cannot fit, the replacement Trooper enters Immobilized-A. This particular IMM-A can only be cancelled when the conditions of the surrounding space change enough to accommodate the new Silhouette; Dodge and Engineer cannot cancel it. With different base sizes, check the legal centre-aligned or edge-aligned replacement positions first; replacement cannot cancel Engaged State. The mandatory-replacement rule does not automatically apply to optional profile changes. Not owning an alternative miniature is a separate issue: use a Transmuted Token to indicate the new profile.'
    pages = ['Replacing_Game_Elements', 'Transmutation']
  } else return null
  return {
    question: String(question).trim(),
    versions: corpus.manifest.sources.map((source) => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : source.title + ' ' + source.version })),
    status: 'EVIDENCE-BOUNDED RULES ANSWER',
    answerSource: 'EVIDENCE_BOUNDED_RULES',
    deepSeek: {
      answer, conclusion, certainty, interpretationRequired: certainty === 'EVIDENCE-BOUNDED INTERPRETATION',
      sources: pages.map((page, index) => ({ id: 'V' + index, title: 'Official Infinity N5.3 Wiki', section: page.replaceAll('_', ' '), url: 'https://infinitythewiki.com/' + page })),
    },
  }
}

function asksIfElectromagneticDestroysDeployable(question) {
  const words = normalizeRuleText(question).replace(/[+./-]/g, ' ')
  return /\b(?:e m|electromagnetic)\b/.test(words)
    && /\bdeployables?\b/.test(words)
    && /\b(?:destroy\w*|damage\w*|kill\w*|remove\w*|wound\w*)\b/.test(words)
    && !/\b(?:n e m|normal|combined)\b/.test(words)
}

function electromagneticDeployableResult(question, corpus) {
  const source = corpus.manifest.sources.find((item) => item.id === 'infinity-rules-n5.3')
  const sources = [
    [64, 'E/M AMMUNITION'],
    [175, 'DEPLOYABLE'],
    [168, 'ISOLATED STATE'],
    [67, 'COMBINED AMMUNITION'],
  ].map(([page, section], index) => ({ id: `E${String(index + 1).padStart(4, '0')}`, title: source.title, version: source.version, page: `p. ${page}`, section, url: source.officialUrl }))
  return {
    question: String(question || '').trim(),
    versions: corpus.manifest.sources.map((item) => ({ id: item.id, version: item.version, label: item.id === 'its-season-18' ? 'ITS Season 18' : `${item.title} ${item.version}` })),
    status: 'EVIDENCE-BOUNDED RULES ANSWER',
    answerSource: 'EVIDENCE_BOUNDED_RULES',
    deepSeek: {
      answer: 'No. E/M alone causes no Wounds, so it does not destroy a deployed Mine, Repeater, or other deployable. A failed E/M Saving Roll instead causes Isolated State; that disables a Deployable Repeater’s communications function. N+E/M is different: its Normal ammunition can inflict Wounds and destroy a one-STR deployable.',
      conclusion: 'NO', certainty: 'EVIDENCE-BOUNDED INTERPRETATION', interpretationRequired: true, sources,
    },
  }
}


function asksAboutPublicFireteamIdentity(question) {
  const words = normalizeRuleText(question)
  if (!/\bfireteams?\b/.test(words) || !/\b(public|open|private|secret|disclos\w*|reveal\w*|announce\w*|tell|share|know\w*)\b/.test(words)) return false
  if (!/\b(name|chart|type|kind|duo|haris|core)\b/.test(words)) return false
  // A question solely about Fireteam Bonuses has the opposite answer.
  if (/\b(bonus|bonuses|level|modifier)\b/.test(words) && !/\b(name|chart|type|kind)\b/.test(words)) return false
  return true
}

function publicFireteamIdentityResult(question, corpus) {
  const source = corpus.manifest.sources.find((item) => item.id === 'infinity-rules-n5.3')
  const sources = [
    [7, 'OPEN AND PRIVATE INFORMATION'],
    [132, 'INFINITY FIRETEAMS — FIRETEAM CREATION AND TYPES'],
    [133, 'FIRETEAMS CHART'],
  ].map(([page, section], index) => ({ id: 'F' + String(index + 1).padStart(4, '0'), title: source.title, version: source.version, page: 'p. ' + page, section, url: source.officialUrl }))
  const chartName = /\b(name|chart)\b/.test(normalizeRuleText(question))
  const answer = chartName
    ? 'Yes—if you mean the named Fireteams Chart entry used to create an on-table Fireteam, disclose that entry and its type (Duo, Haris, or Core) when asked. The members must be declared when the Fireteam is created, and the Chart entry and type determine whether it can be formed. The rules do not separately say “announce the Chart name,” so this is an interpretation of the declaration and Open Information rules. Fireteam Bonuses are a distinct Private item until a benefiting Skill is declared.'
    : 'Yes—disclose whether an on-table Fireteam was formed as a Duo, Haris, or Core when asked. Its members are declared at creation and its type is governed by the Fireteams Chart; neither the type nor the chosen Chart entry is listed as Private. The rules do not explicitly say “announce the type,” so this is an evidence-bounded interpretation. Fireteam Bonuses are separately Private until a benefiting Skill is declared.'
  return {
    question: String(question || '').trim(),
    versions: corpus.manifest.sources.map((item) => ({ id: item.id, version: item.version, label: item.id === 'its-season-18' ? 'ITS Season 18' : item.title + ' ' + item.version })),
    status: 'EVIDENCE-BOUNDED RULES ANSWER',
    answerSource: 'EVIDENCE_BOUNDED_RULES',
    deepSeek: { answer, conclusion: 'YES', certainty: 'EVIDENCE-BOUNDED INTERPRETATION', interpretationRequired: true, sources },
  }
}

export function createRulesInteractionHandler({ retrieve = retrieveRulesReference, logger = console, quickReplyMs = 1200 } = {}) {
  return async function handleRules(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== RULES_COMMAND) return false
    try {
      const question = interaction.options.getString(RULES_OPTION, true).trim()
      if (!question) { await interaction.reply({ content: 'Please provide an Infinity rules question.' }); return true }
      const pending = Symbol('pending')
      const answerPromise = retrieve({ question })
      let timer, result
      try {
        result = await Promise.race([answerPromise, new Promise(resolve => { timer = setTimeout(() => resolve(pending), quickReplyMs) })])
      } finally { clearTimeout(timer) }
      if (result === pending) {
        await interaction.deferReply()
        result = await answerPromise
      }
      logger.info?.(`Infinity rules response: source=${result.answerSource || result.status || 'UNKNOWN'} delivery=${interaction.deferred ? 'deferred' : 'direct'}`)
      const payload = formatRulesDiscordResponse(result)
      if (interaction.deferred) await interaction.editReply(payload)
      else await interaction.reply(payload)
    } catch (error) {
      logger.error?.('Infinity rules request failed:', error); const message = { content: 'The Infinity rules assistant is temporarily unavailable.' }
      try { if (interaction.deferred || interaction.replied) await interaction.editReply(message); else await interaction.reply({ ...message, ephemeral: true }) } catch (replyError) { logger.error?.('Infinity rules Discord error response failed:', replyError) }
    }
    return true
  }
}

export function formatRulesDiscordResponse(result) {
  const fields = []
  const modelContext = formatModelContext(result.modelContext)
  if (modelContext) fields.push({ name: 'OFFICIAL ARMY PROFILE', value: truncate(modelContext, 1024), inline: false })
  if (result.deepSeek) {
    const conclusion = normalizeConclusion(result.deepSeek.conclusion)
    const certainty = result.answerSource === 'LOBO_TO_RULING' ? 'LOBO TO RULING — PENDING OFFICIAL CLARIFICATION' : result.deepSeek.certainty === 'EVIDENCE-BOUNDED INTERPRETATION' ? 'EVIDENCE-BOUNDED INTERPRETATION' : 'EXPLICIT RULES ANSWER'
    const answer = scrubInternalIds(result.deepSeek.answer) || 'The rules assistant did not return an answer.'
    const provenance = result.answerSource === 'APPROVED_BENCHMARK' ? '**APPROVED BENCHMARK ANSWER**\n' : ''
    const verdict = result.deepSeek.questionType === 'EXPLANATORY' ? '' : `**${conclusion}**\n`
    fields.push({ name: 'ANSWER', value: truncate(`${provenance}**${certainty}**\n${verdict}${answer}`, 1024), inline: false })
    const citations = formatCitations(result.deepSeek.sources || []); if (citations) fields.push({ name: 'OFFICIAL SOURCES', value: truncate(citations, 1024), inline: false })
  } else fields.push({ name: 'STATUS', value: `**${result.status || 'AI RULES ANSWER UNAVAILABLE'}**\n${result.limitation || 'No answer was returned.'}`, inline: false })
  const versions = (result.versions || []).map((item) => item.label).join(' • ')
  const method = result.answerSource === 'LOBO_TO_RULING' ? 'Lobo TO ruling pending official clarification; no provider call.' : result.answerSource === 'APPROVED_BENCHMARK' ? 'Approved answer matched before AI; no provider call.' : result.answerSource === 'VERIFIED_RULES' ? 'Verified official rules answer; no provider call.' : result.answerSource === 'EVIDENCE_BOUNDED_RULES' ? 'Evidence-bounded interpretation of official rules; no provider call.' : result.modelContext?.models?.length ? 'AI answer from official Army profile data and selected official rules evidence.' : 'AI answer from selected official evidence.'
  return scrubDiscordPayload({ embeds: [{ title: 'Infinity Rules Assistant', description: truncate(`**Question**\n${result.question}`, 1000), color: 0x8b1e2d, fields, footer: { text: truncate(`Activated corpus: ${versions} • ${method}`, 2048) } }], allowedMentions: { parse: [] } })
}

function benchmarkResult(question, benchmark, corpus) {
  const sources = benchmark.citations.map((citation, index) => {
    const source = corpus.manifest.sources.find((item) => item.id === citation.sourceId)
    return { id: `B${String(index + 1).padStart(4, '0')}`, title: source?.title || citation.sourceId, version: source?.version, page: citation.page == null ? undefined : `p. ${citation.page}`, section: citation.section, url: citation.url || source?.officialUrl }
  })
  return {
    question: String(question || '').trim(),
    versions: corpus.manifest.sources.map((source) => ({ id: source.id, version: source.version, label: source.id === 'its-season-18' ? 'ITS Season 18' : `${source.title} ${source.version}` })),
    status: 'APPROVED BENCHMARK ANSWER',
    answerSource: 'APPROVED_BENCHMARK',
    benchmark: { id: benchmark.id, queryId: benchmark.queryId, matchType: benchmark.matchType, score: benchmark.score },
    deepSeek: { answer: benchmark.answer, conclusion: benchmark.conclusion, certainty: benchmark.certainty, interpretationRequired: benchmark.certainty === 'EVIDENCE-BOUNDED INTERPRETATION', sources },
  }
}

function formatCitations(sources) {
  const seen = new Set()
  return sources.filter((source) => {
    const key = [source.url, source.title, source.version, source.page, source.section].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8).map((source) => {
    const label = [source.title, source.version, source.page, source.section].filter(Boolean).join(' — ')
    return source.url ? `• [${label}](${source.url})` : `• ${label}`
  }).join('\n')
}
function formatModelContext(context) {
  if (!context?.models?.length) return ''
  return context.models.map((model) => {
    const loadoutCount = model.loadoutCount ?? model.variantCount
    const variants = loadoutCount === 1 ? '1 official loadout' : `${loadoutCount} official loadouts; no loadout silently selected`
    const forms = model.formProfileCount > loadoutCount ? ` · ${model.formProfileCount} listed state profiles` : ''
    const details = [
      model.sharedStats?.length ? `Shared stats: ${model.sharedStats.join(' · ')}` : null,
      model.commonSkills?.length ? `Common Skills: ${model.commonSkills.join(', ')}` : null,
      model.commonEquipment?.length ? `Common Equipment: ${model.commonEquipment.join(', ')}` : null,
    ].filter(Boolean).join('\n')
    return `**${model.name}** — ${variants}${forms}${details ? `\n${details}` : ''}`
  }).join('\n\n')
}
function scrubInternalIds(value) { return String(value ?? '').replace(/\bC\d{4}\b/g, '').replace(/\s{2,}/g, ' ').trim() }
function scrubDiscordPayload(value, key = '') { if (Array.isArray(value)) return value.map((item) => scrubDiscordPayload(item)).filter((item) => item !== undefined); if (value && typeof value === 'object') { const out = {}; for (const [name, item] of Object.entries(value)) { const clean = scrubDiscordPayload(item, name); if (clean === undefined) continue; if (typeof clean === 'string' && !clean.trim() && ['name', 'value', 'url', 'text'].includes(name)) continue; out[name] = clean } return out } if (value === undefined || value === null) return undefined; return value }
function truncate(value, max) { const text = String(value ?? ''); return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '').trim()}…` }
function normalizeConclusion(value) { const normalized = String(value || '').trim().toUpperCase(); if (normalized === 'RULE') return 'INTERPRETATION'; return ['YES', 'NO', 'DEPENDS', 'UNRESOLVED', 'INTERPRETATION'].includes(normalized) ? normalized : 'UNRESOLVED' }
function matches(command) { const option = command.options?.[0]; return command.description === RULES_COMMAND_DEFINITION.description && command.options?.length === 1 && option?.name === RULES_OPTION && option?.required === true && option?.type === ApplicationCommandOptionType.String && option?.maxLength === 1000 }




