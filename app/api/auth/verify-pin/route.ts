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
    const { email, pin } = body

    if (!email || !pin) {
      return NextResponse.json(
        { error: 'Email and PIN are required' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Check if PIN exists and is valid
    const { data: pinRecord, error: pinError } = await supabaseAdmin
      .from('password_reset_pins')
      .select('*')
      .eq('email', email)
      .eq('pin', pin)
      .single()

    if (pinError || !pinRecord) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 400 }
      )
    }

    // Check if PIN has expired
    if (new Date(pinRecord.expires_at) < new Date()) {
      // Delete expired PIN
      await supabaseAdmin
        .from('password_reset_pins')
        .delete()
        .eq('id', pinRecord.id)

      return NextResponse.json(
        { error: 'PIN has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if PIN has been used too many times (max 3 attempts)
    if (pinRecord.attempts >= 3) {
      // Delete the PIN
      await supabaseAdmin
        .from('password_reset_pins')
        .delete()
        .eq('id', pinRecord.id)

      return NextResponse.json(
        { error: 'Too many attempts. Please request a new PIN.' },
        { status: 400 }
      )
    }

    // Mark PIN as verified
    await supabaseAdmin
      .from('password_reset_pins')
      .update({
        verified: true,
        attempts: pinRecord.attempts + 1,
      })
      .eq('id', pinRecord.id)

    return NextResponse.json({
      success: true,
      message: 'PIN verified successfully',
    })
  } catch (error) {
    console.error('[API] Error in verify-pin:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
