import { useEffect } from 'react'
import { useLeisureStore } from '../store/leisureStore'
import { fetchBeaches } from '../services/api'

const POLL_MS = 5 * 60 * 1000 // 5 min

export function useLeisureData() {
  const { showBeaches, setBeaches, setLoading } = useLeisureStore()

  useEffect(() => {
    if (!showBeaches) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetchBeaches()
        if (!cancelled) setBeaches(res?.data ?? [])
      } catch {
        if (!cancelled) setBeaches([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [showBeaches, setBeaches, setLoading])
}
