"use client"

import { useAuth } from '@/app/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
}

/**
 * AuthGuard - Unified auth protection for all protected pages
 *
 * This component implements the SINGLE SOURCE OF TRUTH for auth state handling:
 *
 * 1. status === 'loading' → Show skeleton/fallback (neutral UI)
 * 2. status === 'authenticated' → Render children
 * 3. status === 'unauthenticated' → Redirect to login
 *
 * IMPORTANT: This prevents auth flash by NEVER rendering login UI during loading.
 * The skeleton is shown until auth state is definitively resolved.
 */
export function AuthGuard({
  children,
  fallback,
  redirectTo = '/auth/signin'
}: AuthGuardProps) {
  const { status } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Only redirect when we're CERTAIN the user is not authenticated
    if (status === 'unauthenticated') {
      router.replace(redirectTo)
    }
  }, [status, router, redirectTo])

  // Loading state - show skeleton or fallback
  // CRITICAL: Never show login UI here, only neutral loading state
  if (status === 'loading') {
    return fallback || <DefaultSkeleton />
  }

  // Unauthenticated - show nothing while redirecting
  // The useEffect will handle the redirect
  if (status === 'unauthenticated') {
    return fallback || <DefaultSkeleton />
  }

  // Authenticated - render children
  return <>{children}</>
}

/**
 * Default skeleton loader for protected pages
 * Renders a neutral loading state that doesn't imply logged-in or logged-out
 */
function DefaultSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-0 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Skeleton Header */}
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-96 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>

        {/* Skeleton Content Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="ml-4 flex-1">
                  <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2" />
                  <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                      <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for pages that need auth state but handle their own UI
 * Returns a consistent auth state object with helper booleans
 */
export function useAuthState() {
  const { user, status } = useAuth()

  return {
    user,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isUnauthenticated: status === 'unauthenticated',
    // Only true when we have CONFIRMED authentication (not just presence of user object)
    isReady: status !== 'loading',
  }
}
