import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type SupportedLanguage = 'ru' | 'kk' | 'en' | 'tr' | 'zh' | 'de'

interface SettingsState {
  // Theme
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  
  // Sound
  soundEnabled: boolean
  soundVolume: number
  
  // Language
  language: SupportedLanguage
  
  // Notifications
  notificationsEnabled: boolean
  
  // Actions
  setTheme: (theme: Theme) => void
  setResolvedTheme: (theme: 'light' | 'dark') => void
  setSoundEnabled: (enabled: boolean) => void
  setSoundVolume: (volume: number) => void
  setLanguage: (lang: SupportedLanguage) => void
  setNotificationsEnabled: (enabled: boolean) => void
  toggleSound: () => void
  toggleTheme: () => void
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'light',
      resolvedTheme: 'light',
      soundEnabled: true,
      soundVolume: 0.5,
      language: 'ru',
      notificationsEnabled: true,

      // Actions
      setTheme: (theme) => {
        const resolved = theme === 'system' ? getSystemTheme() : theme
        set({ theme, resolvedTheme: resolved })
        
        // Apply theme to document
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', resolved)
        }
      },

      setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),

      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),

      setSoundVolume: (soundVolume) => set({ soundVolume: Math.max(0, Math.min(1, soundVolume)) }),

      setLanguage: (language) => set({ language }),

      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

      toggleTheme: () => {
        const { theme } = get()
        const newTheme: Theme = theme === 'light' ? 'dark' : 'light'
        get().setTheme(newTheme)
      },
    }),
    {
      name: 'attendance-settings',
      partialize: (state) => ({
        theme: state.theme,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        language: state.language,
        notificationsEnabled: state.notificationsEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme on load
          const resolved = state.theme === 'system' ? getSystemTheme() : state.theme
          state.resolvedTheme = resolved
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', resolved)
          }
        }
      },
    }
  )
)

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const store = useSettingsStore.getState()
    if (store.theme === 'system') {
      store.setResolvedTheme(e.matches ? 'dark' : 'light')
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    }
  })
}
