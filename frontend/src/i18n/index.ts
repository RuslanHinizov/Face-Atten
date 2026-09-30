import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import kk from './locales/kk.json'
import en from './locales/en.json'
import tr from './locales/tr.json'

export type SupportedLanguage = 'ru' | 'kk' | 'en' | 'tr'

const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('attendance-language')
    if (stored === 'ru' || stored === 'kk' || stored === 'en' || stored === 'tr') {
      return stored
    }
  }
  return 'ru'
}

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export const changeLanguage = (lang: SupportedLanguage) => {
  i18n.changeLanguage(lang)
  if (typeof window !== 'undefined') {
    localStorage.setItem('attendance-language', lang)
  }
}

export const languages: { code: SupportedLanguage; name: string; flag: string }[] = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'kk', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
]

export default i18n

