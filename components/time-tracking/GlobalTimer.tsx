"use client"

import { useState, useEffect } from 'react'
import { TimeTrackingService, RunningTimer } from '@/lib/services/TimeTrackingService'
import { useAuth } from '@/lib/auth-handler'

/**
 * Global timer indicator shown in the header when any timer is running
 */
export function GlobalTimer() {
  const { user } = useAuth()
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  // Check for running timer on mount and periodically
  useEffect(() => {
    if (!user?.id) return

    async function checkTimer() {
      try {
        const timer = await TimeTrackingService.getRunningTimer(user!.id)
        setRunningTimer(timer)
        if (timer) {
          setElapsedMinutes(timer.elapsed_minutes)
        }
      } catch (error) {
        console.error('Error checking running timer:', error)
      }
    }

    checkTimer()

    // Check every 30 seconds for timer status
    const interval = setInterval(checkTimer, 30000)

    return () => clearInterval(interval)
  }, [user?.id])

  // Update elapsed time every minute when running
  useEffect(() => {
    if (!runningTimer) return

    const interval = setInterval(() => {
      setElapsedMinutes(prev => prev + 1)
    }, 60000)

    return () => clearInterval(interval)
  }, [runningTimer])

  const handleStop = async () => {
    if (!user?.id) return

    try {
      await TimeTrackingService.stopTimer(user.id)
      setRunningTimer(null)
    } catch (error) {
      console.error('Error stopping timer:', error)
    }
  }

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}`
    }
    return `0:${mins.toString().padStart(2, '0')}`
  }

  if (!runningTimer) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-full animate-pulse">
      {/* Recording indicator */}
      <div className="w-2 h-2 bg-red-500 rounded-full" />

      <div className="flex flex-col">
        <span className="text-xs font-mono text-red-600 dark:text-red-400 tabular-nums">
          {formatTime(elapsedMinutes)}
        </span>
        {runningTimer.task_title && (
          <span className="text-[10px] text-red-500 dark:text-red-400 truncate max-w-[120px]">
            {runningTimer.task_title}
          </span>
        )}
      </div>

      <button
        onClick={handleStop}
        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-colors"
        title="Stop timer"
      >
        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>
    </div>
  )
}
