import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useDrawerStore } from '../../../store/drawerStore'
import { useRouteStore } from '../../../store/routeStore'
import { useChatStore } from '../../../store/chatStore'
import { Icons } from '../icons'
import NearbyView from './NearbyView'
import PlaceView from './PlaceView'
import SavedView from './SavedView'
import EventsView from './EventsView'
import DisruptionsView from './DisruptionsView'

const ICONS = {
  nearby:      Icons.search,
  events:      Icons.calendar,
  disruptions: Icons.alert,
  saved:       Icons.pin,
}

export default function SideDrawer() {
  const { view, close } = useDrawerStore()
  const dropdownOpen = useRouteStore(s => s.dropdownOpen)
  const chatOpen = useChatStore(s => s.isOpen)
  const { t } = useTranslation()

  const TITLES = {
    nearby:      t('topbar.nearby'),
    saved:       t('topbar.saved'),
    events:      t('topbar.events'),
    disruptions: t('topbar.disruptions'),
  }

  const isLimited = view === 'events' || view === 'disruptions'

  return (
    <AnimatePresence>
      {view && (
        <motion.aside
          key="side-drawer"
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: chatOpen ? -340 : 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
          className="absolute top-14 right-3 z-30 w-[340px] flex flex-col overflow-hidden shadow-[0_4px_32px_rgba(0,0,0,0.5)] pointer-events-auto"
          style={{
            maxHeight: isLimited ? 'min(580px, calc(100dvh - 80px))' : 'calc(100dvh - 56px)',
            background: '#151210', border: '1px solid #2C2926', borderRadius: 8,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14, ease: 'easeInOut' }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {view !== 'place' && (
                <header className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #2C2926' }}>
                  <div className="flex items-center gap-2.5">
                    {(() => { const Icon = ICONS[view] ?? Icons.pin; return <Icon size={13} style={{ color: view === 'disruptions' ? '#D45555' : '#8C8884' }} /> })()}
                    <h2 className="font-syne text-[13px] font-medium" style={{ color: '#F7F6F4' }}>{TITLES[view]}</h2>
                  </div>
                  <button
                    onClick={close}
                    className="w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-[#1C1C1C]"
                    style={{ color: '#8C8884' }}
                    aria-label="Cerrar"
                  >
                    <Icons.close size={13} />
                  </button>
                </header>
              )}

              {view === 'nearby'       && <NearbyView />}
              {view === 'saved'        && <SavedView />}
              {view === 'events'       && <EventsView />}
              {view === 'disruptions'  && <DisruptionsView />}
              {view === 'place'        && <PlaceView />}
            </motion.div>
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
