import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('session')
  getSessionReport(@Query('date') date: string) {
    const sessionDate = date ?? new Date().toISOString().split('T')[0];
    return this.svc.getSessionReport(sessionDate);
  }

  @Get('ledger')
  getDailyLedger(@Query('date') date: string) {
    const sessionDate = date ?? new Date().toISOString().split('T')[0];
    return this.svc.getDailyLedger(sessionDate);
  }
}
