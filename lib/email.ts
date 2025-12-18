/**
 * Email utility for sending verification and notification emails
 * Uses nodemailer for SMTP email delivery
 */

import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Create and configure nodemailer transporter
 * Supports both SMTP and development mode (ethereal email)
 */
function createTransporter() {
  const useSMTP = process.env.EMAIL_MODE === 'smtp'

  if (useSMTP) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  // Console / dev mode
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  })
}

/**
 * Send an email using the configured transporter
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter()
    const isConsole = process.env.EMAIL_MODE !== 'smtp'
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@vaultr.app',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    }

    const info = await transporter.sendMail(mailOptions)
    
    // In development, log the email content
    if (isConsole) {
      console.log('📧 Email would be sent in production:')
      console.log('To:', options.to)
      console.log('Subject:', options.subject)
      console.log('Text:', options.text)
      console.log('---')
    } else {
      console.log('Email sent:', info.messageId)
    }
    console.log("EMAIL_MODE:", process.env.EMAIL_MODE)
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

/**
 * Send email verification link to user
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const verificationLink = `${baseUrl}/verify-email?token=${token}`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #0070f3; 
            color: #ffffff; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Verify Your Email Address</h2>
          <p>Thank you for signing up for Vaultr! To complete your registration and secure your account, please verify your email address.</p>
          
          <a href="${verificationLink}" class="button">Verify Email Address</a>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0070f3;">${verificationLink}</p>
          
          <p><strong>This link will expire in 24 hours.</strong></p>
          
          <div class="footer">
            <p>If you did not create an account with Vaultr, please ignore this email.</p>
            <p>For security reasons, never share this link with anyone.</p>
          </div>
        </div>
      </body>
    </html>
  `
  
  const text = `
Verify Your Email Address

Thank you for signing up for Vaultr! To complete your registration and secure your account, please verify your email address.

Click the link below to verify your email:
${verificationLink}

This link will expire in 24 hours.

If you did not create an account with Vaultr, please ignore this email.
For security reasons, never share this link with anyone.
  `.trim()
  
  return sendEmail({
    to: email,
    subject: 'Verify your Vaultr account',
    html,
    text,
  })
}

/**
 * Send notification that email was verified successfully
 */
export async function sendWelcomeEmail(email: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome to Vaultr!</h2>
          <p>Your email has been successfully verified. You now have full access to your secure password vault.</p>
          
          <p>You can now:</p>
          <ul>
            <li>Store and manage your passwords securely</li>
            <li>Access your vault from any device</li>
            <li>Organize your passwords with ease</li>
          </ul>
          
          <p><a href="${baseUrl}/dashboard">Go to Dashboard</a></p>
          
          <div class="footer">
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
        </div>
      </body>
    </html>
  `
  
  const text = `
Welcome to Vaultr!

Your email has been successfully verified. You now have full access to your secure password vault.

You can now:
- Store and manage your passwords securely
- Access your vault from any device
- Organize your passwords with ease

Visit: ${baseUrl}/dashboard

If you have any questions, feel free to reach out to our support team.
  `.trim()
  
  return sendEmail({
    to: email,
    subject: 'Welcome to Vaultr - Email Verified',
    html,
    text,
  })
}

/**
 * Send password reset email to user
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const resetLink = `${baseUrl}/reset-password?token=${token}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #0070f3; 
            color: #ffffff; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; padding: 12px; border-radius: 5px; margin: 20px 0; color: #856404; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password. Click the link below to create a new password.</p>
          
          <a href="${resetLink}" class="button">Reset Password</a>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0070f3;">${resetLink}</p>
          
          <p><strong>This link will expire in 24 hours.</strong></p>
          
          <div class="warning">
            <p><strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your account is safe.</p>
          </div>
          
          <div class="footer">
            <p>For security reasons, never share this link with anyone.</p>
            <p>If you have any questions, contact our support team.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
Reset Your Password

We received a request to reset your password. Click the link below to create a new password.

${resetLink}

This link will expire in 24 hours.

⚠️ Security Notice: If you didn't request this password reset, please ignore this email. Your account is safe.

For security reasons, never share this link with anyone.
If you have any questions, contact our support team.
  `.trim()

  return sendEmail({
    to: email,
    subject: 'Reset Your Vaultr Password',
    html,
    text,
  })
}
