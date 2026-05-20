import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDrawerStore } from '../../../store/drawerStore'
import { useMapStore } from '../../../store/mapStore'
import { Icons } from '../icons'
import NearbyView from './NearbyView'
import PlaceView from './PlaceView'

// Drawer is 340px wide, starts at left-[68px] — pad map so content stays visible
const DRAWER_PADDING = { left: 420, top: 0, right: 0, bottom: 0 }
const NO_PADDING     = { left: 0,   top: 0, right: 0, bottom: 0 }

export default function SideDrawer() {
  const { view, close } = useDrawerStore()
  const setMapPadding   = useMapStore(s => s.setMapPadding)

  useEffect(() => {
    setMapPadding(view ? DRAWER_PADDING : NO_PADDING)
  }, [view, setMapPadding])

  const title = view === 'nearby' ? 'Qué hay cerca' : null

  return (
    <AnimatePresence>
      {view && (
        <motion.aside
          key="side-drawer"
          initial={{ x: -360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -360, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          className="absolute top-4 left-[68px] z-30 w-[340px]
            flex flex-col rounded-2xl overflow-hidden
            bg-[#0a0c10]/95 backdrop-blur-2xl border border-white/[0.07]
            shadow-[0_0_60px_rgba(0,0,0,0.5)]"
          style={{ maxHeight: 'calc(100vh - 32px)' }}
        >
          {view === 'nearby' && (
            <header className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.05] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-white/55"><Icons.search size={14} /></span>
                <h2 className="text-white text-[13px] font-medium tracking-wide">{title}</h2>
              </div>
              <button
                onClick={close}
                className="text-white/35 hover:text-white/85 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05]"
                aria-label="Cerrar"
              >
                <Icons.close size={14} />
              </button>
            </header>
          )}

          {view === 'nearby' && <NearbyView />}
          {view === 'place'  && <PlaceView />}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
