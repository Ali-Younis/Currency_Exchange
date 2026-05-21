import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthTokenPayload } from '@exchange/shared';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    private readonly svc: TransactionsService,
    private readonly settings: AppSettingsService,
  ) {}

  @Get()
  findAll(
    @Query('date') date?: string,
    @Query('type') type?: string,
    @Query('tellerId') tellerId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.findAll({
      sessionDate: date,
      type,
      tellerId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthTokenPayload,
  ) {
    return this.svc.create(dto, user.sub);
  }

  @Patch(':id/void')
  voidTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidTransactionDto,
    @CurrentUser() user: AuthTokenPayload,
  ) {
    return this.svc.voidTransaction(id, dto, user.sub, user.role);
  }

  @Post(':id/save-pdf')
  async savePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { pdfBase64: string; filename: string },
  ) {
    const dir = (await this.settings.get('pdf_save_directory')) ?? '/app/pdf-receipts';
    if (!dir) return { skipped: true };
    try {
      fs.mkdirSync(dir, { recursive: true });
      const safeName = path.basename(body.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
      const fullPath = path.join(dir, safeName);
      fs.writeFileSync(fullPath, Buffer.from(body.pdfBase64, 'base64'));
      return { saved: true, path: fullPath };
    } catch {
      return { saved: false };
    }
  }
}
