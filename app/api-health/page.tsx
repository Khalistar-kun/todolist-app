'use client'

import { useEffect, useState } from 'react'

interface HealthCheck {
  name: string
  status: 'checking' | 'success' | 'error'
  message?: string
  details?: any
  duration?: number
}

export default function APIHealthPage() {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { name: 'Database Connection', status: 'checking' },
    { name: 'Profiles Table', status: 'checking' },
    { name: 'Organizations Table', status: 'checking' },
    { name: 'Projects Table', status: 'checking' },
    { name: 'Tasks Table', status: 'checking' },
    { name: 'Comments Table', status: 'checking' },
    { name: 'Activity Logs Table', status: 'checking' },
    { name: 'Notifications Table', status: 'checking' },
    { name: 'Task Assignments Table', status: 'checking' },
    { name: 'Slack Integrations Table', status: 'checking' },
    { name: 'Teams Table', status: 'checking' },
    { name: 'Mentions Table', status: 'checking' },
    { name: 'Attention Items Table', status: 'checking' },
  ])

  const updateCheck = (name: string, status: 'success' | 'error', message?: string, details?: any, duration?: number) => {
    setChecks(prev => prev.map(check =>
      check.name === name
        ? { ...check, status, message, details, duration }
        : check
    ))
  }

  useEffect(() => {
    runHealthChecks()
  }, [])

  const runHealthChecks = async () => {
    // Test Database Connection
    await testEndpoint(
      'Database Connection',
      '/api/health',
      'GET'
    )

    // Test Profiles
    await testEndpoint(
      'Profiles Table',
      '/api/profile',
      'GET'
    )

    // Test Organizations
    await testEndpoint(
      'Organizations Table',
      '/api/organizations',
      'GET'
    )

    // Test Projects
    await testEndpoint(
      'Projects Table',
      '/api/projects',
      'GET'
    )

    // Test Tasks
    await testEndpoint(
      'Tasks Table',
      '/api/tasks',
      'GET'
    )

    // Test Comments
    await testEndpoint(
      'Comments Table',
      '/api/comments',
      'GET'
    )

    // Test Activity Logs
    await testEndpoint(
      'Activity Logs Table',
      '/api/activity',
      'GET'
    )

    // Test Notifications
    await testEndpoint(
      'Notifications Table',
      '/api/notifications',
      'GET'
    )

    // Test Task Assignments
    await testEndpoint(
      'Task Assignments Table',
      '/api/task-assignments',
      'GET'
    )

    // Test Slack Integrations
    await testEndpoint(
      'Slack Integrations Table',
      '/api/slack/integrations',
      'GET'
    )

    // Test Teams
    await testEndpoint(
      'Teams Table',
      '/api/teams',
      'GET'
    )

    // Test Mentions
    await testEndpoint(
      'Mentions Table',
      '/api/mentions',
      'GET'
    )

    // Test Attention Items
    await testEndpoint(
      'Attention Items Table',
      '/api/attention',
      'GET'
    )
  }

  const testEndpoint = async (name: string, url: string, method: string = 'GET') => {
    const startTime = performance.now()

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const duration = Math.round(performance.now() - startTime)
      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        updateCheck(
          name,
          'success',
          `${response.status} ${response.statusText}`,
          data,
          duration
        )
      } else {
        updateCheck(
          name,
          'error',
          `${response.status} ${response.statusText}`,
          data,
          duration
        )
      }
    } catch (error: any) {
      const duration = Math.round(performance.now() - startTime)
      updateCheck(
        name,
        'error',
        error.message || 'Network error',
        { error: error.toString() },
        duration
      )
    }
  }

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'checking':
        return (
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      case 'success':
        return (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
    }
  }

  const getStatusColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'checking':
        return 'bg-blue-50 border-blue-200'
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
    }
  }

  const successCount = checks.filter(c => c.status === 'success').length
  const errorCount = checks.filter(c => c.status === 'error').length
  const checkingCount = checks.filter(c => c.status === 'checking').length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            API Health Check Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Testing all database connections and API endpoints
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Checks</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{checks.length}</div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow p-6">
            <div className="text-sm text-green-600 dark:text-green-400 mb-1">Passed</div>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">{successCount}</div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow p-6">
            <div className="text-sm text-red-600 dark:text-red-400 mb-1">Failed</div>
            <div className="text-3xl font-bold text-red-700 dark:text-red-300">{errorCount}</div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow p-6">
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Checking</div>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{checkingCount}</div>
          </div>
        </div>

        {/* Health Checks */}
        <div className="space-y-4">
          {checks.map((check) => (
            <div
              key={check.name}
              className={`border-2 rounded-lg p-6 transition-all ${getStatusColor(check.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="mt-0.5">
                    {getStatusIcon(check.status)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {check.name}
                    </h3>
                    {check.message && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {check.message}
                      </p>
                    )}
                    {check.duration !== undefined && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Response time: {check.duration}ms
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {check.status === 'error' && check.details && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-800">
                    View Error Details
                  </summary>
                  <pre className="mt-2 p-4 bg-red-100 dark:bg-red-900/30 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(check.details, null, 2)}
                  </pre>
                </details>
              )}

              {/* Success Details */}
              {check.status === 'success' && check.details && Object.keys(check.details).length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-green-700 dark:text-green-300 hover:text-green-800">
                    View Response Data
                  </summary>
                  <pre className="mt-2 p-4 bg-green-100 dark:bg-green-900/30 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(check.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>

        {/* Refresh Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => {
              setChecks(checks.map(c => ({ ...c, status: 'checking', message: undefined, details: undefined, duration: undefined })))
              runHealthChecks()
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Re-run Health Checks
          </button>
        </div>

        {/* Migration Instructions */}
        {errorCount > 0 && (
          <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
              ⚠️ Database Migration Required
            </h3>
            <p className="text-yellow-800 dark:text-yellow-300 mb-4">
              Some API endpoints are failing because the database tables don't exist yet. Follow these steps:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-yellow-800 dark:text-yellow-300">
              <li>Open Supabase SQL Editor: <a href="https://supabase.com/dashboard/project/qyjzqzqqjimittltttph" className="underline" target="_blank" rel="noopener noreferrer">Dashboard Link</a></li>
              <li>Copy the contents of <code className="bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded">safe-migration.sql</code></li>
              <li>Paste into SQL Editor and click "Run"</li>
              <li>Wait for completion (30-60 seconds)</li>
              <li>Refresh this page to verify</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
