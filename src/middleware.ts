import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const response = NextResponse.next({
    request,
  })

  // Refresh session if expired - required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect routes
  const { pathname } = request.nextUrl
  const protectedRoutes = ['/app', '/projects', '/tasks', '/settings']
  const authRoutes = ['/auth/signin', '/auth/signup', '/auth/reset-password']

  // If accessing protected routes without session, redirect to signin
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !session) {
    const url = new URL('/auth/signin', request.url)
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // If accessing auth routes with session, redirect to app
  if (authRoutes.includes(pathname) && session) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  // Update last seen for authenticated users
  if (session && pathname.startsWith('/app')) {
    try {
      await supabase
        .from('profiles')
        .update({
          last_seen_at: new Date().toISOString(),
          is_online: true
        })
        .eq('id', session.user.id)
    } catch (error) {
      console.error('Failed to update last seen:', error)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}