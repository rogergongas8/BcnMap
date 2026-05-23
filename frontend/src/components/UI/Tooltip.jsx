import React from 'react'

const C = {
  orange: '#E8622A',
  blue:   '#4D84D4',
  green:  '#3CB887',
  amber:  '#C98E2E',
  red:    '#D45555',
  purple: '#8B6AD4',
}

function Card({ accent, children }) {
  return (
    <div className="flex overflow-hidden pointer-events-none"
      style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, minWidth: 200, maxWidth: 260, boxShadow: '0 4px 24px rgba(0,0,0,0.6)' }}
    >
      <div className="w-[3px] flex-shrink-0" style={{ background: accent, borderRadius: '2px 0 0 2px' }} />
      <div className="flex-1 min-w-0 p-3">{children}</div>
    </div>
  )
}

function Label({ children }) {
  return <p className="font-mono text-[8px] uppercase tracking-[0.14em] mb-0.5" style={{ color: '#555' }}>{children}</p>
}

function MiniBar({ pct, color }) {
  return (
    <div className="h-[2px] w-full rounded-full mt-1" style={{ background: '#262626' }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  )
}

function ArrivalPill({ mins }) {
  const color = mins <= 1 ? C.green : mins <= 5 ? C.amber : '#888'
  return (
    <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
      {mins <= 0 ? 'ara' : `${mins}'`}
    </span>
  )
}

function BusTooltip({ object }) {
  const buses = object.buses ?? []
  return (
    <Card accent={C.orange}>
      <Label>Parada de bus</Label>
      <p className="font-syne text-[13px] font-medium truncate mb-2" style={{ color: '#EBEBEB' }}>{object.stop_name}</p>
      {object.address && (
        <p className="font-mono text-[10px] truncate mb-2" style={{ color: '#555' }}>{object.address}</p>
      )}
      {object.loading ? (
        <p className="font-mono text-[10px]" style={{ color: '#555' }}>Carregant...</p>
      ) : buses.length === 0 ? (
        <p className="font-mono text-[10px]" style={{ color: '#555' }}>Sense dades en temps real</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {buses.slice(0, 5).map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: C.orange, color: '#fff', minWidth: 26, textAlign: 'center' }}>
                {b.line}
              </span>
              <span className="font-mono text-[10px] truncate flex-1" style={{ color: '#888' }}>{b.dest}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {(b.arrivals ?? []).slice(0, 2).map((mins, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <span style={{ color: '#333' }}>·</span>}
                    <ArrivalPill mins={mins} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function MetroTooltip({ object }) {
  const lines  = object.lines  ?? []
  const trains = object.trains ?? []
  const primaryColor = lines[0]?.color ? `#${lines[0].color.replace(/^#/, '')}` : C.purple

  // Group API trains by line name for easy lookup
  const trainsByLine = {}
  for (const t of trains) {
    if (!trainsByLine[t.line]) trainsByLine[t.line] = []
    trainsByLine[t.line].push(t)
  }

  return (
    <Card accent={primaryColor}>
      {/* Station header */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {lines.map((l, i) => (
          <span key={i} className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: `#${l.color.replace(/^#/, '')}`, color: '#fff' }}>
            {l.name}
          </span>
        ))}
        <span className="font-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: '#555' }}>Operatiu</span>
      </div>
      <p className="font-syne text-[13px] font-medium truncate mb-2" style={{ color: '#EBEBEB' }}>{object.station_name}</p>

      {object.loading ? (
        <p className="font-mono text-[10px]" style={{ color: '#555' }}>Carregant...</p>
      ) : trains.length === 0 ? (
        <p className="font-mono text-[10px]" style={{ color: '#555' }}>Sense dades en temps real</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {lines.map((l, li) => {
            const lineColor = `#${l.color.replace(/^#/, '')}`
            const lineTrains = trainsByLine[l.name] ?? []
            return (
              <div key={li}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-[3px] h-3 rounded-full flex-shrink-0" style={{ background: lineColor }} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: lineColor }}>{l.name}</span>
                  <div className="flex-1 h-px" style={{ background: '#1A1A1A' }} />
                </div>
                {lineTrains.length === 0 ? (
                  <p className="font-mono text-[9px]" style={{ color: '#444' }}>Sense dades</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {lineTrains.slice(0, 2).map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-mono text-[10px] truncate flex-1" style={{ color: '#888' }}>{t.dest}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {(t.arrivals ?? []).slice(0, 2).map((mins, j) => (
                            <React.Fragment key={j}>
                              {j > 0 && <span style={{ color: '#333' }}>·</span>}
                              <ArrivalPill mins={mins} />
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function BicingTooltip({ object }) {
  const bikes  = object.bikes  ?? 0
  const ebikes = object.ebikes ?? 0
  const docks  = object.docks  ?? 0
  const total  = bikes + ebikes + docks
  const pct    = total > 0 ? Math.round(((bikes + ebikes) / total) * 100) : 0
  const isActive = object.status === 'active' || object.status == null

  return (
    <Card accent={isActive ? C.orange : '#555'}>
      <div className="flex items-center justify-between mb-1">
        <Label>Estació Bicing</Label>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
          style={{ background: isActive ? '#E8622A18' : '#1C1C1C', color: isActive ? C.orange : '#555', border: `1px solid ${isActive ? '#E8622A44' : '#262626'}` }}>
          {isActive ? 'Activa' : 'Inactiva'}
        </span>
      </div>
      <p className="font-syne text-[13px] font-medium truncate mb-2.5" style={{ color: '#EBEBEB' }}>{object.name}</p>
      <div className="flex gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] mb-0.5" style={{ color: '#555' }}>Mecàniques</p>
          <p className="font-mono text-[16px] font-semibold leading-none" style={{ color: C.orange }}>{bikes}</p>
        </div>
        {ebikes > 0 && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] mb-0.5" style={{ color: '#555' }}>Elèctriques</p>
            <p className="font-mono text-[16px] font-semibold leading-none" style={{ color: C.green }}>{ebikes}</p>
          </div>
        )}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] mb-0.5" style={{ color: '#555' }}>Ancorats</p>
          <p className="font-mono text-[16px] font-semibold leading-none" style={{ color: '#888' }}>{docks}</p>
        </div>
      </div>
      <MiniBar pct={pct} color={C.orange} />
      <p className="font-mono text-[9px] mt-1" style={{ color: '#555' }}>{bikes + ebikes} / {total} disponibles</p>
    </Card>
  )
}

const EVENT_COLORS = {
  musica:      '#C98E2E',
  esport:      '#3CB887',
  cultura:     '#8B6AD4',
  gastronomia: '#E8622A',
  familia:     '#4D84D4',
  altres:      '#6B6055',
}

const EVENT_CAT_LABELS = {
  musica: 'Música', esport: 'Esport', cultura: 'Cultura',
  gastronomia: 'Gastronomia', familia: 'Família', altres: 'Altres',
}

function EventTooltip({ object }) {
  const color = EVENT_COLORS[object.category] ?? EVENT_COLORS.altres
  const catLabel = EVENT_CAT_LABELS[object.category] ?? object.category

  const formatDate = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleDateString('ca', { day: 'numeric', month: 'short' })
  }

  return (
    <Card accent={color}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="font-mono text-[8px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
          style={{ background: color + '22', color, border: `1px solid ${color}44` }}
        >
          {catLabel}
        </span>
      </div>
      <p className="font-syne text-[13px] font-medium leading-snug mb-1" style={{ color: '#EBEBEB' }}>
        {object.title}
      </p>
      {object.place && (
        <p className="font-mono text-[10px] truncate" style={{ color: '#666' }}>
          {object.place}
        </p>
      )}
      {object.start && (
        <p className="font-mono text-[9px] mt-1.5" style={{ color: '#555' }}>
          {formatDate(object.start)}
          {object.end && object.end !== object.start && ` → ${formatDate(object.end)}`}
        </p>
      )}
    </Card>
  )
}

function TrafficTooltip({ object }) {
  const estado = object.estado ?? ''
  const color  = estado === 'fluido' ? C.green : estado === 'lento' ? C.amber : estado === 'congestionado' ? C.red : '#D45555'
  const labelMap = { fluido: 'Fluït', lento: 'Lent', congestionado: 'Congestionat', cortado: 'Tallat' }
  const label = labelMap[estado] ?? estado.toUpperCase()

  return (
    <Card accent={color}>
      <Label>Incident de trànsit</Label>
      <p className="font-syne text-[13px] font-medium truncate mb-1.5" style={{ color: '#EBEBEB' }}>{object.name}</p>
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
        style={{ background: color + '18', color, border: `1px solid ${color}44` }}>
        {label}
      </span>
      {object.velocidad != null && (
        <p className="font-mono text-[10px] mt-2" style={{ color: '#555' }}>
          Velocitat actual: <span style={{ color: '#EBEBEB' }}>{object.velocidad} km/h</span>
        </p>
      )}
    </Card>
  )
}

export default function Tooltip({ info }) {
  if (!info?.object) return null

  const { x, y, object } = info

  let content
  if (object.type === 'event') {
    content = <EventTooltip object={object} />
  } else if (object.type === 'metro' || object.type === 'tram' || object.type === 'fgc') {
    content = <MetroTooltip object={object} />
  } else if (object.type === 'bus') {
    content = <BusTooltip object={object} />
  } else if (object.bikes != null) {
    content = <BicingTooltip object={object} />
  } else {
    content = <TrafficTooltip object={object} />
  }

  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: x + 14, top: y - 14 }}>
      {content}
    </div>
  )
}
