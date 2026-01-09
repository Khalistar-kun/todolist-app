import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

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
 * IMPORTANT: This hook properly cleans up subscriptions when:
 * - Component unmounts
 * - enabled becomes false (e.g., user logs out)
 * - subscriptions change
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
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isCleaningUpRef = useRef(false)
  const subscriptionsKey = JSON.stringify(subscriptions)

  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      // Call specific event handlers
      switch (payload.eventType) {
        case 'INSERT':
          onInsert?.(payload)
          break
        case 'UPDATE':
          onUpdate?.(payload)
          break
        case 'DELETE':
          onDelete?.(payload)
          break
      }
      // Always call the general onChange handler
      onChange?.(payload)
    },
    [onInsert, onUpdate, onDelete, onChange]
  )

  // Cleanup function that can be called from multiple places
  const cleanup = useCallback(() => {
    if (isCleaningUpRef.current) return
    isCleaningUpRef.current = true

    if (channelRef.current) {
      const tables = subscriptions.map(s => s.table).join(', ')
      console.log(`[Realtime] Unsubscribing from ${tables}`)
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    isCleaningUpRef.current = false
  }, [subscriptions])

  useEffect(() => {
    // Clean up existing channel before creating new one or when disabled
    cleanup()

    if (!enabled || subscriptions.length === 0) {
      return
    }

    // Create a unique channel name based on subscriptions
    const channelName = `realtime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create the channel
    let channel = supabase.channel(channelName)

    // Add subscriptions for each table
    subscriptions.forEach((config) => {
      const { table, schema = 'public', event = '*', filter } = config

      const subscriptionConfig: any = {
        event,
        schema,
        table,
      }

      if (filter) {
        subscriptionConfig.filter = filter
      }

      channel = channel.on(
        'postgres_changes',
        subscriptionConfig,
        handleChange
      )
    })

    // Subscribe to the channel
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        // Reduce logging noise
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel error:', err)
      } else if (status === 'TIMED_OUT') {
        console.error('[Realtime] Subscription timed out')
      }
    })

    channelRef.current = channel

    // Cleanup on unmount or when subscriptions change
    return cleanup
  }, [subscriptionsKey, enabled, handleChange, cleanup])

  // Return function to manually unsubscribe
  return {
    unsubscribe: () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
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
