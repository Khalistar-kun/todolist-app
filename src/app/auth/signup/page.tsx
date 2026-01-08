import { AuthLayout } from '@/components/auth/AuthLayout'
import { SignUpForm } from '@/components/auth/SignUpForm'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <>
      <AuthLayout
        title="Create your account"
        subtitle="Start organizing your tasks and projects today."
      >
        <SignUpForm />
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