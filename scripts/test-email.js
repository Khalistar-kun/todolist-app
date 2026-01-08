// Test script for SMTP email functionality
// Run with: node scripts/test-email.js

require('dotenv').config({ path: '.env.local' });

async function testEmail() {
  console.log('📧 Testing TodolistApp SMTP Configuration...\n');

  // Check environment variables
  const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
    console.log('\nPlease check your .env.local file and ensure all required SMTP variables are set.\n');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded');
  console.log(`   Host: ${process.env.SMTP_HOST}`);
  console.log(`   Port: ${process.env.SMTP_PORT}`);
  console.log(`   User: ${process.env.SMTP_USER}`);
  console.log(`   From: ${process.env.SMTP_FROM} (${process.env.SMTP_FROM_NAME})\n`);

  // Import the email service
  const { emailService } = require('../lib/email-service');

  try {
    // First, verify the connection
    console.log('🔍 Verifying SMTP connection...');
    const isConnected = await emailService.verifyConnection();

    if (!isConnected) {
      console.error('❌ Failed to connect to SMTP server');
      console.log('\nPlease check:');
      console.log('1. Your app password is correct');
      console.log('2. 2-Step Verification is enabled for your Google account');
      console.log('3. Less secure apps are allowed (if not using app password)');
      process.exit(1);
    }

    console.log('✅ SMTP connection verified\n');

    // Send test email
    console.log('📨 Sending test email to Aditya@theprojectseo.com...');
    const result = await emailService.sendTestEmail('Aditya@theprojectseo.com');

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log('\n🎉 Your TodolistApp SMTP is working correctly!');
      console.log('   You can now send emails from your application.\n');

      // Test API endpoint
      console.log('🌐 Testing API endpoint...');
      const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const response = await fetch(`${API_BASE}/api/send-email`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const apiResult = await response.json();
        console.log('✅ API endpoint is healthy');
        console.log(`   Status: ${apiResult.status}`);
        console.log(`   Healthy: ${apiResult.healthy}`);
      } else {
        console.log('⚠️  API endpoint test failed (server may not be running)');
      }

    } else {
      console.error('❌ Failed to send email');
      console.error(`   Error: ${result.error}`);
      console.log('\nTroubleshooting steps:');
      console.log('1. Verify your app password is correct (16 characters)');
      console.log('2. Make sure 2-Step Verification is enabled');
      console.log('3. Check if the app password is generated for the correct app');
      console.log('4. Try regenerating the app password');
    }

  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.log('\nMake sure your Next.js app is running or use the direct email service test.');
  }
}

// Run the test
testEmail();