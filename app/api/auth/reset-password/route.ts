import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
    const { email, pin, newPassword } = body

    if (!email || !pin || !newPassword) {
      return NextResponse.json(
        { error: 'Email, PIN, and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Verify the PIN one more time
    const { data: pinRecord, error: pinError } = await supabaseAdmin
      .from('password_reset_pins')
      .select('*')
      .eq('email', email)
      .eq('pin', pin)
      .eq('verified', true)
      .single()

    if (pinError || !pinRecord) {
      return NextResponse.json(
        { error: 'Invalid or unverified PIN' },
        { status: 400 }
      )
    }

    // Check if PIN has expired
    if (new Date(pinRecord.expires_at) < new Date()) {
      await supabaseAdmin
        .from('password_reset_pins')
        .delete()
        .eq('id', pinRecord.id)

      return NextResponse.json(
        { error: 'PIN has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Find the user by email
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers()

    if (userError) {
      console.error('[API] Error listing users:', userError)
      return NextResponse.json(
        { error: 'Failed to find user' },
        { status: 500 }
      )
    }

    const user = users.users.find(u => u.email === email)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('[API] Error updating password:', updateError)

      // Check for weak password error
      if (updateError.code === 'weak_password' || updateError.message?.includes('weak')) {
        return NextResponse.json(
          { error: 'This password is too weak or has been found in data breaches. Please choose a stronger, unique password.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Delete the used PIN
    await supabaseAdmin
      .from('password_reset_pins')
      .delete()
      .eq('id', pinRecord.id)

    console.log(`[API] Password reset successful for ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('[API] Error in reset-password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
