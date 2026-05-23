import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDrawerStore } from '../../../store/drawerStore'
import { Icons } from '../icons'
import NearbyView from './NearbyView'
import PlaceView from './PlaceView'
import SavedView from './SavedView'
import EventsView from './EventsView'

// Drawer padding — top: 56 always to account for TopBar height
// right/left managed centrally in App.jsx; this component no longer calls setMapPadding directly

export default function SideDrawer() {
  const { view, close } = useDrawerStore()

  const title = view === 'nearby' ? 'A prop' : view === 'saved' ? 'Guardats' : view === 'events' ? 'Esdeveniments' : null

  return (
    <AnimatePresence>
      {view && (
        <motion.aside
          key="side-drawer"
          initial={{ x: -360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -360, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          className="absolute top-14 left-[60px] z-30 w-[340px]
            flex flex-col overflow-hidden
            shadow-[0_4px_32px_rgba(0,0,0,0.5)]"
          style={{ maxHeight: 'calc(100vh - 56px)', background: '#141414', border: '1px solid #262626', borderRadius: 8 }}
        >
          {(view === 'nearby' || view === 'saved' || view === 'events') && (
            <header className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #262626' }}>
              <div className="flex items-center gap-2.5">
                <span style={{ color: '#555' }}>
                  {view === 'nearby' ? <Icons.search size={13} /> : view === 'events' ? <Icons.calendar size={13} /> : <Icons.pin size={13} />}
                </span>
                <h2 className="font-syne text-[13px] font-medium" style={{ color: '#EBEBEB' }}>{title}</h2>
              </div>
              <button
                onClick={close}
                className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-[#1C1C1C]"
                style={{ color: '#555' }}
                aria-label="Cerrar"
              >
                <Icons.close size={13} />
              </button>
            </header>
          )}

          {view === 'nearby'  && <NearbyView />}
          {view === 'saved'   && <SavedView />}
          {view === 'events'  && <EventsView />}
          {view === 'place'   && <PlaceView />}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
