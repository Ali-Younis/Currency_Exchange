import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrations: {
    seed: 'node dist/seed/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
