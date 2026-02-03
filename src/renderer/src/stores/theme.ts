import { writable } from 'svelte/store'

export type Theme = 'light' | 'dark' | 'system'

// Create theme store
function createThemeStore(): {
  subscribe: (run: (value: Theme) => void) => () => void
  set: (theme: Theme) => Promise<void>
  toggle: () => Promise<void>
  init: () => Promise<void>
} {
  const { subscribe, set, update } = writable<Theme>('system')

  return {
    subscribe,
    set: async (theme: Theme) => {
      set(theme)
      applyTheme(theme)
      await window.api.savePreference({ key: 'theme', value: theme })
    },
    toggle: async () => {
      let currentTheme: Theme = 'system'
      update((t) => {
        currentTheme = t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'
        return currentTheme
      })
      applyTheme(currentTheme)
      await window.api.savePreference({ key: 'theme', value: currentTheme })
    },
    init: async () => {
      const saved = await window.api.getPreference('theme')
      const theme = (saved as Theme) || 'system'
      set(theme)
      applyTheme(theme)
    }
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
}

export const theme = createThemeStore()
