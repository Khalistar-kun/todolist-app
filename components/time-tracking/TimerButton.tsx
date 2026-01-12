"use client"

import { useState, useEffect, useCallback } from 'react'
import { TimeTrackingService, RunningTimer } from '@/lib/services/TimeTrackingService'

interface TimerButtonProps {
  taskId: string
  userId: string
  onTimerChange?: (isRunning: boolean, elapsed?: number) => void
  size?: 'sm' | 'md' | 'lg'
  showElapsed?: boolean
}

export function TimerButton({
  taskId,
  userId,
  onTimerChange,
  size = 'md',
  showElapsed = true,
}: TimerButtonProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const [loading, setLoading] = useState(false)
  const [timerId, setTimerId] = useState<string | null>(null)

  // Check for running timer on mount
  useEffect(() => {
    async function checkRunningTimer() {
      try {
        const timer = await TimeTrackingService.getRunningTimer(userId)
        if (timer && timer.task_id === taskId) {
          setIsRunning(true)
          setElapsedMinutes(timer.elapsed_minutes)
          setTimerId(timer.id)
          onTimerChange?.(true, timer.elapsed_minutes)
        }
      } catch (error) {
        console.error('Error checking running timer:', error)
      }
    }

    checkRunningTimer()
  }, [taskId, userId, onTimerChange])

  // Update elapsed time every minute when running
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setElapsedMinutes(prev => {
        const newElapsed = prev + 1
        onTimerChange?.(true, newElapsed)
        return newElapsed
      })
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [isRunning, onTimerChange])

  const handleToggle = useCallback(async () => {
    if (loading) return

    setLoading(true)
    try {
      if (isRunning) {
        // Stop timer
        await TimeTrackingService.stopTimer(userId)
        setIsRunning(false)
        setTimerId(null)
        onTimerChange?.(false)
      } else {
        // Start timer
        const entry = await TimeTrackingService.startTimer(taskId, userId)
        setIsRunning(true)
        setElapsedMinutes(0)
        setTimerId(entry.id)
        onTimerChange?.(true, 0)
      }
    } catch (error) {
      console.error('Error toggling timer:', error)
    } finally {
      setLoading(false)
    }
  }, [isRunning, loading, taskId, userId, onTimerChange])

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-2.5 text-base',
  }

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`
        inline-flex items-center gap-1.5 rounded-md transition-all
        ${sizeClasses[size]}
        ${isRunning
          ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800'
          : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
        }
        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        tap-highlight-none touch-target
      `}
      title={isRunning ? 'Stop timer' : 'Start timer'}
    >
      {isRunning ? (
        <>
          {/* Stop icon */}
          <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
          {showElapsed && (
            <span className="font-mono tabular-nums">{formatTime(elapsedMinutes)}</span>
          )}
        </>
      ) : (
        <>
          {/* Play icon */}
          <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
          {showElapsed && size !== 'sm' && <span>Start</span>}
        </>
      )}
    </button>
  )
}
