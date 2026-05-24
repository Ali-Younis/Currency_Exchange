import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AppSettingsService } from '../app-settings/app-settings.service';

export interface BackupData {
  version: string;
  exportedAt: string;
  tables: {
    appSettings: unknown[];
    currencies: unknown[];
    users: unknown[];
    exchangeRates: unknown[];
    openingBalances: unknown[];
    transactions: unknown[];
    auditLogs: unknown[];
  };
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  async exportData(): Promise<BackupData> {
    const [appSettings, currencies, users, exchangeRates, openingBalances, transactions, auditLogs] =
      await Promise.all([
        this.prisma.appSetting.findMany(),
        this.prisma.currency.findMany(),
        this.prisma.user.findMany(),
        this.prisma.exchangeRate.findMany(),
        this.prisma.openingBalance.findMany(),
        this.prisma.transaction.findMany(),
        this.prisma.auditLog.findMany(),
      ]);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables: {
        appSettings,
        currencies,
        users,
        exchangeRates,
        openingBalances,
        transactions,
        auditLogs,
      },
    };
  }

  async restoreData(backup: BackupData): Promise<void> {
    // Validate structure
    if (!backup?.version || !backup?.tables) {
      throw new Error('Invalid backup file format');
    }

    const t = backup.tables;

    await this.prisma.$transaction(async (tx) => {
      // Delete in reverse FK dependency order
      await tx.auditLog.deleteMany();
      await tx.transaction.deleteMany();
      await tx.openingBalance.deleteMany();
      await tx.exchangeRate.deleteMany();
      await tx.user.deleteMany();
      await tx.currency.deleteMany();
      await tx.appSetting.deleteMany();

      // Restore in FK order
      if (t.appSettings?.length) {
        await tx.appSetting.createMany({ data: t.appSettings as never[] });
      }
      if (t.currencies?.length) {
        await tx.currency.createMany({ data: t.currencies as never[] });
      }
      if (t.users?.length) {
        await tx.user.createMany({ data: t.users as never[] });
      }
      if (t.exchangeRates?.length) {
        await tx.exchangeRate.createMany({ data: t.exchangeRates as never[] });
      }
      if (t.openingBalances?.length) {
        await tx.openingBalance.createMany({ data: t.openingBalances as never[] });
      }
      if (t.transactions?.length) {
        await tx.transaction.createMany({ data: t.transactions as never[] });
      }
      if (t.auditLogs?.length) {
        await tx.auditLog.createMany({ data: t.auditLogs as never[] });
      }
    }, { timeout: 60000 });
  }

  async backupToFile(): Promise<string> {
    const dir = (await this.settings.get('backup_directory')) ?? '/app/backups';

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `RMX2_Exchange_Backup_${datePart}_${timePart}.json`;
    const filepath = path.join(dir, filename);

    const data = await this.exportData();
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');

    this.logger.log(`Backup written to ${filepath}`);
    await Promise.all([
      this.settings.set('backup_last_run', new Date().toISOString()),
      this.settings.set('backup_last_status', 'success'),
    ]);
    return filepath;
  }

  async listBackupFiles(): Promise<{ name: string; size: number; modifiedAt: string }[]> {
    const dir = (await this.settings.get('backup_directory')) ?? '/app/backups';
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && /^[a-zA-Z0-9._-]+$/.test(f));
    return files
      .map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return { name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  async resolveBackupFilePath(filename: string): Promise<string | null> {
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
    const dir = path.resolve((await this.settings.get('backup_directory')) ?? '/app/backups');
    const full = path.join(dir, filename);
    if (!full.startsWith(dir + path.sep) && full !== dir) return null;
    if (!fs.existsSync(full)) return null;
    return full;
  }

  async deleteBackupFile(filename: string): Promise<boolean> {
    const full = await this.resolveBackupFilePath(filename);
    if (!full) return false;
    fs.unlinkSync(full);
    return true;
  }

  async listPdfFiles(): Promise<{ name: string; size: number; modifiedAt: string }[]> {
    const dir = (await this.settings.get('pdf_save_directory')) ?? '/app/pdf-receipts';
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf') && /^[a-zA-Z0-9._-]+$/.test(f));
    return files
      .map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return { name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  async resolvePdfFilePath(filename: string): Promise<string | null> {
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return null;
    const dir = path.resolve((await this.settings.get('pdf_save_directory')) ?? '/app/pdf-receipts');
    const full = path.join(dir, filename);
    if (!full.startsWith(dir + path.sep) && full !== dir) return null;
    if (!fs.existsSync(full)) return null;
    return full;
  }

  async deletePdfFile(filename: string): Promise<boolean> {
    const full = await this.resolvePdfFilePath(filename);
    if (!full) return false;
    fs.unlinkSync(full);
    return true;
  }

  /** Runs every minute and triggers backup once per day at or after the configured time. */
  @Cron('* * * * *')
  async scheduledBackupCheck(): Promise<void> {
    const enabled = await this.settings.get('backup_auto_enabled');
    if (enabled !== 'true') return;

    const configTime = await this.settings.get('backup_auto_time');
    if (!configTime) return;

    const now = new Date();
    const [configHour, configMin] = configTime.split(':').map(Number);
    const configMinutes = configHour * 60 + configMin;
    // Always compare in UTC — the stored time is saved as UTC from the frontend
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    // Only fire once the configured UTC time has been reached for today
    if (currentMinutes < configMinutes) return;

    // Use a dedicated key so that manual "Run Now" never blocks the scheduled run
    const lastScheduledDate = await this.settings.get('backup_last_scheduled_date');
    const todayUTC = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    if (lastScheduledDate === todayUTC) return;

    try {
      const filepath = await this.backupToFile();
      this.logger.log(`Scheduled backup completed: ${filepath}`);
      // Record that the scheduled backup ran today (separate from manual Run Now)
      await this.settings.set('backup_last_scheduled_date', todayUTC);
    } catch (err) {
      this.logger.error('Scheduled backup failed', err);
      await Promise.all([
        this.settings.set('backup_last_run', new Date().toISOString()),
        this.settings.set('backup_last_status', `failed: ${(err as Error).message}`),
      ]);
    }
  }
}
