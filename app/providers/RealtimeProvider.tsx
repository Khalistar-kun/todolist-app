"use client"

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// ============================================================================
// TYPES
// ============================================================================

type ChangeHandler = (payload: RealtimePostgresChangesPayload<any>) => void

interface RealtimeContextType {
  subscribe: (table: string, handler: ChangeHandler, filter?: string) => () => void
  isConnected: boolean
}

// Tables we subscribe to at the root level
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

// ============================================================================
// CONTEXT
// ============================================================================

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

// ============================================================================
// SINGLETON STATE (module-level, survives re-renders)
// ============================================================================

// These live OUTSIDE the component to be true singletons
let globalChannel: RealtimeChannel | null = null
let globalUserId: string | null = null
let globalHandlers: Map<string, Set<ChangeHandler>> = new Map()
let isChannelSetup = false

// ============================================================================
// FILTER MATCHING
// ============================================================================

function matchesFilter(payload: any, filter: string): boolean {
  if (!filter) return true

  const [column, rest] = filter.split('=')
  if (!rest) return true

  const [op, value] = rest.split('.')
  if (op !== 'eq') return true

  const record = payload.new || payload.old
  if (!record) return false

  return String(record[column]) === value
}

// ============================================================================
// REALTIME PROVIDER
// ============================================================================

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)

  // Ref to track if we initiated cleanup (prevents double cleanup)
  const cleanupInitiatedRef = useRef(false)

  // -------------------------------------------------------------------------
  // HANDLER ROUTING
  // -------------------------------------------------------------------------
  const handleChange = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    const table = payload.table

    // Route to table-specific handlers
    const handlers = globalHandlers.get(table)
    if (handlers && handlers.size > 0) {
      handlers.forEach(handler => {
        try {
          handler(payload)
        } catch (error) {
          console.error(`[Realtime] Handler error for ${table}:`, error)
        }
      })
    }

    // Route to filtered handlers
    globalHandlers.forEach((handlers, key) => {
      if (key.startsWith(`${table}:`)) {
        const filter = key.substring(table.length + 1)
        if (matchesFilter(payload, filter)) {
          handlers.forEach(handler => {
            try {
              handler(payload)
            } catch (error) {
              console.error(`[Realtime] Filtered handler error:`, error)
            }
          })
        }
      }
    })
  }, [])

  // -------------------------------------------------------------------------
  // SUBSCRIBE FUNCTION (exposed to components)
  // -------------------------------------------------------------------------
  const subscribe = useCallback((table: string, handler: ChangeHandler, filter?: string): () => void => {
    const key = filter ? `${table}:${filter}` : table

    // Add handler to global registry
    if (!globalHandlers.has(key)) {
      globalHandlers.set(key, new Set())
    }
    globalHandlers.get(key)!.add(handler)

    // Return unsubscribe function (only removes handler, NOT the channel)
    return () => {
      const handlers = globalHandlers.get(key)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          globalHandlers.delete(key)
        }
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // CHANNEL SETUP (singleton, creates ONE channel per user session)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const userId = user?.id || null
    const isAuthenticated = status === 'authenticated' && userId !== null

    // Case 1: User logged out - destroy channel
    if (!isAuthenticated && globalChannel && !cleanupInitiatedRef.current) {
      cleanupInitiatedRef.current = true
      console.log('[Realtime] User logged out - destroying channel')
      supabase.removeChannel(globalChannel)
      globalChannel = null
      globalUserId = null
      isChannelSetup = false
      globalHandlers.clear()
      setIsConnected(false)
      cleanupInitiatedRef.current = false
      return
    }

    // Case 2: Not authenticated - nothing to do
    if (!isAuthenticated) return

    // Case 3: Different user - recreate channel
    if (globalUserId && globalUserId !== userId && globalChannel) {
      console.log('[Realtime] User changed - recreating channel')
      supabase.removeChannel(globalChannel)
      globalChannel = null
      globalUserId = null
      isChannelSetup = false
    }

    // Case 4: Already setup for this user - nothing to do
    if (isChannelSetup && globalChannel && globalUserId === userId) {
      return
    }

    // Setup new channel
    globalUserId = userId
    isChannelSetup = true
    console.log('[Realtime] Creating channel for user:', userId)

    const channelName = `app-realtime-${userId}`
    let channel = supabase.channel(channelName)

    // Subscribe to all tables
    REALTIME_TABLES.forEach(table => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => handleChange(payload as RealtimePostgresChangesPayload<any>)
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

    globalChannel = channel

    // NO cleanup function - channel persists across re-renders
    // Only destroyed on explicit logout (handled above)
  }, [user?.id, status, handleChange])

  // -------------------------------------------------------------------------
  // APP UNMOUNT CLEANUP
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (globalChannel) {
        console.log('[Realtime] App unmount - cleaning up channel')
        supabase.removeChannel(globalChannel)
        globalChannel = null
        globalUserId = null
        isChannelSetup = false
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  const value: RealtimeContextType = {
    subscribe,
    isConnected,
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

// ============================================================================
// HOOKS
// ============================================================================

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

/**
 * Hook for components to subscribe to table changes
 * Uses the centralized channel - does NOT create per-component channels
 */
export function useRealtimeTable(
  table: string,
  onChange: () => void,
  options: { enabled?: boolean; filter?: string } = {}
) {
  const { subscribe } = useRealtime()
  const { enabled = true, filter } = options

  // Stable callback ref
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
