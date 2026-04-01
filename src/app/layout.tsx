import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/ThemeProvider'
import { VersionChecker } from '@/components/VersionChecker'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://app.listingleads.com'),
  title: 'Listing Leads - Prompt Generator',
  description: 'Create beautiful, personalized listing pages in minutes with AI-powered prompt generation',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'Listing Leads - Prompt Generator',
    description: 'Create beautiful, personalized listing pages in minutes with AI-powered prompt generation',
    url: 'https://app.listingleads.com',
    siteName: 'Listing Leads',
    images: [
      {
        url: '/og-image.jpg',
        width: 1445,
        height: 767,
        alt: 'Listing Leads Prompt Generator - AI-powered real estate marketing',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Listing Leads - Prompt Generator',
    description: 'Create beautiful, personalized listing pages in minutes with AI-powered prompt generation',
    images: ['/og-image.jpg'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash - apply theme before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
          <VersionChecker />
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: 'bg-card border-border text-card-foreground',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
