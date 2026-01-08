# Email Service Integration Guide

This guide covers how to integrate and use the email functionality in both the Next.js web app and iOS app.

## Overview

The email service provides:
- ✅ **SMTP Configuration**: Gmail SMTP with TLS encryption
- ✅ **Email Templates**: Welcome, Password Reset, Test, and Custom emails
- ✅ **API Endpoints**: RESTful endpoints for all email operations
- ✅ **Error Handling**: Comprehensive error handling and validation
- ✅ **Cross-platform**: Works on both web and iOS apps
- ✅ **Real-time Status**: Email service health monitoring

## Web App (Next.js) Integration

### Files Created

1. **Email Test Page**: `/src/app/email-test/page.tsx`
2. **Email Verification Component**: `/src/components/EmailVerification.tsx`
3. **Email Dashboard**: `/src/components/EmailDashboard.tsx`
4. **Email Hook**: `/src/hooks/useEmailService.ts`
5. **API Endpoints**:
   - `/app/api/email/send/route.ts`
   - `/app/api/email/test/route.ts`
   - `/app/api/email/welcome/route.ts`
   - `/app/api/email/password-reset/route.ts`

### Quick Start

1. **Test the email service**:
   ```bash
   # Navigate to the email test page
   http://localhost:3000/email-test
   ```

2. **Use the email hook in your components**:
   ```tsx
   import { useEmailService } from '@/hooks/useEmailService';

   function MyComponent() {
     const { sendEmail, sendWelcomeEmail, isLoading } = useEmailService();

     const handleSendEmail = async () => {
       const result = await sendEmail({
         to: 'user@example.com',
         subject: 'Hello!',
         html: '<p>Welcome to our app!</p>'
       });

       if (result.success) {
         console.log('Email sent:', result.messageId);
       }
     };

     return (
       <button onClick={handleSendEmail} disabled={isLoading}>
         Send Email
       </button>
     );
   }
   ```

3. **Add email verification to any page**:
   ```tsx
   import EmailVerification from '@/components/EmailVerification';

   function SettingsPage() {
     return (
       <div>
         <EmailVerification />
         {/* Other settings content */}
       </div>
     );
   }
   ```

### API Usage Examples

#### Send Custom Email
```javascript
const response = await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'recipient@example.com',
    subject: 'Custom Email',
    html: '<p>This is a custom email with <strong>HTML</strong> content.</p>',
    text: 'Plain text fallback',
    cc: 'cc@example.com',
    replyTo: 'support@yourapp.com'
  }),
});

const result = await response.json();
console.log(result); // { success: true, messageId: 'abc-123' }
```

#### Send Welcome Email
```javascript
const response = await fetch('/api/email/welcome', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'user@example.com',
    userName: 'John Doe'
  }),
});
```

#### Send Password Reset
```javascript
const response = await fetch('/api/email/password-reset', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'user@example.com',
    resetLink: 'https://yourapp.com/reset-password?token=abc123'
  }),
});
```

## iOS App Integration

### Files Created

1. **Email Service**: `/TodoApp/Services/EmailService.swift`
2. **UIKit View Controller**: `/TodoApp/ViewControllers/EmailTestViewController.swift`
3. **SwiftUI View**: `/TodoApp/Views/EmailTestView.swift`

### Quick Start

1. **Add EmailService to your app**:
   ```swift
   import SwiftUI

   struct ContentView: View {
       var body: some View {
           NavigationView {
               EmailTestView()
           }
       }
   }
   ```

2. **Use the EmailService in your code**:
   ```swift
   import SwiftUI

   struct MyView: View {
       private let emailService = EmailService.shared

       func sendWelcomeEmail() {
           emailService.sendWelcomeEmail(to: "user@example.com", userName: "John") { result in
               switch result {
               case .success(let messageId):
                   print("Email sent with ID: \(messageId)")
               case .failure(let error):
                   print("Error: \(error.localizedDescription)")
               }
           }
       }

       var body: some View {
           Button("Send Welcome Email") {
               sendWelcomeEmail()
           }
       }
   }
   ```

3. **Add to UIKit View Controller**:
   ```swift
   import UIKit

   class MyViewController: UIViewController {
       private let emailService = EmailService.shared

       override func viewDidLoad() {
           super.viewDidLoad()
           emailService.delegate = self
       }

       @IBAction func sendEmailButtonTapped(_ sender: UIButton) {
           emailService.sendTestEmail(to: "test@example.com") { result in
               DispatchQueue.main.async {
                   switch result {
                   case .success(let messageId):
                       self.showAlert(title: "Success", message: "Email sent: \(messageId)")
                   case .failure(let error):
                       self.showAlert(title: "Error", message: error.localizedDescription)
                   }
               }
           }
       }
   }

   extension MyViewController: EmailServiceDelegate {
       func emailServiceDidSendEmail(_ service: EmailService, messageId: String?) {
           print("Email sent successfully!")
       }

       func emailServiceDidFailToSendEmail(_ service: EmailService, error: EmailServiceError) {
           print("Email failed to send: \(error.localizedDescription)")
       }

       func emailServiceDidUpdateStatus(_ service: EmailService, status: EmailServiceStatus) {
           print("Email service status: \(status.connected)")
       }
   }
   ```

### EmailService Methods

```swift
// Send custom email
emailService.sendEmail(
    to: "recipient@example.com",
    subject: "Hello",
    message: "<p>HTML content</p>",
    isHTML: true
) { result in
    // Handle result
}

// Send welcome email
emailService.sendWelcomeEmail(
    to: "user@example.com",
    userName: "John Doe"
) { result in
    // Handle result
}

// Send password reset
emailService.sendPasswordResetEmail(
    to: "user@example.com",
    resetLink: "https://yourapp.com/reset-password?token=abc123"
) { result in
    // Handle result
}

// Send test email
emailService.sendTestEmail(to: "test@example.com") { result in
    // Handle result
}

// Check service status
emailService.checkServiceStatus { result in
    switch result {
    case .success(let status):
        print("Service connected: \(status.connected)")
    case .failure(let error):
        print("Status check failed: \(error.localizedDescription)")
    }
}
```

## Configuration

### Environment Variables

Make sure these are set in your `.env.local` file:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Your Name <your-email@gmail.com>
SMTP_FROM_NAME=Your App Name
```

### iOS App Configuration

Update the `baseURL` in `EmailService.swift` to match your Next.js app URL:

```swift
private init() {
    // Update this to your production URL
    self.baseURL = "https://yourapp.com/api/email"
    // ...
}
```

## Features

### Email Templates

1. **Test Email**: SMTP configuration verification with detailed status
2. **Welcome Email**: User onboarding with personalized content
3. **Password Reset**: Secure password reset with time-limited links
4. **Custom Email**: Fully customizable HTML or plain text emails

### Error Handling

- ✅ Input validation for all email fields
- ✅ Network error handling with retry logic
- ✅ SMTP connection verification
- ✅ Detailed error messages and logging
- ✅ Graceful degradation when service is unavailable

### Monitoring

- ✅ Real-time service status monitoring
- ✅ Email delivery statistics tracking
- ✅ Success rate calculations
- ✅ Last sent email tracking

## Testing

### Web App Testing

1. Visit `/email-test` for comprehensive testing
2. Test all email templates with different recipients
3. Verify email delivery in recipient's inbox
4. Check spam folders if emails don't arrive
5. Test error scenarios with invalid data

### iOS App Testing

1. Open the EmailTestView or EmailTestViewController
2. Test all email functionality
3. Verify error handling with network issues
4. Test delegate methods for real-time updates
5. Verify UI responsiveness during sending

## Production Checklist

- [ ] Gmail App Password is configured
- [ ] Environment variables are set correctly
- [ ] Email templates are customized with your branding
- [ ] Error handling is tested thoroughly
- [ ] Rate limiting is considered (Gmail has limits)
- [ ] Email unsubscribe links are added for marketing emails
- [ ] SPF/DKIM records are configured for your domain
- [ ] iOS app baseURL is updated to production URL
- [ ] Analytics tracking is implemented for email events

## Troubleshooting

### Common Issues

1. **Gmail Authentication Error**:
   - Ensure you're using an App Password, not your regular password
   - Enable 2-factor authentication on your Gmail account
   - Generate a new App Password if needed

2. **Emails Not Arriving**:
   - Check spam/junk folders
   - Verify recipient email addresses are correct
   - Check SMTP connection status
   - Review email content for spam triggers

3. **iOS App Connection Issues**:
   - Verify the baseURL in EmailService.swift
   - Check network connectivity
   - Ensure API endpoints are accessible
   - Review SSL certificate configuration

4. **Rate Limiting**:
   - Gmail has sending limits (100-500 emails per day)
   - Implement queue system for bulk emails
   - Consider using a dedicated email service for high volume

## Security Considerations

- Store SMTP credentials securely using environment variables
- Never expose SMTP credentials in client-side code
- Implement rate limiting to prevent abuse
- Use HTTPS for all API communications
- Validate all user inputs before processing
- Consider adding CAPTCHA for public email forms

## Support

For issues with the email service:
1. Check the browser console or iOS logs for detailed error messages
2. Verify SMTP configuration and credentials
3. Test with different email addresses
4. Check network connectivity and firewall settings
5. Review the Gmail App Password setup guide

## Next Steps

1. Customize email templates with your branding
2. Add more email templates as needed
3. Implement email analytics and tracking
4. Add email scheduling functionality
5. Set up automated email campaigns
6. Integrate with user management system