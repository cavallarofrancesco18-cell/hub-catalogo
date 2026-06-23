import { buildPageMetadata } from '@/lib/site';
import { HomeSplashRedirect } from '@/components/home-splash-redirect';

export const metadata = buildPageMetadata({
  title: 'AutoTrade HUB - Avvio catalogo',
  description:
    'Schermata di avvio AutoTrade HUB con caricamento tachimetro e apertura automatica del catalogo veicoli.',
  path: '/',
});

export default function Home() {
  return <HomeSplashRedirect />;
}
