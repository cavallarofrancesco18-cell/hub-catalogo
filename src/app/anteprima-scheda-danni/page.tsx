import { notFound } from 'next/navigation';

import { VehicleDamageSheetPrintButton } from '@/components/vehicle-damage-sheet-print-button';
import type { Vehicle } from '@/lib/types';

export default function DamageSheetPreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  const previewVehicle: Partial<Vehicle> = {
    marca: 'RENAULT',
    modello: 'Clio',
    versione: '1.0 TCe Intens',
    targa: 'AB123CD',
    numeroRiferimento: 12345,
    data_immatricolazione: '2022-05-18',
    chilometraggio: 28450,
    carburante: 'Benzina',
    cambio: 'Manuale',
    colore_esterno: 'Grigio scuro',
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-xl space-y-5 rounded-lg border bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anteprima locale</p>
          <h1 className="mt-2 text-2xl font-semibold">Scheda danni veicolo</h1>
          <p className="mt-2 text-sm text-slate-600">RENAULT Clio 1.0 TCe Intens · AB123CD</p>
        </div>
        <VehicleDamageSheetPrintButton vehicle={previewVehicle} />
      </section>
    </main>
  );
}