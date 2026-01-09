import { supabase } from './supabase'
import type { Profile } from './supabase'

export interface AuthUser {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
  username?: string | null
}

export async function signUp(email: string, password: string, fullName: string) {
  try {
    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (authError) throw authError

    if (authData.user) {
      // Create profile record
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: authData.user.email!,
        full_name: fullName,
      })

      if (profileError) throw profileError

      // Create default organization for new user
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: `${fullName}'s Workspace`,
          slug: `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          created_by: authData.user.id,
        })
        .select()
        .single()

      if (orgError) throw orgError

      // Add user as owner of the organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: authData.user.id,
          role: 'owner',
        })

      if (memberError) throw memberError
    }

    return { success: true, data: authData }
  } catch (error: any) {
    console.error('Sign up error:', error)
    return { success: false, error: error.message }
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // Wait a moment for cookies to be set
    await new Promise(resolve => setTimeout(resolve, 100))

    return { success: true, data }
  } catch (error: any) {
    console.error('[Auth] Sign in error:', error)
    return { success: false, error: error.message }
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Sign out error:', error)
    return { success: false, error: error.message }
  }
}

export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Reset password error:', error)
    return { success: false, error: error.message }
  }
}

export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Update password error:', error)
    return { success: false, error: error.message }
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Get profile data
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error

    return {
      id: user.id,
      email: user.email!,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      username: profile.username,
    }
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Update profile error:', error)
    return { success: false, error: error.message }
  }
}

export async function uploadAvatar(userId: string, file: File) {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    // Update profile with avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (updateError) throw updateError

    return { success: true, avatarUrl: publicUrl }
  } catch (error: any) {
    console.error('Upload avatar error:', error)
    return { success: false, error: error.message }
  }
}

export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    console.error('Google sign in error:', error)
    return { success: false, error: error.message }
  }
}

export async function signInWithMagicLink(email: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    console.error('Magic link sign in error:', error)
    return { success: false, error: error.message }
  }
}

// Auth state listener
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const profile = await getCurrentUser()
      callback(profile)
    } else {
      callback(null)
    }
  })
}