import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchCommutes, createCommute, updateCommute,
  deleteCommute, fetchCommuteStatus,
} from '../services/api'
import { useAuthStore } from '../store/authStore'

export function useCommutes() {
  const isLogged = useAuthStore(s => s.isLogged)
  const [commutes, setCommutes] = useState([])
  const [statuses, setStatuses] = useState({}) // { [id]: status }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(async () => {
    if (!isLogged) return
    setLoading(true)
    try {
      const data = await fetchCommutes()
      setCommutes(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isLogged])

  const refreshStatuses = useCallback(async (list) => {
    const today = new Date().getDay() // 0=Sun
    const isoDay = today === 0 ? 7 : today // ISO: 1=Mon, 7=Sun
    const todayCommutes = (list ?? commutes).filter(c =>
      c.is_active && c.days_of_week.includes(isoDay)
    )
    if (!todayCommutes.length) return

    const results = await Promise.allSettled(
      todayCommutes.map(c => fetchCommuteStatus(c.id).then(s => [c.id, s]))
    )
    const next = {}
    results.forEach(r => {
      if (r.status === 'fulfilled') next[r.value[0]] = r.value[1]
    })
    setStatuses(prev => ({ ...prev, ...next }))
  }, [commutes])

  useEffect(() => {
    if (!isLogged) { setCommutes([]); setStatuses({}); return }
    load()
  }, [isLogged])

  // Poll statuses every 60s when there are active today commutes
  useEffect(() => {
    clearInterval(pollRef.current)
    if (!commutes.length) return
    refreshStatuses(commutes)
    pollRef.current = setInterval(() => refreshStatuses(commutes), 60_000)
    return () => clearInterval(pollRef.current)
  }, [commutes])

  async function add(data) {
    const created = await createCommute(data)
    setCommutes(prev => [created, ...prev])
    return created
  }

  async function toggle(id) {
    const commute = commutes.find(c => c.id === id)
    if (!commute) return
    const updated = await updateCommute(id, { is_active: !commute.is_active })
    setCommutes(prev => prev.map(c => c.id === id ? updated : c))
  }

  async function remove(id) {
    await deleteCommute(id)
    setCommutes(prev => prev.filter(c => c.id !== id))
    setStatuses(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function save(id, data) {
    const updated = await updateCommute(id, data)
    setCommutes(prev => prev.map(c => c.id === id ? updated : c))
    return updated
  }

  return { commutes, statuses, loading, error, add, toggle, remove, save, reload: load }
}
