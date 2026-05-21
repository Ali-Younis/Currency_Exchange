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
    time?: string;
    commission1?: string;
    commission2?: string;
    inRate?: string;
    outRate?: string;
    cashierName?: string;
  }): Promise<void> {
    const transport = await this.createTransport();
    if (!transport) {
      this.logger.warn('SMTP not configured — email not sent');
      return;
    }

    const from = (await this.settings.get('smtp_from')) ?? 'noreply@exchange-manager.local';
    const logoB64 = await this.settings.get('logo_base64');
    const companyName = (await this.settings.get('company_name')) ?? 'Exchange Manager';
    const companyAddress = (await this.settings.get('company_address')) ?? '';
    const companyPhone = (await this.settings.get('company_phone')) ?? '';
    const companyEmail = (await this.settings.get('company_email')) ?? '';
    const greetingTemplate = (await this.settings.get('receipt_greeting')) ?? 'Dear {customerName},\n\nThank you for your transaction. Please find below the details of your exchange. If you have any questions, please do not hesitate to contact us.';
    const closingTemplate = (await this.settings.get('receipt_closing')) ?? 'Thank you for choosing {companyName} for your currency exchange needs. We appreciate your business and look forward to serving you again.';

    const substitute = (template: string) =>
      template
        .replace(/\{customerName\}/gi, opts.customerName)
        .replace(/\{companyName\}/gi, companyName);

    const greeting = substitute(greetingTemplate);
    const closing = substitute(closingTemplate);

    // Format date/time display
    let dateTimeDisplay = opts.date;
    if (opts.time) {
      try {
        const timeObj = new Date(opts.time);
        const hh = String(timeObj.getUTCHours()).padStart(2, '0');
        const mm2 = String(timeObj.getUTCMinutes()).padStart(2, '0');
        dateTimeDisplay = `${opts.date} at ${hh}:${mm2} UTC`;
      } catch {
        dateTimeDisplay = opts.date;
      }
    }

    // Strip data URI prefix to get raw base64 for CID attachment (required for Gmail)
    let logoBase64Raw: string | null = null;
    let logoMime = 'image/png';
    if (logoB64) {
      const match = logoB64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        logoMime = match[1];
        logoBase64Raw = match[2];
      } else {
        logoBase64Raw = logoB64;
      }
    }

    const logoHtml = logoBase64Raw
      ? `<img src="cid:logo@exchange" alt="${companyName}" style="max-height:70px;max-width:240px;object-fit:contain;display:block;margin:0 auto 10px">`
      : `<div style="font-size:24px;font-weight:bold;color:#0a146e;text-align:center;margin-bottom:10px">${companyName}</div>`;

    const companyDetailsLines = [
      `<div style="font-size:15px;font-weight:700;color:#111827;text-align:center;margin-bottom:4px">${companyName}</div>`,
      companyAddress ? `<div style="font-size:13px;color:#6b7280;text-align:center">${companyAddress}</div>` : '',
      (companyPhone || companyEmail)
        ? `<div style="font-size:13px;color:#6b7280;text-align:center">${[companyPhone, companyEmail].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>`
        : '',
    ].filter(Boolean).join('');

    // Build rate rows depending on transaction type
    const rateRows = opts.type === 'CROSS'
      ? `<tr style="border-bottom:1px solid #f3f4f6">
           <td style="padding:10px 0;color:#6b7280;width:45%">Rate 1 (${opts.currencyIn} &rarr; GBP)</td>
           <td style="padding:10px 0;color:#111827">${opts.inRate ?? opts.rate}</td>
         </tr>
         <tr style="border-bottom:1px solid #f3f4f6">
           <td style="padding:10px 0;color:#6b7280">Rate 2 (GBP &rarr; ${opts.currencyOut})</td>
           <td style="padding:10px 0;color:#111827">${opts.outRate ?? ''}</td>
         </tr>`
      : opts.type === 'BUY'
      ? `<tr style="border-bottom:1px solid #f3f4f6">
           <td style="padding:10px 0;color:#6b7280;width:45%">Rate (${opts.currencyIn} &rarr; GBP)</td>
           <td style="padding:10px 0;color:#111827">${opts.rate}</td>
         </tr>`
      : `<tr style="border-bottom:1px solid #f3f4f6">
           <td style="padding:10px 0;color:#6b7280;width:45%">Rate (GBP &rarr; ${opts.currencyOut})</td>
           <td style="padding:10px 0;color:#111827">${opts.rate}</td>
         </tr>`;

    // Commission rows
    const commissionRows = (() => {
      if (!opts.commission1 && !opts.commission2) return '';
      if (opts.type === 'CROSS' && opts.commission2) {
        return `<tr style="border-bottom:1px solid #f3f4f6">
           <td style="padding:10px 0;color:#6b7280">Commission 1</td>
           <td style="padding:10px 0;color:#111827">${opts.commission1 ?? '0.00'} GBP</td>
         </tr>
         <tr style="border-bottom:1px solid #f3f4f6">
           <td style="padding:10px 0;color:#6b7280">Commission 2</td>
           <td style="padding:10px 0;color:#111827">${opts.commission2} GBP</td>
         </tr>`;
      }
      if (opts.commission1 && parseFloat(opts.commission1) > 0) {
        return `<tr style="border-bottom:1px solid #f3f4f6">
           <td style="padding:10px 0;color:#6b7280">Commission</td>
           <td style="padding:10px 0;color:#111827">${opts.commission1} GBP</td>
         </tr>`;
      }
      return '';
    })();

    // Format greeting/closing preserving line breaks
    const greetingHtml = greeting.replace(/\n/g, '<br>');
    const closingHtml = closing.replace(/\n/g, '<br>');

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#ffffff;padding:28px 28px 16px;text-align:center">
          ${logoHtml}
          ${companyDetailsLines}
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
        <div style="padding:24px 28px">
          <p style="margin:0 0 20px;color:#374151;line-height:1.6">${greetingHtml}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280;width:45%">Receipt #</td>
              <td style="padding:10px 0;font-weight:600;color:#111827">${opts.receiptNumber}</td>
            </tr>
            ${opts.cashierName ? `
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280;width:45%">Cashier</td>
              <td style="padding:10px 0;color:#111827">${opts.cashierName}</td>
            </tr>` : ''}
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Date &amp; Time</td>
              <td style="padding:10px 0;color:#111827">${dateTimeDisplay}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">You gave</td>
              <td style="padding:10px 0;font-weight:600;color:#dc2626">${opts.amountIn} ${opts.currencyIn}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">You received</td>
              <td style="padding:10px 0;font-weight:600;color:#16a34a">${opts.amountOut} ${opts.currencyOut}</td>
            </tr>
            ${rateRows}
            ${commissionRows}
          </table>
          <p style="margin:24px 0 0;color:#374151;line-height:1.6">${closingHtml}</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;border-top:1px solid #f3f4f6;padding-top:16px">
            This is an automated receipt. Please keep it for your records.
          </p>
        </div>
      </div>
    `;

    try {
      await transport.sendMail({
        from,
        to: opts.to,
        subject: `Currency Exchange Receipt — ${opts.receiptNumber}`,
        html,
        attachments: logoBase64Raw
          ? [{ filename: 'logo.png', content: logoBase64Raw, encoding: 'base64' as const, cid: 'logo@exchange', contentType: logoMime }]
          : [],
      });
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
