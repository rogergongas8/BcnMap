import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'

const EASE = [0.32, 0.72, 0, 1]

// Silhoueta minimalista de la skyline de Barcelona per al header
function SkylineDecor() {
  return (
    <svg
      viewBox="0 0 320 44"
      fill="currentColor"
      aria-hidden="true"
      className="absolute bottom-0 left-0 w-full"
      style={{ color: '#B8885A', opacity: 0.09, height: 44 }}
    >
      {/* Edificis esquerra */}
      <rect x="0" y="34" width="12" height="10" />
      <rect x="14" y="27" width="9" height="17" />
      <rect x="25" y="36" width="7" height="8" />
      <rect x="34" y="30" width="14" height="14" />
      <rect x="50" y="34" width="10" height="10" />
      {/* Sagrada Família — doble agulla */}
      <polygon points="74,1 77,27 80,1" />
      <polygon points="82,6 85,27 88,6" />
      <rect x="72" y="27" width="18" height="17" />
      {/* Edificis centrals */}
      <rect x="96" y="20" width="20" height="24" />
      <rect x="118" y="30" width="11" height="14" />
      <rect x="131" y="16" width="18" height="28" />
      <rect x="151" y="26" width="12" height="18" />
      {/* Torre Glòries — troncocònica */}
      <path d="M168 44 L172 8 L176 44Z" />
      {/* Edificis dreta */}
      <rect x="182" y="22" width="18" height="22" />
      <rect x="202" y="30" width="12" height="14" />
      <rect x="216" y="14" width="22" height="30" />
      <rect x="240" y="28" width="14" height="16" />
      <rect x="256" y="20" width="16" height="24" />
      <rect x="274" y="32" width="10" height="12" />
      <rect x="286" y="24" width="18" height="20" />
      <rect x="306" y="30" width="14" height="14" />
    </svg>
  )
}

function InputField({ id, label, type, value, onChange, required, minLength }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[9px] uppercase tracking-[0.18em]"
        style={{ color: '#5C5248' }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-3.5 py-2.5 rounded-lg font-mono text-[13px] outline-none"
        style={{
          background: '#181410',
          border: `1px solid ${focused ? '#B8885A66' : '#28221A'}`,
          color: '#EDE8DF',
          caretColor: '#B8885A',
          boxShadow: focused
            ? 'inset 0 1px 3px rgba(0,0,0,0.4), 0 0 0 3px rgba(184,136,90,0.07)'
            : 'inset 0 1px 3px rgba(0,0,0,0.3)',
          transition: 'border-color 0.16s, box-shadow 0.16s',
        }}
      />
    </div>
  )
}

const TABS = [
  { id: 'login',    label: 'Entrar' },
  { id: 'register', label: 'Registrar-se' },
]

export default function LoginModal({ onClose }) {
  const [tab, setTab]       = useState('login')
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, pass)
      } else {
        await register(name, email, pass)
      }
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.message
        ?? Object.values(err?.response?.data?.errors ?? {})[0]?.[0]
        ?? 'Error al autenticar'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: 'rgba(5,3,1,0.9)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.28, ease: EASE }}
          onClick={e => e.stopPropagation()}
          className="w-full overflow-hidden"
          style={{
            maxWidth: 348,
            background: '#0E0C09',
            border: '1px solid #2A221A',
            borderRadius: 12,
            boxShadow: '0 32px 72px rgba(2,1,0,0.85), inset 0 1px 0 rgba(255,200,140,0.04)',
          }}
        >
          {/* ── Header amb skyline ── */}
          <div
            className="relative overflow-hidden px-6 pt-6 pb-5"
            style={{
              background: 'linear-gradient(160deg, #1C1208 0%, #120F07 100%)',
              borderBottom: '1px solid #28211A',
            }}
          >
            <SkylineDecor />
            <div className="relative">
              <div className="flex items-baseline gap-2.5 mb-1">
                <span
                  className="font-syne leading-none font-semibold"
                  style={{ fontSize: 24, color: '#EDE8DF', letterSpacing: '-0.02em' }}
                >
                  BCN
                </span>
                <span
                  className="font-mono text-[10px] font-medium uppercase"
                  style={{ color: '#B8885A', letterSpacing: '0.22em' }}
                >
                  Live
                </span>
              </div>
              <p
                className="font-mono text-[9px] uppercase"
                style={{ color: '#3E3530', letterSpacing: '0.14em' }}
              >
                barcelona · mapa en temps real
              </p>
            </div>
          </div>

          {/* ── Selector de pestanya ── */}
          <div className="px-5 pt-5">
            <div
              className="relative flex rounded-lg p-[3px]"
              style={{ background: '#181410', border: '1px solid #28221A' }}
            >
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setError('') }}
                  className="relative flex-1 py-2 z-10 font-mono text-[11px] tracking-[0.06em] transition-colors"
                  style={{ color: tab === t.id ? '#1A0E06' : '#5C5248', fontWeight: tab === t.id ? 600 : 400 }}
                >
                  {tab === t.id && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-[6px]"
                      style={{ background: '#B8885A' }}
                      transition={{ duration: 0.2, ease: EASE }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Formulari ── */}
          <form onSubmit={submit} className="px-5 pt-4 pb-5 flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {tab === 'register' && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  style={{ overflow: 'hidden' }}
                >
                  <InputField
                    id="modal-name"
                    label="Nom"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <InputField
              id="modal-email"
              label="Correu electrònic"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <InputField
              id="modal-pass"
              label="Contrasenya"
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
              minLength={8}
            />

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="font-mono text-[11px]"
                  style={{ color: '#B85A44' }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-syne font-semibold text-[13px] mt-1"
              style={{
                background: loading ? '#7A3518' : '#B8885A',
                color: '#1A0E06',
                letterSpacing: '0.04em',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.16s, transform 0.1s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#F06D32' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#B8885A' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translateY(1px)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {loading ? '…' : tab === 'login' ? 'Entrar' : 'Crear compte'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
