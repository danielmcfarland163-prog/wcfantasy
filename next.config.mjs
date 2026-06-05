/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/worldcup2026',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'crests.football-data.org' },
    ],
    // Cloudflare doesn't support next/image optimization — use unoptimized
    unoptimized: true,
  },
}

export default nextConfig

import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
initOpenNextCloudflareForDev()
