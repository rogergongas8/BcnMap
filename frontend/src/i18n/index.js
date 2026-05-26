import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ca from './locales/ca'
import es from './locales/es'
import en from './locales/en'

const saved = localStorage.getItem('bcn:lang') ?? 'ca'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ca: { translation: ca },
      es: { translation: es },
      en: { translation: en },
    },
    lng:          saved,
    fallbackLng:  'ca',
    interpolation: { escapeValue: false },
  })

export default i18n
