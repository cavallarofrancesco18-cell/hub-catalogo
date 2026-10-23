import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  disable: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingIncludes: {
    '/api/pdfjs-worker': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'],
  },
  async redirects() {
    return [{ source: '/auto', destination: '/#catalogo', permanent: true }];
  },
  async headers() {
    return [
      '/admin/:path*',
      '/seller/:path*',
      '/agent/:path*',
      '/hub-documenti/:path*',
      '/modulistica/:path*',
      '/comunicazioni/:path*',
      '/auto/:slug/contratto/:path*',
      '/pdf-preview/:path*',
      '/preferiti',
      '/register',
      '/trader',
      '/logo-demo',
      '/splash',
      '/splash-smartphone-demo',
    ].map(source => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
    }));
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    qualities: [28, 35, 42, 45, 50, 55, 65, 68, 80],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.nstre.it',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.canva.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'studio-3074982188-44660.firebasestorage.app',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'dyler.it',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withPWA(nextConfig);
