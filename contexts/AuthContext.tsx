"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-client'

interface AuthUser {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
  username?: string | null
}

// Auth status represents the three possible states
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  // New: explicit auth status to prevent false logout states
  status: AuthStatus
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  // Force refresh for bfcache recovery
  forceRefresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth loading timeout (10 seconds max)
const AUTH_TIMEOUT_MS = 10000

// Visibility refresh debounce (prevent rapid refreshes)
const VISIBILITY_DEBOUNCE_MS = 2000

// Clear all user-related data from localStorage
function clearUserStorage(userId?: string) {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        // Clear profile, notifications, and any user-specific data
        if (
          key.startsWith('profile-') ||
          key.startsWith('notifications-') ||
          key.startsWith('welcome-seen-') ||
          key.startsWith('sb-') // Supabase keys
        ) {
          keysToRemove.push(key)
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (e) {
    console.error('[Auth] Error clearing localStorage:', e)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const initializedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastVisibilityRefreshRef = useRef<number>(0)
  const isMountedRef = useRef(true)

  // Helper to update auth state atomically
  const setAuthState = useCallback((newUser: AuthUser | null, isLoading: boolean) => {
    setUser(newUser)
    setLoading(isLoading)
    setStatus(isLoading ? 'loading' : newUser ? 'authenticated' : 'unauthenticated')
  }, [])

  // Clear timeout on cleanup
  const clearAuthTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const signOut = useCallback(async () => {
    const currentUserId = user?.id

    // Immediately clear user state for responsive UI
    setAuthState(null, false)

    // Clear localStorage data
    clearUserStorage(currentUserId)

    try {
      // Remove all realtime channels to prevent stale connections
      const channels = supabase.getChannels()
      await Promise.all(channels.map(channel => supabase.removeChannel(channel)))

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) {
        console.error('[Auth] Supabase signOut error:', error)
      }
    } catch (err) {
      console.error('[Auth] Error during signOut:', err)
    }
  }, [user?.id, setAuthState])

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      if (isMountedRef.current) {
        setUser(currentUser)
      }
    } catch (error) {
      console.error('[Auth] Error refreshing user:', error)
      if (isMountedRef.current) {
        setUser(null)
      }
    }
  }, [])

  // Force refresh - validates session with server and refreshes all state
  // Used for bfcache recovery and visibility changes
  const forceRefresh = useCallback(async () => {
    const now = Date.now()
    // Debounce rapid refreshes
    if (now - lastVisibilityRefreshRef.current < VISIBILITY_DEBOUNCE_MS) {
      console.log('[Auth] Skipping force refresh - too soon since last refresh')
      return
    }
    lastVisibilityRefreshRef.current = now

    console.log('[Auth] Force refresh triggered - validating session')
    try {
      // CRITICAL: Use getUser() to validate with server, not getSession() which may be stale
      const { data: { user: authUser }, error } = await supabase.auth.getUser()

      if (!isMountedRef.current) return

      if (error) {
        console.warn('[Auth] Force refresh - session invalid:', error.message)
        setAuthState(null, false)
        return
      }

      if (authUser) {
        // Session is valid - refresh profile
        const profile = await getCurrentUser()
        if (isMountedRef.current) {
          setAuthState(profile, false)
          console.log('[Auth] Force refresh complete - user authenticated')
        }
      } else {
        // No user
        if (isMountedRef.current) {
          setAuthState(null, false)
          console.log('[Auth] Force refresh complete - no user')
        }
      }
    } catch (error) {
      console.error('[Auth] Force refresh error:', error)
      // Don't change state on error - keep existing state
    }
  }, [setAuthState])

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initializedRef.current) return
    initializedRef.current = true

    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      if (status === 'loading') {
        console.warn('[Auth] Auth loading timed out after', AUTH_TIMEOUT_MS, 'ms')
        // IMPORTANT: On timeout, don't assume logged out - stay in loading state
        // but stop the spinner. User can refresh to retry.
        setAuthState(null, false)
      }
    }, AUTH_TIMEOUT_MS)

    // Get initial session - use getSession first for instant check, then validate
    const getInitialSession = async () => {
      try {
        // STEP 1: Quick local session check (instant, from cookies)
        const { data: { session: localSession } } = await supabase.auth.getSession()

        // If no local session at all, user is definitely not logged in
        if (!localSession) {
          setAuthState(null, false)
          clearAuthTimeout()
          return
        }

        // STEP 2: We have a local session - show user as authenticated immediately
        // This prevents the "flash to login" issue
        // Set a preliminary user state with basic info from session
        const preliminaryUser: AuthUser = {
          id: localSession.user.id,
          email: localSession.user.email || '',
          full_name: localSession.user.user_metadata?.full_name || null,
          avatar_url: localSession.user.user_metadata?.avatar_url || null,
          username: null,
        }
        setAuthState(preliminaryUser, false)

        // STEP 3: Now validate with server and get full profile (background)
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (error) {
          // Session was invalid on server - NOW we know user is logged out
          console.warn('[Auth] Session validation error:', error.message)
          setAuthState(null, false)
          clearAuthTimeout()
          return
        }

        if (authUser) {
          // Get full profile data
          const profile = await getCurrentUser()
          if (profile) {
            setAuthState(profile, false)
          }
          // If profile fetch fails, keep preliminary user data
        } else {
          // Server says no user - clear state
          setAuthState(null, false)
        }
      } catch (error) {
        console.error('[Auth] Error getting initial session:', error)
        // On error, don't flash logout - maintain current state
        setAuthState(null, false)
      } finally {
        clearAuthTimeout()
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle sign out event immediately
        if (event === 'SIGNED_OUT') {
          setAuthState(null, false)
          clearUserStorage()
          return
        }

        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('[Auth] Token refresh failed')
          setAuthState(null, false)
          return
        }

        if (session?.user) {
          try {
            const profile = await getCurrentUser()
            setAuthState(profile, false)
          } catch (error) {
            console.error('[Auth] Error fetching profile on auth change:', error)
            // Don't clear user on profile fetch error - session is still valid
            // Keep existing user state
          }
        } else {
          setAuthState(null, false)
        }
        clearAuthTimeout()
      }
    )

    return () => {
      subscription.unsubscribe()
      clearAuthTimeout()
    }
  }, [clearAuthTimeout, setAuthState, status])

  // Handle page visibility changes and bfcache recovery
  // CRITICAL for macOS/iOS Safari where bfcache causes stale state
  useEffect(() => {
    isMountedRef.current = true

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'authenticated') {
        console.log('[Auth] Tab became visible - refreshing session')
        forceRefresh()
      }
    }

    // Handle pageshow (bfcache restoration) - CRITICAL for macOS Safari
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[Auth] Page restored from bfcache - force refreshing')
        // Always refresh on bfcache restoration regardless of current status
        forceRefresh()
      }
    }

    // Handle window focus (user clicks on window)
    const handleFocus = () => {
      if (status === 'authenticated') {
        console.log('[Auth] Window focused - validating session')
        forceRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('focus', handleFocus)

    return () => {
      isMountedRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('focus', handleFocus)
    }
  }, [status, forceRefresh])

  const value = {
    user,
    loading,
    status,
    signOut,
    refreshUser,
    forceRefresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}