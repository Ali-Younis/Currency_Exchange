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
    type: 'BUY' | 'SELL';
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

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0a146e">Exchange Receipt</h2>
        <p>Dear ${opts.customerName},</p>
        <p>Thank you for your transaction. Here are the details:</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#555">Receipt #</td><td style="font-weight:bold">${opts.receiptNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Type</td><td>${opts.type === 'BUY' ? 'Buy (we bought your currency)' : 'Sell (we sold you currency)'}</td></tr>
          <tr><td style="padding:6px 0;color:#555">You gave</td><td>${opts.amountIn} ${opts.currencyIn}</td></tr>
          <tr><td style="padding:6px 0;color:#555">You received</td><td>${opts.amountOut} ${opts.currencyOut}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Rate applied</td><td>${opts.rate}</td></tr>
          <tr><td style="padding:6px 0;color:#555">Date</td><td>${opts.date}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px">Exchange Manager — Currency Exchange System</p>
      </div>
    `;

    try {
      await transport.sendMail({ from, to: opts.to, subject: `Receipt ${opts.receiptNumber}`, html });
      this.logger.log(`Receipt email sent to ${opts.to}`);
    } catch (err) {
      this.logger.error(`Failed to send receipt email: ${String(err)}`);
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
