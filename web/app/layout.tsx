import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from './providers/auth-provider'
import { ThemeProvider } from './providers/theme-provider'
import { LayoutProvider } from './providers/layout-provider'
import { DensityProvider } from './providers/density-provider'
import { ThemeColorProvider } from './providers/theme-color-provider'
const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '拾忆 - Echoes',
  description: '个人语义搜索引擎 - 拾起遗落的记忆',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/apple-icon-180.png', sizes: '180x180' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="font-sans">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                document.documentElement.classList.add('preload');
                window.addEventListener('load', function() {
                  document.documentElement.classList.remove('preload');
                });
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <LayoutProvider>
              <DensityProvider>
                <ThemeColorProvider>
                  {children}
                </ThemeColorProvider>
              </DensityProvider>
            </LayoutProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
