import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
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
    private readonly email: EmailService,
  ) {}

  async create(dto: CreateTransactionDto, tellerId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createdTx: any = null;
    let valueInGbpForAudit = new Prisma.Decimal(0);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdTx = await this.prisma.$transaction(
        async (tx) => {
          const gbpCurrency = await tx.currency.findFirst({ where: { code: 'GBP' } });

          const isCross =
            gbpCurrency !== null &&
            dto.currencyInId !== gbpCurrency.id &&
            dto.currencyOutId !== gbpCurrency.id;

          let valueInGbp: Prisma.Decimal;
          let buyRateSnapshot: Prisma.Decimal | null = null;
          let sellRateSnapshot: Prisma.Decimal | null = null;
          let spreadProfitGbp: Prisma.Decimal | null = null;

          if (isCross) {
            // ── Cross-currency: SAR → EUR via GBP bridge ─────────────────────────
            const [inRate, outRate] = await Promise.all([
              tx.exchangeRate.findFirst({
                where: { currencyId: dto.currencyInId },
                orderBy: { effectiveDate: 'desc' },
              }),
              tx.exchangeRate.findFirst({
                where: { currencyId: dto.currencyOutId },
                orderBy: { effectiveDate: 'desc' },
              }),
            ]);

            if (inRate) {
              valueInGbp = new Prisma.Decimal(dto.amountIn).div(new Prisma.Decimal(inRate.buyRate));
              buyRateSnapshot = new Prisma.Decimal(inRate.buyRate);
              sellRateSnapshot = outRate ? new Prisma.Decimal(outRate.sellRate) : null;
              const spreadIn = new Prisma.Decimal(inRate.buyRate)
                .minus(new Prisma.Decimal(inRate.sellRate))
                .div(new Prisma.Decimal(inRate.buyRate));
              let totalSpread = spreadIn;
              if (outRate) {
                const spreadOut = new Prisma.Decimal(outRate.buyRate)
                  .minus(new Prisma.Decimal(outRate.sellRate))
                  .div(new Prisma.Decimal(outRate.buyRate));
                totalSpread = totalSpread.plus(spreadOut);
              }
              spreadProfitGbp = valueInGbp.mul(totalSpread);
              if (spreadProfitGbp.lt(0)) spreadProfitGbp = new Prisma.Decimal(0);
            } else {
              valueInGbp = new Prisma.Decimal(dto.amountIn).div(new Prisma.Decimal(dto.rateApplied));
            }
          } else {
            // ── Standard GBP-involved trade ──────────────────────────────────────
            if (gbpCurrency && dto.currencyInId === gbpCurrency.id) {
              valueInGbp = new Prisma.Decimal(dto.amountIn);
            } else if (gbpCurrency && dto.currencyOutId === gbpCurrency.id) {
              valueInGbp = new Prisma.Decimal(dto.amountOut);
            } else {
              valueInGbp = new Prisma.Decimal(0);
            }

            const foreignCurrencyId =
              gbpCurrency && dto.currencyInId === gbpCurrency.id ? dto.currencyOutId : dto.currencyInId;

            const latestRate = await tx.exchangeRate.findFirst({
              where: { currencyId: foreignCurrencyId },
              orderBy: { effectiveDate: 'desc' },
            });

            if (latestRate) {
              buyRateSnapshot = new Prisma.Decimal(latestRate.buyRate);
              sellRateSnapshot = new Prisma.Decimal(latestRate.sellRate);
              if (buyRateSnapshot.gt(0)) {
                const spread = buyRateSnapshot.minus(sellRateSnapshot);
                spreadProfitGbp = valueInGbp.mul(spread).div(buyRateSnapshot);
                if (spreadProfitGbp.lt(0)) spreadProfitGbp = new Prisma.Decimal(0);
              }
            }
          }

          valueInGbpForAudit = valueInGbp;

          // ── Balance check: ensure we have enough of currencyOut ───────────────
          const sessionDateObj = new Date(dto.sessionDate);
          const [openingBalance, inflowAgg, outflowAgg, currencyOut] = await Promise.all([
            tx.openingBalance.findFirst({
              where: { currencyId: dto.currencyOutId, sessionDate: sessionDateObj },
            }),
            tx.transaction.aggregate({
              where: { currencyInId: dto.currencyOutId, isVoided: false, sessionDate: sessionDateObj },
              _sum: { amountIn: true },
            }),
            tx.transaction.aggregate({
              where: { currencyOutId: dto.currencyOutId, isVoided: false, sessionDate: sessionDateObj },
              _sum: { amountOut: true },
            }),
            tx.currency.findUnique({ where: { id: dto.currencyOutId } }),
          ]);

          const opening = new Prisma.Decimal(openingBalance?.amount?.toString() ?? '0');
          const inflows = new Prisma.Decimal(inflowAgg._sum.amountIn?.toString() ?? '0');
          const outflows = new Prisma.Decimal(outflowAgg._sum.amountOut?.toString() ?? '0');
          const available = opening.plus(inflows).minus(outflows);

          if (available.lt(new Prisma.Decimal(dto.amountOut))) {
            throw new BadRequestException(
              `Insufficient ${currencyOut?.code ?? 'currency'} balance: available ${available.toFixed(2)}, required ${dto.amountOut}`,
            );
          }

          // ── Create transaction ────────────────────────────────────────────────
          return tx.transaction.create({
            data: {
              receiptNumber: generateReceiptNumber(),
              type: dto.type,
              customerName: dto.customerName,
              customerEmail: dto.customerEmail,
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
              sessionDate: sessionDateObj,
            },
            include: {
              currencyIn: true,
              currencyOut: true,
              teller: { select: { id: true, fullName: true, username: true } },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      // P2034: serialization failure from concurrent transactions — ask teller to retry
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        throw new ConflictException('Transaction conflict due to concurrent request, please try again.');
      }
      throw e;
    }

    const result = createdTx!;

    await this.audit.log({
      userId: tellerId,
      action: 'CREATE_TRANSACTION',
      entity: 'Transaction',
      entityId: result.id,
      payload: { receiptNumber: result.receiptNumber, type: result.type, valueInGbp: valueInGbpForAudit.toString() },
    });

    // Fire-and-forget email receipt
    if (dto.customerEmail) {
      void this.email.sendReceiptEmail({
        to: dto.customerEmail,
        receiptNumber: result.receiptNumber,
        customerName: dto.customerName,
        type: dto.type,
        amountIn: result.amountIn.toString(),
        currencyIn: result.currencyIn.code,
        amountOut: result.amountOut.toString(),
        currencyOut: result.currencyOut.code,
        rate: result.rateApplied.toString(),
        date: dto.sessionDate,
      });
    }

    return result;
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
