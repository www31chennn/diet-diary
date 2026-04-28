import type { Metadata, Viewport } from 'next'
import { Noto_Sans_TC, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { AppShell } from '@/components/layout/AppShell'

const body = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
})

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Diet Diary 飲食日記',
  description: 'AI 飲食記錄，輕鬆管理熱量與營養',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#5B8DB8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={`${body.variable} ${display.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-surface-50 font-sans text-slate-800 antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
