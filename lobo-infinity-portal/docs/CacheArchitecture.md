# Lobo Infinity Portal Cache Architecture

## Data Flow

```text
React
  -> Apps Script API
    -> Cache Manager
      -> fresh CacheService entry
      -> stale fallback CacheService entry
      -> Google Sheets only on cache miss or invalidation
```

## Strategy

- Public read endpoints use `getCachedApiResponse`.
- Cached entries are valid for five minutes.
- A stale copy is retained for up to six hours.
- If a rebuild fails, the API returns the most recent stale copy where available.
- Cache keys exclude auth tokens and cache-busting noise.
- The frontend also deduplicates in-flight GET requests and keeps a short in-memory response cache.

## Invalidation

Targeted invalidation removes affected cache groups without changing unrelated cache keys.

- Settings changes: `settings`, `home`
- Streams changes: `streams`, `home`
- News changes: `news`, `home`, `notifications`, `timeline`
- Army list changes: `armyLists`, `player`, `faction`, `searchData`, `home`
- Standings/stat rebuilds: all cache groups
- Season operations: all cache groups

## Cache Status

The Commissioner Dashboard reads cache metadata from the central manager:

- age
- time remaining
- last refresh
- size
- health
- cache hit and miss rate
- refresh count
- estimated Google Sheets reads
- slowest and fastest endpoint

## Performance Notes

Apps Script web apps still add roughly one second of platform overhead. The cache manager reduces the expensive Google Sheets and calculation portion of requests, especially for the homepage and intelligence endpoints.
