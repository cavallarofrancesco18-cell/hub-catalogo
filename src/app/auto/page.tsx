'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Vehicle } from '@/lib/types';
import { VehicleCard } from '@/components/vehicle-card';
import './home-custom.css';
import { FilterSidebar } from './components/filter-sidebar';
import { TraderAccessPopup } from './components/trader-access-popup';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUserRole } from '@/firebase';
import { releaseExpiredVehicleReservations } from '@/lib/vehicle-reservations';
import { SlidersHorizontal } from 'lucide-react';

type VehicleFilters = {
  searchText: string;
  brand: string;
  model: string;
  fuel: string;
  transmission: string;
  price: [number, number];
  mileage: [number, number];
};

function normalizeVehicleBrand(brand: string | undefined | null): string {
  if (!brand) {
    return '';
  }

  const trimmed = brand.trim();
  if (trimmed.toLowerCase() === 'fiat') {
    return 'FIAT';
  }

  return trimmed;
}

export default function AutoPage() {
  const firestore = useFirestore();
  const { role, roleData } = useUserRole();
  const isSeller = role === 'seller';
  const isAdmin = role === 'admin';
  const hasExtendedCatalogAccess =
    role === 'seller' && roleData?.sellerType?.toUpperCase() === 'HUB';
  const showHubSection = isAdmin || hasExtendedCatalogAccess;
  
  const vehiclesRef = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'vehicles'),
            hasExtendedCatalogAccess
              ? where('stato', 'in', ['In vendita', 'In arrivo', 'Prenotato'])
              : where('stato', '==', 'In vendita')
          )
        : null,
    [firestore, hasExtendedCatalogAccess]
  );
  const { data: vehicles, isLoading: isLoadingVehicles } = useCollection<Vehicle>(vehiclesRef);

  const incomingVehiclesRef = useMemoFirebase(
    () =>
      firestore && showHubSection
        ? query(
            collection(firestore, 'vehicles'),
            where('stato', '==', 'In arrivo')
          )
        : null,
    [firestore, showHubSection]
  );
  const { data: incomingVehicles, isLoading: isLoadingIncoming } = useCollection<Vehicle>(incomingVehiclesRef);

  const normalizedVehicles = useMemo(() => {
    if (!vehicles) {
      return vehicles;
    }

    return vehicles.map(vehicle => {
      const normalizedBrand = normalizeVehicleBrand(vehicle?.marca);
      if (!normalizedBrand || normalizedBrand === vehicle.marca) {
        return vehicle;
      }

      return {
        ...vehicle,
        marca: normalizedBrand,
      };
    });
  }, [vehicles]);
  
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [initialPriceRange, setInitialPriceRange] = useState<[number, number]>([0, 100000]);
  const [initialMileageRange, setInitialMileageRange] = useState<[number, number]>([0, 250000]);

  const [filters, setFilters] = useState<VehicleFilters>({
    searchText: '',
    brand: 'all',
    model: 'all',
    fuel: 'all',
    transmission: 'all',
    price: [0, 100000],
    mileage: [0, 250000],
  });
  const [sortBy, setSortBy] = useState('price-asc');
  
  // vehicles === null means Firestore has not yet responded (still loading).
  // vehicles === [] means Firestore responded with zero results.
  // Using !vehicles would treat an empty result set as "still loading".
  const isLoading = isLoadingVehicles || vehicles === null;

  useEffect(() => {
    void releaseExpiredVehicleReservations().catch(error => {
      console.error('Failed to release expired vehicle reservations.', error);
    });
  }, []);

  useEffect(() => {
    if (!normalizedVehicles || normalizedVehicles.length === 0) {
      setBrands([]);
      setModels([]);
      return;
    }

    const safeVehicles = normalizedVehicles.filter(Boolean);
    const uniqueBrands = Array.from(new Set(safeVehicles.map(v => v.marca).filter(Boolean))).sort();
    setBrands(uniqueBrands);

    const kmValues = safeVehicles
      .map(v => Number(v.chilometraggio))
      .filter(value => Number.isFinite(value) && value >= 0);
    if (kmValues.length > 0) {
      const mileageRange: [number, number] = [Math.min(...kmValues), Math.max(...kmValues)];
      setInitialMileageRange(mileageRange);
      setFilters(prev => ({ ...prev, mileage: mileageRange }));
    }

    const priceValues = safeVehicles
      .map(v => Number(v.prezzo))
      .filter(value => Number.isFinite(value) && value >= 0);
    if (priceValues.length > 0) {
      const priceRange: [number, number] = [Math.min(...priceValues), Math.max(...priceValues)];
      setInitialPriceRange(priceRange);
      setFilters(prev => ({ ...prev, price: priceRange }));
    }
  }, [normalizedVehicles]);

  useEffect(() => {
    if (!normalizedVehicles || filters.brand === 'all') {
      setModels([]);
      return;
    }

    const nextModels = Array.from(
      new Set(
        normalizedVehicles
          .filter(vehicle => vehicle?.marca === filters.brand)
          .map(vehicle => vehicle.modello)
          .filter(Boolean)
      )
    ).sort();

    setModels(nextModels);
  }, [normalizedVehicles, filters.brand]);


  const filteredAndSortedVehicles = useMemo(() => {
    if (!normalizedVehicles) return [];

    const getVisiblePrice = (vehicle: Vehicle) => {
      if (!isSeller) {
        return vehicle.prezzo;
      }

      return typeof vehicle.prezzoPrivati === 'number' && vehicle.prezzoPrivati > 0
        ? vehicle.prezzoPrivati
        : vehicle.prezzo;
    };
    
    let filtered = normalizedVehicles.filter(v => {
      const { searchText, brand, model, fuel, transmission, price, mileage } = filters;
      const normalizedSearch = searchText.trim().toLowerCase();
      const visiblePrice = getVisiblePrice(v);
      const vehicleKm = Number(v.chilometraggio) || 0;
      const searchableText = `${v.marca} ${v.modello} ${v.versione ?? ''} ${v.targa ?? ''}`.toLowerCase();

      return (
        (normalizedSearch === '' || searchableText.includes(normalizedSearch)) &&
        (brand === 'all' || v.marca === brand) &&
        (model === 'all' || v.modello === model) &&
        (fuel === 'all' || v.carburante === fuel) &&
        (transmission === 'all' || v.cambio === transmission) &&
        visiblePrice >= price[0] && visiblePrice <= price[1] &&
        vehicleKm >= mileage[0] && vehicleKm <= mileage[1]
      );
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return getVisiblePrice(a) - getVisiblePrice(b);
        case 'price-desc':
          return getVisiblePrice(b) - getVisiblePrice(a);
        case 'year-desc':
          return new Date(b.data_immatricolazione).getTime() - new Date(a.data_immatricolazione).getTime();
        case 'year-asc':
          return new Date(a.data_immatricolazione).getTime() - new Date(b.data_immatricolazione).getTime();
        default:
          return 0;
      }
    });
  }, [normalizedVehicles, filters, sortBy, isSeller]);

  return (
    <div className="container mx-auto px-4 py-5 sm:py-8">
      <TraderAccessPopup />
      <section className="hero-showcase relative mb-5 overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-5 shadow-xl shadow-slate-900/25 sm:px-6 sm:py-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_30%)]" />
        <div className="hero-showcase__content relative mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:gap-5">
          <div className="space-y-3">
            <em>
            <h1 className="hero-showcase__headline text-xl font-bold font-headline leading-tight text-white sm:text-2xl md:text-3xl lg:max-w-4xl">
              Le auto presenti sul nostro portale provengono da contratti di noleggio a lungo termine giunti alla loro scadenza.
            </h1></em>
            <p className="hero-showcase__copy mx-auto max-w-4xl text-sm leading-6 text-slate-200/90 md:text-base">
              Questa tipologia di veicoli rappresenta oggi una delle migliori opportunità sul mercato dell'usato recente: automobili con una storia chiara, manutenzione programmata e chilometraggio certificato.
            </p>
            <p className="hero-showcase__copy mx-auto hidden max-w-4xl text-sm leading-6 text-slate-200/90 md:block md:text-base" style={{ animationDelay: '0.14s' }}>
              Ogni vettura viene verificata prima della messa in vendita e proposta con la massima trasparenza. Eventuali segni di normale utilizzo sono compatibili con l'età e il chilometraggio del veicolo e non ne compromettono affidabilità, sicurezza o funzionalità.
            </p>
          </div>
          <div className="hero-feature-panel flex w-full max-w-4xl flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-4 shadow-lg shadow-slate-950/20 backdrop-blur-md sm:px-5 sm:py-5">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              <Badge variant="outline" className="hero-feature-chip border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-50 shadow-sm sm:px-4 sm:py-2 sm:text-sm">
                Chilometraggio certificato
              </Badge>
              <Badge variant="outline" className="hero-feature-chip border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-50 shadow-sm sm:px-4 sm:py-2 sm:text-sm" style={{ animationDelay: '0.18s' }}>
                Manutenzione regolare e verificabile
              </Badge>
              <Badge variant="outline" className="hero-feature-chip border-sky-300/30 bg-sky-400/15 px-3 py-1.5 text-xs font-semibold text-sky-50 shadow-sm shadow-sky-950/30 sm:px-4 sm:py-2 sm:text-sm" style={{ animationDelay: '0.32s' }}>
                Finanziamento disponibile in sede
              </Badge>
            </div>
            <p className="hero-showcase__note max-w-3xl text-sm leading-6 text-slate-200/90 md:text-base">
              Tagliandi eseguiti con puntualita, standard aziendali rigorosi e soluzioni di acquisto flessibili con servizi aggiuntivi disponibili su richiesta.
            </p>
          </div>
        </div>
      </section>
      {showHubSection && (isLoadingIncoming ? (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold font-headline sm:text-2xl">Auto in Arrivo - HUB</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-[200px] w-full rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : incomingVehicles && incomingVehicles.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold font-headline sm:text-2xl">Auto in Arrivo - HUB</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {incomingVehicles.slice(0, 10).map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </section>
      ) : null)}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline sm:text-3xl">Catalogo Auto</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredAndSortedVehicles.length} risultati disponibili
            </p>
          )}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 w-full gap-2 lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              Filtri e ordinamento
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[92vw] max-w-md overflow-y-auto px-0">
            <SheetHeader className="border-b px-5 pb-4 text-left">
              <SheetTitle>Filtri e ordinamento</SheetTitle>
              <SheetDescription>
                Aggiorna il catalogo senza perdere spazio utile sullo schermo.
              </SheetDescription>
            </SheetHeader>
            <div className="p-5">
              <FilterSidebar
                brands={brands}
                models={models}
                filters={filters}
                setFilters={setFilters}
                sortBy={sortBy}
                setSortBy={setSortBy}
                priceRange={initialPriceRange}
                mileageRange={initialMileageRange}
                disabled={isLoading}
                className="border-0 shadow-none"
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <div className="sticky top-4 h-fit">
          <FilterSidebar
            brands={brands}
            models={models}
            filters={filters}
            setFilters={setFilters}
            sortBy={sortBy}
            setSortBy={setSortBy}
            priceRange={initialPriceRange}
            mileageRange={initialMileageRange}
            disabled={isLoading}
            className="hidden lg:block"
          />
        </div>
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col space-y-3">
                  <Skeleton className="h-[200px] w-full rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedVehicles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAndSortedVehicles.map(vehicle => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
                <h2 className="text-xl font-semibold">Nessun veicolo trovato</h2>
                <p className="mt-2 text-muted-foreground">Prova a modificare i filtri di ricerca.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}