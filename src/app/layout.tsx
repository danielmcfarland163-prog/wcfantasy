export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from 'next'
import { Barlow, Barlow_Condensed, Space_Mono } from 'next/font/google'
import './globals.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  variable: '--font-barlow-condensed',
  display: 'swap',
})
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Soccer Fantasy Game',
  description: 'Fill your bracket, climb the leaderboard, trash talk your friends.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏆</text></svg>",
  },
  openGraph: {
    title: 'Soccer Fantasy Game',
    description: 'Fill your bracket, climb the leaderboard, trash talk your friends.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#171a2b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${barlow.variable} ${barlowCondensed.variable} ${spaceMono.variable}`}
        style={{
          '--f-cond': 'var(--font-barlow-condensed), system-ui, sans-serif',
          '--f-body': 'var(--font-barlow), system-ui, sans-serif',
          '--f-mono': "var(--font-space-mono), 'Courier New', monospace",
        } as React.CSSProperties}
      >
        {children}
      </body>
    </html>
  )
}
