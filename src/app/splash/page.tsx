import { buildPageMetadata } from '@/lib/site';
import { HomeSplashRedirect } from '@/components/home-splash-redirect';

export const metadata = buildPageMetadata({
  title: 'AutoTrade HUB - Splash Preview',
  description: 'Anteprima locale della splash screen senza redirect automatico al catalogo.',
  path: '/splash',
});

export default function SplashPage() {
  return <HomeSplashRedirect />;
}
