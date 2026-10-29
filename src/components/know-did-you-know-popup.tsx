'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DidYouKnowPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 60000); // 1 minuto

    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Popup - Nuvoletta */}
      <div className="fixed bottom-8 right-8 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="relative rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-6 py-5 shadow-2xl shadow-slate-950/40 backdrop-blur-md">
          {/* Coda della nuvoletta */}
          <div className="absolute -bottom-2 right-8 h-4 w-4 rotate-45 border-b border-r border-white/20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />

          {/* Pulsante X */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 transition-colors border border-blue-400/30"
          >
            <X className="h-4 w-4 text-white" />
          </button>

          {/* Contenuto */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Sapevi che...</h3>

            <div className="space-y-2">
              <p className="text-sm leading-6 text-slate-200/90">
                Le auto presenti sul nostro portale provengono da contratti di noleggio a lungo termine giunti alla loro scadenza.
              </p>
              <p className="text-sm leading-6 text-slate-200/90">
                Questa tipologia di veicoli rappresenta oggi una delle migliori opportunità sul mercato dell'usato recente: automobili con una storia chiara, manutenzione programmata e chilometraggio certificato.
              </p>
              <p className="text-sm leading-6 text-slate-200/90">
                Ogni vettura viene verificata prima della messa in vendita e proposta con la massima trasparenza. Eventuali segni di normale utilizzo sono compatibili con l'età e il chilometraggio del veicolo e non ne compromettono affidabilità, sicurezza o funzionalità.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
