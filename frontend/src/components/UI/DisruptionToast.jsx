import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from './icons'
import { useDataStore } from '../../store/dataStore'
import { useDrawerStore } from '../../store/drawerStore'

export default function DisruptionToast() {
  const disruptions     = useDataStore(s => s.disruptions)
  const openDisruptions = useDrawerStore(s => s.openDisruptions)
  const prevCountRef    = useRef(null)
  const [visible, setVisible]       = useState(false)
  const [newCount, setNewCount]     = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    // Skip first load (prevCountRef is null before first data arrives)
    if (prevCountRef.current === null) {
      prevCountRef.current = disruptions.length
      return
    }

    const prev = prevCountRef.current
    const curr = disruptions.length
    prevCountRef.current = curr

    // Show toast only when disruptions increase
    if (curr > prev) {
      setNewCount(curr - prev)
      setVisible(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), 5000)
    }
  }, [disruptions])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleClick = () => {
    setVisible(false)
    openDisruptions()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          className="absolute top-[72px] left-1/2 z-50 -translate-x-1/2"
        >
          <button
            onClick={handleClick}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
              shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-opacity hover:opacity-90"
            style={{
              background: '#1C1C1C',
              border: '1px solid #D4555555',
              borderColor: '#D45555',
            }}
          >
            <span className="flex-shrink-0" style={{ color: '#D45555' }}>
              <Icons.alert size={13} />
            </span>
            <span className="font-syne text-[12px] font-medium" style={{ color: '#EBEBEB' }}>
              {newCount === 1
                ? 'Nova incidencia al metro'
                : `${newCount} noves incidencies al metro`}
            </span>
            <span className="font-mono text-[10px]" style={{ color: '#555' }}>Veure</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
