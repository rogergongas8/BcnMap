import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useContextMenuStore } from '../../store/contextMenuStore'
import { useChatStore } from '../../store/chatStore'
import { useRouteStore } from '../../store/routeStore'
import { useMapStore } from '../../store/mapStore'
import { Icons } from '../UI/icons'

export default function MapContextMenu() {
  const { isOpen, x, y, lng, lat, closeMenu } = useContextMenuStore()
  const openChatWithPrompt = useChatStore(s => s.openChatWithPrompt)
  const setChatRequest = useRouteStore(s => s.setChatRequest)
  const userLocation = useMapStore(s => s.userLocation)
  const flyTo = useMapStore(s => s.flyTo)

  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu()
    }
    const handleScroll = () => closeMenu()
    
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('wheel', handleScroll)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('wheel', handleScroll)
    }
  }, [isOpen, closeMenu])

  if (!isOpen) return null

  // Ensure menu stays within screen bounds (assuming menu is roughly 220px wide, 140px tall)
  const menuWidth = 220
  const menuHeight = 140
  const winW = window.innerWidth
  const winH = window.innerHeight

  const safeX = x + menuWidth > winW ? x - menuWidth : x
  const safeY = y + menuHeight > winH ? y - menuHeight : y

  const handleRouteTo = () => {
    closeMenu()
    flyTo({ lat, lng, zoom: 16 })
    const dest = { lat, lng, label: 'Ubicación seleccionada' }
    if (userLocation) {
      setChatRequest({ origin: { lat: userLocation.lat, lng: userLocation.lng, label: 'La meva ubicació' }, destination: dest, mode: 'foot' })
    } else {
      setChatRequest({ origin: null, destination: dest, mode: 'foot' })
    }
  }

  const handleRouteFrom = () => {
    closeMenu()
    flyTo({ lat, lng, zoom: 16 })
    const origin = { lat, lng, label: 'Ubicación seleccionada' }
    setChatRequest({ origin, destination: null, mode: 'foot' })
  }

  const handleAskAI = () => {
    closeMenu()
    flyTo({ lat, lng, zoom: 16 })
    openChatWithPrompt(`Dime qué hay interesante alrededor de las coordenadas ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }

  const handleCoffee = () => {
    closeMenu()
    flyTo({ lat, lng, zoom: 16 })
    openChatWithPrompt(`Busca cafeterías a menos de 500m de ${lat.toFixed(5)}, ${lng.toFixed(5)} y muéstramelas en el mapa.`)
  }

  const BTN_STYLE = "w-full flex items-center gap-2.5 px-3 py-2.5 text-left font-syne text-[11px] transition-colors hover:bg-[#2C2926]"

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="absolute z-[70] flex flex-col overflow-hidden"
        style={{
          top: safeY,
          left: safeX,
          width: menuWidth,
          background: '#151210',
          border: '1px solid #2C2926',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          color: '#F7F6F4'
        }}
      >
        <div className="px-3 py-2" style={{ borderBottom: '1px solid #201E1B', background: '#0e0e0e' }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: '#8C8884' }}>Acciones rápidas</p>
        </div>
        
        <button onClick={handleRouteTo} className={BTN_STYLE} style={{ borderBottom: '1px solid #201E1B' }}>
          <Icons.navigation size={12} style={{ color: '#B8885A' }} />
          Trazar ruta hasta aquí
        </button>
        
        <button onClick={handleRouteFrom} className={BTN_STYLE} style={{ borderBottom: '1px solid #201E1B' }}>
          <Icons.pin size={12} style={{ color: '#8C8884' }} />
          Trazar ruta desde aquí
        </button>

        <button onClick={handleAskAI} className={BTN_STYLE} style={{ borderBottom: '1px solid #201E1B' }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#3CB887' }}>
            <path d="M8 1.5C4.41 1.5 1.5 4.02 1.5 7.12c0 1.64.73 3.11 1.9 4.14L3 14.5l3.88-1.94c.35.07.72.1 1.12.1 3.59 0 6.5-2.52 6.5-5.54S11.59 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          </svg>
          Preguntar a la IA
        </button>

        <button onClick={handleCoffee} className={BTN_STYLE}>
          <Icons.cafe size={12} style={{ color: '#C98E2E' }} />
          Buscar cafeterías a 500m
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
