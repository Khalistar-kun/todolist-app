import { useEffect, useRef, useCallback } from 'react'
import { useRealtime } from '@/contexts/RealtimeContext'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface SubscriptionConfig {
  table: string
  schema?: string
  event?: PostgresChangeEvent
  filter?: string
}

interface UseRealtimeSubscriptionOptions {
  subscriptions: SubscriptionConfig[]
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void
  onChange?: (payload: RealtimePostgresChangesPayload<any>) => void
  enabled?: boolean
}

/**
 * Hook for subscribing to Supabase real-time changes on database tables
 *
 * ARCHITECTURE: This hook uses the centralized RealtimeContext instead of
 * creating per-component channels. This prevents the "unsubscribe spam"
 * that occurred when components re-rendered or auth state changed.
 *
 * The centralized channel:
 * - Lives at app root (RealtimeProvider)
 * - Survives page navigation
 * - Only destroyed on logout
 * - Handlers are registered/unregistered without recreating the channel
 *
 * @example
 * useRealtimeSubscription({
 *   subscriptions: [
 *     { table: 'organization_announcements', filter: `organization_id=eq.${orgId}` },
 *     { table: 'organization_meetings', filter: `organization_id=eq.${orgId}` },
 *   ],
 *   onChange: () => refetchData(),
 *   enabled: !!orgId,
 * })
 */
export function useRealtimeSubscription({
  subscriptions,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  const { subscribe } = useRealtime()

  // Stable refs to prevent re-subscriptions on callback changes
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const onChangeRef = useRef(onChange)

  // Update refs on each render
  onInsertRef.current = onInsert
  onUpdateRef.current = onUpdate
  onDeleteRef.current = onDelete
  onChangeRef.current = onChange

  // Stable handler that routes to appropriate callbacks
  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      switch (payload.eventType) {
        case 'INSERT':
          onInsertRef.current?.(payload)
          break
        case 'UPDATE':
          onUpdateRef.current?.(payload)
          break
        case 'DELETE':
          onDeleteRef.current?.(payload)
          break
      }
      onChangeRef.current?.(payload)
    },
    []
  )

  // Create stable subscription key - only table and filter matter
  const subscriptionsKey = JSON.stringify(
    subscriptions.map(s => ({ table: s.table, filter: s.filter }))
  )

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) {
      return
    }

    // Register handlers for each subscription with the central manager
    const unsubscribers: (() => void)[] = []

    subscriptions.forEach(config => {
      const unsubscribe = subscribe(config.table, handleChange, config.filter)
      unsubscribers.push(unsubscribe)
    })

    // Cleanup: unregister handlers (does NOT destroy the channel)
    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [subscriptionsKey, enabled, handleChange, subscribe])

  // Return object for API compatibility
  return {
    unsubscribe: () => {
      // No-op - cleanup is handled automatically by effect
    },
  }
}

/**
 * Simplified hook for subscribing to a single table
 */
export function useTableSubscription(
  table: string,
  filter: string | undefined,
  onDataChange: () => void,
  enabled = true
) {
  return useRealtimeSubscription({
    subscriptions: filter ? [{ table, filter }] : [{ table }],
    onChange: onDataChange,
    enabled,
  })
}
