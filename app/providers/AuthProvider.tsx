"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth-client'

// ============================================================================
// TYPES
// ============================================================================

export interface AuthUser {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
  username?: string | null
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  accessToken: string | null
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ============================================================================
// GLOBAL SKELETON (blocks app until auth resolves)
// ============================================================================

function GlobalSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

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

// ============================================================================
// AUTH PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Single authoritative state
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    accessToken: null,
  })

  // Refs to prevent race conditions
  const initStartedRef = useRef(false)
  const isMountedRef = useRef(true)

  // -------------------------------------------------------------------------
  // SIGN OUT
  // -------------------------------------------------------------------------
  const signOut = useCallback(async () => {
    clearUserStorage()

    // Update state IMMEDIATELY before async work
    setState({ status: 'unauthenticated', user: null, accessToken: null })

    try {
      // Clean up realtime channels
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

  // -------------------------------------------------------------------------
  // REFRESH USER (for profile updates)
  // -------------------------------------------------------------------------
  const refreshUser = useCallback(async () => {
    if (!isMountedRef.current) return

    try {
      const profile = await getCurrentUser()
      if (isMountedRef.current && profile) {
        setState(prev => ({
          ...prev,
          user: profile,
        }))
      }
    } catch (error) {
      console.error('[Auth] Error refreshing user:', error)
    }
  }, [])

  // -------------------------------------------------------------------------
  // INITIALIZATION (runs ONCE)
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Strict mode protection
    if (initStartedRef.current) return
    initStartedRef.current = true
    isMountedRef.current = true

    async function init() {
      console.log('[Auth] Initializing...')

      try {
        // STEP 1: Check for local session
        const { data: sessionData } = await supabase.auth.getSession()

        if (!sessionData?.session) {
          // No session = unauthenticated
          console.log('[Auth] No session found')
          if (isMountedRef.current) {
            setState({ status: 'unauthenticated', user: null, accessToken: null })
          }
          return
        }

        // STEP 2: Validate session with server (CRITICAL for soft refresh)
        console.log('[Auth] Session found, validating with server...')
        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (!isMountedRef.current) return

        if (userError || !userData?.user) {
          console.warn('[Auth] Session invalid:', userError?.message)
          setState({ status: 'unauthenticated', user: null, accessToken: null })
          return
        }

        // STEP 3: Session is valid - set authenticated state
        const authUser: AuthUser = {
          id: userData.user.id,
          email: userData.user.email || '',
          full_name: userData.user.user_metadata?.full_name || null,
          avatar_url: userData.user.user_metadata?.avatar_url || null,
          username: null,
        }

        console.log('[Auth] Session validated - authenticated')
        setState({
          status: 'authenticated',
          user: authUser,
          accessToken: sessionData.session.access_token,
        })

        // STEP 4: Load full profile in background (non-blocking)
        try {
          const fullProfile = await getCurrentUser()
          if (fullProfile && isMountedRef.current) {
            setState(prev => ({
              ...prev,
              user: fullProfile,
            }))
            console.log('[Auth] Full profile loaded')
          }
        } catch (profileError) {
          console.error('[Auth] Profile fetch error:', profileError)
          // Keep basic user - auth is still valid
        }
      } catch (error) {
        console.error('[Auth] Critical init error:', error)
        if (isMountedRef.current) {
          setState({ status: 'unauthenticated', user: null, accessToken: null })
        }
      }
    }

    init()

    // Set up auth state change listener (for other tabs, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State change:', event)

        if (!isMountedRef.current) return

        if (event === 'SIGNED_OUT') {
          setState({ status: 'unauthenticated', user: null, accessToken: null })
          clearUserStorage()
          return
        }

        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('[Auth] Token refresh failed')
          setState({ status: 'unauthenticated', user: null, accessToken: null })
          return
        }

        if (session?.user) {
          try {
            const profile = await getCurrentUser()
            if (profile && isMountedRef.current) {
              setState({
                status: 'authenticated',
                user: profile,
                accessToken: session.access_token,
              })
            }
          } catch (error) {
            console.error('[Auth] Profile fetch error:', error)
            // Use basic info from session
            setState({
              status: 'authenticated',
              user: {
                id: session.user.id,
                email: session.user.email || '',
                full_name: session.user.user_metadata?.full_name || null,
                avatar_url: session.user.user_metadata?.avatar_url || null,
                username: null,
              },
              accessToken: session.access_token,
            })
          }
        }
      }
    )

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  // -------------------------------------------------------------------------
  // BFCACHE HANDLER (Safari back-forward cache)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handlePageShow = async (event: PageTransitionEvent) => {
      if (!event.persisted) return

      console.log('[Auth] bfcache restore - validating session')

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session && state.status === 'authenticated') {
          console.log('[Auth] Session expired during bfcache')
          setState({ status: 'unauthenticated', user: null, accessToken: null })
        }
      } catch (error) {
        console.error('[Auth] bfcache session check error:', error)
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [state.status])

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  const value: AuthContextType = {
    ...state,
    signOut,
    refreshUser,
  }

  // CRITICAL: Block ALL rendering until auth is resolved
  if (state.status === 'loading') {
    return (
      <AuthContext.Provider value={value}>
        <GlobalSkeleton />
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================================
// HOOKS
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Legacy compatibility - expose loading as a separate boolean
export function useAuthLoading() {
  const { status } = useAuth()
  return status === 'loading'
}
