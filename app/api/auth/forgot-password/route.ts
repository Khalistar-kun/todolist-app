import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/email-service'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check if user exists
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers()

    if (userError) {
      console.error('[API] Error listing users:', userError)
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      )
    }

    const userExists = users.users.some(u => u.email === email)

    if (!userExists) {
      // For security, still return success but don't include PIN
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a reset PIN has been sent.',
      })
    }

    // Generate a 6-digit PIN on the server
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString()

    // Delete any existing PINs for this email
    await supabaseAdmin
      .from('password_reset_pins')
      .delete()
      .eq('email', email)

    // Insert new PIN with 15 minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error: insertError } = await supabaseAdmin
      .from('password_reset_pins')
      .insert({
        email,
        pin: generatedPin,
        expires_at: expiresAt,
        verified: false,
        attempts: 0,
      })

    if (insertError) {
      console.error('[API] Error storing PIN:', insertError)
      return NextResponse.json(
        { error: 'Failed to create reset PIN' },
        { status: 500 }
      )
    }

    // Send email with PIN
    const emailResult = await emailService.sendPasswordResetPinEmail(email, generatedPin)

    if (!emailResult.success) {
      console.error('[API] Failed to send password reset email:', emailResult.error)
      // Don't expose email sending failure to user for security
      // The PIN is still stored, so if email eventually arrives, it will work
    } else {
      console.log(`[API] Password reset email sent to ${email}`)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a reset PIN has been sent.',
    })
  } catch (error) {
    console.error('[API] Error in forgot-password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
