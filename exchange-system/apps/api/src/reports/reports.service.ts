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
}
