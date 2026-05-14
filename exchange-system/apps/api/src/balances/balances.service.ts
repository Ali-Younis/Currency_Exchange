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
}
