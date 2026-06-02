import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../icons'
import { useCommutes } from '../../../hooks/useCommutes'
import { useAuthStore } from '../../../store/authStore'
import CommuteForm from './CommuteForm'

const MODE_COLORS = {
  foot:   '#a78bfa',
  bicing: '#00ff88',
  bus:    '#00b4ff',
  metro:  '#ff6b35',
  car:    '#ffaa00',
}

const MODE_ICON = {
  foot:   Icons.walking,
  bicing: Icons.bike,
  bus:    Icons.bus,
  metro:  Icons.metro,
  car:    Icons.car,
}

function CommuteRow({ commute, status, onToggle, onDelete, onEdit, dayNames, modeLabel }) {
  const { t } = useTranslation()
  const color = MODE_COLORS[commute.mode] ?? '#B0ACA7'
  const ModeIcon = MODE_ICON[commute.mode] ?? Icons.route
  const isToday = status?.is_today ?? false

  return (
    <li
      className="flex group transition-colors"
      style={{ borderBottom: '1px solid #201E1B', opacity: commute.is_active ? 1 : 0.45 }}
    >
      <div className="w-[3px] flex-shrink-0 self-stretch" style={{ background: isToday && commute.is_active ? color : 'transparent' }} />
      <div className="flex flex-col gap-1 px-3.5 py-3 flex-1 min-w-0">

        {/* Top row: icon + name + actions */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: color + '18', color, border: `1px solid ${color}33` }}
          >
            <ModeIcon size={11} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-syne text-[13px] font-medium truncate" style={{ color: '#F7F6F4' }}>{commute.name}</p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(commute)}
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: '#8C8884' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#B8885A' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
            >
              <Icons.settings size={10} />
            </button>
            <button
              onClick={() => onDelete(commute.id)}
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: '#8C8884' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#D45555' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8C8884' }}
            >
              <Icons.close size={10} />
            </button>
          </div>

          {/* Toggle active */}
          <button
            onClick={() => onToggle(commute.id)}
            className="w-8 h-4 rounded-full flex-shrink-0 relative transition-colors"
            style={{ background: commute.is_active ? color + '55' : '#2C2926', border: `1px solid ${commute.is_active ? color : '#3C3A36'}` }}
            title={commute.is_active ? t('drawer.commuteView.deactivate') : t('drawer.commuteView.activate')}
          >
            <span
              className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
              style={{ background: commute.is_active ? color : '#8C8884', left: commute.is_active ? '13px' : '2px' }}
            />
          </button>
        </div>

        {/* Route labels */}
        <p className="font-mono text-[10px] truncate" style={{ color: '#8C8884', paddingLeft: '2rem' }}>
          {commute.origin_label} <span style={{ color: '#5C5A56' }}>→</span> {commute.dest_label}
        </p>

        {/* Days + arrival time */}
        <div className="flex items-center gap-1.5" style={{ paddingLeft: '2rem' }}>
          <div className="flex gap-0.5">
            {dayNames.map((d, i) => {
              const dayNum = i + 1
              const active = commute.days_of_week.includes(dayNum)
              return (
                <span
                  key={dayNum}
                  className="font-mono text-[8px] w-4 h-4 flex items-center justify-center rounded"
                  style={{
                    background: active ? color + '22' : 'transparent',
                    color: active ? color : '#4C4A46',
                    border: `1px solid ${active ? color + '44' : '#2C2926'}`,
                  }}
                >
                  {d}
                </span>
              )
            })}
          </div>
          <span className="font-mono text-[9px]" style={{ color: '#8C8884' }}>
            <Icons.clock size={8} style={{ display: 'inline', marginRight: 3 }} />
            {commute.arrival_time?.slice(0, 5)}
          </span>
        </div>

        {/* Live status — only shown for today's active commutes */}
        {isToday && commute.is_active && status && (
          <div
            className="flex items-start gap-2 mt-1 px-2 py-1.5 rounded"
            style={{ background: '#151210', border: `1px solid ${color}22` }}
          >
            {status.warning ? (
              <Icons.alert size={10} style={{ color: '#D45555', flexShrink: 0, marginTop: 1 }} />
            ) : (
              <Icons.check size={10} style={{ color: color, flexShrink: 0, marginTop: 1 }} />
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              {status.leave_by && (
                <p className="font-mono text-[11px] font-bold" style={{ color }}>
                  {t('drawer.commuteView.leaveBy', { time: status.leave_by })}
                </p>
              )}
              {status.next_departure && (
                <p className="font-mono text-[10px]" style={{ color: '#B0ACA7' }}>
                  {modeLabel} {status.next_departure} · {status.travel_minutes} min
                </p>
              )}
              {!status.next_departure && status.travel_minutes && (
                <p className="font-mono text-[10px]" style={{ color: '#B0ACA7' }}>
                  {t('drawer.commuteView.journeyMins', { n: status.travel_minutes })}
                </p>
              )}
              {status.warning && (
                <p className="font-mono text-[9px]" style={{ color: '#D45555' }}>{status.warning}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

export default function CommuteView() {
  const { t } = useTranslation()
  const isLogged = useAuthStore(s => s.isLogged)
  const { commutes, statuses, loading, add, toggle, remove, save } = useCommutes()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  const dayNames = t('drawer.commuteForm.daysShort', { returnObjects: true })

  if (!isLogged) {
    return (
      <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#211F1B', color: '#8C8884' }}>
          <Icons.route size={15} />
        </div>
        <p className="font-syne text-[13px] leading-snug max-w-[200px]" style={{ color: '#B0ACA7' }}>
          {t('drawer.commuteView.loginHint')}
        </p>
      </div>
    )
  }

  const handleEdit = (commute) => {
    setEditTarget(commute)
    setShowForm(true)
  }

  const handleFormSubmit = async (data) => {
    if (editTarget) {
      await save(editTarget.id, data)
    } else {
      await add(data)
    }
    setShowForm(false)
    setEditTarget(null)
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditTarget(null)
  }

  if (showForm) {
    return (
      <CommuteForm
        initial={editTarget}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
      />
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {loading && (
        <div className="px-6 py-12 flex justify-center gap-1.5">
          {[0, 140, 280].map(d => (
            <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#B8885A', animationDelay: `${d}ms` }} />
          ))}
        </div>
      )}

      {!loading && commutes.length === 0 && (
        <div className="px-6 py-12 flex flex-col items-center text-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#211F1B', color: '#8C8884' }}>
            <Icons.route size={15} />
          </div>
          <p className="font-syne text-[13px] leading-snug max-w-[220px]" style={{ color: '#B0ACA7' }}>
            {t('drawer.commuteView.empty')}
          </p>
        </div>
      )}

      {!loading && commutes.length > 0 && (
        <ul className="flex-1 overflow-y-auto min-h-0">
          {commutes.map(c => (
            <CommuteRow
              key={c.id}
              commute={c}
              status={statuses[c.id]}
              onToggle={toggle}
              onDelete={remove}
              onEdit={handleEdit}
              dayNames={dayNames}
              modeLabel={t(`modes.${c.mode}`)}
            />
          ))}
        </ul>
      )}

      <div className="flex-shrink-0 px-3.5 py-3" style={{ borderTop: '1px solid #201E1B' }}>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="w-full py-2 rounded font-syne text-[12px] font-medium transition-colors"
          style={{ background: '#B8885A22', color: '#B8885A', border: '1px solid #B8885A44' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#B8885A33' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#B8885A22' }}
        >
          {t('drawer.commuteView.add')}
        </button>
      </div>
    </div>
  )
}
