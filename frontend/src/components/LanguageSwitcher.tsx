import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { languages, changeLanguage, type SupportedLanguage } from '../i18n'
import { useAttendanceStore } from '../store/attendanceStore'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const setLanguage = useAttendanceStore((s) => s.setLanguage)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLanguageChange = (code: SupportedLanguage) => {
    changeLanguage(code)
    if (code === 'ru' || code === 'kk' || code === 'en') {
      setLanguage(code)
    }
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-600/40 transition-all duration-200 text-slate-200"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4 text-slate-400" />
        <span className="text-sm">{currentLang.flag}</span>
        <span className="text-sm font-medium hidden sm:inline">{currentLang.name}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-slate-800/95 backdrop-blur-xl border border-slate-600/50 shadow-2xl shadow-black/40 overflow-hidden z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${i18n.language === lang.code
                  ? 'bg-indigo-600/30 text-indigo-300'
                  : 'text-slate-300 hover:bg-slate-700/60'
                }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="text-sm font-medium">{lang.name}</span>
              {i18n.language === lang.code && (
                <span className="ml-auto w-2 h-2 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
