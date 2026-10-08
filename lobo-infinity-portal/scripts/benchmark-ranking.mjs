// Compare exact benchmark profiles; faction aliases count once globally.
export function addBenchmarkRanks(ratings) {
  const global = new Map(), factions = new Map()
  for (const [key, states] of Object.entries(ratings)) {
    const parts = key.split(':')
    if (parts.length !== 5) continue
    for (const [state, value] of Object.entries(states)) {
      if (!Number.isFinite(value.rating)) continue
      const pool = global.get(state) || new Map()
      const identity = parts.slice(1).join(':')
      pool.set(identity, Math.max(pool.get(identity) ?? -Infinity, value.rating))
      global.set(state, pool)
      const factionKey = `${parts[0]}:${state}`
      const local = factions.get(factionKey) || new Map()
      local.set(key, value.rating)
      factions.set(factionKey, local)
    }
  }
  const pools = new Map([...global].map(([key, values]) => [key, [...values.values()].sort((a,b)=>b-a)]))
  const localPools = new Map([...factions].map(([key, values]) => [key, [...values.values()].sort((a,b)=>b-a)]))
  const rank = (pool, score) => {
    let low = 0, high = pool.length
    while (low < high) { const mid = (low + high) >>> 1; if (pool[mid] > score) low = mid + 1; else high = mid }
    return low + 1
  }
  return Object.fromEntries(Object.entries(ratings).map(([key, states]) => [key, Object.fromEntries(Object.entries(states).map(([state, value]) => {
    const all = pools.get(state), local = localPools.get(`${key.split(':')[0]}:${state}`)
    return [state, all && local && Number.isFinite(value.rating) ? {...value, globalRank:rank(all,value.rating), globalTotal:all.length, factionRank:rank(local,value.rating), factionTotal:local.length} : value]
  }))]))
}
