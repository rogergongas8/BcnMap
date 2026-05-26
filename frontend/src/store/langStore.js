import { create } from 'zustand'
import i18n from '../i18n'

const LANGS = [
  { id: 'ca', label: 'CA' },
  { id: 'es', label: 'ES' },
  { id: 'en', label: 'EN' },
]

export const useLangStore = create((set) => ({
  lang:    localStorage.getItem('bcn:lang') ?? 'ca',
  langs:   LANGS,
  setLang: (lang) => {
    localStorage.setItem('bcn:lang', lang)
    i18n.changeLanguage(lang)
    set({ lang })
  },
}))
