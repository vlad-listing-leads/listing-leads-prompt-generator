import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { MemberstackAuthProvider } from '@/components/MemberstackAuthProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Listing Leads - Page Personalizer',
  description: 'Create beautiful, personalized listing pages in minutes',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Memberstack SDK */}
        <Script
          src="https://static.memberstack.com/scripts/v1/memberstack.js"
          data-memberstack-app={process.env.NEXT_PUBLIC_MEMBERSTACK_APP_ID}
          strategy="afterInteractive"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <MemberstackAuthProvider>
          {children}
        </MemberstackAuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1e1e1e',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  )
}
