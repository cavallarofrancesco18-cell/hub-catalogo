import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import type { Vehicle } from '@/lib/types';
import { getCatalogVehicles } from '@/lib/server/vehicles';
import {
  formatCurrency,
  formatNumber,
  generateSlug,
  getDirectImageUrl,
  getVehicleAddedAt,
  getVehicleCoverImageUrl,
} from '@/lib/utils';

function isPriceSimilar(candidate: Vehicle, currentVehicle: Vehicle) {
  if (!currentVehicle.prezzo || currentVehicle.prezzo <= 0) {
    return false;
  }

  return candidate.prezzo >= currentVehicle.prezzo * 0.7
    && candidate.prezzo <= currentVehicle.prezzo * 1.3;
}

export async function SimilarVehicles({ currentVehicle }: { currentVehicle: Vehicle }) {
  const availableVehicles = (await getCatalogVehicles())
    .filter(vehicle => vehicle.id !== currentVehicle.id)
    .sort((firstVehicle, secondVehicle) => {
      const firstSameBrand = firstVehicle.marca.trim().toLowerCase() === currentVehicle.marca.trim().toLowerCase();
      const secondSameBrand = secondVehicle.marca.trim().toLowerCase() === currentVehicle.marca.trim().toLowerCase();
      if (firstSameBrand !== secondSameBrand) {
        return firstSameBrand ? -1 : 1;
      }

      const firstSimilarPrice = isPriceSimilar(firstVehicle, currentVehicle);
      const secondSimilarPrice = isPriceSimilar(secondVehicle, currentVehicle);
      if (firstSimilarPrice !== secondSimilarPrice) {
        return firstSimilarPrice ? -1 : 1;
      }

      const firstAddedAt = getVehicleAddedAt(firstVehicle)?.getTime() ?? 0;
      const secondAddedAt = getVehicleAddedAt(secondVehicle)?.getTime() ?? 0;
      return secondAddedAt - firstAddedAt;
    })
    .slice(0, 6);

  if (availableVehicles.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-slate-200 bg-slate-50 py-12 sm:py-16" aria-labelledby="similar-vehicles-title">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-sky-700">Ancora disponibili</p>
            <h2 id="similar-vehicles-title" className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
              Auto simili che potrebbero interessarti
            </h2>
          </div>
          <Link href="/auto" className="inline-flex items-center gap-2 font-semibold text-sky-700 hover:text-sky-900">
            Vedi tutte le auto disponibili <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {availableVehicles.map(vehicle => {
            const slug = generateSlug(vehicle);
            const imageUrl = getDirectImageUrl(getVehicleCoverImageUrl(vehicle));

            return (
              <article key={vehicle.id} className="overflow-hidden border border-slate-200 bg-white shadow-sm">
                <Link href={`/auto/${slug}`} className="group block">
                  <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={`${vehicle.marca} ${vehicle.modello}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-slate-950">{vehicle.marca} {vehicle.modello}</h3>
                    <p className="mt-1 truncate text-sm text-slate-600">{vehicle.versione}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-sm text-slate-600">{formatNumber(vehicle.chilometraggio)} km</span>
                      <span className="font-bold text-slate-950">{formatCurrency(vehicle.prezzo)}</span>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link href="/auto" className="inline-flex h-11 items-center gap-2 bg-sky-600 px-5 font-semibold text-white hover:bg-sky-700">
            Vedi tutte le auto disponibili <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
