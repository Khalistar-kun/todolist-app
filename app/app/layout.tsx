import { AppNavigation } from '@/components/layout/AppNavigation'
import { NotificationBanner } from '@/components/notifications/NotificationBanner'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <AppNavigation />
      <NotificationBanner />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}