// Production-ready token storage using database
// This is more secure than environment variables for production

import { createClient } from '@supabase/supabase-js';

interface StoredTokens {
  id: string;
  provider: 'gmail' | 'outlook';
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  scope?: string;
  created_at: string;
  updated_at: string;
}

export class EmailTokenStorage {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for server-side operations
    );
  }

  /**
   * Store OAuth2 tokens securely in database
   */
  async storeTokens(
    provider: 'gmail' | 'outlook',
    tokens: {
      access_token: string;
      refresh_token: string;
      expiry_date: number;
      scope?: string;
      token_type?: string;
    }
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_tokens')
        .upsert({
          provider,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type || 'Bearer',
          expiry_date: new Date(tokens.expiry_date).toISOString(),
          scope: tokens.scope,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'provider',
        });

      if (error) {
        throw new Error(`Failed to store tokens: ${error.message}`);
      }

      console.log(`Tokens stored successfully for ${provider}`);
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  }

  /**
   * Retrieve stored tokens from database
   */
  async getTokens(provider: 'gmail' | 'outlook'): Promise<StoredTokens | null> {
    try {
      const { data, error } = await this.supabase
        .from('email_tokens')
        .select('*')
        .eq('provider', provider)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw new Error(`Failed to retrieve tokens: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error retrieving tokens:', error);
      throw error;
    }
  }

  /**
   * Update access token (used after refresh)
   */
  async updateAccessToken(
    provider: 'gmail' | 'outlook',
    access_token: string,
    expiry_date: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_tokens')
        .update({
          access_token,
          expiry_date: new Date(expiry_date).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('provider', provider);

      if (error) {
        throw new Error(`Failed to update access token: ${error.message}`);
      }

      console.log(`Access token updated for ${provider}`);
    } catch (error) {
      console.error('Error updating access token:', error);
      throw error;
    }
  }

  /**
   * Delete stored tokens (for logout)
   */
  async deleteTokens(provider: 'gmail' | 'outlook'): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_tokens')
        .delete()
        .eq('provider', provider);

      if (error) {
        throw new Error(`Failed to delete tokens: ${error.message}`);
      }

      console.log(`Tokens deleted for ${provider}`);
    } catch (error) {
      console.error('Error deleting tokens:', error);
      throw error;
    }
  }

  /**
   * Check if tokens exist and are not expired
   */
  async isTokenValid(provider: 'gmail' | 'outlook'): Promise<boolean> {
    try {
      const tokens = await this.getTokens(provider);

      if (!tokens) {
        return false;
      }

      // Add 5 minute buffer before expiry
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes
      const currentTime = Date.now();
      const expiryTime = new Date(tokens.expiry_date).getTime();

      return currentTime < (expiryTime - expiryBuffer);
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }
}