"use client"

import { useCallback, useRef, useEffect, useState } from 'react'
import { TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { SensorOptions } from '@dnd-kit/core'

// =============================================================================
// BODY SCROLL LOCK UTILITIES
// =============================================================================

let scrollLockCount = 0
let scrollY = 0

export function lockBodyScroll() {
  if (typeof document === 'undefined') return

  if (scrollLockCount === 0) {
    scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.touchAction = 'none'
  }
  scrollLockCount++
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return

  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    document.body.style.touchAction = ''
    window.scrollTo(0, scrollY)
  }
}

// =============================================================================
// MOBILE DETECTION
// =============================================================================

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

// =============================================================================
// MOBILE-OPTIMIZED DND SENSORS HOOK
// =============================================================================

export interface MobileDndSensorsOptions {
  /**
   * Long press delay in ms for touch devices
   * @default 400
   */
  touchDelay?: number
  /**
   * Movement tolerance during long press (px)
   * If exceeded, drag is cancelled (user is scrolling)
   * @default 5
   */
  touchTolerance?: number
  /**
   * Distance to move before drag activates on desktop
   * @default 10
   */
  mouseDistance?: number
  /**
   * Callback when drag starts (for locking scroll)
   */
  onDragStart?: () => void
  /**
   * Callback when drag ends (for unlocking scroll)
   */
  onDragEnd?: () => void
}

/**
 * Returns optimized sensors for both mobile and desktop:
 * - Mobile: Uses TouchSensor with delay-based activation (long press)
 * - Desktop: Uses MouseSensor with distance-based activation
 */
export function useMobileDndSensors(options: MobileDndSensorsOptions = {}) {
  const {
    touchDelay = 400,
    touchTolerance = 5,
    mouseDistance = 10,
  } = options

  // TouchSensor with delay - requires holding for touchDelay ms
  // If user moves more than touchTolerance px, activation is cancelled (scrolling)
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: touchDelay,
      tolerance: touchTolerance,
    },
  })

  // MouseSensor with distance - requires moving mouseDistance px to activate
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: mouseDistance,
    },
  })

  // Combine sensors - dnd-kit will use the appropriate one based on input type
  return useSensors(touchSensor, mouseSensor)
}

// =============================================================================
// DRAG STATE HOOK (for managing scroll lock and visual feedback)
// =============================================================================

export interface DragState {
  isDragging: boolean
  activeId: string | null
}

export function useDragState() {
  const [state, setState] = useState<DragState>({
    isDragging: false,
    activeId: null,
  })

  const handleDragStart = useCallback((activeId: string) => {
    setState({ isDragging: true, activeId })
    lockBodyScroll()

    // Haptic feedback on mobile
    if (isTouchDevice() && 'vibrate' in navigator) {
      navigator.vibrate(50)
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    setState({ isDragging: false, activeId: null })
    unlockBodyScroll()
  }, [])

  const handleDragCancel = useCallback(() => {
    setState({ isDragging: false, activeId: null })
    unlockBodyScroll()
  }, [])

  return {
    ...state,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  }
}

// =============================================================================
// LONG PRESS VISUAL FEEDBACK HOOK
// =============================================================================

export interface LongPressOptions {
  delay?: number
  onActivate?: () => void
}

/**
 * Hook for adding long-press visual feedback to draggable items
 * Shows pending state during the delay period
 */
export function useLongPressIndicator(options: LongPressOptions = {}) {
  const { delay = 400, onActivate } = options
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPending, setIsPending] = useState(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return

    // Don't show indicator on interactive elements
    const target = e.target as HTMLElement
    if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(target.tagName)) {
      return
    }

    startPosRef.current = { x: touch.clientX, y: touch.clientY }
    setIsPending(true)

    timerRef.current = setTimeout(() => {
      setIsPending(false)
      onActivate?.()
    }, delay)
  }, [delay, onActivate])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPending) return

    const touch = e.touches[0]
    if (!touch) return

    const dx = Math.abs(touch.clientX - startPosRef.current.x)
    const dy = Math.abs(touch.clientY - startPosRef.current.y)

    // Cancel if moved too much (user is scrolling)
    if (dx > 5 || dy > 5) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setIsPending(false)
    }
  }, [isPending])

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsPending(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    isPending,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
  }
}
