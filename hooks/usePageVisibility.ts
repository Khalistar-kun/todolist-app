"use client"

import { useEffect, useCallback, useRef } from 'react'

interface UsePageVisibilityOptions {
  onVisible?: () => void
  onHidden?: () => void
  onPageShow?: (persisted: boolean) => void
  onFocus?: () => void
}

/**
 * Hook to handle page visibility changes across all platforms
 *
 * CRITICAL for cross-platform reliability:
 * - Handles bfcache restoration (macOS Safari, iOS Safari)
 * - Handles tab visibility changes
 * - Handles window focus/blur
 *
 * This is essential for fixing the "stale state" issue on macOS
 * where users need to hard refresh to see current data.
 */
export function usePageVisibility({
  onVisible,
  onHidden,
  onPageShow,
  onFocus,
}: UsePageVisibilityOptions = {}) {
  const lastVisibilityRef = useRef<boolean>(true)
  const isMountedRef = useRef(true)

  // Safe callback wrapper
  const safeCall = useCallback((fn?: () => void) => {
    if (isMountedRef.current && fn) {
      try {
        fn()
      } catch (error) {
        console.error('[PageVisibility] Callback error:', error)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    // Handle document visibility changes (tab switching)
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'

      // Only trigger if visibility actually changed
      if (isVisible !== lastVisibilityRef.current) {
        lastVisibilityRef.current = isVisible

        if (isVisible) {
          console.log('[PageVisibility] Tab became visible')
          safeCall(onVisible)
        } else {
          safeCall(onHidden)
        }
      }
    }

    // Handle pageshow event (bfcache restoration)
    // This is CRITICAL for macOS Safari and iOS Safari
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from bfcache
        console.log('[PageVisibility] Page restored from bfcache - refreshing state')
        safeCall(() => onPageShow?.(true))
        safeCall(onVisible)
      } else {
        safeCall(() => onPageShow?.(false))
      }
    }

    // Handle window focus (user clicks on window)
    const handleFocus = () => {
      console.log('[PageVisibility] Window focused')
      safeCall(onFocus)
      // Also trigger visible callback when window gains focus
      if (!lastVisibilityRef.current) {
        lastVisibilityRef.current = true
        safeCall(onVisible)
      }
    }

    // Handle pagehide event (before bfcache storage)
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[PageVisibility] Page being stored in bfcache')
      }
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('focus', handleFocus)

    // Initialize visibility state
    lastVisibilityRef.current = document.visibilityState === 'visible'

    return () => {
      isMountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('focus', handleFocus)
    }
  }, [onVisible, onHidden, onPageShow, onFocus, safeCall])

  return {
    isVisible: () => document.visibilityState === 'visible',
  }
}

/**
 * Hook to detect if the page was restored from bfcache
 * and needs state refresh
 */
export function useBfcacheRecovery(onRecovery: () => void) {
  const hasRecoveredRef = useRef(false)

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !hasRecoveredRef.current) {
        hasRecoveredRef.current = true
        console.log('[bfcache] Page restored - triggering recovery')
        onRecovery()
        // Reset flag after a short delay to allow for subsequent recoveries
        setTimeout(() => {
          hasRecoveredRef.current = false
        }, 1000)
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [onRecovery])
}
