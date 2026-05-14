import { Test, TestingModule } from '@nestjs/testing';
import { BalancesService } from '../../src/balances/balances.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/audit/audit.service';

describe('BalancesService', () => {
  let service: BalancesService;
  let prisma: {
    currency: { findMany: jest.Mock };
    openingBalance: { findMany: jest.Mock; upsert: jest.Mock };
    transaction: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      currency: { findMany: jest.fn() },
      openingBalance: { findMany: jest.fn(), upsert: jest.fn() },
      transaction: { findMany: jest.fn() },
    };

    const audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
  });

  describe('getCurrentBalances()', () => {
    it('returns correct current balance calculation', async () => {
      const currencyId = 'c1';
      prisma.currency.findMany.mockResolvedValue([
        { id: currencyId, code: 'USD', nameEn: 'US Dollar', nameAr: 'دولار أمريكي', symbol: '$', countryCode: 'US', sortOrder: 1 },
      ]);
      prisma.openingBalance.findMany.mockResolvedValue([
        { currencyId, amount: { toString: () => '1000' } },
      ]);
      prisma.transaction.findMany.mockResolvedValue([
        // BUY: currencyIn = USD (agency buys 200 USD from customer)
        { type: 'BUY', currencyInId: currencyId, currencyOutId: 'gbp', amountIn: { toString: () => '200' }, amountOut: { toString: () => '160' } },
        // SELL: currencyOut = USD (agency sells 50 USD to customer)
        { type: 'SELL', currencyInId: 'gbp', currencyOutId: currencyId, amountIn: { toString: () => '40' }, amountOut: { toString: () => '50' } },
      ]);

      const result = await service.getCurrentBalances('2025-01-15');
      expect(result).toHaveLength(1);

      const row = result[0];
      expect(row.currencyCode).toBe('USD');
      expect(row.openingBalance).toBe('1000.00');
      expect(row.totalBuys).toBe('200.00');    // +200 from BUY
      expect(row.totalSells).toBe('50.00');    // -50 from SELL
      expect(row.currentBalance).toBe('1150.00'); // 1000 + 200 - 50
    });

    it('returns zero balance when no opening balance set', async () => {
      prisma.currency.findMany.mockResolvedValue([
        { id: 'c2', code: 'EUR', nameEn: 'Euro', nameAr: 'يورو', symbol: '€', countryCode: 'EU', sortOrder: 2 },
      ]);
      prisma.openingBalance.findMany.mockResolvedValue([]);
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getCurrentBalances('2025-01-15');
      expect(result[0].currentBalance).toBe('0.00');
    });
  });
});
