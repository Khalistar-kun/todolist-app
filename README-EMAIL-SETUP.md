# Gmail OAuth2 SMTP Setup for Dynamic IP Environments

This complete setup allows you to send emails via Gmail SMTP using OAuth2, which works perfectly with dynamic IP addresses like Starlink. The setup includes automatic token refresh and backup SMTP fallback.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install nodemailer google-auth-library googleapis
npm install -D @types/nodemailer
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable APIs:
   - Gmail API
   - Google+ API (if not already enabled)

4. Create OAuth2 Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "Gmail SMTP OAuth2"
   - Add redirect URI: `https://yourdomain.com/api/auth/gmail/callback`

5. Set up OAuth Consent Screen:
   - Go to "APIs & Services" → "OAuth consent screen"
   - Add required scopes: `https://www.googleapis.com/auth/gmail.send`

### 3. Environment Configuration

Copy `.env.example` to `.env.local` and configure:

```env
# Google OAuth2
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/gmail/callback

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
SMTP_FROM_EMAIL=your-email@gmail.com

# Backup SMTP (optional but recommended)
BACKUP_SMTP_HOST=smtp.yourbackupprovider.com
BACKUP_SMTP_PORT=587
BACKUP_SMTP_USER=backup_email@provider.com
BACKUP_SMTP_PASS=backup_password
```

### 4. Database Setup (Production Only)

Run the provided SQL in your Supabase SQL editor to create the email tokens table:

```sql
-- Run email-setup.sql in Supabase SQL editor
```

### 5. Connect Gmail

Navigate to your setup page (`/setup`) and click "Connect Gmail" to authorize your account.

## 📁 File Structure

```
lib/
├── gmail-oauth2.ts          # OAuth2 token management
├── smtp-service.ts          # Email sending service
└── email-token-storage.ts   # Database token storage (production)

app/api/
├── auth/gmail/
│   ├── initiate/route.ts    # Start OAuth2 flow
│   ├── callback/route.ts    # Handle OAuth2 callback
│   └── status/route.ts      # Check/refresh tokens
└── email/
    ├── send/route.ts        # Send email API
    └── test/route.ts        # Test configuration

components/
└── email-setup.tsx          # Setup UI component

examples/
└── email-usage.ts           # Usage examples
```

## 🔧 Usage Examples

### Send an Email

```javascript
import { SMTPService } from '@/lib/smtp-service';

const smtpService = new SMTPService();

const result = await smtpService.sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello from OAuth2!',
  html: '<h1>This email was sent using Gmail OAuth2</h1>',
  text: 'This email was sent using Gmail OAuth2',
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

### Send via API

```javascript
const response = await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'user@example.com',
    subject: 'Test Email',
    html: '<p>This is a test email</p>',
  }),
});

const result = await response.json();
```

### Test Configuration

```javascript
const response = await fetch('/api/email/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    testEmail: 'your-test-email@example.com',
  }),
});
```

## 🔐 Security Features

- **OAuth2 Authentication**: No need to store Gmail passwords
- **Automatic Token Refresh**: Tokens refresh automatically before expiry
- **Secure Storage**: Tokens stored securely (environment variables or database)
- **CSRF Protection**: State parameter prevents CSRF attacks
- **Rate Limiting**: Built-in delays to prevent rate limiting
- **Fallback System**: Backup SMTP ensures email delivery even if OAuth2 fails

## 🔄 Token Management

The system automatically:

1. **Detects** when access tokens are about to expire (5-minute buffer)
2. **Refreshes** tokens using the refresh token
3. **Updates** stored tokens securely
4. **Falls back** to backup SMTP if refresh fails

## 📧 Backup SMTP Options

### SendGrid
```env
BACKUP_SMTP_HOST=smtp.sendgrid.net
BACKUP_SMTP_PORT=587
BACKUP_SMTP_USER=apikey
BACKUP_SMTP_PASS=your_sendgrid_api_key
```

### Mailgun
```env
BACKUP_SMTP_HOST=smtp.mailgun.org
BACKUP_SMTP_PORT=587
BACKUP_SMTP_USER=postmaster@yourdomain.mailgun.org
BACKUP_SMTP_PASS=your_mailgun_password
```

### Postmark
```env
BACKUP_SMTP_HOST=smtp.postmarkapp.com
BACKUP_SMTP_PORT=587
BACKUP_SMTP_USER=your_postmark_server_token
BACKUP_SMTP_PASS=your_postmark_server_token
```

## 🚨 Troubleshooting

### Common Issues

1. **"No refresh token received"**
   - Make sure to use `prompt=consent` and `access_type=offline` in OAuth2 URL
   - Revoke existing app permissions and try again

2. **"Invalid redirect URI"**
   - Check that the redirect URI matches exactly in Google Console
   - Include the full URL with https://

3. **"Token refresh failed"**
   - Check that refresh token is still valid
   - User may need to re-authenticate

4. **"Rate limit exceeded"**
   - Built-in delays help prevent this
   - Consider increasing delay between bulk emails

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=smtp:*
```

## 📊 Monitoring

### Health Check Endpoint

```bash
curl https://yourdomain.com/api/email/test
```

### Status Check

```javascript
const status = await fetch('/api/auth/gmail/status');
const { configured, message } = await status.json();
```

## 🔧 Advanced Configuration

### Custom Token Storage

For production, use the database storage instead of environment variables:

```javascript
import { EmailTokenStorage } from '@/lib/email-token-storage';

const tokenStorage = new EmailTokenStorage();
await tokenStorage.storeTokens('gmail', tokens);
```

### Custom Email Templates

```javascript
const html = await renderEmailTemplate('welcome', { userName: 'John' });
await smtpService.sendEmail({ to: email, subject, html });
```

### Bulk Email Sending

The system includes built-in support for bulk email with individualization and rate limiting.

## 📈 Performance

- **Token Refresh**: Only when needed (typically every 50-60 minutes)
- **Fallback Detection**: Immediate if primary fails
- **Rate Limiting**: 1-second delay between emails (configurable)
- **Caching**: Token status cached for 5 minutes

## 🆘 Support

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Verify environment variables are correctly set
3. Check Google Cloud Console for OAuth2 configuration
4. Test with the provided test endpoint
5. Enable debug logging for detailed error information

## 🔄 Backup Options

If OAuth2 completely fails:

1. **App Passwords**: Use Gmail app passwords (less secure)
2. **Third-party Services**: SendGrid, Mailgun, Postmark
3. **SMTP Relay**: Use your hosting provider's SMTP relay

The built-in fallback system handles this automatically.