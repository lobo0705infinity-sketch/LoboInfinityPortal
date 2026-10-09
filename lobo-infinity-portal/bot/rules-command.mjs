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
  const [corpus, modelResolution] = await Promise.all([loadProductionRulesCorpus(), resolveRulesModelMentions(question)])
  const verified = verifiedRulesInteraction(question, corpus)
  if (verified) return verified
  // Approved benchmark answers describe rules concepts, not the selected Army
  // profile. A named model must take the evidence-bounded path so its actual
  // profile facts participate in the answer.
  const benchmark = modelResolution.models.length ? null : await findApprovedRulesAnswer(question)
  if (benchmark) return benchmarkResult(question, benchmark, corpus)
  if (!modelResolution.models.length && asksIfElectromagneticDestroysDeployable(question))
    return electromagneticDeployableResult(question, corpus)
  if (!modelResolution.models.length && asksAboutPublicFireteamIdentity(question))
    return publicFireteamIdentityResult(question, corpus)
  return deepSeek({ question, corpus, modelResolution })
}


/** Verified N5.3 interactions. Keep compound questions on the evidence path. */
export function verifiedRulesInteraction(question, corpus) {
  const words = normalizeRuleText(String(question).replace(/[’']/g, ''))
    .replace(/\bimmobili[sz]ed\b/g, 'immobilized')
    .replace(/\bimmobili[sz]ation\b/g, 'immobilized')
    .replace(/[()?.,]/g, '').replace(/\s+/g, ' ').trim()
  let answer, conclusion, pages
  let certainty = 'EVIDENCE-BOUNDED INTERPRETATION'
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
  if (new RegExp('^(?:does|can|may|will) ' + nanoscreenSubject + ' (?:gain|receive|get|benefit from|claim) (?:the )?(?:\\+?6(?: (?:to )?(?:save|saving rolls?))?|saving roll bonus|cover bonus) from (?:a |the )?vitroferro(?: deployable)? cover$').test(words)
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

export function createRulesInteractionHandler({ retrieve = retrieveRulesReference, logger = console } = {}) {
  return async function handleRules(interaction) {
    if (!interaction?.isChatInputCommand?.() || interaction.commandName !== RULES_COMMAND) return false
    try {
      await interaction.deferReply(); const question = interaction.options.getString(RULES_OPTION, true).trim()
      if (!question) { await interaction.editReply({ content: 'Please provide an Infinity rules question.' }); return true }
      await interaction.editReply(formatRulesDiscordResponse(await retrieve({ question })))
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
    const certainty = result.deepSeek.certainty === 'EVIDENCE-BOUNDED INTERPRETATION' ? 'EVIDENCE-BOUNDED INTERPRETATION' : 'EXPLICIT RULES ANSWER'
    const answer = scrubInternalIds(result.deepSeek.answer) || 'The rules assistant did not return an answer.'
    const provenance = result.answerSource === 'APPROVED_BENCHMARK' ? '**APPROVED BENCHMARK ANSWER**\n' : ''
    fields.push({ name: 'ANSWER', value: truncate(`${provenance}**${certainty}**\n**${conclusion}**\n${answer}`, 1024), inline: false })
    const citations = formatCitations(result.deepSeek.sources || []); if (citations) fields.push({ name: 'OFFICIAL SOURCES', value: truncate(citations, 1024), inline: false })
  } else fields.push({ name: 'STATUS', value: `**${result.status || 'AI RULES ANSWER UNAVAILABLE'}**\n${result.limitation || 'No answer was returned.'}`, inline: false })
  const versions = (result.versions || []).map((item) => item.label).join(' • ')
  const method = result.answerSource === 'APPROVED_BENCHMARK' ? 'Approved answer matched before AI; no provider call.' : result.answerSource === 'EVIDENCE_BOUNDED_RULES' ? 'Evidence-bounded interpretation of official rules; no provider call.' : result.modelContext?.models?.length ? 'AI answer from official Army profile data and selected official rules evidence.' : 'AI answer from selected official evidence.'
  return scrubDiscordPayload({ embeds: [{ title: 'Infinity Rules Assistant', description: truncate(`**Question**\n${result.question}`, 1000), color: 0x8b1e2d, fields, footer: { text: truncate(`Activated corpus: ${versions} • ${method}`, 2048) } }], allowedMentions: { parse: [] } })
}

function benchmarkResult(question, benchmark, corpus) {
  const sources = benchmark.citations.map((citation, index) => {
    const source = corpus.manifest.sources.find((item) => item.id === citation.sourceId)
    return { id: `B${String(index + 1).padStart(4, '0')}`, title: source?.title || citation.sourceId, version: source?.version, page: `p. ${citation.page}`, section: citation.section, url: source?.officialUrl }
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
