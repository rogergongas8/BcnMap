import React from 'react'
import { motion } from 'framer-motion'
import { useDataStore } from '../../store/dataStore'

export default function StatsPanel() {
  const traffic    = useDataStore(s => s.traffic)
  const bicing     = useDataStore(s => s.bicing)
  const lastUpdated = useDataStore(s => s.lastUpdated)

  const congested = traffic.filter(t => ['congestionado', 'cortado'].includes(t.estado)).length
  const pct = traffic.length ? Math.round((congested / traffic.length) * 100) : null

  const activeBicing = bicing.filter(s => s.status === 'active')
  const totalBikes   = activeBicing.reduce((a, s) => a + s.bikes_available, 0)

  const congColor = pct == null ? '#666' : pct < 15 ? '#27AE60' : pct < 35 ? '#E67E22' : '#C0392B'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 3.5, duration: 0.5 }}
      className="absolute top-4 left-4 panel-glass rounded-xl px-4 py-3 min-w-52"
    >
      <div className="text-white font-mono text-sm font-bold tracking-widest mb-1">
        BCN LIVE
      </div>
      <div className="text-white/40 text-xs font-mono mb-3">
        {lastUpdated
          ? lastUpdated.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' })
          : 'Connectant...'}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-white/50 text-xs">Trànsit</span>
          <span className="font-mono text-xs" style={{ color: congColor }}>
            {pct != null ? `${pct}% congestió` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/50 text-xs">Bicing</span>
          <span className="font-mono text-xs text-neon-blue">
            {totalBikes > 0 ? `${totalBikes} bicis` : '—'}
          </span>
        </div>
      </div>

      {pct != null && (
        <div className="mt-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#27AE60' }} />
          <span className="text-white/40 text-xs font-mono">EN VIVO</span>
        </div>
      )}
    </motion.div>
  )
}
