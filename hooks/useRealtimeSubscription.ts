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

  useEffect(() => {
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
        console.log(`[Realtime] Subscribed to ${subscriptions.map(s => s.table).join(', ')}`, { subscriptions })
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Channel error:', err)
      } else if (status === 'TIMED_OUT') {
        console.error('[Realtime] Subscription timed out')
      } else {
        console.log('[Realtime] Status:', status)
      }
    })

    channelRef.current = channel

    // Cleanup on unmount or when subscriptions change
    return () => {
      if (channelRef.current) {
        console.log(`[Realtime] Unsubscribing from ${subscriptions.map(s => s.table).join(', ')}`)
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [subscriptionsKey, enabled, handleChange])

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
