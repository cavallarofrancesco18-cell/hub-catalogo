import { buildPageMetadata } from '@/lib/site';
import { SplashSmartphonePrototypes } from '@/components/splash-smartphone-prototypes';

export const metadata = buildPageMetadata({
  title: 'AutoTrade HUB - Smartphone Splash Demo',
  description: 'Prove di caricamento splash in stile smartphone per confronto visuale.',
  path: '/splash-smartphone-demo',
});

export default function SplashSmartphoneDemoPage() {
  return <SplashSmartphonePrototypes />;
}
