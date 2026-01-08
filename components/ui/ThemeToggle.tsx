"use client"

import { useThemeSafe } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const themeContext = useThemeSafe()

  // Return null during SSR or if context not available
  if (!themeContext) {
    return (
      <button
        className="relative flex items-center h-9 px-3 rounded-full bg-gray-100 transition-colors duration-200"
        aria-label="Toggle theme"
        disabled
      >
        <span className="text-xs font-medium uppercase tracking-wide mr-2 text-gray-600">Day</span>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </span>
      </button>
    )
  }

  const { theme, toggleTheme } = themeContext
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative flex items-center h-9 px-3 rounded-full transition-colors duration-200
        ${isDark
          ? 'bg-gray-800 hover:bg-gray-700'
          : 'bg-gray-100 hover:bg-gray-200'
        }
      `}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Label */}
      <span className={`
        text-xs font-medium uppercase tracking-wide mr-2
        ${isDark ? 'text-gray-300' : 'text-gray-600'}
      `}>
        {isDark ? 'Night' : 'Day'}
      </span>

      {/* Icon Container */}
      <span className={`
        flex items-center justify-center w-6 h-6 rounded-full transition-colors
        ${isDark ? 'bg-gray-700' : 'bg-white shadow-sm'}
      `}>
        {/* Sun Icon */}
        {!isDark && (
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
        {/* Moon Icon */}
        {isDark && (
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </span>
    </button>
  )
}

// Compact version for navbar
export function ThemeToggleCompact() {
  const themeContext = useThemeSafe()

  // Return placeholder during SSR or if context not available
  if (!themeContext) {
    return (
      <button
        className="p-2 rounded-lg text-gray-500 transition-colors"
        aria-label="Toggle theme"
        disabled
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      </button>
    )
  }

  const { theme, toggleTheme } = themeContext
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className={`
        p-2 rounded-lg transition-colors
        ${isDark
          ? 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800'
          : 'text-gray-500 hover:text-amber-500 hover:bg-gray-100'
        }
      `}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Sun Icon */}
      {!isDark && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
      {/* Moon Icon */}
      {isDark && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  )
}
