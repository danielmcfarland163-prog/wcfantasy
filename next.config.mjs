import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/world_cup2026',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'crests.football-data.org' },
    ],
    // Cloudflare Pages doesn't support next/image optimization — use unoptimized
    unoptimized: true,
  },
}

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform()
}

export default nextConfig
