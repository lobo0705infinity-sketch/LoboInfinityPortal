import { readFile } from 'node:fs/promises'
import { resourceStatePath, DEFAULT_CHECK_INTERVAL_MS } from './rules-resource-watcher.mjs'
import { DEFAULT_MATCHMAKING_CHECK_INTERVAL_MS } from './matchmaking-command.mjs'
import { MATCHMAKING_TIME_ZONE, MATCHMAKING_DIGEST_HOUR } from './matchmaking-time.mjs'

export async function deliveryJobReport({env=process.env,read=readFile}={}) {
  const statePath=resourceStatePath(env)
  let checkpoint={status:'NOT_YET_SAVED',checkedAt:null}
  try {
    const state=JSON.parse(await read(statePath,'utf8'))
    checkpoint={status:'SAVED',checkedAt:state.checkedAt || null}
  }catch(error){if(error.code!=='ENOENT')checkpoint={status:'UNREADABLE',checkedAt:null}}
  const digestHour=String(env.INFINITY_MATCHMAKING_DIGEST_HOUR || '').trim()
  return {
    jobs:[
      {id:'interactive-commands',owner:'Lobo’s Little Helper',trigger:'User command or button',responsibilities:['Army/TTS tools','Rules and missions','Combat comparisons','Availability and game requests','Help and reports'],source:'bot/lobos-little-helper.mjs'},
      {id:'maps-workshops',owner:'Lobo’s Little Helper',trigger:'Startup and periodic check',enabled:String(env.INFINITY_RESOURCES_ANNOUNCER_ENABLED || 'true').toLowerCase()!=='false',intervalMs:Math.max(60000,Number(env.INFINITY_RESOURCES_CHECK_INTERVAL_MS)||DEFAULT_CHECK_INTERVAL_MS),channel:env.INFINITY_RESOURCES_CHANNEL_ID || env.INFINITY_RESOURCES_CHANNEL_NAME || 'tts-map-submissions',statePath,checkpoint,deduplication:'Persistent resource snapshot plus existing bot-message markers. Defer delivery if history cannot be read.',source:'bot/rules-resource-watcher.mjs'},
      {id:'daily-matchmaking',owner:'Lobo’s Little Helper',trigger:'Periodic check; one daily availability board when due',enabled:String(env.INFINITY_MATCHMAKING_ENABLED || 'true').toLowerCase()!=='false',intervalMs:Math.max(60000,Number(env.INFINITY_MATCHMAKING_CHECK_INTERVAL_MS)||DEFAULT_MATCHMAKING_CHECK_INTERVAL_MS),timeZone:String(env.INFINITY_MATCHMAKING_DIGEST_TIME_ZONE || '').trim()||MATCHMAKING_TIME_ZONE,hour:digestHour&&Number.isInteger(Number(digestHour))?Number(digestHour):MATCHMAKING_DIGEST_HOUR,channel:env.INFINITY_MATCHMAKING_CHANNEL_ID || env.INFINITY_MATCHMAKING_CHANNEL_NAME || 'scheduling-feed',deduplication:'Daily marker in Discord history; defer delivery if history cannot be read.',source:'bot/matchmaking-command.mjs'},
      {id:'portal-league-announcements',owner:'Portal Automation Queue / Discord webhook',trigger:'League events, commissioner actions and queue maintenance',responsibilities:['Game stories and results','Achievements and season events','League news and recaps'],declaredMaintenanceMinutes:30,liveScheduleVerified:false,coverage:'Source mapping only. Installed Apps Script triggers and commissioner webhook settings require backend access.',deduplication:'Queue IDs and Discord delivery log; submitted games wait for story generation.',sources:['backend/AutomationApi.gs','backend/DiscordApi.gs','backend/ArmyIntelligenceScheduler.gs','api/automation-queue-worker.mjs']},
    ],
    assessment:'No duplicate job is established between the map/workshop watcher, daily availability board and league announcement queue. Keep these delivery responsibilities distinct; manual commissioner replay is intentional.'
  }
}
