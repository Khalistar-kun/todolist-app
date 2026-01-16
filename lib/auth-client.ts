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
    // NOTE: The database trigger 'handle_new_user' automatically creates the profile
    // when a user is inserted into auth.users, so we do NOT manually insert into profiles
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
      // Wait briefly for the database trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify the profile was created by the trigger
      const { data: profile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single()

      if (profileCheckError || !profile) {
        console.error('[SignUp] Profile trigger may have failed, profile not found:', profileCheckError)
        // The trigger should have created the profile, but if it didn't, we have a DB issue
        throw new Error('Database error saving new user. Please try again.')
      }

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

      if (orgError) {
        console.error('[SignUp] Error creating organization:', orgError)
        // Don't fail signup if org creation fails, user can create one later
      } else {
        // Add user as owner of the organization
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: orgData.id,
            user_id: authData.user.id,
            role: 'owner',
          })

        if (memberError) {
          console.error('[SignUp] Error adding user to organization:', memberError)
        }
      }
    }

    return { success: true, data: authData }
  } catch (error: any) {
    console.error('[SignUp] Error:', error)
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
    let { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // If profile doesn't exist (trigger failed), create it now
    if (error && error.code === 'PGRST116') {
      console.warn('[Auth] Profile not found for user, creating fallback profile:', user.id)

      const fullName = user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'User'

      const avatarUrl = user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null

      // Create the missing profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          avatar_url: avatarUrl,
          profile_completed: false,
        }, { onConflict: 'id' })
        .select()
        .single()

      if (createError) {
        console.error('[Auth] Failed to create fallback profile:', createError)
        // Return basic user info even without full profile
        return {
          id: user.id,
          email: user.email!,
          full_name: fullName,
          avatar_url: avatarUrl,
          username: null,
        }
      }

      profile = newProfile
      console.log('[Auth] Fallback profile created successfully')
    } else if (error) {
      throw error
    }

    return {
      id: user.id,
      email: user.email!,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      username: profile.username,
    }
  } catch (error) {
    console.error('[Auth] Get current user error:', error)
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