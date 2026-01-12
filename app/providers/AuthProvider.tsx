"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from 'react'
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
// CONSTANTS
// ============================================================================

// Maximum time to wait for auth initialization before showing error
const AUTH_TIMEOUT_MS = 10000 // 10 seconds

// ============================================================================
// SINGLETON AUTH STORE (survives React re-renders and soft refresh)
// ============================================================================

type Listener = () => void

class AuthStore {
  private state: AuthState = {
    status: 'loading',
    user: null,
    accessToken: null,
  }
  private listeners = new Set<Listener>()
  private initialized = false
  private initPromise: Promise<void> | null = null
  private initStartTime: number = 0

  getState = (): AuthState => {
    return this.state
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setState(newState: AuthState) {
    this.state = newState
    this.listeners.forEach(listener => listener())
  }

  async initialize(): Promise<void> {
    // If already initialized and authenticated, don't re-init
    // This handles soft refresh where JS context persists
    if (this.initialized && this.state.status !== 'loading') {
      console.log('[Auth] Already initialized, status:', this.state.status)
      return
    }

    // If init is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise
    }

    this.initStartTime = Date.now()
    this.initPromise = this.doInitialize()

    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  private async doInitialize(): Promise<void> {
    console.log('[Auth] Initializing...')
    this.setState({ status: 'loading', user: null, accessToken: null })

    try {
      // STEP 1: Check for local session with timeout
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Session fetch timeout')), AUTH_TIMEOUT_MS)
      )

      let sessionData: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']
      try {
        const result = await Promise.race([sessionPromise, timeoutPromise])
        sessionData = result.data
      } catch (timeoutError) {
        console.error('[Auth] Session fetch timed out after', AUTH_TIMEOUT_MS, 'ms')
        this.setState({ status: 'unauthenticated', user: null, accessToken: null })
        this.initialized = true
        return
      }

      if (!sessionData?.session) {
        console.log('[Auth] No session found')
        this.setState({ status: 'unauthenticated', user: null, accessToken: null })
        this.initialized = true
        return
      }

      // STEP 2: Validate session with server (with timeout)
      console.log('[Auth] Session found, validating...')
      const userPromise = supabase.auth.getUser()
      const userTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('User validation timeout')), AUTH_TIMEOUT_MS)
      )

      let userData: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']
      let userError: Awaited<ReturnType<typeof supabase.auth.getUser>>['error']

      try {
        const result = await Promise.race([userPromise, userTimeoutPromise])
        userData = result.data
        userError = result.error
      } catch (timeoutError) {
        console.error('[Auth] User validation timed out')
        // If validation times out but we have a session, try to use cached session
        // This prevents being locked out on slow connections
        const authUser: AuthUser = {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email || '',
          full_name: sessionData.session.user.user_metadata?.full_name || null,
          avatar_url: sessionData.session.user.user_metadata?.avatar_url || null,
          username: null,
        }
        console.log('[Auth] Using cached session due to timeout')
        this.setState({
          status: 'authenticated',
          user: authUser,
          accessToken: sessionData.session.access_token,
        })
        this.initialized = true
        return
      }

      if (userError || !userData?.user) {
        console.warn('[Auth] Session invalid:', userError?.message)
        this.setState({ status: 'unauthenticated', user: null, accessToken: null })
        this.initialized = true
        return
      }

      // STEP 3: Set authenticated state
      const authUser: AuthUser = {
        id: userData.user.id,
        email: userData.user.email || '',
        full_name: userData.user.user_metadata?.full_name || null,
        avatar_url: userData.user.user_metadata?.avatar_url || null,
        username: null,
      }

      const initDuration = Date.now() - this.initStartTime
      console.log('[Auth] Session validated - authenticated in', initDuration, 'ms')
      this.setState({
        status: 'authenticated',
        user: authUser,
        accessToken: sessionData.session.access_token,
      })
      this.initialized = true

      // STEP 4: Load full profile in background (non-blocking)
      this.loadFullProfile()
    } catch (error) {
      console.error('[Auth] Critical init error:', error)
      this.setState({ status: 'unauthenticated', user: null, accessToken: null })
      this.initialized = true
    }
  }

  // Load full profile in background - non-blocking
  private async loadFullProfile(): Promise<void> {
    try {
      const fullProfile = await getCurrentUser()
      if (fullProfile && this.state.status === 'authenticated') {
        this.setState({
          ...this.state,
          user: fullProfile,
        })
        console.log('[Auth] Full profile loaded')
      }
    } catch (profileError) {
      // Non-critical error - we already have basic user info
      console.error('[Auth] Profile fetch error (non-critical):', profileError)
    }
  }

  async signOut(): Promise<void> {
    // Clear storage
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('profile-') || key.startsWith('notifications-') || key.startsWith('welcome-seen-'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (e) {
      console.error('[Auth] Error clearing localStorage:', e)
    }

    // Update state immediately
    this.initialized = false
    this.setState({ status: 'unauthenticated', user: null, accessToken: null })

    try {
      const channels = supabase.getChannels()
      await Promise.all(channels.map(channel => supabase.removeChannel(channel)))
      await supabase.auth.signOut({ scope: 'global' })
    } catch (err) {
      console.error('[Auth] Error during signOut:', err)
    }
  }

  async refreshUser(): Promise<void> {
    if (this.state.status !== 'authenticated') return

    try {
      const profile = await getCurrentUser()
      if (profile) {
        this.setState({ ...this.state, user: profile })
      }
    } catch (error) {
      console.error('[Auth] Error refreshing user:', error)
    }
  }

  // Handle auth state changes from Supabase
  // IMPORTANT: Only handle actual state changes, not tab visibility events
  handleAuthChange(event: string, session: any) {
    // Ignore INITIAL_SESSION - we handle initialization ourselves
    if (event === 'INITIAL_SESSION') {
      return
    }

    console.log('[Auth] State change:', event)

    if (event === 'SIGNED_OUT') {
      // Only update if we think we're authenticated
      if (this.state.status === 'authenticated') {
        this.initialized = false
        this.setState({ status: 'unauthenticated', user: null, accessToken: null })
      }
      return
    }

    if (event === 'SIGNED_IN' && session?.user) {
      // Only re-init if we're not already authenticated as this user
      if (this.state.status !== 'authenticated' || this.state.user?.id !== session.user.id) {
        this.initialized = false
        this.initialize()
      }
      return
    }

    if (event === 'TOKEN_REFRESHED' && session?.access_token) {
      // Just update the token, don't trigger re-render cascade
      if (this.state.accessToken !== session.access_token) {
        this.state = { ...this.state, accessToken: session.access_token }
        // Don't notify listeners for just a token update - it's not user-facing
      }
    }
  }

  // Force re-initialization (for testing/debugging)
  reset() {
    this.initialized = false
    this.initPromise = null
    this.setState({ status: 'loading', user: null, accessToken: null })
  }
}

// Global singleton instance
const authStore = new AuthStore()

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ============================================================================
// GLOBAL SKELETON WITH TIMEOUT
// ============================================================================

function GlobalSkeleton() {
  const [showTimeout, setShowTimeout] = useState(false)

  useEffect(() => {
    // Show timeout message after AUTH_TIMEOUT_MS
    const timer = setTimeout(() => {
      setShowTimeout(true)
    }, AUTH_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        {showTimeout && (
          <div className="text-center mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg max-w-sm">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Taking longer than expected...
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 underline hover:no-underline"
            >
              Refresh page
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// AUTH PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use useSyncExternalStore for proper subscription to singleton store
  const state = useSyncExternalStore(
    authStore.subscribe,
    authStore.getState,
    authStore.getState // Server snapshot (same as client for this use case)
  )

  // Initialize on mount
  useEffect(() => {
    authStore.initialize()

    // Set up Supabase auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => authStore.handleAuthChange(event, session)
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Handle bfcache restoration
  useEffect(() => {
    const handlePageShow = async (event: PageTransitionEvent) => {
      if (!event.persisted) return
      console.log('[Auth] bfcache restore')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session && state.status === 'authenticated') {
        authStore.handleAuthChange('SIGNED_OUT', null)
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [state.status])

  // Create stable callbacks
  const signOut = useCallback(() => authStore.signOut(), [])
  const refreshUser = useCallback(() => authStore.refreshUser(), [])

  const value: AuthContextType = {
    ...state,
    signOut,
    refreshUser,
  }

  // Block rendering until auth resolves
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

export function useAuthLoading() {
  const { status } = useAuth()
  return status === 'loading'
}
