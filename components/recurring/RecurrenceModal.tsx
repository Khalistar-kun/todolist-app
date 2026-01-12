"use client"

import { useState, useEffect } from 'react'
import { RecurringTaskService, RecurrenceFormData, RecurrenceFrequency, TaskRecurrence } from '@/lib/services/RecurringTaskService'

interface RecurrenceModalProps {
  taskId: string
  existingRecurrence?: TaskRecurrence | null
  onClose: () => void
  onSave: () => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
]

export function RecurrenceModal({ taskId, existingRecurrence, onClose, onSave }: RecurrenceModalProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(existingRecurrence?.frequency || 'weekly')
  const [interval, setInterval] = useState(existingRecurrence?.interval || 1)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(existingRecurrence?.days_of_week || [1]) // Default to Monday
  const [dayOfMonth, setDayOfMonth] = useState(existingRecurrence?.day_of_month || 1)
  const [startDate, setStartDate] = useState(
    existingRecurrence?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(existingRecurrence?.end_date?.split('T')[0] || '')
  const [maxOccurrences, setMaxOccurrences] = useState(existingRecurrence?.max_occurrences || 0)
  const [endType, setEndType] = useState<'never' | 'date' | 'count'>(
    existingRecurrence?.end_date ? 'date' : existingRecurrence?.max_occurrences ? 'count' : 'never'
  )
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<Date[]>([])

  // Update preview when pattern changes
  useEffect(() => {
    const data: RecurrenceFormData = {
      frequency,
      interval,
      days_of_week: frequency === 'weekly' ? daysOfWeek : undefined,
      day_of_month: ['monthly', 'quarterly', 'yearly'].includes(frequency) ? dayOfMonth : undefined,
      start_date: startDate,
      end_date: endType === 'date' ? endDate : undefined,
      max_occurrences: endType === 'count' ? maxOccurrences : undefined,
    }
    setPreview(RecurringTaskService.getUpcomingOccurrences(data, 5))
  }, [frequency, interval, daysOfWeek, dayOfMonth, startDate, endDate, endType, maxOccurrences])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const data: RecurrenceFormData = {
        frequency,
        interval,
        days_of_week: frequency === 'weekly' ? daysOfWeek : undefined,
        day_of_month: ['monthly', 'quarterly', 'yearly'].includes(frequency) ? dayOfMonth : undefined,
        start_date: startDate,
        end_date: endType === 'date' ? endDate : undefined,
        max_occurrences: endType === 'count' ? maxOccurrences : undefined,
      }

      if (existingRecurrence) {
        await RecurringTaskService.updateRecurrence(existingRecurrence.id, data)
      } else {
        await RecurringTaskService.createRecurrence(taskId, data)
      }

      onSave()
    } catch (error) {
      console.error('Error saving recurrence:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existingRecurrence) return

    if (confirm('Are you sure you want to remove this recurrence pattern?')) {
      try {
        await RecurringTaskService.deleteRecurrence(existingRecurrence.id)
        onSave()
      } catch (error) {
        console.error('Error deleting recurrence:', error)
      }
    }
  }

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {existingRecurrence ? 'Edit Recurrence' : 'Set Recurrence'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Repeat
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {FREQUENCIES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Interval for custom frequency */}
          {frequency === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Every
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={interval}
                  onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <span className="text-gray-700 dark:text-gray-300">days</span>
              </div>
            </div>
          )}

          {/* Days of week for weekly */}
          {frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                On days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDayOfWeek(day.value)}
                    className={`min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      daysOfWeek.includes(day.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of month for monthly/quarterly/yearly */}
          {['monthly', 'quarterly', 'yearly'].includes(frequency) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                On day
              </label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          )}

          {/* Start date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* End condition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ends
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="endType"
                  value="never"
                  checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="w-4 h-4"
                />
                <span className="text-gray-700 dark:text-gray-300">Never</span>
              </label>
              <label className="flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="endType"
                  value="date"
                  checked={endType === 'date'}
                  onChange={() => setEndType('date')}
                  className="w-4 h-4"
                />
                <span className="text-gray-700 dark:text-gray-300">On date</span>
                {endType === 'date' && (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="ml-2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </label>
              <label className="flex items-center gap-2 min-h-[44px]">
                <input
                  type="radio"
                  name="endType"
                  value="count"
                  checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="w-4 h-4"
                />
                <span className="text-gray-700 dark:text-gray-300">After</span>
                {endType === 'count' && (
                  <>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={maxOccurrences}
                      onChange={(e) => setMaxOccurrences(parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <span className="text-gray-700 dark:text-gray-300">occurrences</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Next occurrences
              </div>
              <div className="space-y-1">
                {preview.map((date, i) => (
                  <div key={i} className="text-sm text-gray-600 dark:text-gray-400">
                    {date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            {existingRecurrence && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Remove
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : existingRecurrence ? 'Update' : 'Set Recurrence'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
