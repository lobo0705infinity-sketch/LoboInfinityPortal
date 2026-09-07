import { ApplicationCommandOptionType } from 'discord.js'
import { buildRulesReference, loadProductionRulesCorpus, RULES_STATUS } from './infinity-rules-service.mjs'
import { createDeepSeekFallback } from './deepseek-rules.mjs'

export const RULES_COMMAND='rules'
export const RULES_OPTION='question'
export const RULES_COMMAND_DEFINITION=Object.freeze({name:RULES_COMMAND,description:'Search the current official Infinity rules',options:[{name:RULES_OPTION,description:'Infinity rules question',required:true,type:ApplicationCommandOptionType.String,max_length:1000}]})

export async function ensureRulesCommand(client){
  if(!client?.guilds?.cache)return[];const registered=[]
  for(const guild of client.guilds.cache.values()){const commands=await guild.commands.fetch();let command=commands.find((candidate)=>candidate.name===RULES_COMMAND);if(!command)command=await guild.commands.create(RULES_COMMAND_DEFINITION);else if(!matches(command))command=await command.edit(RULES_COMMAND_DEFINITION);registered.push({applicationId:command.applicationId,guildId:guild.id,id:command.id})}
  const globals=await client.application.commands.fetch();const obsolete=globals.find((command)=>command.name===RULES_COMMAND);if(obsolete)await obsolete.delete();return registered
}

export async function retrieveRulesReference({question}){const corpus=await loadProductionRulesCorpus();const retrieved=buildRulesReference(corpus,question);return createDeepSeekFallback({corpus})(retrieved)}

export function createRulesInteractionHandler({retrieve=retrieveRulesReference,logger=console}={}){
  return async function handleRules(interaction){if(!interaction?.isChatInputCommand?.()||interaction.commandName!==RULES_COMMAND)return false
    try{await interaction.deferReply();const question=interaction.options.getString(RULES_OPTION,true).trim();if(!question){await interaction.editReply({content:'Please provide an Infinity rules question.'});return true}const result=await retrieve({question});await interaction.editReply(formatRulesDiscordResponse(result))}
    catch(error){logger.error?.('Infinity rules reference request failed:',error);try{const message={content:'The authoritative Infinity rules reference is temporarily unavailable.'};if(interaction.deferred||interaction.replied)await interaction.editReply(message);else await interaction.reply({...message,ephemeral:true})}catch(replyError){logger.error?.('Infinity rules Discord error response failed:',replyError)}}return true
  }
}

export function formatRulesDiscordResponse(result){
  const fields=[]
  if(result.deepSeek){const conclusion=normalizeConclusion(result.deepSeek.conclusion),binary=isBinaryRulesQuestion(result.question),certainty=result.deepSeek.interpretationRequired?'EVIDENCE-BOUNDED INTERPRETATION':(binary?'EXPLICIT RULING':'EXPLICIT RULES ANSWER');let answer=typeof result.deepSeek.answer==='string'?result.deepSeek.answer.trim():'';answer=answer.replace(/\bE\d+(?:\s*\/\s*E\d+)*\b/g,'').replace(/\s{2,}/g,' ').trim();if(!answer||(/^UNRESOLVED$/i.test(answer)&&conclusion==='UNRESOLVED'))answer='The supplied official evidence does not conclusively resolve this interaction.';const shown=binary?`**${certainty}**\n**${conclusion}**\n${answer}`:`**${certainty}**\n${answer}`;fields.push({name:'ANSWER',value:shown,inline:false})}
  for(const rule of result.rules.slice(0,4)){const scope=rule.scope==='ITS'?'ITS SEASON 18 — ':rule.sourceId.includes('faq')?'FAQ CLARIFICATION — ':'';const metadata=`**${scope}${rule.sourceLabel} — ${rule.pageLabel}**\n${rule.url?`[Open official source](${rule.url})`:''}`;const excerpt=truncate(rule.excerpt,Math.max(0,1024-metadata.length-2));fields.push({name:truncate(rule.ruleName||'RULE EXCERPT',256),value:`${metadata}\n${excerpt}`,inline:false})}
  if(!fields.length)fields.push({name:'STATUS',value:RULES_STATUS.NONE,inline:false})
  else fields.push({name:'STATUS',value:`**${result.status}**${result.noExplicitFaq?'\nNo explicit current FAQ adjudication of this exact combination was found in the activated corpus.':''}${result.limitation?`\n${result.limitation}`:''}`,inline:false})
  const versions=result.versions.map((item)=>item.label).join(' • ')
  const embed={title:'Infinity Rules Reference',description:truncate(`**Question**\n${result.question}`,1000),color:0x8b1e2d,fields,footer:{text:truncate(`Activated corpus: ${versions} • Retrieval reference only; no autonomous ruling.`,2048)}}
  enforceEmbedLimit(embed);return scrubDiscordPayload({embeds:[embed],allowedMentions:{parse:[]}})
}
function scrubDiscordPayload(value,key=''){if(Array.isArray(value))return value.map((item)=>scrubDiscordPayload(item)).filter((item)=>item!==undefined);if(value&&typeof value==='object'){const out={};for(const [name,item] of Object.entries(value)){const clean=scrubDiscordPayload(item,name);if(clean===undefined)continue;if(typeof clean==='string'&&!clean.trim()&&(name==='name'||name==='value'||name==='url'||name==='text'))continue;out[name]=clean}return out}if(value===undefined||value===null)return undefined;return value}
function truncate(value,max){const text=String(value??'');if(text.length<=max)return text;return `${text.slice(0,Math.max(0,max-1)).replace(/\s+\S*$/,'').trim()}…`}
function embedSize(embed){return(embed.title?.length??0)+(embed.description?.length??0)+(embed.footer?.text?.length??0)+embed.fields.reduce((n,f)=>n+f.name.length+f.value.length,0)}
function enforceEmbedLimit(embed){while(embedSize(embed)>5900){const candidate=[...embed.fields].reverse().find((field)=>field.name!=='STATUS'&&field.value.length>300);if(!candidate)break;candidate.value=truncate(candidate.value,candidate.value.length-200)}}
function normalizeConclusion(value){const normalized=String(value||'').trim().toUpperCase();return ['YES','NO','DEPENDS','UNRESOLVED'].includes(normalized)?normalized:'INTERPRETATION'}
function isBinaryRulesQuestion(question){return /^(?:does|do|can|could|will|would|may|might|is|are|was|were|should|must|has|have|did)\b/i.test(String(question||'').trim())}
function matches(command){const option=command.options?.[0];return command.description===RULES_COMMAND_DEFINITION.description&&command.options?.length===1&&option?.name===RULES_OPTION&&option?.required===true&&option?.type===ApplicationCommandOptionType.String&&option?.maxLength===1000}
