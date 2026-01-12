"use client"

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type ChangeHandler = (payload: RealtimePostgresChangesPayload<any>) => void

interface RealtimeContextType {
  // Subscribe to table changes - returns unsubscribe function
  subscribe: (table: string, handler: ChangeHandler, filter?: string) => () => void
  // Check if realtime is connected
  isConnected: boolean
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

// Tables that we support realtime for
const REALTIME_TABLES = [
  'projects',
  'tasks',
  'project_members',
  'notifications',
  'comments',
  'organization_announcements',
  'organization_meetings',
  'organizations',
  'organization_members',
] as const

type RealtimeTable = typeof REALTIME_TABLES[number]

/**
 * Centralized Realtime Provider
 *
 * ARCHITECTURE:
 * - Single channel created per authenticated session
 * - Components register handlers via subscribe()
 * - Channel lives at app root, survives page navigation
 * - Only destroyed on logout
 *
 * This prevents the "unsubscribe spam" caused by per-component subscriptions
 * that get destroyed on every re-render or navigation.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, status, isInitialized } = useAuth()
  const [isConnected, setIsConnected] = useState(false)

  // Single channel for all subscriptions
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Map of table -> Set of handlers
  const handlersRef = useRef<Map<string, Set<ChangeHandler>>>(new Map())

  // Track if we've set up the channel
  const isSetupRef = useRef(false)

  // Prevent cleanup during normal operation
  const isCleaningUpRef = useRef(false)

  // Central handler that routes events to registered handlers
  const handleChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    const table = payload.table
    const handlers = handlersRef.current.get(table)

    if (handlers && handlers.size > 0) {
      handlers.forEach(handler => {
        try {
          handler(payload)
        } catch (error) {
          console.error(`[Realtime] Handler error for ${table}:`, error)
        }
      })
    }
  }, [])

  // Subscribe function exposed to components
  const subscribe = useCallback((table: string, handler: ChangeHandler, filter?: string): () => void => {
    // Create key for filtered subscriptions
    const key = filter ? `${table}:${filter}` : table

    // Add handler to registry
    if (!handlersRef.current.has(key)) {
      handlersRef.current.set(key, new Set())
    }
    handlersRef.current.get(key)!.add(handler)

    // Return unsubscribe function
    return () => {
      const handlers = handlersRef.current.get(key)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          handlersRef.current.delete(key)
        }
      }
    }
  }, [])

  // Track user ID for logout detection
  const currentUserIdRef = useRef<string | null>(null)

  // Set up channel ONCE when authenticated
  // CRITICAL: This effect should NOT re-run on normal state changes
  useEffect(() => {
    // Don't do anything until auth is initialized
    if (!isInitialized) return

    const userId = user?.id || null
    const wasAuthenticated = currentUserIdRef.current !== null
    const isAuthenticated = status === 'authenticated' && userId !== null

    // Case 1: User logged out - clean up channel
    if (wasAuthenticated && !isAuthenticated) {
      if (channelRef.current && !isCleaningUpRef.current) {
        isCleaningUpRef.current = true
        console.log('[Realtime] User logged out - destroying channel')
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        isSetupRef.current = false
        currentUserIdRef.current = null
        setIsConnected(false)
        isCleaningUpRef.current = false
      }
      return
    }

    // Case 2: User changed (different user logged in) - recreate channel
    if (wasAuthenticated && isAuthenticated && currentUserIdRef.current !== userId) {
      if (channelRef.current) {
        console.log('[Realtime] User changed - recreating channel')
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        isSetupRef.current = false
      }
    }

    // Case 3: Not authenticated - nothing to do
    if (!isAuthenticated) return

    // Case 4: Already set up for this user - nothing to do
    if (isSetupRef.current && channelRef.current && currentUserIdRef.current === userId) {
      return
    }

    // Set up new channel
    currentUserIdRef.current = userId
    isSetupRef.current = true
    console.log('[Realtime] Creating channel for user:', userId)

    const channelName = `app-realtime-${userId}`
    let channel = supabase.channel(channelName)

    // Subscribe to all supported tables
    REALTIME_TABLES.forEach(table => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          // Route to table-specific handlers
          handleChange(payload as RealtimePostgresChangesPayload<any>)

          // Also check for filtered handlers
          handlersRef.current.forEach((handlers, key) => {
            if (key.startsWith(`${table}:`)) {
              const filter = key.substring(table.length + 1)
              if (matchesFilter(payload, filter)) {
                handlers.forEach(handler => {
                  try {
                    handler(payload as RealtimePostgresChangesPayload<any>)
                  } catch (error) {
                    console.error(`[Realtime] Filtered handler error:`, error)
                  }
                })
              }
            }
          })
        }
      )
    })

    // Subscribe to channel
    channel.subscribe((subscribeStatus, err) => {
      if (subscribeStatus === 'SUBSCRIBED') {
        console.log('[Realtime] Channel connected')
        setIsConnected(true)
      } else if (subscribeStatus === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel error:', err)
        setIsConnected(false)
      } else if (subscribeStatus === 'TIMED_OUT') {
        console.error('[Realtime] Channel timed out')
        setIsConnected(false)
      } else if (subscribeStatus === 'CLOSED') {
        console.log('[Realtime] Channel closed')
        setIsConnected(false)
      }
    })

    channelRef.current = channel

    // NO cleanup here - channel persists across effect re-runs
    // Cleanup only happens on explicit logout (handled above)
  }, [user?.id, status, isInitialized, handleChange])

  // Cleanup on unmount (app close)
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        console.log('[Realtime] App unmount - cleaning up channel')
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  const value = {
    subscribe,
    isConnected,
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

/**
 * Simple filter matching for realtime payloads
 * Supports format: "column=eq.value"
 */
function matchesFilter(payload: any, filter: string): boolean {
  if (!filter) return true

  const [column, rest] = filter.split('=')
  if (!rest) return true

  const [op, value] = rest.split('.')
  if (op !== 'eq') return true // Only support eq for now

  const record = payload.new || payload.old
  if (!record) return false

  return String(record[column]) === value
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

/**
 * Hook for components to subscribe to table changes
 * This is a drop-in replacement for useRealtimeSubscription
 * but uses the centralized channel instead of creating per-component channels
 */
export function useRealtimeTable(
  table: string,
  onChange: () => void,
  options: { enabled?: boolean; filter?: string } = {}
) {
  const { subscribe } = useRealtime()
  const { enabled = true, filter } = options

  // Stable callback ref to prevent re-subscriptions
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled) return

    const handler: ChangeHandler = () => {
      onChangeRef.current()
    }

    const unsubscribe = subscribe(table, handler, filter)
    return unsubscribe
  }, [subscribe, table, filter, enabled])
}
