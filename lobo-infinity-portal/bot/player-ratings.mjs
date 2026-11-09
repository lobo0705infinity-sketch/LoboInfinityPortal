import { join } from 'node:path'
import { ApplicationCommandOptionType as Type, PermissionFlagsBits } from 'discord.js'
import { createTop40Store } from './top40-notifications.mjs'
import { AURORA_DISCORD_GUILD_ID } from '../shared/aurora-registration.mjs'
import { calculatePortalElo, campaignEloGames, ratingBand, ratingKey } from '../shared/portal-elo.mjs'

const BLOB = 'https://ecwefvuvauaqpary.public.blob.vercel-storage.com/'
const META = 'https://api.infinitythemeta.com/players/'
const validId = value => /^\d{17,20}$/.test(String(value || ''))
export async function loadRatingSnapshot(fetchObject = fetch) {
  async function json(url) {
    const r = await fetchObject(url, { cache: 'no-cache', signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw Error('Rating source is unavailable.')
    return r.json()
  }
  const pointer = await json(`${BLOB}public-snapshots/current.json`)
  if (!/^\d{8}T\d{6}Z$/.test(pointer?.snapshotId) || pointer.basePath !== `public-snapshots/${pointer.snapshotId}/`) throw Error('Invalid rating snapshot pointer.')
  const [games, players] = await Promise.all(['games','players'].map(name => json(`${BLOB}${pointer.basePath}${name}.json`)))
  if ([games,players].some(e => e.snapshotId !== pointer.snapshotId || e.sourceCutoff !== pointer.sourceCutoff || !Array.isArray(e.data))) throw Error('Rating snapshot generations do not match.')
  return { snapshotId: pointer.snapshotId, sourceCutoff: pointer.sourceCutoff, games: games.data, players: players.data }
}

export async function loadMetaRatings(fetchObject = fetch) {
  async function page(offset) {
    const r = await fetchObject(`${META}?limit=200&offset=${offset}&min_games=0&active=0&provisional=true&unranked=true`, { signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw Error('Infinity the Meta is unavailable.')
    const p = await r.json()
    if (!p.run?.run_id || !Number.isSafeInteger(p.total) || p.total < 1 || p.total > 20000 || !Array.isArray(p.rows)) throw Error('Invalid Infinity the Meta directory.')
    return p
  }
  const first = await page(0), pages = [first]
  // Preserve one published rating run across every directory page.
  for (let offset = first.rows.length; offset < first.total;) {
    if (!first.rows.length) throw Error('Infinity the Meta directory is incomplete.')
    const offsets = Array.from({ length: Math.min(4, Math.ceil((first.total - offset) / first.rows.length)) }, (_, i) => offset + i * first.rows.length)
    const batch = await Promise.all(offsets.map(page))
    pages.push(...batch); offset += offsets.length * first.rows.length
  }
  if (pages.some(p => p.run.run_id !== first.run.run_id || p.total !== first.total)) throw Error('Infinity the Meta rating run changed during import.')
  const rows = pages.flatMap(p => p.rows)
  if (rows.length !== first.total || new Set(rows.map(p => p.person_id)).size !== first.total || rows.some(p => !p.person_id || !p.name || !Number.isFinite(p.rating))) throw Error('Infinity the Meta directory is incomplete.')
  return { run: first.run, rows }
}

export async function listRatingMembers(guild) {
  const members = []; let after
  for (let page = 0; page < 50; page++) {
    const batch = [...(await guild.members.list({ limit: 1000, after, cache: false })).values()]
    members.push(...batch.filter(m => !m.user.bot))
    if (batch.length < 1000) return members
    const next = batch.at(-1)?.id
    if (!next || next === after) break
    after = next
  }
  throw Error('Complete Discord membership could not be loaded.')
}

// Exact unique aliases only; no substrings, similarity scores, or timezone stripping.
export function matchRatingMembers(members, players, links = {}) {
  const result = new Map(), unresolved = []
  for (const player of players) {
    const key = ratingKey(player.player), explicit = links[key]?.userId
    const aliases = new Set([player.player, player.displayName].filter(Boolean).map(ratingKey))
    const found = explicit ? members.filter(m => m.id === explicit) : members.filter(m =>
      [m.user.username, m.user.globalName, m.displayName].some(value => value && aliases.has(ratingKey(value))))
    if (found.length === 1) result.set(key, found[0])
    else unresolved.push({ player: player.player, reason: found.length ? 'Ambiguous Discord name' : 'No Discord match' })
  }
  // Two portal identities cannot silently share one Discord account.
  const ids = new Map()
  for (const [key, member] of result) ids.set(member.id, [...(ids.get(member.id) || []), key])
  for (const keys of ids.values()) if (keys.length > 1) for (const key of keys) {
    result.delete(key); unresolved.push({ player: key, reason: 'Discord account matches multiple Portal players' })
  }
  return { matches: result, unresolved }
}

export async function syncRatingRoles(guild, assignments, state, save) {
  const me = guild.members.me || await guild.members.fetchMe()
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) throw Error('LLH needs Manage Roles to assign rating bands.')
  const roles = await guild.roles.fetch()
  state.ratingRoles ||= {}
  const report = { changed: 0, unchanged: 0, failed: [] }
  for (const { member, source, rating } of assignments) {
    const name = `${source === 'portal' ? 'Portal ELO' : 'Meta Rating'} ${rating === null ? 'Unrated' : ratingBand(rating)}`
    let id = state.ratingRoles[name], role = id && roles.get(id)
    if (!role) {
      const existing = [...roles.values()].filter(r => r.name === name)
      if (existing.length > 1) { report.failed.push({ source, member: member.displayName, reason: 'Duplicate rating roles' }); continue }
      role = existing[0]
      if (!role) { role = await guild.roles.create({ name, permissions: [], hoist: false, mentionable: false, reason: 'Lobo requested separate Meta and Portal rating roles.' }); roles.set(role.id, role) }
      id = role.id; state.ratingRoles[name] = id; await save(state)
    }
    if (role.managed || role.permissions.bitfield !== 0n || !role.editable || role.name !== name) { report.failed.push({ source, member: member.displayName, reason: 'Rating role permissions or hierarchy need attention' }); continue }
    const prefix = source === 'portal' ? 'Portal ELO ' : 'Meta Rating '
    const old = Object.entries(state.ratingRoles).filter(([n, roleId]) => n.startsWith(prefix) && roleId !== id && member.roles.cache.has(roleId)).map(([, roleId]) => roleId)
    try {
      if (!member.roles.cache.has(id)) {
        const updated = await member.roles.add(role, 'Update player rating band')
        if (!updated.roles.cache.has(id)) throw Error('Role assignment could not be verified.')
        report.changed++
      } else report.unchanged++
      // Add the replacement first, and modify only the tracked rating roles.
      for (const oldId of old) {
        const oldRole = roles.get(oldId)
        if (!oldRole || oldRole.managed || oldRole.permissions.bitfield !== 0n || !oldRole.editable || !oldRole.name.startsWith(prefix)) throw Error('Old rating role requires attention.')
        const updated = await member.roles.remove(oldId, 'Replace previous player rating band')
        if (updated.roles.cache.has(oldId)) throw Error('Old rating role removal could not be verified.')
      }
    } catch { report.failed.push({ source, member: member.displayName, reason: 'Discord role update failed' }) }
  }
  return report
}

export const RATINGS_COMMAND = { name: 'ratings', description: 'Manage Portal ELO and Infinity the Meta rating roles', dmPermission: false,
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(), options: [
    { name: 'status', description: 'Download sync results and unmatched players', type: Type.Subcommand },
    { name: 'sync', description: 'Refresh ratings and Discord roles now', type: Type.Subcommand },
    { name: 'link', description: 'Confirm a Portal player and optional Meta profile for an account', type: Type.Subcommand, options: [
      { name: 'account', description: 'The Discord member', type: Type.User, required: true },
      { name: 'player', description: 'Exact Portal player name', type: Type.String, required: true },
      { name: 'meta_id', description: 'Infinity the Meta profile person ID (pin:...)', type: Type.String },
    ] },
  ] }

export const ELO_COMMAND = { name: 'elo', description: 'See your Portal ELO, Meta rating, and the leaderboard', dmPermission: false,
  options: [{ name: 'player', description: 'Look up another server member', type: Type.User, required: false }] }

export function eloCommandReply({ projection, portalPlayer, metaPlayer, name }) {
  const portal = projection?.leaderboard.find(p => ratingKey(p.player) === ratingKey(portalPlayer))
  const safeName = String(name || 'Player').replace(/[\r\n<>@`*_]/g, ' ').slice(0,80)
  const lines = [`**${safeName} — player ratings**`]
  lines.push(portal ? `Portal ELO: **${portal.elo}** · #${portal.rank} · ${portal.games} games · ${portal.provisional ? 'Provisional' : 'Established'}`
    : portalPlayer ? 'Portal ELO: **Unrated** — no completed Portal games yet.' : 'Portal ELO: no confirmed Portal account match. Ask Lobo to link your account.')
  lines.push(metaPlayer ? `Infinity the Meta: **${Math.round(metaPlayer.rating)}** (Glicko-2)` : 'Infinity the Meta: no unique profile match is available yet.')
  if (projection?.leaderboard.length) lines.push('', '**Portal top five**', ...projection.leaderboard.slice(0,5).map(p => `${p.rank}. ${String(p.displayName || p.player).replace(/[\r\n<>@`*_]/g,' ').slice(0,80)} — **${p.elo}**${p.provisional ? ' · provisional' : ''}`))
  lines.push('', 'Rating-band roles appear on member profiles. Portal and Meta ratings are separate.')
  return { content: lines.join('\n'), allowedMentions: { parse: [], repliedUser: false }, components: [{ type: 1, components: [{ type: 2, style: 5, label: 'Open the ELO leaderboard', url: 'https://lobo-infinity-portal.vercel.app/elo' }] }] }
}

export function createPlayerRatings({ store = createTop40Store(join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data','player-ratings.json')),
  linkedPlayers = async () => [], campaignGames = async () => [], loadSnapshot = loadRatingSnapshot, loadMeta = loadMetaRatings, logger = console } = {}) {
  let guild, running, timer, projection, report = { status: 'starting' }, meta, metaAt = 0, dataIssue = true, linking = false
  let portalAccounts = new Map(), metaAccounts = new Map()
  async function tick() {
    if (running) return running
    if (linking) return
    let published = false
    running = (async () => {
      const state = await store.read(), snapshot = await loadSnapshot()
      const confirmed = await linkedPlayers()
      const links = { ...Object.fromEntries(confirmed.map(p => [ratingKey(p.playerName || p.name), { userId: p.userId }])), ...state.links }
      const canonical = new Map(Object.entries(links).map(([name, p]) => [p.userId, snapshot.players.find(v => ratingKey(v.player) === name)?.player]))
      const campaign = (await campaignGames()).map(g => ({ ...g, playerA: { ...g.playerA, name: canonical.get(g.playerA.id) || g.playerA.name }, playerB: { ...g.playerB, name: canonical.get(g.playerB.id) || g.playerB.name } }))
      const elo = calculatePortalElo([...snapshot.games, ...campaignEloGames(campaign, snapshot.players)])
      const names = new Map(snapshot.players.map(p => [ratingKey(p.player), p.displayName]))
      elo.leaderboard.forEach(p => { p.displayName = names.get(ratingKey(p.player)) || p.displayName })
      projection = { ...elo, snapshotId: snapshot.snapshotId, sourceCutoff: snapshot.sourceCutoff, generatedAt: new Date().toISOString() }
      dataIssue = false
      published = true
      const members = await listRatingMembers(guild)
      const roster = [...snapshot.players, ...elo.leaderboard.filter(p => !snapshot.players.some(v => ratingKey(v.player) === ratingKey(p.player)))]
      const matched = matchRatingMembers(members, roster, links)
      portalAccounts = new Map([...matched.matches].map(([player, member]) => [member.id, player]))
      const assignments = elo.leaderboard.flatMap(p => { const member = matched.matches.get(ratingKey(p.player)); return member ? [{ member, source: 'portal', rating: p.rating }] : [] })
      const rated = new Set(elo.leaderboard.map(p => ratingKey(p.player)))
      for (const [name, member] of matched.matches) if (!rated.has(name)) assignments.push({ member, source: 'portal', rating: null })
      let metaIssue = ''
      if (!meta || Date.now() - metaAt > 3600000) {
        try { meta = await loadMeta(); metaAt = Date.now() }
        catch { metaIssue = 'Infinity the Meta import failed; existing Meta roles were preserved.' }
      }
      const metaUnmatched = []
      const metaCandidates = []
      if (meta && !metaIssue) for (const member of members) {
        const explicit = Object.values(state.links).find(p => p.userId === member.id)?.metaId
        const portalNames = [...matched.matches].filter(([, m]) => m.id === member.id).map(([name]) => name)
        const aliases = new Set([member.user.username, member.user.globalName, member.displayName, ...portalNames].filter(Boolean).map(ratingKey))
        const found = meta.rows.filter(p => explicit ? p.person_id === explicit : aliases.has(ratingKey(p.name)))
        if (found.length === 1) metaCandidates.push({ member, source: 'meta', rating: found[0].rating, personId: found[0].person_id })
        else metaUnmatched.push({ member: member.displayName, reason: found.length ? 'Ambiguous Meta profile' : 'No Meta profile match' })
      }
      for (const candidate of metaCandidates) {
        if (metaCandidates.filter(p => p.personId === candidate.personId).length === 1) assignments.push(candidate)
        else metaUnmatched.push({ member: candidate.member.displayName, reason: 'Meta profile matches multiple Discord accounts' })
      }
      if (meta && !metaIssue) metaAccounts = new Map(metaCandidates.filter(candidate => metaCandidates.filter(p => p.personId === candidate.personId).length === 1).map(candidate => [candidate.member.id, {rating:candidate.rating}]))
      const sync = await syncRatingRoles(guild, assignments, state, s => store.write(s))
      report = { status: metaIssue || sync.failed.length ? 'attention' : 'current', snapshotId: snapshot.snapshotId, updatedAt: projection.generatedAt,
        portalPlayers: elo.leaderboard.length, portalGames: elo.gameCount, portalMatched: matched.matches.size,
        metaMatched: assignments.filter(a => a.source === 'meta').length, metaCutoff: meta?.run.closed_week_cutoff,
        metaIssue, portalUnmatched: matched.unresolved, metaUnmatched, ...sync }
      logger.info?.(`Player rating sync: ${JSON.stringify({ status: report.status, portalGames: report.portalGames, portalMatched: report.portalMatched, metaMatched: report.metaMatched, failed: sync.failed.length })}`)
    })().catch(error => { if (!published) dataIssue = true; report = { ...report, status: dataIssue ? 'unavailable' : 'attention', issue: error.message }; logger.error?.(`Player rating sync: ${error.message}`) }).finally(() => { running = null })
    return running
  }
  return { tick, summary: () => report,
    publicSummary: () => Object.fromEntries(['status','updatedAt','snapshotId','portalPlayers','portalGames','portalMatched','metaMatched','metaCutoff'].map(key => [key, report[key]])),
    publicProjection: () => { if (!projection || dataIssue) throw Error('Player ratings are temporarily unavailable.'); return projection },
    async start(client) {
      guild = client.guilds.cache.get(AURORA_DISCORD_GUILD_ID)
      if (!guild) throw Error('Lobo Discord is not connected.')
      const commands = await guild.commands.fetch(), existing = commands.find(c => c.name === 'ratings')
      if (existing) await existing.edit(RATINGS_COMMAND); else await guild.commands.create(RATINGS_COMMAND)
      const elo = commands.find(c => c.name === 'elo')
      if (elo) await elo.edit({ ...ELO_COMMAND, defaultMemberPermissions: null }); else await guild.commands.create(ELO_COMMAND)
      void tick(); timer = setInterval(() => void tick(), 60000); timer.unref()
    },
    stop() { clearInterval(timer) },
    async handler(interaction) {
      if (interaction.isChatInputCommand?.() && interaction.commandName === 'elo') {
        if (interaction.guildId !== AURORA_DISCORD_GUILD_ID) { await interaction.reply({content:'Use /elo in the Lobo server.',ephemeral:true}); return true }
        await interaction.deferReply({ephemeral:true})
        if (!projection || dataIssue) { await interaction.editReply({content:'Ratings are starting or temporarily unavailable. Try again shortly.'}); return true }
        const account = interaction.options.getUser('player') || interaction.user
        const member = interaction.options.getMember?.('player') || (account.id === interaction.user.id ? interaction.member : null)
        const reply = eloCommandReply({projection,portalPlayer:portalAccounts.get(account.id),metaPlayer:metaAccounts.get(account.id),name:member?.displayName || account.globalName || account.username})
        await interaction.editReply(reply)
        return true
      }
      if (!interaction.isChatInputCommand?.() || interaction.commandName !== 'ratings') return false
      if (interaction.guildId !== AURORA_DISCORD_GUILD_ID || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) { await interaction.reply({ content: 'Manage Server is required.', ephemeral: true }); return true }
      await interaction.deferReply({ ephemeral: true })
      try {
        const action = interaction.options.getSubcommand()
        if (action === 'link') {
          linking = true
          // Serialize links with the sync so a background write cannot overwrite them.
          if (running) await running
          const account = interaction.options.getUser('account', true), player = interaction.options.getString('player', true).trim()
          const snapshot = await loadSnapshot(), p = snapshot.players.find(p => ratingKey(p.player) === ratingKey(player))
          if (!p || account.bot || !validId(account.id)) throw Error('Choose a Portal player and a human Discord member.')
          await guild.members.fetch(account.id)
          const metaId = interaction.options.getString('meta_id')?.trim()
          if (metaId && !meta?.rows.some(p => p.person_id === metaId)) throw Error('Choose a profile ID from the imported Infinity the Meta directory.')
          const state = await store.read()
          if (Object.entries(state.links).some(([key, link]) => key !== ratingKey(p.player) && link.userId === account.id)) throw Error('That Discord account is linked to another Portal player.')
          state.links[ratingKey(p.player)] = { userId: account.id, playerName: p.player, ...(metaId ? { metaId } : {}), confirmedAt: new Date().toISOString() }
          await store.write(state)
          linking = false
        }
        if (action !== 'status') await tick()
        await interaction.editReply({ content: `Ratings: ${report.status}. Portal ${report.portalMatched || 0} matched; Meta ${report.metaMatched || 0} matched.`, files: [{ attachment: Buffer.from(JSON.stringify(report, null, 2)), name: 'rating-sync-report.json' }] })
      } catch (error) { await interaction.editReply({ content: error.message }) }
      finally { linking = false }
      return true
    },
  }
}
