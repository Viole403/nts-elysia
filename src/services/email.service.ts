import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import sgMail from '@sendgrid/mail';
import { Resend } from 'resend';

// Placeholder for React Email templates
const WelcomeEmail = ({ name }: { name: string }) => `<h1>Welcome, ${name}!</h1><p>Thank you for registering.</p>`;
const NotificationEmail = ({ message }: { message: string }) => `<p>${message}</p>`;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: any;
  private emailProvider: string;

  constructor() {
    this.emailProvider = process.env.EMAIL_PROVIDER || 'NODEMAILER';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    switch (this.emailProvider) {
      case 'NODEMAILER':
        this.transporter = nodemailer.createTransport({
          host: process.env.NODEMAILER_SMTP_HOST,
          port: Number(process.env.NODEMAILER_SMTP_PORT),
          secure: Number(process.env.NODEMAILER_SMTP_PORT) === 465,
          auth: {
            user: process.env.NODEMAILER_SMTP_USER,
            pass: process.env.NODEMAILER_SMTP_PASS,
          },
        });
        break;
      case 'MAILGUN':
        const mg = new Mailgun(formData);
        this.transporter = mg.client({
          username: 'api',
          key: process.env.MAILGUN_API_KEY || '',
        });
        break;
      case 'SENDGRID':
        sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
        this.transporter = sgMail;
        break;
      case 'RESEND':
        this.transporter = new Resend(process.env.RESEND_API_KEY);
        break;
      default:
        console.warn('No email provider configured. Emails will not be sent.');
        break;
    }
  }

  async sendEmail(options: EmailOptions) {
    const from = process.env.SENDER_EMAIL || 'noreply@example.com';

    try {
      switch (this.emailProvider) {
        case 'NODEMAILER':
          await this.transporter.sendMail({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
          });
          break;
        case 'MAILGUN':
          await this.transporter.messages.create(process.env.MAILGUN_DOMAIN || '', {
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
          });
          break;
        case 'SENDGRID':
          await this.transporter.send({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
          });
          break;
        case 'RESEND':
          await this.transporter.emails.send({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
          });
          break;
        default:
          console.log('Email sending skipped: No provider configured.', options);
          break;
      }
      console.log(`Email sent to ${options.to} with subject: ${options.subject}`);
    } catch (error) {
      console.error(`Failed to send email to ${options.to}:`, error);
    }
  }

  async sendWelcomeEmail(to: string, name: string) {
    const emailHtml = render(WelcomeEmail({ name }));
    await this.sendEmail({
      to,
      subject: 'Welcome to our platform!',
      html: emailHtml,
    });
  }

  async sendNotificationEmail(to: string, message: string) {
    const emailHtml = render(NotificationEmail({ message }));
    await this.sendEmail({
      to,
      subject: 'New Notification',
      html: emailHtml,
    });
  }
}

export const emailService = new EmailService();