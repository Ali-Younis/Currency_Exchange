import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? '',
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_CURRENCIES = [
  { code: 'GBP', nameEn: 'British Pound',        nameAr: 'الجنيه الإسترليني', symbol: '£',  sortOrder: 1 },
  { code: 'USD', nameEn: 'US Dollar',             nameAr: 'الدولار الأمريكي',  symbol: '$',  sortOrder: 2 },
  { code: 'EUR', nameEn: 'Euro',                  nameAr: 'اليورو',            symbol: '€',  sortOrder: 3 },
  { code: 'JOD', nameEn: 'Jordanian Dinar',       nameAr: 'الدينار الأردني',   symbol: 'JD', sortOrder: 4 },
  { code: 'SAR', nameEn: 'Saudi Riyal',           nameAr: 'الريال السعودي',    symbol: '﷼',  sortOrder: 5 },
  { code: 'AED', nameEn: 'UAE Dirham',            nameAr: 'الدرهم الإماراتي',  symbol: 'د.إ', sortOrder: 6 },
  { code: 'CHF', nameEn: 'Swiss Franc',           nameAr: 'الفرنك السويسري',   symbol: 'Fr', sortOrder: 7 },
  { code: 'EGP', nameEn: 'Egyptian Pound',        nameAr: 'الجنيه المصري',     symbol: 'E£', sortOrder: 8 },
  { code: 'BHD', nameEn: 'Bahraini Dinar',        nameAr: 'الدينار البحريني',  symbol: '.د.ب', sortOrder: 9 },
  { code: 'AUD', nameEn: 'Australian Dollar',     nameAr: 'الدولار الأسترالي', symbol: 'A$', sortOrder: 10 },
  { code: 'CAD', nameEn: 'Canadian Dollar',       nameAr: 'الدولار الكندي',    symbol: 'C$', sortOrder: 11 },
  { code: 'TRY', nameEn: 'Turkish Lira',          nameAr: 'الليرة التركية',    symbol: '₺',  sortOrder: 12 },
];

async function main() {
  console.log('Seeding database…');

  // Currencies
  for (const c of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, isActive: true },
    });
  }
  console.log(`✓ ${DEFAULT_CURRENCIES.length} currencies seeded`);

  // Admin user
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin1234', 12);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        fullName: 'System Administrator',
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('✓ Admin user created  (username: admin, password: admin1234)');
  } else {
    console.log('✓ Admin user already exists — skipped');
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
