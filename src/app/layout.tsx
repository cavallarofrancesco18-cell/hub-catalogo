import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { LayoutShell } from '@/components/layout-shell';
import { getStructuredData, siteConfig } from '@/lib/site';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });

const autoTradeLogoUrl = '/favicon2.png';

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
  themeColor: '#588AEC',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const enableAdsense = process.env.NODE_ENV === 'production';

  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon2.png" />
        <link rel="shortcut icon" href="/favicon2.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#588AEC" />
        <meta name="color-scheme" content="light" />
        {enableAdsense ? (
          <>
            <meta name="google-adsense-account" content="ca-pub-5786919013348134" />
            <script
              async
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5786919013348134"
              crossOrigin="anonymous"
            />
          </>
        ) : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (typeof window === 'undefined') return;
                var cleanupVersion = 'sw-cleanup-v2';
                var storageKey = '__autotrade_' + cleanupVersion;

                try {
                  if (window.localStorage && window.localStorage.getItem(storageKey) === 'done') {
                    return;
                  }
                } catch (e) {}

                window.addEventListener('load', function () {
                  var unregisterAll = function () {
                    if (!('serviceWorker' in navigator)) return Promise.resolve();
                    return navigator.serviceWorker.getRegistrations()
                      .then(function (registrations) {
                        return Promise.all(
                          registrations.map(function (registration) {
                            return registration.unregister();
                          })
                        );
                      })
                      .catch(function () {});
                  };

                  var deleteAllCaches = function () {
                    if (!('caches' in window)) return Promise.resolve();
                    return caches.keys()
                      .then(function (keys) {
                        return Promise.all(
                          keys.map(function (key) {
                            return caches.delete(key);
                          })
                        );
                      })
                      .catch(function () {});
                  };

                  Promise.all([unregisterAll(), deleteAllCaches()])
                    .finally(function () {
                      try {
                        if (window.localStorage) {
                          window.localStorage.setItem(storageKey, 'done');
                        }
                      } catch (e) {}
                    });
                });
              })();
            `,
          }}
        />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased', inter.variable, display.variable)}>
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
