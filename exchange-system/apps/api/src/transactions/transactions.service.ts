import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { Prisma } from '@prisma/client';

function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `TXN-${year}-${rand}`;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateTransactionDto, tellerId: string) {
    // Determine valueInGbp — the GBP side of the transaction
    // GBP is always one side; if neither currency is GBP, use amountIn * rateApplied
    const gbpCurrency = await this.prisma.currency.findFirst({ where: { code: 'GBP' } });
    let valueInGbp: Prisma.Decimal;

    if (gbpCurrency) {
      if (dto.currencyInId === gbpCurrency.id) {
        valueInGbp = new Prisma.Decimal(dto.amountIn);
      } else if (dto.currencyOutId === gbpCurrency.id) {
        valueInGbp = new Prisma.Decimal(dto.amountOut);
      } else {
        // Cross-currency: approximate via rate
        valueInGbp = new Prisma.Decimal(dto.amountIn).div(new Prisma.Decimal(dto.rateApplied));
      }
    } else {
      valueInGbp = new Prisma.Decimal(0);
    }

    // ── Profit snapshot: fetch the current exchange rate for the foreign currency
    const foreignCurrencyId =
      gbpCurrency && dto.currencyInId === gbpCurrency.id ? dto.currencyOutId : dto.currencyInId;

    const latestRate = await this.prisma.exchangeRate.findFirst({
      where: { currencyId: foreignCurrencyId },
      orderBy: { effectiveDate: 'desc' },
    });

    let buyRateSnapshot: Prisma.Decimal | null = null;
    let sellRateSnapshot: Prisma.Decimal | null = null;
    let spreadProfitGbp: Prisma.Decimal | null = null;

    if (latestRate) {
      buyRateSnapshot = new Prisma.Decimal(latestRate.buyRate);
      sellRateSnapshot = new Prisma.Decimal(latestRate.sellRate);
      // Spread profit = valueInGbp × (sellRate - buyRate) / buyRate
      // sellRate > buyRate → agency earns money on every unit exchanged
      if (buyRateSnapshot.gt(0)) {
        const spread = sellRateSnapshot.minus(buyRateSnapshot);
        spreadProfitGbp = valueInGbp.mul(spread).div(buyRateSnapshot);
        // Clamp to zero — should never be negative, but guard against bad rate data
        if (spreadProfitGbp.lt(0)) spreadProfitGbp = new Prisma.Decimal(0);
      }
    }

    const tx = await this.prisma.transaction.create({
      data: {
        receiptNumber: generateReceiptNumber(),
        type: dto.type,
        customerName: dto.customerName,
        currencyInId: dto.currencyInId,
        amountIn: dto.amountIn,
        currencyOutId: dto.currencyOutId,
        amountOut: dto.amountOut,
        rateApplied: dto.rateApplied,
        valueInGbp,
        buyRateSnapshot,
        sellRateSnapshot,
        spreadProfitGbp,
        notes: dto.notes,
        tellerId,
        sessionDate: new Date(dto.sessionDate),
      },
      include: {
        currencyIn: true,
        currencyOut: true,
        teller: { select: { id: true, fullName: true, username: true } },
      },
    });

    await this.audit.log({
      userId: tellerId,
      action: 'CREATE_TRANSACTION',
      entity: 'Transaction',
      entityId: tx.id,
      payload: { receiptNumber: tx.receiptNumber, type: tx.type, valueInGbp: valueInGbp.toString() },
    });

    return tx;
  }

  async findAll(params: {
    sessionDate?: string;
    type?: string;
    tellerId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { sessionDate, type, tellerId, page = 1, pageSize = 50 } = params;
    const where: Prisma.TransactionWhereInput = {};
    if (sessionDate) where.sessionDate = new Date(sessionDate);
    if (type) where.type = type as 'BUY' | 'SELL';
    if (tellerId) where.tellerId = tellerId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: {
          currencyIn: true,
          currencyOut: true,
          teller: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        currencyIn: true,
        currencyOut: true,
        teller: { select: { id: true, fullName: true } },
      },
    });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }

  async voidTransaction(id: string, dto: VoidTransactionDto, userId: string, userRole: string) {
    const tx = await this.findOne(id);
    if (tx.isVoided) throw new ForbiddenException('Transaction is already voided');
    if (userRole !== 'ADMIN') throw new ForbiddenException('Only admins can void transactions');

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { isVoided: true, voidedAt: new Date(), voidedReason: dto.reason },
    });

    await this.audit.log({
      userId,
      action: 'VOID_TRANSACTION',
      entity: 'Transaction',
      entityId: id,
      payload: { reason: dto.reason },
    });

    return updated;
  }
}
