import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * End-of-day/session report.
   * Returns per-currency: opening balance, total buys, total sells, closing balance.
   * All non-voided transactions for the given sessionDate are summed.
   */
  async getSessionReport(sessionDate: string) {
    const date = new Date(sessionDate);

    const currencies = await this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const rows = await Promise.all(
      currencies.map(async (currency) => {
        // Opening balance for this date
        const openingBal = await this.prisma.openingBalance.findUnique({
          where: {
            currencyId_sessionDate: { currencyId: currency.id, sessionDate: date },
          },
        });

        // Sum of all BUY transactions where this currency came IN (agency receives it)
        const buysIn = await this.prisma.transaction.aggregate({
          where: {
            currencyInId: currency.id,
            type: 'BUY',
            sessionDate: date,
            isVoided: false,
          },
          _sum: { amountIn: true },
        });

        // Sum of all SELL transactions where this currency went OUT (agency gives it)
        const sellsOut = await this.prisma.transaction.aggregate({
          where: {
            currencyOutId: currency.id,
            type: 'SELL',
            sessionDate: date,
            isVoided: false,
          },
          _sum: { amountOut: true },
        });

        const opening = new Prisma.Decimal(openingBal?.amount ?? 0);
        const totalBuys = new Prisma.Decimal(buysIn._sum.amountIn ?? 0);
        const totalSells = new Prisma.Decimal(sellsOut._sum.amountOut ?? 0);
        const closing = opening.plus(totalBuys).minus(totalSells);

        return {
          currencyId: currency.id,
          currencyCode: currency.code,
          currencyNameEn: currency.nameEn,
          currencyNameAr: currency.nameAr,
          symbol: currency.symbol,
          openingBalance: opening.toFixed(2),
          totalBuys: totalBuys.toFixed(2),
          totalSells: totalSells.toFixed(2),
          closingBalance: closing.toFixed(2),
        };
      }),
    );

    return { sessionDate, rows };
  }

  /** Daily ledger — all transactions for a date, grouped by type */
  async getDailyLedger(sessionDate: string) {
    const date = new Date(sessionDate);
    const transactions = await this.prisma.transaction.findMany({
      where: { sessionDate: date, isVoided: false },
      include: {
        currencyIn: true,
        currencyOut: true,
        teller: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const buys = transactions.filter((t) => t.type === 'BUY');
    const sells = transactions.filter((t) => t.type === 'SELL');

    return { sessionDate, buys, sells, total: transactions.length };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN REPORTS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * P&L Report — spread profit per currency for the given date range.
   * Returns: currencyCode, totalTransactions, totalVolumeGbp, totalProfitGbp, avgProfitPerTxn
   */
  async getProfitReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const currencies = await this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const rows = await Promise.all(
      currencies.map(async (currency) => {
        const agg = await this.prisma.transaction.aggregate({
          where: {
            isVoided: false,
            sessionDate: { gte: start, lte: end },
            OR: [{ currencyInId: currency.id }, { currencyOutId: currency.id }],
          },
          _sum: { valueInGbp: true, spreadProfitGbp: true },
          _count: { id: true },
        });

        const totalTransactions = agg._count.id;
        const totalVolumeGbp = new Prisma.Decimal(agg._sum.valueInGbp ?? 0);
        const totalProfitGbp = new Prisma.Decimal(agg._sum.spreadProfitGbp ?? 0);
        const avgProfitPerTxn =
          totalTransactions > 0 ? totalProfitGbp.div(totalTransactions) : new Prisma.Decimal(0);

        return {
          currencyId: currency.id,
          currencyCode: currency.code,
          currencyNameEn: currency.nameEn,
          symbol: currency.symbol,
          totalTransactions,
          totalVolumeGbp: totalVolumeGbp.toFixed(2),
          totalProfitGbp: totalProfitGbp.toFixed(4),
          avgProfitPerTxnGbp: avgProfitPerTxn.toFixed(4),
        };
      }),
    );

    const grandTotalProfit = rows.reduce(
      (acc, r) => acc.plus(new Prisma.Decimal(r.totalProfitGbp)),
      new Prisma.Decimal(0),
    );
    const grandTotalVolume = rows.reduce(
      (acc, r) => acc.plus(new Prisma.Decimal(r.totalVolumeGbp)),
      new Prisma.Decimal(0),
    );

    return {
      startDate,
      endDate,
      grandTotalProfitGbp: grandTotalProfit.toFixed(4),
      grandTotalVolumeGbp: grandTotalVolume.toFixed(2),
      rows: rows.filter((r) => r.totalTransactions > 0),
    };
  }

  /**
   * Volume Trends — daily transaction counts and GBP value, with per-currency breakdown.
   */
  async getVolumeReport(
    startDate: string,
    endDate: string,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all non-voided transactions in range
    const transactions = await this.prisma.transaction.findMany({
      where: { isVoided: false, sessionDate: { gte: start, lte: end } },
      include: { currencyIn: true, currencyOut: true },
      orderBy: { sessionDate: 'asc' },
    });

    // Group by date bucket
    const buckets = new Map<
      string,
      { count: number; volumeGbp: Prisma.Decimal; buys: number; sells: number }
    >();

    for (const tx of transactions) {
      const d = tx.sessionDate as Date;
      let key: string;
      if (groupBy === 'week') {
        // ISO week Monday
        const day = d.getDay() || 7;
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + 1);
        key = monday.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      } else {
        key = (d as Date).toISOString().split('T')[0];
      }

      const bucket = buckets.get(key) ?? {
        count: 0,
        volumeGbp: new Prisma.Decimal(0),
        buys: 0,
        sells: 0,
      };
      bucket.count += 1;
      bucket.volumeGbp = bucket.volumeGbp.plus(new Prisma.Decimal(tx.valueInGbp));
      if (tx.type === 'BUY') bucket.buys += 1;
      else bucket.sells += 1;
      buckets.set(key, bucket);
    }

    const trendPoints = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        count: b.count,
        volumeGbp: b.volumeGbp.toFixed(2),
        buys: b.buys,
        sells: b.sells,
      }));

    return {
      startDate,
      endDate,
      groupBy,
      totalTransactions: transactions.length,
      trendPoints,
    };
  }

  /**
   * Top Customers — ranked by total GBP value or transaction count.
   */
  async getTopCustomers(startDate: string, endDate: string, limit: number = 20) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const groups = await this.prisma.transaction.groupBy({
      by: ['customerName'],
      where: { isVoided: false, sessionDate: { gte: start, lte: end } },
      _sum: { valueInGbp: true, spreadProfitGbp: true },
      _count: { id: true },
      orderBy: { _sum: { valueInGbp: 'desc' } },
      take: limit,
    });

    return {
      startDate,
      endDate,
      customers: groups.map((g, idx) => ({
        rank: idx + 1,
        customerName: g.customerName,
        totalTransactions: g._count.id,
        totalVolumeGbp: new Prisma.Decimal(g._sum.valueInGbp ?? 0).toFixed(2),
        totalProfitGbp: new Prisma.Decimal(g._sum.spreadProfitGbp ?? 0).toFixed(4),
      })),
    };
  }

  /**
   * Rate History — buy/sell/spread over time for a specific currency.
   */
  async getRateHistory(currencyId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const rates = await this.prisma.exchangeRate.findMany({
      where: { currencyId, effectiveDate: { gte: start, lte: end } },
      include: { currency: true, setBy: { select: { id: true, fullName: true } } },
      orderBy: { effectiveDate: 'asc' },
    });

    return {
      currencyId,
      startDate,
      endDate,
      history: rates.map((r) => ({
        id: r.id,
        effectiveDate: r.effectiveDate,
        buyRate: r.buyRate.toString(),
        sellRate: r.sellRate.toString(),
        spread: new Prisma.Decimal(r.sellRate).minus(new Prisma.Decimal(r.buyRate)).toString(),
        setBy: r.setBy,
        currencyCode: r.currency.code,
      })),
    };
  }

  /**
   * Audit Trail — paginated, filterable log of all admin/system actions.
   */
  async getAuditTrail(params: {
    startDate?: string;
    endDate?: string;
    action?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { startDate, endDate, action, userId, page = 1, pageSize = 50 } = params;

    const where: Prisma.AuditLogWhereInput = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
      if (endDate) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate + 'T23:59:59Z');
    }
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.userId = userId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * End-of-Day Enhanced Report — session summary + profit totals + transaction count.
   */
  async getEndOfDay(sessionDate: string) {
    const date = new Date(sessionDate);

    const [sessionReport, txAgg] = await Promise.all([
      this.getSessionReport(sessionDate),
      this.prisma.transaction.aggregate({
        where: { sessionDate: date, isVoided: false },
        _sum: { valueInGbp: true, spreadProfitGbp: true },
        _count: { id: true },
      }),
    ]);

    const voidedCount = await this.prisma.transaction.count({
      where: { sessionDate: date, isVoided: true },
    });

    return {
      sessionDate,
      totalTransactions: txAgg._count.id,
      voidedTransactions: voidedCount,
      totalVolumeGbp: new Prisma.Decimal(txAgg._sum.valueInGbp ?? 0).toFixed(2),
      totalProfitGbp: new Prisma.Decimal(txAgg._sum.spreadProfitGbp ?? 0).toFixed(4),
      balances: sessionReport.rows,
    };
  }
}
