import { getSupabaseBrowser } from './supabase/client';
import { useEffect, useState } from 'react';

export interface AuthState {
  user: any;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const sb = getSupabaseBrowser();

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await sb.auth.getSession();

        if (error) {
          console.error('Auth initialization error:', error);
          setAuthState({
            user: null,
            loading: false,
            error: error.message
          });
        } else {
          setAuthState({
            user: session?.user || null,
            loading: false,
            error: null
          });
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        setAuthState({
          user: null,
          loading: false,
          error: err.message
        });
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = sb.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);

        if (event === 'SIGNED_IN' && session) {
          setAuthState({
            user: session.user,
            loading: false,
            error: null
          });
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            loading: false,
            error: null
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string) => {
    const sb = getSupabaseBrowser();

    try {
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send magic link'
      };
    }
  };

  const signOut = async () => {
    const sb = getSupabaseBrowser();

    try {
      const { error } = await sb.auth.signOut();

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: error.message || 'Failed to sign out'
      };
    }
  };

  return {
    ...authState,
    signIn,
    signOut
  };
}