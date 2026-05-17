import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(forwardRef(() => AppSettingsService))
    private readonly settings: AppSettingsService,
  ) {}

  private async createTransport() {
    const host = await this.settings.get('smtp_host');
    const port = await this.settings.get('smtp_port');
    const user = await this.settings.get('smtp_user');
    const pass = await this.settings.get('smtp_pass');

    if (!host) return null;

    return nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendReceiptEmail(opts: {
    to: string;
    receiptNumber: string;
    customerName: string;
    type: 'BUY' | 'SELL' | 'CROSS';
    amountIn: string;
    currencyIn: string;
    amountOut: string;
    currencyOut: string;
    rate: string;
    date: string;
  }): Promise<void> {
    const transport = await this.createTransport();
    if (!transport) {
      this.logger.warn('SMTP not configured — email not sent');
      return;
    }

    const from = (await this.settings.get('smtp_from')) ?? 'noreply@exchange-manager.local';
    const logoB64 = await this.settings.get('logo_base64');

    const logoHtml = logoB64
      ? `<img src="${logoB64}" alt="Company Logo" style="max-height:60px;max-width:220px;object-fit:contain;display:block;margin-bottom:16px">`
      : `<div style="font-size:22px;font-weight:bold;color:#0a146e;margin-bottom:16px">Exchange Manager</div>`;

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#0a146e;padding:24px 28px">
          ${logoHtml}
          <div style="color:#fff;font-size:18px;font-weight:600">Transaction Receipt</div>
        </div>
        <div style="padding:24px 28px">
          <p style="margin:0 0 16px;color:#374151">Dear <strong>${opts.customerName}</strong>,</p>
          <p style="margin:0 0 20px;color:#374151">Thank you for your transaction. Here are the details:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280;width:45%">Receipt #</td>
              <td style="padding:10px 0;font-weight:600;color:#111827">${opts.receiptNumber}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Transaction type</td>
              <td style="padding:10px 0;color:#111827">${opts.type === 'BUY' ? 'Buy (customer sold us currency)' : opts.type === 'SELL' ? 'Sell (customer bought currency)' : 'Cross-currency exchange'}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">You gave</td>
              <td style="padding:10px 0;font-weight:600;color:#dc2626">${opts.amountIn} ${opts.currencyIn}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">You received</td>
              <td style="padding:10px 0;font-weight:600;color:#16a34a">${opts.amountOut} ${opts.currencyOut}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Rate applied</td>
              <td style="padding:10px 0;color:#111827">${opts.rate}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7280">Date</td>
              <td style="padding:10px 0;color:#111827">${opts.date}</td>
            </tr>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px">
            This is an automated receipt from Exchange Manager. Please keep it for your records.
          </p>
        </div>
      </div>
    `;

    try {
      await transport.sendMail({ from, to: opts.to, subject: `Receipt ${opts.receiptNumber}`, html });
      this.logger.log(`Receipt email sent to ${opts.to}`);
    } catch (err) {
      this.logger.error(`Failed to send receipt email: ${String(err)}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string, fullName: string): Promise<void> {
    const transport = await this.createTransport();
    if (!transport) {
      this.logger.warn('SMTP not configured — password reset email not sent');
      return;
    }

    const from = (await this.settings.get('smtp_from')) ?? 'noreply@exchange-manager.local';

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0a146e">Password Reset Request</h2>
        <p>Dear ${fullName},</p>
        <p>We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${resetUrl}" style="background:#0a146e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Reset Password
          </a>
        </div>
        <p style="color:#888;font-size:13px">If you did not request this, you can safely ignore this email. Your password will not change.</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Exchange Manager — Currency Exchange System</p>
      </div>
    `;

    try {
      await transport.sendMail({ from, to, subject: 'Password Reset — Exchange Manager', html });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email: ${String(err)}`);
    }
  }

  async sendTestEmail(to: string): Promise<void> {
    const transport = await this.createTransport();
    if (!transport) throw new Error('SMTP not configured');

    const from = (await this.settings.get('smtp_from')) ?? 'noreply@exchange-manager.local';
    await transport.sendMail({
      from,
      to,
      subject: 'Exchange Manager — Test Email',
      text: 'This is a test email from Exchange Manager. SMTP is configured correctly.',
    });
  }
}
