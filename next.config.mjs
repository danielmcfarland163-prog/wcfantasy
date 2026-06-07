import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/soccer-fantasy',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'crests.football-data.org' },
    ],
    // Cloudflare doesn't support next/image optimization — use unoptimized
    unoptimized: true,
  },
}

// Enables the OpenNext Cloudflare bindings during `next dev`
initOpenNextCloudflareForDev()

export default nextConfig
