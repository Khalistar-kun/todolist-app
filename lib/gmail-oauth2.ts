import { google } from 'googleapis';

export interface GmailOAuth2Tokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope?: string;
  token_type?: string;
}

export class GmailOAuth2Manager {
  private oauth2Client: any;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID!;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI!;

    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    // Set up the scopes
    const scopes = ['https://www.googleapis.com/auth/gmail.send'];
    this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important for getting refresh token
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Get the authorization URL for Google OAuth2
   */
  getAuthUrl(): string {
    const scopes = ['https://www.googleapis.com/auth/gmail.send'];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: this.generateState(), // Add state parameter for security
    });
  }

  /**
   * Generate a secure state parameter for CSRF protection
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<GmailOAuth2Tokens> {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);

      if (!tokens.refresh_token) {
        throw new Error('No refresh token received. Make sure to use prompt=consent and access_type=offline');
      }

      // Store tokens in environment variables or database
      this.storeTokens(tokens);

      return tokens as GmailOAuth2Tokens;
    } catch (error) {
      console.error('Error getting OAuth2 tokens:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Store tokens securely
   */
  private storeTokens(tokens: GmailOAuth2Tokens): void {
    // In production, store these in a secure database
    // For now, we'll update environment variables
    process.env.GMAIL_OAUTH2_ACCESS_TOKEN = tokens.access_token;
    process.env.GMAIL_OAUTH2_REFRESH_TOKEN = tokens.refresh_token;
    process.env.GMAIL_OAUTH2_TOKEN_EXPIRY = tokens.expiry_date.toString();
  }

  /**
   * Get stored tokens
   */
  private getStoredTokens(): GmailOAuth2Tokens | null {
    const accessToken = process.env.GMAIL_OAUTH2_ACCESS_TOKEN;
    const refreshToken = process.env.GMAIL_OAUTH2_REFRESH_TOKEN;
    const expiryDate = process.env.GMAIL_OAUTH2_TOKEN_EXPIRY;

    if (!accessToken || !refreshToken || !expiryDate) {
      return null;
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: parseInt(expiryDate),
      token_type: 'Bearer',
    };
  }

  /**
   * Check if access token is expired
   */
  private isTokenExpired(tokens: GmailOAuth2Tokens): boolean {
    if (!tokens.expiry_date) return true;

    // Add 5 minute buffer before expiry
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    return Date.now() >= (tokens.expiry_date - expiryBuffer);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string> {
    const tokens = this.getStoredTokens();

    if (!tokens) {
      throw new Error('No stored tokens found. Please re-authenticate.');
    }

    if (!this.isTokenExpired(tokens)) {
      return tokens.access_token;
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: tokens.refresh_token,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update stored tokens
      const newTokens: GmailOAuth2Tokens = {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || tokens.refresh_token, // Keep old refresh token if not provided
        expiry_date: credentials.expiry_date || Date.now() + (credentials.expires_in! * 1000),
        token_type: credentials.token_type || 'Bearer',
      };

      this.storeTokens(newTokens);
      return newTokens.access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token. Please re-authenticate.');
    }
  }

  /**
   * Get a valid access token (refreshes if necessary)
   */
  async getValidAccessToken(): Promise<string> {
    try {
      return await this.refreshAccessToken();
    } catch (error) {
      console.error('Error getting valid access token:', error);
      throw error;
    }
  }

  /**
   * Revoke tokens (for logout)
   */
  async revokeTokens(): Promise<void> {
    const tokens = this.getStoredTokens();
    if (!tokens) return;

    try {
      await this.oauth2Client.revokeToken(tokens.access_token);

      // Clear stored tokens
      delete process.env.GMAIL_OAUTH2_ACCESS_TOKEN;
      delete process.env.GMAIL_OAUTH2_REFRESH_TOKEN;
      delete process.env.GMAIL_OAUTH2_TOKEN_EXPIRY;
    } catch (error) {
      console.error('Error revoking tokens:', error);
    }
  }
}