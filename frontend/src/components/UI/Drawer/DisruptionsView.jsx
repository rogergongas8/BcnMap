import React from 'react'
import { Icons } from '../icons'
import { useDataStore } from '../../../store/dataStore'

// Official TMB metro line colors
const LINE_COLORS = {
  L1:  '#ED1B2E', L2:  '#9B2D8E', L3:  '#3CB34A',
  L4:  '#F7C300', L5:  '#0070C0', L6:  '#9BA0A3',
  L7:  '#965912', L8:  '#965912', L9:  '#ED7D31',
  L9N: '#ED7D31', L9S: '#ED7D31',
  L10: '#7FC5E8', L10N:'#7FC5E8', L10S:'#7FC5E8',
  L11: '#9BC91C', L12: '#8E6339',
  FM:  '#9BA0A3',
}

function lineColor(line) {
  if (!line) return '#888'
  const key = line.toUpperCase().replace(/\s+/g, '')
  return LINE_COLORS[key] ?? '#888'
}

function LineTag({ line }) {
  const color = lineColor(line)
  return (
    <span
      className="inline-flex items-center justify-center font-mono text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
      style={{
        background: color + '20',
        color,
        border: `1px solid ${color}50`,
        minWidth: 34,
      }}
    >
      {line}
    </span>
  )
}

export default function DisruptionsView() {
  const disruptions = useDataStore(s => s.disruptions)

  if (disruptions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center py-12">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: '#1C1C1C', color: '#3CB34A' }}
        >
          <Icons.check size={18} />
        </div>
        <p className="font-syne text-[14px] font-medium" style={{ color: '#EBEBEB' }}>
          Servei normal
        </p>
        <p className="font-mono text-[11px] leading-snug max-w-[220px]" style={{ color: '#555' }}>
          Cap incidencia activa a la xarxa de metro de Barcelona
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid #1A1A1A' }}>
        <span style={{ color: '#D45555' }}><Icons.alert size={11} /></span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: '#D45555' }}>
          {disruptions.length} {disruptions.length === 1 ? 'incidencia activa' : 'incidencies actives'}
        </span>
      </div>

      <ul>
        {disruptions.map((d, i) => {
          const color = lineColor(d.line)
          return (
            <li
              key={i}
              className="flex"
              style={{ borderBottom: '1px solid #1A1A1A' }}
            >
              <div
                className="w-[3px] flex-shrink-0 self-stretch"
                style={{ background: color }}
              />
              <div className="flex items-start gap-3 px-3.5 py-3 flex-1 min-w-0">
                <LineTag line={d.line} />
                <div className="min-w-0 flex-1">
                  <p
                    className="font-mono text-[11px] leading-snug"
                    style={{ color: '#EBEBEB' }}
                  >
                    {d.description}
                  </p>
                  <p
                    className="font-mono text-[9px] mt-1 uppercase tracking-[0.08em]"
                    style={{ color: '#555' }}
                  >
                    Metro Barcelona
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="px-4 py-3" style={{ borderTop: '1px solid #262626' }}>
        <p className="font-mono text-[9px] leading-relaxed" style={{ color: '#444' }}>
          Dades TMB · S'actualitzen cada 2 min
        </p>
      </div>
    </div>
  )
}
