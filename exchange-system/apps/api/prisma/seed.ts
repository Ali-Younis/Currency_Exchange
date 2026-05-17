import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? '',
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_CURRENCIES = [
  { code: 'GBP', nameEn: 'British Pound',        nameAr: 'الجنيه الإسترليني', symbol: '£',   countryCode: 'GB', sortOrder: 1 },
  { code: 'USD', nameEn: 'US Dollar',             nameAr: 'الدولار الأمريكي',  symbol: '$',   countryCode: 'US', sortOrder: 2 },
  { code: 'EUR', nameEn: 'Euro',                  nameAr: 'اليورو',            symbol: '€',   countryCode: 'EU', sortOrder: 3 },
  { code: 'JOD', nameEn: 'Jordanian Dinar',       nameAr: 'الدينار الأردني',   symbol: 'JD',  countryCode: 'JO', sortOrder: 4 },
  { code: 'SAR', nameEn: 'Saudi Riyal',           nameAr: 'الريال السعودي',    symbol: '﷼',   countryCode: 'SA', sortOrder: 5 },
  { code: 'AED', nameEn: 'UAE Dirham',            nameAr: 'الدرهم الإماراتي',  symbol: 'د.إ', countryCode: 'AE', sortOrder: 6 },
  { code: 'CHF', nameEn: 'Swiss Franc',           nameAr: 'الفرنك السويسري',   symbol: 'Fr',  countryCode: 'CH', sortOrder: 7 },
  { code: 'EGP', nameEn: 'Egyptian Pound',        nameAr: 'الجنيه المصري',     symbol: 'E£',  countryCode: 'EG', sortOrder: 8 },
  { code: 'BHD', nameEn: 'Bahraini Dinar',        nameAr: 'الدينار البحريني',  symbol: '.د.ب',countryCode: 'BH', sortOrder: 9 },
  { code: 'AUD', nameEn: 'Australian Dollar',     nameAr: 'الدولار الأسترالي', symbol: 'A$',  countryCode: 'AU', sortOrder: 10 },
  { code: 'CAD', nameEn: 'Canadian Dollar',       nameAr: 'الدولار الكندي',    symbol: 'C$',  countryCode: 'CA', sortOrder: 11 },
  { code: 'TRY', nameEn: 'Turkish Lira',          nameAr: 'الليرة التركية',    symbol: '₺',   countryCode: 'TR', sortOrder: 12 },
];

// Base exchange rates: foreign units per 1 GBP.
// Bureau convention: buyRate > sellRate — agency profits on every transaction.
// BUY (agency buys foreign): customer gets GBP = foreign / buyRate  (higher buyRate → fewer GBP given)
// SELL (agency sells foreign): customer gets foreign = GBP × sellRate (lower sellRate → less foreign given)
const BASE_RATES: Record<string, { buy: number; sell: number }> = {
  USD: { buy: 1.285, sell: 1.265 },
  EUR: { buy: 1.170, sell: 1.155 },
  JOD: { buy: 0.910, sell: 0.895 },
  SAR: { buy: 4.800, sell: 4.720 },
  AED: { buy: 4.680, sell: 4.600 },
  CHF: { buy: 1.130, sell: 1.115 },
  EGP: { buy: 62.00, sell: 60.00 },
  BHD: { buy: 0.485, sell: 0.475 },
  AUD: { buy: 1.980, sell: 1.950 },
  CAD: { buy: 1.760, sell: 1.730 },
  TRY: { buy: 40.00, sell: 38.50 },
};

// Opening balance amounts in foreign currency units
const OPENING_AMOUNTS: Record<string, number> = {
  GBP: 10000, USD: 5000, EUR: 5000, JOD: 2000,
  SAR: 20000, AED: 20000, CHF: 4000, EGP: 250000,
  BHD: 2000, AUD: 8000, CAD: 7000, TRY: 150000,
};

const CUSTOMERS = [
  'Mohammed Al-Rashid', 'Sarah Johnson', 'Ahmed Al-Sayed', 'Emma Williams',
  'Omar Al-Farsi', 'James Thompson', 'Fatima Al-Khatib', 'Michael Brown',
  'Khalid Al-Mansouri', 'Anna Schmidt',
];

/** Deterministic pseudo-random [0,1) — avoids different results on re-runs */
function prand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/** Zero-pad to date-only string that maps cleanly to @db.Date */
function dateOnly(d: Date): Date {
  return new Date(d.toISOString().split('T')[0] + 'T00:00:00.000Z');
}

async function main() {
  console.log('Seeding database…');

  // ── Currencies ───────────────────────────────────────────────
  for (const c of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({
      where:  { code: c.code },
      update: { countryCode: c.countryCode },
      create: { ...c, isActive: true },
    });
  }
  console.log(`✓ ${DEFAULT_CURRENCIES.length} currencies seeded`);

  // ── Admin user ───────────────────────────────────────────────
  const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin1234', 12);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        fullName: 'System Administrator',
        email: 'admin@exchange.local',
        role: 'ADMIN',
        isActive: true,
        forcePasswordChange: true,
      },
    });
    console.log('✓ Admin user created (username: admin, password: admin1234)');
  } else {
    // Only patch missing email — never reset forcePasswordChange (user may have already changed it)
    if (!adminExists.email) {
      await prisma.user.update({ where: { id: adminExists.id }, data: { email: 'admin@exchange.local' } });
      console.log('✓ Admin user: added missing email');
    } else {
      console.log('✓ Admin user already up-to-date');
    }
  }

  // ── Teller1 user ─────────────────────────────────────────────
  let teller = await prisma.user.findUnique({ where: { username: 'teller1' } });
  if (!teller) {
    const passwordHash = await bcrypt.hash('Teller@12345', 12);
    teller = await prisma.user.create({
      data: {
        username: 'teller1',
        passwordHash,
        fullName: 'Test Teller',
        email: 'teller1@exchange.local',
        role: 'TELLER',
        isActive: true,
        forcePasswordChange: true,
      },
    });
    console.log('✓ Teller1 user created (username: teller1, password: Teller@12345)');
  } else {
    console.log('✓ Teller1 user already exists');
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
  const currencies = await prisma.currency.findMany();
  const cmap = new Map(currencies.map((c) => [c.code, c]));
  const gbp  = cmap.get('GBP')!;
  const foreignCodes = Object.keys(BASE_RATES);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Exchange rates + Opening balances (30 days) ───────────────
  for (let d = 29; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const dayDate = dateOnly(day);

    // Rates
    for (const [code, base] of Object.entries(BASE_RATES)) {
      const ccy = cmap.get(code);
      if (!ccy) continue;

      const drift  = 1 + (prand(d * 100 + code.charCodeAt(0)) - 0.5) * 0.01;
      const buyRate  = parseFloat((base.buy  * drift).toFixed(6));
      const sellRate = parseFloat((base.sell * drift).toFixed(6));

      const exists = await prisma.exchangeRate.findFirst({
        where: { currencyId: ccy.id, effectiveDate: dayDate },
      });
      if (!exists) {
        await prisma.exchangeRate.create({
          data: { currencyId: ccy.id, buyRate, sellRate, effectiveDate: dayDate, setById: admin.id },
        });
      }
    }

    // Opening balances
    for (const [code, baseAmt] of Object.entries(OPENING_AMOUNTS)) {
      const ccy = cmap.get(code);
      if (!ccy) continue;

      const variation = 1 + (prand(d * 200 + code.charCodeAt(0)) - 0.5) * 0.1;
      const amount = parseFloat((baseAmt * variation).toFixed(2));

      await prisma.openingBalance.upsert({
        where:  { currencyId_sessionDate: { currencyId: ccy.id, sessionDate: dayDate } },
        update: {},
        create: { currencyId: ccy.id, amount, sessionDate: dayDate, setById: admin.id },
      });
    }
  }
  console.log('✓ Exchange rates and opening balances seeded (30 days)');

  // ── Test transactions (~100) ──────────────────────────────────
  const existingCount = await prisma.transaction.count({ where: { tellerId: teller.id } });
  if (existingCount > 0) {
    console.log(`✓ Transactions already exist (${existingCount}) — skipped`);
  } else {
    const year = today.getFullYear();
    let txnSeq = 0;

    for (let d = 29; d >= 1; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - d);
      const dayDate = dateOnly(day);

      const txnsToday = d % 3 === 0 ? 4 : 3; // 3-4 per day → ~100 total over 29 days

      for (let t = 0; t < txnsToday; t++) {
        const seed = d * 10 + t;
        const isBuy = seed % 2 === 0;
        const ccyCode = foreignCodes[seed % foreignCodes.length];
        const ccy = cmap.get(ccyCode)!;
        const base = BASE_RATES[ccyCode];
        const rateVar = 1 + (prand(seed * 50) - 0.5) * 0.01;
        const customer = CUSTOMERS[seed % CUSTOMERS.length];

        // Realistic foreign amount per currency type
        let amtForeign: number;
        if (['USD', 'EUR', 'CHF', 'AUD', 'CAD'].includes(ccyCode)) {
          amtForeign = Math.round((200 + prand(seed) * 1800) / 10) * 10;
        } else if (['JOD', 'BHD'].includes(ccyCode)) {
          amtForeign = Math.round((100 + prand(seed) * 400) * 10) / 10;
        } else if (['SAR', 'AED'].includes(ccyCode)) {
          amtForeign = Math.round((500 + prand(seed) * 4500) / 10) * 10;
        } else if (ccyCode === 'EGP') {
          amtForeign = Math.round((2000 + prand(seed) * 18000) / 100) * 100;
        } else { // TRY
          amtForeign = Math.round((500 + prand(seed) * 4500) / 100) * 100;
        }

        txnSeq++;
        const receiptNumber = `TXN-${year}-${String(100000 + txnSeq)}`;
        const createdAt = new Date(day.getTime() + (9 + t) * 3_600_000); // spread over business hours

        let currencyInId: string, currencyOutId: string;
        let amountIn: number, amountOut: number, rateApplied: number, valueInGbp: number;

        if (isBuy) {
          // Agency buys foreign FROM customer: in=foreign, out=GBP
          currencyInId  = ccy.id;
          currencyOutId = gbp.id;
          rateApplied = parseFloat((base.buy * rateVar).toFixed(6));
          amountIn  = amtForeign;
          amountOut = parseFloat((amtForeign / rateApplied).toFixed(2));
          valueInGbp = amountOut;
        } else {
          // Agency sells foreign TO customer: in=GBP, out=foreign
          currencyInId  = gbp.id;
          currencyOutId = ccy.id;
          rateApplied = parseFloat((base.sell * rateVar).toFixed(6));
          amountIn  = parseFloat((amtForeign / rateApplied).toFixed(2));
          amountOut = amtForeign;
          valueInGbp = amountIn;
        }

        await prisma.transaction.create({
          data: {
            receiptNumber,
            type: isBuy ? 'BUY' : 'SELL',
            customerName: customer,
            currencyInId,
            amountIn,
            currencyOutId,
            amountOut,
            rateApplied,
            valueInGbp,
            tellerId: teller.id,
            sessionDate: dayDate,
            createdAt,
          },
        });
      }
    }
    console.log(`✓ ${txnSeq} test transactions created`);
  }

  console.log('\nSeeding complete.');
  console.log('  Admin  → username: admin    password: admin1234    (must change on first login)');
  console.log('  Teller → username: teller1  password: Teller@12345 (must change on first login)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

