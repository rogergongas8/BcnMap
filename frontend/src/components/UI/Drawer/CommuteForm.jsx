import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '../icons'
import { geocodeSearch } from '../../../utils/geocode'

const MODES = [
  { id: 'foot',   Icon: Icons.walking, color: '#a78bfa' },
  { id: 'bicing', Icon: Icons.bike,    color: '#00ff88' },
  { id: 'bus',    Icon: Icons.bus,     color: '#00b4ff' },
  { id: 'metro',  Icon: Icons.metro,   color: '#ff6b35' },
  { id: 'car',    Icon: Icons.car,     color: '#ffaa00' },
]

function LocationInput({ label, value, onChange, placeholder }) {
  const [query, setQuery]       = useState(value?.label ?? '')
  const [suggestions, setSugg]  = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(debounceRef.current)
    if (q.length < 3) { setSugg([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await geocodeSearch(q)
        setSugg(results.slice(0, 4))
      } catch { setSugg([]) }
      setSearching(false)
    }, 350)
  }

  const select = (r) => {
    setQuery(r.label)
    setSugg([])
    onChange({ label: r.label, lat: r.lat, lng: r.lng })
  }

  return (
    <div className="relative">
      <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>{label}</label>
      <div className="relative">
        <input
          value={query}
          onChange={handleInput}
          placeholder={placeholder}
          className="w-full px-3 py-2 font-mono text-[11px] rounded outline-none"
          style={{ background: '#1C1A17', border: '1px solid #2C2926', color: '#F7F6F4' }}
          onFocus={e => { e.currentTarget.style.borderColor = '#B8885A' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#2C2926' }}
        />
        {searching && (
          <span className="absolute right-2.5 top-2.5 w-3 h-3 rounded-full border border-[#B8885A] border-t-transparent animate-spin" />
        )}
      </div>
      {suggestions.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 rounded overflow-hidden"
          style={{ background: '#1C1A17', border: '1px solid #2C2926' }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => select(s)}
              className="px-3 py-2 font-mono text-[11px] cursor-pointer transition-colors"
              style={{ color: '#F7F6F4', borderBottom: i < suggestions.length - 1 ? '1px solid #2C2926' : 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#252320' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CommuteForm({ initial, onSubmit, onCancel }) {
  const { t } = useTranslation()
  const [name,        setName]        = useState(initial?.name ?? '')
  const [mode,        setMode]        = useState(initial?.mode ?? 'bus')
  const [origin,      setOrigin]      = useState(
    initial ? { label: initial.origin_label, lat: initial.origin_lat, lng: initial.origin_lng } : null
  )
  const [dest,        setDest]        = useState(
    initial ? { label: initial.dest_label, lat: initial.dest_lat, lng: initial.dest_lng } : null
  )
  const [days,        setDays]        = useState(initial?.days_of_week ?? [1, 2, 3, 4, 5])
  const [arrivalTime, setArrivalTime] = useState(initial?.arrival_time?.slice(0, 5) ?? '09:00')
  const [alertMins,   setAlertMins]   = useState(initial?.alert_minutes_before ?? 20)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  const daysShort = t('drawer.commuteForm.daysShort', { returnObjects: true })

  const toggleDay = (n) => {
    setDays(prev => prev.includes(n) ? prev.filter(d => d !== n) : [...prev, n])
  }

  const handleSubmit = async () => {
    if (!name.trim())  return setError(t('drawer.commuteForm.errorName'))
    if (!origin)       return setError(t('drawer.commuteForm.errorOrigin'))
    if (!dest)         return setError(t('drawer.commuteForm.errorDest'))
    if (!days.length)  return setError(t('drawer.commuteForm.errorDays'))

    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        name:                 name.trim(),
        mode,
        origin_label:         origin.label,
        origin_lat:           origin.lat,
        origin_lng:           origin.lng,
        dest_label:           dest.label,
        dest_lat:             dest.lat,
        dest_lng:             dest.lng,
        days_of_week:         days,
        arrival_time:         arrivalTime,
        alert_minutes_before: alertMins,
      })
    } catch (e) {
      setError(e.response?.data?.message ?? t('drawer.commuteForm.errorSave'))
      setSaving(false)
    }
  }

  const selectedMode = MODES.find(m => m.id === mode)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 py-4">

        {/* Name */}
        <div>
          <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>{t('drawer.commuteForm.name')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('drawer.commuteForm.namePlaceholder')}
            className="w-full px-3 py-2 font-mono text-[11px] rounded outline-none"
            style={{ background: '#1C1A17', border: '1px solid #2C2926', color: '#F7F6F4' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#B8885A' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#2C2926' }}
          />
        </div>

        {/* Origin / Destination */}
        <LocationInput label={t('drawer.commuteForm.origin')} value={origin} onChange={setOrigin} placeholder={t('drawer.commuteForm.addressPlaceholder')} />
        <LocationInput label={t('drawer.commuteForm.dest')} value={dest} onChange={setDest} placeholder={t('drawer.commuteForm.addressPlaceholder')} />

        {/* Mode */}
        <div>
          <label className="block font-mono text-[10px] mb-1.5" style={{ color: '#8C8884' }}>{t('drawer.commuteForm.transport')}</label>
          <div className="flex gap-1.5">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded transition-colors"
                style={{
                  background: mode === m.id ? m.color + '18' : '#1C1A17',
                  border: `1px solid ${mode === m.id ? m.color + '55' : '#2C2926'}`,
                  color: mode === m.id ? m.color : '#8C8884',
                }}
              >
                <m.Icon size={12} />
                <span className="font-mono text-[8px]">{t(`modes.${m.id}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Days */}
        <div>
          <label className="block font-mono text-[10px] mb-1.5" style={{ color: '#8C8884' }}>{t('drawer.commuteForm.days')}</label>
          <div className="flex gap-1">
            {daysShort.map((dayLabel, i) => {
              const n = i + 1
              return (
                <button
                  key={n}
                  onClick={() => toggleDay(n)}
                  className="flex-1 py-1.5 rounded font-mono text-[9px] font-medium transition-colors"
                  style={{
                    background: days.includes(n) ? selectedMode.color + '18' : '#1C1A17',
                    border: `1px solid ${days.includes(n) ? selectedMode.color + '55' : '#2C2926'}`,
                    color: days.includes(n) ? selectedMode.color : '#8C8884',
                  }}
                >
                  {dayLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Arrival time */}
        <div>
          <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>{t('drawer.commuteForm.arrivalTime')}</label>
          <input
            type="time"
            value={arrivalTime}
            onChange={e => setArrivalTime(e.target.value)}
            className="w-full px-3 py-2 font-mono text-[11px] rounded outline-none"
            style={{ background: '#1C1A17', border: '1px solid #2C2926', color: '#F7F6F4' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#B8885A' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#2C2926' }}
          />
        </div>

        {/* Alert */}
        <div>
          <label className="block font-mono text-[10px] mb-1" style={{ color: '#8C8884' }}>
            {t('drawer.commuteForm.alertBefore', { n: alertMins })}
          </label>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={alertMins}
            onChange={e => setAlertMins(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: selectedMode.color }}
          />
          <div className="flex justify-between font-mono text-[9px] mt-0.5" style={{ color: '#5C5A56' }}>
            <span>5 min</span><span>60 min</span>
          </div>
        </div>

        {error && (
          <p className="font-mono text-[10px] px-3 py-2 rounded" style={{ background: '#D4555522', color: '#D45555', border: '1px solid #D4555544' }}>
            {error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2 px-4 pb-4 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded font-syne text-[12px] transition-colors"
          style={{ background: '#1C1A17', color: '#8C8884', border: '1px solid #2C2926' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#252320' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1C1A17' }}
        >
          {t('misc.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2 rounded font-syne text-[12px] font-medium transition-colors"
          style={{ background: saving ? '#B8885A44' : '#B8885A22', color: '#B8885A', border: '1px solid #B8885A44' }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#B8885A33' }}
          onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#B8885A22' }}
        >
          {saving ? t('drawer.commuteForm.saving') : initial ? t('drawer.commuteForm.saveChanges') : t('drawer.commuteForm.create')}
        </button>
      </div>
    </div>
  )
}
