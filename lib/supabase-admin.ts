import { createClient } from '@supabase/supabase-js'

// Admin client that bypasses RLS - only use on server-side
// Use fallback empty strings during build time to prevent build failures
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Create admin client - during build time this creates a non-functional client
// At runtime in API routes, the actual env vars will be available
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
