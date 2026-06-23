import { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/site';
import { TraderForm } from './components/trader-form';

export const metadata: Metadata = buildPageMetadata({
  title: 'Accesso Commercianti - AutoTrade HUB',
  description: 'Accedi ai prezzi esclusivi e collabora con AutoTrade HUB. Compila il modulo con i tuoi dati.',
  path: '/trader',
});

export default function TraderPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <TraderForm />
    </div>
  );
}
