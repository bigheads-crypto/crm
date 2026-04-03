// Konfiguracja Next.js z obsługą internacjonalizacji przez next-intl
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.10.1.201', '10.10.1.201:9999'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '10.10.1.201',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
