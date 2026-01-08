# Google Workspace SMTP Setup Guide for Next.js Applications

## Overview

This guide covers setting up Google Workspace SMTP for sending emails from your Next.js applications using your domain (theprojectseo.com) with proper security practices and integration examples.

## 1. Google Workspace Setup

### 1.1 Domain Configuration

1. **Access Google Admin Console**:
   - Go to [admin.google.com](https://admin.google.com)
   - Sign in with your admin account

2. **Verify Domain Ownership**:
   - Navigate to `Domains` > `Manage domains`
   - Add `theprojectseo.com` if not already added
   - Complete domain verification (DNS TXT record)

3. **Enable Gmail for Organization**:
   - Go to `Apps` > `Google Workspace` > `Gmail`
   - Ensure Gmail is enabled for users who will send emails

### 1.2 SMTP Relay Service Configuration

1. **Enable SMTP Relay Service**:
   - Navigate to `Apps` > `Google Workspace` > `Gmail` > `Routing`
   - Click `SMTP relay service` > `Configure SMTP relay service`

2. **Add SMTP Configuration**:
   ```
   Allowed Senders:
   - Only addresses in your organization

   Authentication:
   - Require SMTP Authentication

   Encryption:
   - Require TLS encryption

   IP Address Restrictions:
   - Add your server IPs (if using specific IPs)
   - Or leave unrestricted for development (with caution)
   ```

3. **Save Configuration**

## 2. Authentication Methods

### Option 1: App Passwords (Recommended for Development)

1. **Enable 2-Step Verification**:
   - Go to myaccount.google.com/security
   - Enable 2-Step Verification for the account

2. **Generate App Password**:
   ```
   - Go to myaccount.google.com/apppasswords
   - Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Name it: "Next.js SMTP"
   - Generate and save the 16-character password
   ```

### Option 2: OAuth2 (Recommended for Production)

1. **Create OAuth2 Credentials**:
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Select your project
   - Navigate to `APIs & Services` > `Credentials`
   - Create credentials > `OAuth client ID`
   - Application type: `Web application`
   - Authorized redirect URIs: Add your callback URL

2. **Enable Gmail API**:
   - Go to `APIs & Services` > `Library`
   - Search and enable `Gmail API`

## 3. Next.js Integration

### 3.1 Install Required Packages

```bash
npm install nodemailer
npm install @types/nodemailer # For TypeScript
```

### 3.2 Email Service Configuration

Create `/lib/email.ts`:

```typescript
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: nodemailer.Attachment[];
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private config: SMTPConfig;

  constructor(config: SMTPConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransporter({
      ...config,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${this.config.auth.user}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

    await this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Please click the link below to verify your email address:</p>
          <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email
          </a>
          <p style="margin-top: 20px; color: #666;">
            If you didn't request this verification, please ignore this email.
          </p>
        </div>
      `
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    await this.sendEmail({
      to: email,
      subject: 'Reset your password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
          <p style="margin-top: 20px; color: #666;">
            This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
          </p>
        </div>
      `
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return false;
    }
  }
}

export default EmailService;
```

### 3.3 Email Service Initialization

Create `/lib/email-service.ts`:

```typescript
import EmailService from './email';

const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!
  }
};

export const emailService = new EmailService(emailConfig);

export async function initializeEmailService() {
  const isConnected = await emailService.testConnection();
  if (!isConnected) {
    console.error('Failed to initialize email service');
  }
  return isConnected;
}
```

### 3.4 API Route for Sending Emails

Create `/app/api/send-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email-service';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const { success, limit, remaining, reset } = await rateLimit(request);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString()
          }
        }
      );
    }

    const { to, subject, text, html } = await request.json();

    // Validate required fields
    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      );
    }

    await emailService.sendEmail({
      to,
      subject,
      text,
      html
    });

    return NextResponse.json(
      { message: 'Email sent successfully' },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString()
        }
      }
    );

  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
```

## 4. Environment Variables

Create `.env.local` (never commit this file):

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@theprojectseo.com
SMTP_PASS=your-app-password-here

# Email Display
EMAIL_FROM_NAME=The Project SEO
NEXT_PUBLIC_APP_URL=https://theprojectseo.com

# OAuth2 (if using instead of app passwords)
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_REDIRECT_URI=https://theprojectseo.com/api/auth/google/callback
```

## 5. Rate Limiting Implementation

Create `/lib/rate-limit.ts`:

```typescript
import { NextRequest } from 'next/server';

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  request: NextRequest,
  limit: number = 10, // requests per window
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<RateLimitResult> {
  const identifier = request.ip || 'anonymous';
  const now = Date.now();

  // Clean up expired entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }

  // Get or create entry
  const entry = rateLimitMap.get(identifier) || { count: 0, resetTime: now + windowMs };

  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + windowMs;
  }

  entry.count++;
  rateLimitMap.set(identifier, entry);

  return {
    success: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.resetTime
  };
}
```

## 6. Google Workspace SMTP Quotas and Limits

### 6.1 Sending Limits (as of 2024)

| Account Type | Daily Limit | Per-minute Limit |
|--------------|-------------|------------------|
| G Suite Basic | 2,000 | 100 |
| G Suite Business | 10,000 | 500 |
| G Suite Enterprise | Unlimited | 1,000 |

### 6.2 Best Practices for Rate Limiting

```typescript
// Implement exponential backoff for failed attempts
const sendEmailWithRetry = async (emailOptions: EmailOptions, maxRetries = 3) => {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await emailService.sendEmail(emailOptions);
      return { success: true };
    } catch (error) {
      attempt++;

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: wait 2^attempt * 1000ms
      const waitTime = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};
```

## 7. Security Best Practices

### 7.1 App Security

```typescript
// Validate email addresses
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sanitize HTML content
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const sanitizeHtml = (html: string): string => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['href', 'target']
  });
};
```

### 7.2 Environment Security

```typescript
// Validate environment variables on startup
const requiredEnvVars = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM_NAME'
];

const validateEnvironment = () => {
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(process.env.SMTP_USER!)) {
    throw new Error('Invalid SMTP_USER format');
  }

  console.log('Environment variables validated successfully');
};

// Call during application startup
validateEnvironment();
```

## 8. Production Deployment Considerations

### 8.1 Vercel Environment Variables

```bash
# Set in Vercel dashboard or CLI
vercel env add SMTP_USER
vercel env add SMTP_PASS
vercel env add EMAIL_FROM_NAME
vercel env add NEXT_PUBLIC_APP_URL
```

### 8.2 Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Health check to verify email service
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "import('./lib/email-service.js').then(m => m.initializeEmailService().then(console.log))"
```

### 8.3 Monitoring and Logging

```typescript
// lib/email-monitoring.ts
interface EmailMetrics {
  sent: number;
  failed: number;
  lastSent: Date | null;
  errors: string[];
}

class EmailMonitor {
  private metrics: EmailMetrics = {
    sent: 0,
    failed: 0,
    lastSent: null,
    errors: []
  };

  recordSent() {
    this.metrics.sent++;
    this.metrics.lastSent = new Date();
  }

  recordFailed(error: string) {
    this.metrics.failed++;
    this.metrics.errors.push(error);

    // Keep only last 100 errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }
  }

  getMetrics(): EmailMetrics {
    return { ...this.metrics };
  }

  async logMetrics() {
    console.log('Email Service Metrics:', JSON.stringify(this.metrics, null, 2));

    // Send to monitoring service
    if (process.env.MONITORING_WEBHOOK) {
      await fetch(process.env.MONITORING_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'email',
          metrics: this.metrics,
          timestamp: new Date().toISOString()
        })
      });
    }
  }
}

export const emailMonitor = new EmailMonitor();
```

## 9. Testing Email Functionality

### 9.1 Unit Tests

```typescript
// tests/email.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EmailService from '../lib/email';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'test-password'
      }
    });
  });

  it('should create email service instance', () => {
    expect(emailService).toBeInstanceOf(EmailService);
  });

  it('should validate email configuration', () => {
    expect(() => {
      new EmailService({
        host: '',
        port: 0,
        secure: false,
        auth: { user: '', pass: '' }
      });
    }).toThrow();
  });
});
```

### 9.2 Email Templates

Create `/templates/email-templates.ts`:

```typescript
export const emailTemplates = {
  welcome: (name: string) => ({
    subject: `Welcome to ${process.env.EMAIL_FROM_NAME || 'Our Platform'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Welcome, ${name}!</h1>
        <p>Thank you for joining our platform. We're excited to have you on board.</p>
        <p>Best regards,<br>Team ${process.env.EMAIL_FROM_NAME || 'Support'}</p>
      </div>
    `
  }),

  orderConfirmation: (orderId: string, amount: number) => ({
    subject: `Order Confirmation #${orderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Confirmed</h2>
        <p>Your order #${orderId} has been confirmed.</p>
        <p>Total amount: $${amount.toFixed(2)}</p>
      </div>
    `
  }),

  newsletterSubscription: (email: string) => ({
    subject: 'Newsletter Subscription Confirmed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Successfully Subscribed!</h2>
        <p>You've been added to our newsletter list with the email: ${email}</p>
      </div>
    `
  })
};
```

## 10. Common Troubleshooting

### 10.1 Authentication Issues

```bash
# Check if credentials are working
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations": [{"to": [{"email": "test@example.com"}]}],"from": {"email":"noreply@theprojectseo.com"},"subject":"Test","content": [{"type":"text/plain", "value":"Test"}]}'
```

### 10.2 Common Error Solutions

1. **"Invalid login"**: Check app password, ensure 2-step verification enabled
2. **"Connection timed out"**: Verify firewall settings, port 587 is open
3. **"535 5.7.8 Username and Password not accepted"**: Use app password, not regular password
4. **"421 4.7.0 Temporary System Problem"**: Implement exponential backoff and retry logic

### 10.3 Debug Mode

```typescript
// Enable debug logging for troubleshooting
const debugEmailService = new EmailService({
  ...emailConfig,
  debug: process.env.NODE_ENV === 'development',
  logger: true
});
```

## 11. Advanced Features

### 11.1 Email Queue System

```typescript
// lib/email-queue.ts
class EmailQueue {
  private queue: Array<{ email: EmailOptions; resolve: Function; reject: Function; timestamp: number }> = [];
  private processing = false;
  private rateLimitWindow = 60000; // 1 minute
  private rateLimitCount = 100; // Max emails per minute

  async add(email: EmailOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ email, resolve, reject, timestamp: Date.now() });
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const recentEmails = this.queue.filter(e => now - e.timestamp < this.rateLimitWindow);

      if (recentEmails.length >= this.rateLimitCount) {
        // Wait for the oldest email to expire from the window
        const oldestTimestamp = Math.min(...recentEmails.map(e => e.timestamp));
        const waitTime = this.rateLimitWindow - (now - oldestTimestamp);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const item = this.queue.shift();
      if (item) {
        try {
          await emailService.sendEmail(item.email);
          item.resolve();
        } catch (error) {
          item.reject(error);
        }
      }
    }

    this.processing = false;
  }
}

export const emailQueue = new EmailQueue();
```

### 11.2 Email Tracking

```typescript
// lib/email-tracking.ts
interface TrackingPixel {
  emailId: string;
  opened: boolean;
  clicked: boolean;
  openedAt?: Date;
  clickedAt?: Date;
}

class EmailTracker {
  private trackedEmails: Map<string, TrackingPixel> = new Map();

  generateTrackingPixel(emailId: string): string {
    this.trackedEmails.set(emailId, { emailId, opened: false, clicked: false });

    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
  }

  trackOpen(emailId: string) {
    const email = this.trackedEmails.get(emailId);
    if (email && !email.opened) {
      email.opened = true;
      email.openedAt = new Date();
      console.log(`Email ${emailId} opened at ${email.openedAt}`);
    }
  }

  trackClick(emailId: string) {
    const email = this.trackedEmails.get(emailId);
    if (email && !email.clicked) {
      email.clicked = true;
      email.clickedAt = new Date();
      console.log(`Email ${emailId} clicked at ${email.clickedAt}`);
    }
  }
}

export const emailTracker = new EmailTracker();
```

## 12. Complete Example Usage

```typescript
// Example in your application
import { emailService } from '@/lib/email-service';
import { emailQueue } from '@/lib/email-queue';
import { emailMonitor } from '@/lib/email-monitoring';

async function sendWelcomeEmail(userEmail: string, userName: string) {
  try {
    await emailQueue.add({
      to: userEmail,
      subject: 'Welcome to Our Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome, ${userName}!</h1>
          <p>Thank you for joining our community. We're excited to have you on board.</p>
          <a href="https://theprojectseo.com/get-started" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Get Started
          </a>
        </div>
      `
    });

    emailMonitor.recordSent();
    console.log('Welcome email queued successfully');
  } catch (error) {
    emailMonitor.recordFailed(error.message);
    console.error('Failed to send welcome email:', error);
  }
}

// Initialize email service on app startup
if (process.env.NODE_ENV === 'production') {
  initializeEmailService().then(success => {
    if (!success) {
      console.error('Failed to initialize email service');
      process.exit(1);
    }
  });
}
```

This comprehensive guide provides everything needed to set up Google Workspace SMTP with Next.js applications, including security best practices, rate limiting, monitoring, and advanced features for production use.