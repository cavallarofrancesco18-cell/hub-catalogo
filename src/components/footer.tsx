import Link from 'next/link';

import { footerLegalNavigation, footerSupportNavigation, siteName, siteUrl } from '@/lib/site';
import { FooterGoogleReviews } from '@/components/footer-google-reviews';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-100">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div className="lg:col-span-3">
          <FooterGoogleReviews />
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-400">HUB Mobility</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[0.08em]">{siteName}</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-300">
            Piattaforma dedicata alla selezione di auto usate, veicoli provenienti da noleggio a lungo termine,
            consulenza su finanziamenti, permute e servizi automotive con approccio trasparente e orientato al cliente.
          </p>
          <p className="text-sm text-slate-400">{siteUrl.replace('https://', '')}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Navigazione</h3>
          <ul className="mt-5 space-y-3 text-sm text-slate-200">
            {footerSupportNavigation.map(item => (
              <li key={item.href}>
                <Link className="transition hover:text-amber-300" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Informazioni legali</h3>
          <ul className="mt-5 space-y-3 text-sm text-slate-200">
            {footerLegalNavigation.map(item => (
              <li key={item.href}>
                <Link className="transition hover:text-amber-300" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© 2026 HUB Mobility. Tutti i diritti riservati.</p>
          <p>Contenuti editoriali, schede veicolo e richieste informative gestiti su AutoTrade HUB.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;