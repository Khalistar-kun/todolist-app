import { Suspense } from 'react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { SignInForm } from '@/components/auth/SignInForm'
import Link from 'next/link'

// Loading fallback for SignInForm (uses useSearchParams which requires Suspense)
function SignInFormFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  )
}

export default function SignInPage() {
  return (
    <>
      <AuthLayout
        title="Sign in to your account"
        subtitle="Welcome back! Please enter your details."
      >
        <Suspense fallback={<SignInFormFallback />}>
          <SignInForm />
        </Suspense>
      </AuthLayout>

      {/* Back to home link */}
      <div className="text-center mt-6">
        <Link
          href="/"
          className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 flex items-center justify-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>
    </>
  )
}
