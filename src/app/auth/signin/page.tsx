import { AuthLayout } from '@/components/auth/AuthLayout'
import { SignInForm } from '@/components/auth/SignInForm'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <>
      <AuthLayout
        title="Sign in to your account"
        subtitle="Welcome back! Please enter your details."
      >
        <SignInForm />
      </AuthLayout>

      {/* Back to home link */}
      <div className="text-center mt-6">
        <Link
          href="/"
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1"
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