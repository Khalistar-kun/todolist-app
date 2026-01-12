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

    this.initPromise = this.doInitialize()
    await this.initPromise
    this.initPromise = null
  }

  private async doInitialize(): Promise<void> {
    console.log('[Auth] Initializing...')
    this.setState({ status: 'loading', user: null, accessToken: null })

    try {
      // STEP 1: Check for local session
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData?.session) {
        console.log('[Auth] No session found')
        this.setState({ status: 'unauthenticated', user: null, accessToken: null })
        this.initialized = true
        return
      }

      // STEP 2: Validate session with server
      console.log('[Auth] Session found, validating...')
      const { data: userData, error: userError } = await supabase.auth.getUser()

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

      console.log('[Auth] Session validated - authenticated')
      this.setState({
        status: 'authenticated',
        user: authUser,
        accessToken: sessionData.session.access_token,
      })
      this.initialized = true

      // STEP 4: Load full profile in background
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
        console.error('[Auth] Profile fetch error:', profileError)
      }
    } catch (error) {
      console.error('[Auth] Critical init error:', error)
      this.setState({ status: 'unauthenticated', user: null, accessToken: null })
      this.initialized = true
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
  handleAuthChange(event: string, session: any) {
    console.log('[Auth] State change:', event)

    if (event === 'SIGNED_OUT') {
      this.setState({ status: 'unauthenticated', user: null, accessToken: null })
      return
    }

    if (event === 'SIGNED_IN' && session?.user) {
      // Re-initialize to get fresh state
      this.initialized = false
      this.initialize()
    }

    if (event === 'TOKEN_REFRESHED' && session?.access_token) {
      this.setState({ ...this.state, accessToken: session.access_token })
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
// GLOBAL SKELETON
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
