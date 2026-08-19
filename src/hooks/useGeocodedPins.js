// Drives @/lib/geocode for a map layer: paints cached pins immediately, then
// crawls whatever is still unresolved at Nominatim's one-per-second limit,
// updating pins as it goes.
//
// Every map in the app used to hand-roll this effect. They disagreed on the
// rate-limit delay, on whether a stale pin set survived a location change, and
// on how a cache clear re-triggered the crawl. One implementation now.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  buildPins, geocodeLocation, sleep, RATE_LIMIT_MS,
  loadLocalCache, saveLocalCache, clearLocalCache,
  loadRemoteCache, saveRemoteCache,
} from '@/lib/geocode'

// Flush the shared cache this often during a crawl, so closing the tab
// part-way through doesn't throw away the work already paid for.
const REMOTE_FLUSH_EVERY = 10

/**
 * @param locMap   { [location: string]: item[] } — caller groups its own records
 * @param lsKey    localStorage key for this layer's cache
 * @param remoteDoc  geocache/{docId} to share across devices, or null for local-only
 * @returns { pins, geocoding, progress, clearCache }
 *          pins: [{ lat, lng, items }]
 */
export function useGeocodedPins(locMap, { lsKey, remoteDoc = null } = {}) {
  const [pins, setPins] = useState([])
  const [geocoding, setGeocoding] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [reloadToken, setReloadToken] = useState(0)

  // Only the SET of location strings should restart a crawl. Depending on
  // locMap itself would restart on every snapshot that touches a record's
  // unrelated fields, and a restart costs one second per location.
  const locKeys = useMemo(() => Object.keys(locMap).sort().join('|'), [locMap])

  // Keeps the grouped items reachable inside the effect without making them a
  // dependency, so pin contents stay fresh while the crawl keeps running.
  const locMapRef = useRef(locMap)
  useEffect(() => { locMapRef.current = locMap }, [locMap])

  // A crawl spans many awaits. Bump the generation to abandon the old one —
  // this also covers StrictMode's double-invoked effects in development.
  const runIdRef = useRef(0)

  useEffect(() => {
    const runId = ++runIdRef.current
    const stale = () => runIdRef.current !== runId

    if (!locKeys) {
      setPins([])
      return
    }

    const current = locMapRef.current

    async function crawl() {
      // 1. localStorage is synchronous, so known pins land on the first paint.
      const local = loadLocalCache(lsKey)
      let cache = { ...local }
      setPins(buildPins(current, cache))

      // 2. The shared cache may hold entries geocoded on another device.
      //    Local wins on conflict — it is the more recently written of the two.
      if (remoteDoc) {
        const remote = await loadRemoteCache(remoteDoc)
        if (stale()) return
        cache = { ...remote, ...local }
        saveLocalCache(lsKey, cache)
        setPins(buildPins(current, cache))
      }

      // A cached null means "asked, no result" — don't ask again.
      const missing = Object.keys(current).filter((loc) => !(loc in cache))
      if (!missing.length) return

      setGeocoding(true)
      setProgress({ done: 0, total: missing.length })

      try {
        for (let i = 0; i < missing.length; i++) {
          if (stale()) return
          const loc = missing[i]
          try {
            cache[loc] = (await geocodeLocation(loc)) ?? null
          } catch {
            cache[loc] = null
          }
          if (stale()) return

          saveLocalCache(lsKey, cache)
          setProgress({ done: i + 1, total: missing.length })
          setPins(buildPins(current, cache))

          const last = i === missing.length - 1
          if (remoteDoc && ((i + 1) % REMOTE_FLUSH_EVERY === 0 || last)) {
            saveRemoteCache(remoteDoc, cache) // fire-and-forget
          }
          if (!last) await sleep(RATE_LIMIT_MS)
        }
      } finally {
        if (!stale()) setGeocoding(false)
      }
    }

    crawl()

    // Abandon this crawl; the next effect run starts its own. Written from the
    // captured runId rather than read-and-incremented, so the cleanup doesn't
    // depend on what the ref holds by the time it runs.
    return () => { runIdRef.current = runId + 1 }
  }, [locKeys, lsKey, remoteDoc, reloadToken])

  const clearCache = useCallback(() => {
    clearLocalCache(lsKey)
    if (remoteDoc) saveRemoteCache(remoteDoc, {})
    setPins([])
    setReloadToken((t) => t + 1) // re-runs the effect, which re-crawls from empty
  }, [lsKey, remoteDoc])

  return { pins, geocoding, progress, clearCache }
}
