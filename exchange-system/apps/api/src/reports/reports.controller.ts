import { Controller, Get, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

const today = () => new Date().toISOString().split('T')[0];
const thirtyDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  // ── Existing endpoints ────────────────────────────────────────────────────

  @Get('session')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports', 'dashboard')
  getSessionReport(@Query('date') date: string) {
    return this.svc.getSessionReport(date ?? today());
  }

  @Get('ledger')
  @UseGuards(PermissionsGuard)
  @RequirePermission('ledger')
  getDailyLedger(@Query('date') date: string) {
    return this.svc.getDailyLedger(date ?? today());
  }

  // ── Admin reports ─────────────────────────────────────────────────────────

  /** P&L report: spread profit per currency over a date range */
  @Get('profit')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getProfitReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.svc.getProfitReport(startDate ?? thirtyDaysAgo(), endDate ?? today());
  }

  /** Volume & trend report — daily/weekly/monthly transaction counts */
  @Get('volume')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports')
  getVolumeReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'day',
    @Query('currencyId') currencyId?: string,
  ) {
    return this.svc.getVolumeReport(startDate ?? thirtyDaysAgo(), endDate ?? today(), groupBy, currencyId);
  }

  /** Top customers by transaction count (all-time, no date filter) */
  @Get('customers')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports')
  getTopCustomers(
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.svc.getTopCustomers(limit);
  }

  /** Rate history for a specific currency */
  @Get('rates-history')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports')
  getRateHistory(
    @Query('currencyId') currencyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.svc.getRateHistory(currencyId, startDate ?? thirtyDaysAgo(), endDate ?? today());
  }

  /** Paginated audit trail */
  @Get('audit')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports')
  getAuditTrail(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize?: number,
  ) {
    return this.svc.getAuditTrail({ startDate, endDate, action, userId, page, pageSize });
  }

  /** Enhanced end-of-day summary with profit totals */
  @Get('end-of-day')
  @UseGuards(PermissionsGuard)
  @RequirePermission('reports')
  getEndOfDay(@Query('date') date: string) {
    return this.svc.getEndOfDay(date ?? today());
  }
}
