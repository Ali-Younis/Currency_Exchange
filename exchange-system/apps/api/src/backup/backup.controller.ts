import {
  Controller, Get, Post, Put, Body, HttpCode, HttpStatus, UseGuards, StreamableFile, Header,
} from '@nestjs/common';
import { BackupService, BackupData } from './backup.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

class BackupConfigDto {
  @IsOptional()
  @IsString()
  directory?: string;

  @IsOptional()
  @IsString()
  autoTime?: string;

  @IsOptional()
  @IsBoolean()
  autoEnabled?: boolean;
}

class RestoreDto {
  @IsObject()
  backup!: BackupData;
}

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly settings: AppSettingsService,
  ) {}

  /** Download a full backup as JSON */
  @Get('export')
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename="RMX2_Exchange_Backup.json"')
  async exportBackup(): Promise<StreamableFile> {
    const data = await this.backupService.exportData();
    const json = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(json, 'utf-8');
    return new StreamableFile(buffer);
  }

  /** Restore from uploaded JSON backup */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importBackup(@Body() body: RestoreDto) {
    await this.backupService.restoreData(body.backup);
    return { restored: true };
  }

  /** Trigger an immediate backup to the configured directory */
  @Post('run-now')
  @HttpCode(HttpStatus.OK)
  async runNow() {
    const filepath = await this.backupService.backupToFile();
    return { filepath };
  }

  /** Get auto-backup configuration */
  @Get('config')
  async getConfig() {
    const [directory, autoTime, autoEnabled, lastRun, lastStatus] = await Promise.all([
      this.settings.get('backup_directory'),
      this.settings.get('backup_auto_time'),
      this.settings.get('backup_auto_enabled'),
      this.settings.get('backup_last_run'),
      this.settings.get('backup_last_status'),
    ]);
    return {
      directory: directory ?? '/app/backups',
      autoTime: autoTime ?? '02:00',
      autoEnabled: autoEnabled === 'true',
      lastRun: lastRun ?? null,
      lastStatus: lastStatus ?? null,
    };
  }

  /** Update auto-backup configuration */
  @Put('config')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setConfig(@Body() dto: BackupConfigDto) {
    const ops: Promise<void>[] = [];
    if (dto.directory !== undefined) ops.push(this.settings.set('backup_directory', dto.directory));
    if (dto.autoTime !== undefined) ops.push(this.settings.set('backup_auto_time', dto.autoTime));
    if (dto.autoEnabled !== undefined) ops.push(this.settings.set('backup_auto_enabled', String(dto.autoEnabled)));
    await Promise.all(ops);
  }
}
