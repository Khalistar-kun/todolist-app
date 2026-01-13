import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { RealtimeProvider } from '@/app/providers/RealtimeProvider'
import { ThemeProvider } from '@/contexts/ThemeContext'

export const metadata = {
  title: 'TodoApp - Organize your work and life',
  description: 'Simple, powerful task manager that helps teams get things done.',
}

// Inline script to prevent theme flash - runs before React hydrates
// This MUST be inline to execute before any rendering
const themeInitScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline theme script to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen transition-colors">
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              {children}
              <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                className: '',
                style: {
                  background: 'var(--toast-bg, #1E293B)',
                  color: 'var(--toast-color, #fff)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#F43F5E',
                    secondary: '#fff',
                  },
                },
              }}
              />
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}