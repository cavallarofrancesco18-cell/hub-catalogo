import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { LayoutShell } from '@/components/layout-shell';
import { getStructuredData, siteConfig } from '@/lib/site';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const autoTradeLogoUrl = '/favicon.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.domain),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.domain,
    siteName: siteConfig.name,
    type: 'website',
    locale: 'it_IT',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
  },
  icons: {
    icon: autoTradeLogoUrl,
    apple: autoTradeLogoUrl,
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
  userScalable: false,
  themeColor: '#588AEC',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#588AEC" />
        <meta name="color-scheme" content="light" />
        <meta name="google-adsense-account" content="ca-pub-5786919013348134" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5786919013348134"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {process.env.NODE_ENV === 'development' ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  if (typeof window === 'undefined') return;
                  window.addEventListener('load', function () {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(function (registrations) {
                        registrations.forEach(function (registration) {
                          registration.unregister();
                        });
                      }).catch(function () {});
                    }

                    if ('caches' in window) {
                      caches.keys().then(function (keys) {
                        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
                      }).catch(function () {});
                    }
                  });
                })();
              `,
            }}
          />
        ) : null}
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased', inter.variable)}>
        <FirebaseClientProvider>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(getStructuredData()) }}
          />
          <LayoutShell>{children}</LayoutShell>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
