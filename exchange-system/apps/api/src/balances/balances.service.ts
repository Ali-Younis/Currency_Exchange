import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SetOpeningBalanceDto } from './dto/set-balance.dto';

@Injectable()
export class BalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getByDate(sessionDate: string) {
    return this.prisma.openingBalance.findMany({
      where: { sessionDate: new Date(sessionDate) },
      include: { currency: true },
      orderBy: { currency: { sortOrder: 'asc' } },
    });
  }

  async upsert(dto: SetOpeningBalanceDto, setById: string) {
    const balance = await this.prisma.openingBalance.upsert({
      where: {
        currencyId_sessionDate: {
          currencyId: dto.currencyId,
          sessionDate: new Date(dto.sessionDate),
        },
      },
      update: { amount: dto.amount, setById },
      create: {
        currencyId: dto.currencyId,
        amount: dto.amount,
        sessionDate: new Date(dto.sessionDate),
        setById,
      },
      include: { currency: true },
    });

    await this.audit.log({
      userId: setById,
      action: 'SET_OPENING_BALANCE',
      entity: 'OpeningBalance',
      entityId: balance.id,
      payload: { currencyId: dto.currencyId, amount: dto.amount, sessionDate: dto.sessionDate },
    });

    return balance;
  }

  /** Real-time balances: opening + buys - sells for today's session */
  async getCurrentBalances(sessionDate?: string) {
    const today = sessionDate ?? new Date().toISOString().split('T')[0];
    const dateKey = new Date(today);

    const currencies = await this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const openingBals = await this.prisma.openingBalance.findMany({
      where: { sessionDate: dateKey },
    });

    const openingMap = Object.fromEntries(openingBals.map((b) => [b.currencyId, b.amount]));

    const txns = await this.prisma.transaction.findMany({
      where: { sessionDate: dateKey, isVoided: false },
    });

    return currencies.map((c) => {
      const opening = openingMap[c.id] ?? 0;
      const buys = txns
        .filter((t) => t.type === 'BUY' && t.currencyInId === c.id)
        .reduce((s, t) => s + parseFloat(t.amountIn.toString()), 0);
      const sells = txns
        .filter((t) => t.type === 'SELL' && t.currencyOutId === c.id)
        .reduce((s, t) => s + parseFloat(t.amountOut.toString()), 0);
      const current = parseFloat(opening.toString()) + buys - sells;

      return {
        currencyId: c.id,
        currencyCode: c.code,
        currencyNameEn: c.nameEn,
        currencyNameAr: c.nameAr,
        symbol: c.symbol,
        countryCode: c.countryCode,
        openingBalance: parseFloat(opening.toString()).toFixed(2),
        totalBuys: buys.toFixed(2),
        totalSells: sells.toFixed(2),
        currentBalance: current.toFixed(2),
      };
    });
  }
}
