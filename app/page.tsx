"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

// Maximum time to show loading spinner before showing landing page
const MAX_LOADING_TIME_MS = 5000

export default function HomePage() {
  const [showDemo, setShowDemo] = useState(false)
  const [forceShowLanding, setForceShowLanding] = useState(false)
  const { user, status } = useAuth()
  const router = useRouter()
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle OAuth redirect - if code param exists, forward to callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      router.replace(`/auth/callback?code=${code}`)
    }
  }, [router])

  // Set timeout to prevent infinite loading - only if auth is still checking
  useEffect(() => {
    if (status === 'loading' && !forceShowLanding) {
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('[Home] Loading timeout reached, showing landing page')
        setForceShowLanding(true)
      }, MAX_LOADING_TIME_MS)
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [status, forceShowLanding])

  // Redirect authenticated users to dashboard
  useEffect(() => {
    // Only redirect when we have confirmed authentication
    if (status === 'authenticated' && user) {
      router.push('/app')
    }
  }, [user, status, router])

  // Show spinner while auth is loading (not timed out)
  if (status === 'loading' && !forceShowLanding) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  // Redirect in progress - show spinner while navigating
  if (status === 'authenticated' && user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  // Only show landing page when we've confirmed user is NOT authenticated
  // OR if loading has timed out (forceShowLanding)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-semibold text-lg text-gray-900">
                TodoApp
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href="/auth/signin"
                className="text-sm px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 md:pt-24 md:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight text-gray-900 tracking-tight">
            Organize your work
            <br />
            <span className="text-blue-500">
              and life, finally
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto font-normal">
            Stay organized with TodoApp—the simple, powerful task manager
            that helps teams get things done.
          </p>

          <div className="flex justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 group px-6 py-3 text-base bg-blue-500 text-white hover:bg-blue-600 rounded-lg font-medium transition-all"
            >
              Get started for free
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Free during beta • No credit card required
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 bg-white">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 tracking-tight">
            Everything you need
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto font-normal">
            Powerful features for teams of all sizes
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
          <div className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-2 text-gray-900">
              Team collaboration
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Assign tasks to multiple people and keep everyone aligned.
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-2 text-gray-900">
              Workflow automation
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Create workflows that move tasks through stages automatically.
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-2 text-gray-900">
              Slack integration
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Get real-time updates directly in your Slack channels.
            </p>
          </div>
        </div>
      </section>

  
      {/* Footer */}
      <footer className="border-t border-gray-100 mt-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">TodoApp</span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2025 TodoApp. Built with Next.js & Supabase. App Router Migration Complete!
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}