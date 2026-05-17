import {
  Controller, Get, Put, Delete, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

class SetSettingDto {
  @IsString()
  @IsNotEmpty()
  value!: string;
}

class TestEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to!: string;
}

@Controller('app-settings')
@UseGuards(JwtAuthGuard)
export class AppSettingsController {
  constructor(
    private readonly svc: AppSettingsService,
    private readonly email: EmailService,
  ) {}

  /** Public read — any authenticated user can fetch settings (e.g. logo) */
  @Get()
  getAll() {
    return this.svc.getAll();
  }

  /** Unauthenticated — used on login page before the user has a token */
  @Get('public/logo')
  @Public()
  async getPublicLogo() {
    const value = await this.svc.get('logo_base64');
    return { key: 'logo_base64', value: value ?? null };
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    const value = await this.svc.get(key);
    if (value === null) return { key, value: null };
    return { key, value };
  }

  @Put(':key')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  set(@Param('key') key: string, @Body() dto: SetSettingDto) {
    return this.svc.set(key, dto.value);
  }

  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('key') key: string) {
    return this.svc.delete(key);
  }

  @Post('email/test')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async testEmail(@Body() dto: TestEmailDto) {
    await this.email.sendTestEmail(dto.to);
    return { sent: true };
  }
}
