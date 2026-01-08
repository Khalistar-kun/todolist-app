import { createClient } from '@supabase/supabase-js'

// Admin client that bypasses RLS - only use on server-side
// Use placeholder values during build time to prevent validation errors
// At runtime in API routes, the actual env vars will be available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-build-time-only'

// Create admin client - during build time this creates a non-functional client
// At runtime in API routes, the actual env vars will be available
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
