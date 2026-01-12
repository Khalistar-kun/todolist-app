"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
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
// CRITICAL: 'loading' means auth has NOT been resolved yet
// Components MUST NOT render auth-dependent content until status !== 'loading'
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  // Explicit auth status - primary source of truth for auth state
  status: AuthStatus
  // True when initial auth check is complete - use this to gate rendering
  isInitialized: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Clear user-related data from localStorage (NOT Supabase keys - those are managed by Supabase)
function clearUserStorage() {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        if (
          key.startsWith('profile-') ||
          key.startsWith('notifications-') ||
          key.startsWith('welcome-seen-')
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
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [isInitialized, setIsInitialized] = useState(false)

  // Refs to prevent race conditions and double-init
  const initStartedRef = useRef(false)
  const isMountedRef = useRef(true)
  const lastUserIdRef = useRef<string | null>(null)

  // Stable atomic state update
  const setAuthState = useCallback((newUser: AuthUser | null, newStatus: AuthStatus) => {
    if (!isMountedRef.current) return

    // Prevent unnecessary updates that could cause re-renders
    const newUserId = newUser?.id || null
    if (lastUserIdRef.current === newUserId && status === newStatus) {
      return
    }
    lastUserIdRef.current = newUserId

    setUser(newUser)
    setStatus(newStatus)
  }, [status])

  const signOut = useCallback(async () => {
    // Clear localStorage data BEFORE changing state
    clearUserStorage()

    // Update state immediately
    lastUserIdRef.current = null
    setUser(null)
    setStatus('unauthenticated')

    try {
      // Remove all realtime channels
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
  }, [])

  const refreshUser = useCallback(async () => {
    if (!isMountedRef.current) return

    try {
      const currentUser = await getCurrentUser()
      if (isMountedRef.current && currentUser) {
        setUser(currentUser)
        lastUserIdRef.current = currentUser.id
      }
    } catch (error) {
      console.error('[Auth] Error refreshing user:', error)
    }
  }, [])

  // CRITICAL: Single initialization effect - runs ONCE on mount
  // No timeouts, no arbitrary fallbacks - auth resolves naturally
  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initStartedRef.current) return
    initStartedRef.current = true
    isMountedRef.current = true

    const initializeAuth = async () => {
      console.log('[Auth] Initializing...')

      try {
        // STEP 1: Check for existing session (instant, from cookies)
        const { data: { session: localSession } } = await supabase.auth.getSession()

        if (!localSession) {
          // No session found - user is definitively unauthenticated
          console.log('[Auth] No session - unauthenticated')
          setUser(null)
          setStatus('unauthenticated')
          setIsInitialized(true)
          return
        }

        // STEP 2: Session exists - set authenticated state immediately
        // This prevents "flash to login" during slow network
        const preliminaryUser: AuthUser = {
          id: localSession.user.id,
          email: localSession.user.email || '',
          full_name: localSession.user.user_metadata?.full_name || null,
          avatar_url: localSession.user.user_metadata?.avatar_url || null,
          username: null,
        }

        lastUserIdRef.current = preliminaryUser.id
        setUser(preliminaryUser)
        setStatus('authenticated')
        setIsInitialized(true) // UI can now render
        console.log('[Auth] Session found - authenticated (preliminary)')

        // STEP 3: Validate with server and get full profile (background, non-blocking)
        try {
          const { data: { user: authUser }, error } = await supabase.auth.getUser()

          if (!isMountedRef.current) return

          if (error || !authUser) {
            // Session invalid on server - clear state
            console.warn('[Auth] Session invalid:', error?.message)
            lastUserIdRef.current = null
            setUser(null)
            setStatus('unauthenticated')
            return
          }

          // Get full profile
          const profile = await getCurrentUser()
          if (profile && isMountedRef.current) {
            setUser(profile)
            console.log('[Auth] Full profile loaded')
          }
        } catch (error) {
          console.error('[Auth] Background validation error:', error)
          // Keep preliminary state on background errors
        }
      } catch (error) {
        console.error('[Auth] Critical init error:', error)
        setUser(null)
        setStatus('unauthenticated')
        setIsInitialized(true)
      }
    }

    initializeAuth()

    // Listen for auth changes from other tabs or token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State change:', event)

        if (event === 'SIGNED_OUT') {
          lastUserIdRef.current = null
          setUser(null)
          setStatus('unauthenticated')
          clearUserStorage()
          return
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('[Auth] Token refresh failed')
          lastUserIdRef.current = null
          setUser(null)
          setStatus('unauthenticated')
          return
        }

        if (session?.user && isMountedRef.current) {
          try {
            const profile = await getCurrentUser()
            if (profile && isMountedRef.current) {
              lastUserIdRef.current = profile.id
              setUser(profile)
              setStatus('authenticated')
            }
          } catch (error) {
            console.error('[Auth] Profile fetch error:', error)
            // Session valid but profile fetch failed - use basic info
            const basicUser: AuthUser = {
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name || null,
              avatar_url: session.user.user_metadata?.avatar_url || null,
              username: null,
            }
            lastUserIdRef.current = basicUser.id
            setUser(basicUser)
            setStatus('authenticated')
          }
        }
      }
    )

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  // Handle bfcache restoration ONLY - not visibility changes
  // Visibility-based refresh causes the subscription loops
  useEffect(() => {
    const handlePageShow = async (event: PageTransitionEvent) => {
      if (!event.persisted) return

      console.log('[Auth] bfcache restore - validating session')

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session && status === 'authenticated') {
          console.log('[Auth] Session expired during bfcache')
          lastUserIdRef.current = null
          setUser(null)
          setStatus('unauthenticated')
        }
      } catch (error) {
        console.error('[Auth] bfcache session check error:', error)
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [status])

  const value = {
    user,
    loading: status === 'loading',
    status,
    isInitialized,
    signOut,
    refreshUser,
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
