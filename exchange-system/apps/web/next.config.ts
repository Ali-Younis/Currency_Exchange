import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // API_INTERNAL_URL is a RUNTIME env var (server-side only).
    // The browser always calls relative /api/v1 paths;
    // Next.js server forwards them to the API container at runtime.
    // This keeps the Docker image fully cloud-portable — no URL baked at build time.
    const apiBase = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
