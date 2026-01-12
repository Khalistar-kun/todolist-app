import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize in constructor - do it lazily on first use
    // This prevents issues with environment variables not being loaded yet
  }

  private ensureInitialized(): boolean {
    if (this.initialized) {
      return this.transporter !== null;
    }

    this.initialized = true;

    // Check for required environment variables
    const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
      console.error('[EmailService] Missing required environment variables:', missingVars.join(', '));
      console.error('[EmailService] Email sending will be disabled');
      return false;
    }

    try {
      console.log('[EmailService] Initializing with SMTP_HOST:', process.env.SMTP_HOST);

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false, // Allow self-signed certs for Gmail
        },
      });

      // Verify connection asynchronously (don't block)
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('[EmailService] SMTP connection verification failed:', error);
        } else {
          console.log('[EmailService] SMTP connection verified - ready to send');
        }
      });

      return true;
    } catch (error) {
      console.error('[EmailService] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<EmailResponse> {
    // Lazy initialization
    if (!this.ensureInitialized() || !this.transporter) {
      console.error('[EmailService] Cannot send email - service not initialized');
      return {
        success: false,
        error: 'Email service not initialized. Check SMTP environment variables.',
      };
    }

    try {
      const fromName = process.env.SMTP_FROM_NAME || 'TodolistApp';
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

      const mailOptions = {
        from: options.from || `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      console.log('[EmailService] Attempting to send email:', {
        to: options.to,
        subject: options.subject,
        from: mailOptions.from,
      });

      const info = await this.transporter.sendMail(mailOptions);

      console.log('[EmailService] Email sent successfully:', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject,
        response: info.response,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a welcome email
   */
  async sendWelcomeEmail(to: string, userName: string = ''): Promise<EmailResponse> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to TodolistApp</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to TodolistApp! 🎉</h1>
        </div>
        <div class="content">
          <h2>Hi${userName ? ` ${userName}` : ''},</h2>
          <p>Thank you for signing up for TodolistApp! We're excited to have you on board.</p>
          <p>With TodolistApp, you can:</p>
          <ul>
            <li>✅ Create and manage your to-do lists efficiently</li>
            <li>🎯 Set priorities and deadlines</li>
            <li>📊 Track your productivity</li>
            <li>🔔 Get reminders for important tasks</li>
          </ul>
          <p>Get started by organizing your tasks and boosting your productivity!</p>
          <a href="https://yourapp.com" class="button">Open TodolistApp</a>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p>Best regards,<br>The TodolistApp Team</p>
        </div>
        <div class="footer">
          <p>© 2025 TodolistApp. All rights reserved.</p>
          <p>You're receiving this email because you signed up for TodolistApp.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: 'Welcome to TodolistApp! 🎉',
      html,
      text: `Welcome to TodolistApp! Hi${userName ? ` ${userName}` : ''}, Thank you for signing up! Get started by organizing your tasks.`,
    });
  }

  /**
   * Send a password reset email with link
   */
  async sendPasswordResetEmail(to: string, resetLink: string): Promise<EmailResponse> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset - TodolistApp</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #e74c3c;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 10px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset 🔒</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password for your TodolistApp account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" class="button">Reset Password</a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${resetLink}</p>
          <div class="warning">
            <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
          </div>
          <p>Best regards,<br>The TodolistApp Team</p>
        </div>
        <div class="footer">
          <p>© 2025 TodolistApp. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: 'Reset Your TodolistApp Password',
      html,
      text: `Reset your TodolistApp password: ${resetLink}. This link expires in 1 hour.`,
    });
  }

  /**
   * Send a password reset PIN email
   */
  async sendPasswordResetPinEmail(to: string, pin: string): Promise<EmailResponse> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset PIN - TodolistApp</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .pin-box {
            background: #fff;
            border: 2px dashed #667eea;
            padding: 20px;
            text-align: center;
            border-radius: 10px;
            margin: 25px 0;
          }
          .pin-code {
            font-size: 42px;
            font-weight: bold;
            letter-spacing: 12px;
            color: #667eea;
            font-family: 'Courier New', monospace;
          }
          .pin-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
          .security-note {
            background: #e8f4fd;
            border-left: 4px solid #2196F3;
            padding: 12px 15px;
            margin: 20px 0;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset PIN</h1>
        </div>
        <div class="content">
          <h2>Your Password Reset Code</h2>
          <p>You requested to reset your password for your TodolistApp account. Use the PIN below to verify your identity:</p>

          <div class="pin-box">
            <div class="pin-label">Your Verification PIN</div>
            <div class="pin-code">${pin}</div>
          </div>

          <div class="warning">
            <p><strong>Important:</strong> This PIN will expire in <strong>15 minutes</strong> for security reasons.</p>
          </div>

          <div class="security-note">
            <p><strong>Security Tip:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
          </div>

          <p>Enter this PIN on the password reset page to continue resetting your password.</p>
          <p>Best regards,<br>The TodolistApp Team</p>
        </div>
        <div class="footer">
          <p>© 2025 TodolistApp. All rights reserved.</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: 'Your Password Reset PIN - TodolistApp',
      html,
      text: `Your TodolistApp password reset PIN is: ${pin}. This PIN expires in 15 minutes. If you didn't request this, please ignore this email.`,
    });
  }

  /**
   * Send a project invitation email
   */
  async sendProjectInvitationEmail(
    to: string,
    inviterName: string,
    projectName: string,
    role: string,
    inviteToken: string
  ): Promise<EmailResponse> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://todolist-app-o9wc.vercel.app'
    const inviteLink = `${baseUrl}/auth/signin?invite=${inviteToken}`

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Project Invitation - TodolistApp</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 500;
          }
          .button:hover {
            background: #2563eb;
          }
          .project-box {
            background: #fff;
            border: 2px solid #e5e7eb;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
          }
          .project-name {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 8px;
          }
          .role-badge {
            display: inline-block;
            background: #dbeafe;
            color: #1d4ed8;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
          }
          .info-box {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>You're Invited!</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>
          <p><strong>${inviterName}</strong> has invited you to collaborate on a project in TodolistApp.</p>

          <div class="project-box">
            <div class="project-name">${projectName}</div>
            <span class="role-badge">Role: ${role.charAt(0).toUpperCase() + role.slice(1)}</span>
          </div>

          <p style="text-align: center;">
            <a href="${inviteLink}" class="button">Accept Invitation</a>
          </p>

          <div class="info-box">
            <p style="margin: 0;"><strong>What happens next?</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>Click the button above to accept the invitation</li>
              <li>Sign in or create an account if you don't have one</li>
              <li>Start collaborating on the project immediately</li>
            </ul>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>

          <p>Best regards,<br>The TodolistApp Team</p>
        </div>
        <div class="footer">
          <p>© 2025 TodolistApp. All rights reserved.</p>
          <p>If you can't click the button, copy this link to your browser:</p>
          <p style="word-break: break-all; color: #3b82f6;">${inviteLink}</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `You've been invited to join "${projectName}" on TodolistApp`,
      html,
      text: `${inviterName} has invited you to join "${projectName}" as ${role}. Accept the invitation here: ${inviteLink}. This link expires in 7 days.`,
    });
  }

  /**
   * Send a test email
   */
  async sendTestEmail(to: string): Promise<EmailResponse> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test Email - TodolistApp</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .status {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SMTP Test Email ✅</h1>
        </div>
        <div class="content">
          <h2>Configuration Test Successful!</h2>
          <div class="status">
            <p><strong>Status:</strong> Your SMTP configuration is working correctly</p>
            <p><strong>Service:</strong> Gmail SMTP</p>
            <p><strong>App:</strong> TodolistApp</p>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p>This email confirms that your SMTP service has been successfully configured and is ready to send emails from TodolistApp.</p>
          <h3>Configuration Details:</h3>
          <ul>
            <li>✅ Gmail App Password: Successfully authenticated</li>
            <li>✅ SMTP Connection: Established</li>
            <li>✅ TLS Encryption: Enabled</li>
            <li>✅ From Address: Aditya@theprojectseo.com</li>
          </ul>
          <p>Your email service is now ready for production use!</p>
          <p>Best regards,<br>The TodolistApp Team</p>
        </div>
        <div class="footer">
          <p>© 2025 TodolistApp. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: '✅ TodolistApp SMTP Test - Success!',
      html,
      text: `SMTP Test Successful! Your Gmail SMTP configuration is working correctly for TodolistApp.`,
    });
  }

  /**
   * Verify email service health
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.ensureInitialized() || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[EmailService] Connection verified successfully');
      return true;
    } catch (error) {
      console.error('[EmailService] Connection verification failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const emailService = new EmailService();

// Export default
export default emailService;