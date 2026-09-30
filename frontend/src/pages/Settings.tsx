import { memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Check,
  Sparkles,
  Palette,
  Languages
} from 'lucide-react'
import { useSettingsStore, Theme, SupportedLanguage } from '../store/settingsStore'
import { languages } from '../i18n'
import { useSound } from '../hooks/useSound'

const ThemeOption = memo(({
  theme,
  currentTheme,
  onClick,
  icon: Icon,
  label
}: {
  theme: Theme
  currentTheme: Theme
  onClick: (theme: Theme) => void
  icon: React.ElementType
  label: string
}) => {
  const isSelected = currentTheme === theme

  return (
    <button
      onClick={() => onClick(theme)}
      className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-300 flex-1 min-w-[140px] ${
        isSelected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
      }`}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
        isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'
      }`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className={`font-semibold text-sm ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
        {label}
      </span>
    </button>
  )
})

ThemeOption.displayName = 'ThemeOption'

const LanguageOption = memo(({
  lang,
  currentLang,
  onClick
}: {
  lang: { code: SupportedLanguage; name: string; flag: string }
  currentLang: string
  onClick: (code: SupportedLanguage) => void
}) => {
  const isSelected = currentLang === lang.code

  return (
    <button
      onClick={() => onClick(lang.code)}
      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 flex-1 min-w-[160px] ${
        isSelected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
      }`}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <span className="text-2xl">{lang.flag}</span>
      <span className={`font-medium ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
        {lang.name}
      </span>
    </button>
  )
})

LanguageOption.displayName = 'LanguageOption'

export const Settings = memo(() => {
  const { t, i18n } = useTranslation()
  const {
    theme,
    soundEnabled,
    soundVolume,
    notificationsEnabled,
    setTheme,
    setSoundEnabled,
    setSoundVolume,
    setNotificationsEnabled,
  } = useSettingsStore()

  const { playNotification } = useSound()

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme)
  }, [setTheme])

  const handleLanguageChange = useCallback((code: SupportedLanguage) => {
    i18n.changeLanguage(code)
    localStorage.setItem('attendance-language', code)
  }, [i18n])

  const handleTestSound = useCallback(() => {
    playNotification()
  }, [playNotification])

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="w-11 h-11 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[var(--color-surface)]">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text)] tracking-tight">
                  {t('settings.title')}
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {t('settings.subtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Horizontal Layout */}
      <main className="max-w-[1400px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Theme & Language Row */}
          <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Theme Section */}
            <section className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    {t('settings.theme.title')}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t('settings.theme.subtitle')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <ThemeOption
                  theme="light"
                  currentTheme={theme}
                  onClick={handleThemeChange}
                  icon={Sun}
                  label={t('settings.theme.light')}
                />
                <ThemeOption
                  theme="dark"
                  currentTheme={theme}
                  onClick={handleThemeChange}
                  icon={Moon}
                  label={t('settings.theme.dark')}
                />
                <ThemeOption
                  theme="system"
                  currentTheme={theme}
                  onClick={handleThemeChange}
                  icon={Monitor}
                  label={t('settings.theme.system')}
                />
              </div>
            </section>

            {/* Language Section */}
            <section className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Languages className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    {t('settings.language.title')}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t('settings.language.subtitle')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                {languages.map((lang) => (
                  <LanguageOption
                    key={lang.code}
                    lang={lang}
                    currentLang={i18n.language}
                    onClick={handleLanguageChange}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Sound & Notifications Row */}
          <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sound Section */}
            <section className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    {soundEnabled ? (
                      <Volume2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      {t('settings.sound.title')}
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t('settings.sound.subtitle')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                    soundEnabled ? 'bg-emerald-500' : 'bg-[var(--color-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {soundEnabled && (
                <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-[var(--color-text)]">
                        {t('settings.sound.volume')}
                      </label>
                      <span className="text-sm text-[var(--color-text-muted)] font-mono">
                        {Math.round(soundVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={soundVolume}
                      onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                      className="w-full h-2 bg-[var(--color-bg)] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <button
                    onClick={handleTestSound}
                    className="btn btn-secondary"
                  >
                    <Volume2 className="w-4 h-4" />
                    {t('settings.sound.testSound')}
                  </button>
                </div>
              )}
            </section>

            {/* Notifications Section */}
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    {notificationsEnabled ? (
                      <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <BellOff className="w-5 h-5 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      {t('settings.notifications.title')}
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t('settings.notifications.subtitle')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                    notificationsEnabled ? 'bg-amber-500' : 'bg-[var(--color-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                      notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {notificationsEnabled && (
                <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-3 p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)]">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-text)]">{t('settings.notifications.enabled')}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{t('settings.notifications.description')}</p>
                    </div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
})

Settings.displayName = 'Settings'

export default Settings
