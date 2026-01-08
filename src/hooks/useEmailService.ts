import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailServiceState {
  isLoading: boolean;
  result: EmailResult | null;
}

export const useEmailService = () => {
  const [state, setState] = useState<EmailServiceState>({
    isLoading: false,
    result: null,
  });

  const sendEmail = useCallback(async (options: EmailOptions): Promise<EmailResult> => {
    setState({ isLoading: true, result: null });

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      const result = await response.json();

      const emailResult: EmailResult = {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };

      setState({ isLoading: false, result: emailResult });

      if (result.success) {
        toast.success('Email sent successfully!');
      } else {
        toast.error(`Failed to send email: ${result.error || 'Unknown error'}`);
      }

      return emailResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResult: EmailResult = {
        success: false,
        error: errorMessage,
      };

      setState({ isLoading: false, result: errorResult });
      toast.error(`Network error: ${errorMessage}`);

      return errorResult;
    }
  }, []);

  const sendWelcomeEmail = useCallback(async (to: string, userName?: string): Promise<EmailResult> => {
    setState({ isLoading: true, result: null });

    try {
      const response = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, userName }),
      });

      const result = await response.json();

      const emailResult: EmailResult = {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };

      setState({ isLoading: false, result: emailResult });

      if (result.success) {
        toast.success('Welcome email sent successfully!');
      } else {
        toast.error(`Failed to send welcome email: ${result.error || 'Unknown error'}`);
      }

      return emailResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResult: EmailResult = {
        success: false,
        error: errorMessage,
      };

      setState({ isLoading: false, result: errorResult });
      toast.error(`Network error: ${errorMessage}`);

      return errorResult;
    }
  }, []);

  const sendPasswordResetEmail = useCallback(async (to: string, resetLink: string): Promise<EmailResult> => {
    setState({ isLoading: true, result: null });

    try {
      const response = await fetch('/api/email/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, resetLink }),
      });

      const result = await response.json();

      const emailResult: EmailResult = {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };

      setState({ isLoading: false, result: emailResult });

      if (result.success) {
        toast.success('Password reset email sent successfully!');
      } else {
        toast.error(`Failed to send password reset email: ${result.error || 'Unknown error'}`);
      }

      return emailResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResult: EmailResult = {
        success: false,
        error: errorMessage,
      };

      setState({ isLoading: false, result: errorResult });
      toast.error(`Network error: ${errorMessage}`);

      return errorResult;
    }
  }, []);

  const sendTestEmail = useCallback(async (to: string): Promise<EmailResult> => {
    setState({ isLoading: true, result: null });

    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to }),
      });

      const result = await response.json();

      const emailResult: EmailResult = {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };

      setState({ isLoading: false, result: emailResult });

      if (result.success) {
        toast.success('Test email sent successfully!');
      } else {
        toast.error(`Failed to send test email: ${result.error || 'Unknown error'}`);
      }

      return emailResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResult: EmailResult = {
        success: false,
        error: errorMessage,
      };

      setState({ isLoading: false, result: errorResult });
      toast.error(`Network error: ${errorMessage}`);

      return errorResult;
    }
  }, []);

  const checkServiceStatus = useCallback(async (): Promise<{ connected: boolean; status: any }> => {
    try {
      const response = await fetch('/api/email/test');
      const result = await response.json();

      if (result.success) {
        return {
          connected: result.status.connected,
          status: result.status,
        };
      }

      return {
        connected: false,
        status: null,
      };
    } catch (error) {
      console.error('Failed to check email service status:', error);
      return {
        connected: false,
        status: null,
      };
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null });
  }, []);

  return {
    ...state,
    sendEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendTestEmail,
    checkServiceStatus,
    reset,
  };
};

export default useEmailService;