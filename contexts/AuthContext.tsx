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

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth loading timeout (10 seconds max)
const AUTH_TIMEOUT_MS = 10000

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
  const initializedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    setUser(null)
    setLoading(false)

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
  }, [user?.id])

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('[Auth] Error refreshing user:', error)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initializedRef.current) return
    initializedRef.current = true

    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Auth loading timed out after', AUTH_TIMEOUT_MS, 'ms')
        setLoading(false)
        setUser(null)
      }
    }, AUTH_TIMEOUT_MS)

    // Get initial session
    const getInitialSession = async () => {
      try {
        // Use getUser() for server-validated auth (more secure than getSession)
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (error) {
          // Session invalid or expired - clear state
          console.warn('[Auth] Session validation error:', error.message)
          setUser(null)
          setLoading(false)
          clearAuthTimeout()
          return
        }

        if (authUser) {
          const profile = await getCurrentUser()
          setUser(profile)
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('[Auth] Error getting initial session:', error)
        setUser(null)
      } finally {
        setLoading(false)
        clearAuthTimeout()
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle sign out event immediately
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          clearUserStorage()
          return
        }

        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('[Auth] Token refresh failed')
          setUser(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          try {
            const profile = await getCurrentUser()
            setUser(profile)
          } catch (error) {
            console.error('[Auth] Error fetching profile on auth change:', error)
            // Don't clear user on profile fetch error - session is still valid
          }
        } else {
          setUser(null)
        }
        setLoading(false)
        clearAuthTimeout()
      }
    )

    return () => {
      subscription.unsubscribe()
      clearAuthTimeout()
    }
  }, [clearAuthTimeout])

  const value = {
    user,
    loading,
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