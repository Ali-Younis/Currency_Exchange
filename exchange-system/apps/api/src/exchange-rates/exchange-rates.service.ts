import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SetExchangeRateDto } from './dto/set-rate.dto';

@Injectable()
export class ExchangeRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Get the latest rate for every active currency for a given date (default: today) */
  async getLatestRates(sessionDate?: string) {
    const date = sessionDate ? new Date(sessionDate) : new Date();
    // For each currency, get most recent rate on or before sessionDate
    const currencies = await this.prisma.currency.findMany({ where: { isActive: true } });

    const results = await Promise.all(
      currencies.map(async (c) => {
        const rate = await this.prisma.exchangeRate.findFirst({
          where: {
            currencyId: c.id,
            effectiveDate: { lte: date },
          },
          orderBy: { effectiveDate: 'desc' },
          include: { currency: true },
        });
        return { currency: c, rate: rate ?? null };
      }),
    );

    return results;
  }

  async setRate(dto: SetExchangeRateDto, setById: string) {
    const currency = await this.prisma.currency.findUnique({ where: { id: dto.currencyId } });
    if (!currency) throw new NotFoundException(`Currency ${dto.currencyId} not found`);

    const rate = await this.prisma.exchangeRate.create({
      data: {
        currencyId: dto.currencyId,
        buyRate: dto.buyRate,
        sellRate: dto.sellRate,
        effectiveDate: new Date(),
        setById,
      },
      include: { currency: true },
    });

    await this.audit.log({
      userId: setById,
      action: 'SET_EXCHANGE_RATE',
      entity: 'ExchangeRate',
      entityId: rate.id,
      payload: { currencyCode: currency.code, buyRate: dto.buyRate, sellRate: dto.sellRate },
    });

    return rate;
  }

  async getRateForCurrency(currencyId: string) {
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { currencyId },
      orderBy: { effectiveDate: 'desc' },
    });
    if (!rate) throw new NotFoundException(`No exchange rate set for currency ${currencyId}`);
    return rate;
  }
}
