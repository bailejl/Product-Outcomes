import * as nodemailer from 'nodemailer'

export interface EmailConfig {
  smtp: {
    host: string
    port: number
    secure: boolean
    auth?: {
      user: string
      pass: string
    }
  }
  from: {
    name: string
    email: string
  }
  templates: {
    passwordReset: {
      subject: string
      html: (resetLink: string, userName: string) => string
      text: (resetLink: string, userName: string) => string
    }
    emailVerification: {
      subject: string
      html: (verificationLink: string, userName: string) => string
      text: (verificationLink: string, userName: string) => string
    }
  }
}

export interface EmailOptions {
  to: string
  subject: string
  html?: string
  text?: string
}

export class EmailService {
  private transporter: nodemailer.Transporter
  private config: EmailConfig

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      smtp: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '1025'),
        secure: process.env.SMTP_SECURE === 'true',
        ...(process.env.SMTP_USER && process.env.SMTP_PASS ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        } : {})
      },
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Product Outcomes',
        email: process.env.EMAIL_FROM_ADDRESS || 'noreply@productoutcomes.com'
      },
      templates: {
        passwordReset: {
          subject: 'Reset Your Password',
          html: (resetLink: string, userName: string) => `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Your Password</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .button { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                  <h2>Hello ${userName},</h2>
                  <p>We received a request to reset your password for your Product Outcomes account.</p>
                  <p>Click the button below to create a new password:</p>
                  <a href="${resetLink}" class="button">Reset Password</a>
                  <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                  <p>This link will expire in 24 hours for security reasons.</p>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; color: #4f46e5;">${resetLink}</p>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The Product Outcomes Team</p>
                  <p>If you have any questions, please contact our support team.</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: (resetLink: string, userName: string) => `
            Hello ${userName},

            We received a request to reset your password for your Product Outcomes account.

            To reset your password, click or copy the following link into your browser:
            ${resetLink}

            If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

            This link will expire in 24 hours for security reasons.

            Best regards,
            The Product Outcomes Team
          `
        },
        emailVerification: {
          subject: 'Verify Your Email Address',
          html: (verificationLink: string, userName: string) => `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Verify Your Email</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #10b981; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Welcome to Product Outcomes!</h1>
                </div>
                <div class="content">
                  <h2>Hello ${userName},</h2>
                  <p>Thank you for signing up for Product Outcomes. To complete your registration, please verify your email address.</p>
                  <p>Click the button below to verify your email:</p>
                  <a href="${verificationLink}" class="button">Verify Email</a>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="word-break: break-all; color: #10b981;">${verificationLink}</p>
                </div>
                <div class="footer">
                  <p>Best regards,<br>The Product Outcomes Team</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: (verificationLink: string, userName: string) => `
            Hello ${userName},

            Thank you for signing up for Product Outcomes. To complete your registration, please verify your email address.

            To verify your email, click or copy the following link into your browser:
            ${verificationLink}

            Best regards,
            The Product Outcomes Team
          `
        }
      },
      ...config
    }

    this.transporter = nodemailer.createTransport(this.config.smtp)
  }

  /**
   * Send a raw email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: `${this.config.from.name} <${this.config.from.email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      }

      const info = await this.transporter.sendMail(mailOptions)
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject
      })
    } catch (error) {
      console.error('Failed to send email:', error)
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string,
    baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ): Promise<void> {
    const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`
    const template = this.config.templates.passwordReset

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html(resetLink, userName),
      text: template.text(resetLink, userName)
    })
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(
    email: string,
    verificationToken: string,
    userName: string,
    baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ): Promise<void> {
    const verificationLink = `${baseUrl}/auth/verify-email?token=${verificationToken}`
    const template = this.config.templates.emailVerification

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html(verificationLink, userName),
      text: template.text(verificationLink, userName)
    })
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      console.log('SMTP connection verified successfully')
      return true
    } catch (error) {
      console.error('SMTP connection failed:', error)
      return false
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(
    to: string,
    baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Test Email - Product Outcomes',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from Product Outcomes.</p>
        <p>If you receive this email, your email configuration is working correctly.</p>
        <p>Base URL: ${baseUrl}</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
      text: `
        Test Email

        This is a test email from Product Outcomes.
        If you receive this email, your email configuration is working correctly.

        Base URL: ${baseUrl}
        Timestamp: ${new Date().toISOString()}
      `
    })
  }
}