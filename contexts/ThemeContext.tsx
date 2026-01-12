"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Get initial theme without causing hydration mismatch
function getInitialTheme(): Theme {
  // During SSR, return undefined to defer to client
  if (typeof window === 'undefined') {
    return 'light' // Default for SSR
  }
  return 'light' // Will be updated on mount
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [mounted, setMounted] = useState(false)

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(newTheme)
      // Also toggle the dark class for Tailwind
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [])

  useEffect(() => {
    // Only run on client
    setMounted(true)

    // Get stored theme or system preference
    let initialTheme: Theme = 'light'
    try {
      const stored = localStorage.getItem('theme') as Theme | null
      if (stored && (stored === 'light' || stored === 'dark')) {
        initialTheme = stored
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialTheme = 'dark'
      }
    } catch (e) {
      // localStorage might be unavailable
      console.warn('[Theme] Could not access localStorage:', e)
    }

    setThemeState(initialTheme)
    applyTheme(initialTheme)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set a preference
      const stored = localStorage.getItem('theme')
      if (!stored) {
        const newTheme = e.matches ? 'dark' : 'light'
        setThemeState(newTheme)
        applyTheme(newTheme)
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [applyTheme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
    } catch (e) {
      console.warn('[Theme] Could not save to localStorage:', e)
    }
  }, [applyTheme])

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }, [theme, setTheme])

  // Prevent hydration mismatch by rendering children immediately
  // Theme will be applied client-side after mount
  // The suppressHydrationWarning on html element handles the class mismatch

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Safe version that returns null if not in provider
export function useThemeSafe() {
  return useContext(ThemeContext)
}
