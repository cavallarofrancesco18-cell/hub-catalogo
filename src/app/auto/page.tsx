'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Vehicle } from '@/lib/types';
import { VehicleCard } from '@/components/vehicle-card';
import './home-custom.css';
import { FilterSidebar } from './components/filter-sidebar';
import { TraderAccessPopup } from './components/trader-access-popup';
import { DidYouKnowPopup } from '@/components/know-did-you-know-popup';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BrandedLoader } from '@/components/branded-loader';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUser, useUserRole } from '@/firebase';
import { releaseExpiredVehicleReservations } from '@/lib/vehicle-reservations';
import { FAVORITES_CHANGED_EVENT, readFavoriteIdsByScope } from '@/lib/favorites';
import { formatNumber } from '@/lib/utils';
import { SlidersHorizontal } from 'lucide-react';
import { useInitialCatalogVehicles } from './components/catalog-initial-data';

type VehicleFilters = {
  searchText: string;
  favoritesOnly: boolean;
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
  return <AutoCatalog />;
}

function AutoCatalog({
  initialVehicles: serverInitialVehicles,
}: {
  initialVehicles?: Vehicle[];
} = {}) {
  const contextInitialVehicles = useInitialCatalogVehicles();
  const initialVehicles = serverInitialVehicles ?? contextInitialVehicles;
  const firestore = useFirestore();
  const { user } = useUser();
  const { role, roleData } = useUserRole();
  const isSeller = role === 'seller';
  const isAdmin = role === 'admin';
  const hasExtendedCatalogAccess =
    role === 'seller' && roleData?.sellerType?.toUpperCase() === 'HUB';
  const isRegisteredUser = Boolean(role);
  const favoritePersistence = user && !user.isAnonymous ? 'persistent' : 'session';
  const getMerchantPrice = (vehicle: Vehicle) =>
    typeof vehicle.prezzoPrivati === 'number' && vehicle.prezzoPrivati > 0
      ? vehicle.prezzoPrivati
      : vehicle.prezzo;
  const getVisibleCatalogPrice = (vehicle: Vehicle) => {
    // Se prezzo pubblico è 0 o null, usa prezzo commerciante
    const publicPrice = vehicle.prezzo;
    if (!publicPrice || publicPrice === 0) {
      return getMerchantPrice(vehicle);
    }

    if (!isRegisteredUser) {
      return publicPrice;
    }

    if (isAdmin || hasExtendedCatalogAccess) {
      return publicPrice;
    }

    return getMerchantPrice(vehicle);
  };
  
  const vehiclesRef = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'vehicles'),
            where('stato', '==', 'In vendita'),
            where('adminOnly', '==', false)
          )
        : null,
    [firestore]
  );
  const { data: vehicles, isLoading: isLoadingVehicles } = useCollection<Vehicle>(vehiclesRef);

  const incomingVehiclesRef = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'vehicles'),
            where('stato', '==', 'In arrivo'),
            where('adminOnly', '==', false)
          )
        : null,
    [firestore]
  );
  const { data: incomingVehicles, isLoading: isLoadingIncoming } = useCollection<Vehicle>(incomingVehiclesRef);

  const normalizedVehicles = useMemo(() => {
    const availableVehicles = vehicles ?? initialVehicles;
    const catalogVehicles = [
      ...(incomingVehicles ?? []),
      ...availableVehicles.filter(vehicle => vehicle.stato !== 'In arrivo'),
    ];

    return catalogVehicles.map(vehicle => {
      const normalizedBrand = normalizeVehicleBrand(vehicle?.marca);
      if (!normalizedBrand || normalizedBrand === vehicle.marca) {
        return vehicle;
      }

      return {
        ...vehicle,
        marca: normalizedBrand,
      };
    });
  }, [vehicles, initialVehicles, incomingVehicles]);
  
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [initialPriceRange, setInitialPriceRange] = useState<[number, number]>([0, 100000]);
  const [initialMileageRange, setInitialMileageRange] = useState<[number, number]>([0, 250000]);

  const [filters, setFilters] = useState<VehicleFilters>({
    searchText: '',
    favoritesOnly: false,
    brand: 'all',
    model: 'all',
    fuel: 'all',
    transmission: 'all',
    price: [0, 100000],
    mileage: [0, 250000],
  });
  const [sortBy, setSortBy] = useState('price-asc');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showCatalogLoadingOverlay, setShowCatalogLoadingOverlay] = useState(false);
  
  // vehicles === null means Firestore has not yet responded (still loading).
  // vehicles === [] means Firestore responded with zero results.
  // Using !vehicles would treat an empty result set as "still loading".
  const isLoading = initialVehicles.length === 0 && (isLoadingVehicles || vehicles === null);

  useEffect(() => {
    setFavoriteIds(readFavoriteIdsByScope(favoritePersistence));

    const handleFavoritesChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ favoriteIds?: string[]; persistence?: string }>;
      if (customEvent.detail?.persistence !== favoritePersistence) {
        return;
      }

      setFavoriteIds(customEvent.detail.favoriteIds ?? []);
    };

    const handleStorageSync = () => {
      setFavoriteIds(readFavoriteIdsByScope(favoritePersistence));
    };

    window.addEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged as EventListener);
    window.addEventListener('storage', handleStorageSync);

    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged as EventListener);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [favoritePersistence]);

  useEffect(() => {
    if (!isLoading) {
      setShowCatalogLoadingOverlay(false);
      return;
    }

    setShowCatalogLoadingOverlay(true);
    const maxOverlayTimer = window.setTimeout(() => {
      setShowCatalogLoadingOverlay(false);
    }, 900);

    return () => {
      window.clearTimeout(maxOverlayTimer);
    };
  }, [isLoading]);

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
      .filter(vehicle => vehicle.stato !== 'In arrivo')
      .map(v => Number(getVisibleCatalogPrice(v)))
      .filter(value => Number.isFinite(value) && value >= 0);
    if (priceValues.length > 0) {
      const priceRange: [number, number] = [Math.min(...priceValues), Math.max(...priceValues)];
      setInitialPriceRange(priceRange);
      setFilters(prev => ({ ...prev, price: priceRange }));
    }
  }, [normalizedVehicles, isRegisteredUser, isAdmin, hasExtendedCatalogAccess]);

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
    
    let filtered = normalizedVehicles.filter(v => {
      const { searchText, favoritesOnly, brand, model, fuel, transmission, price, mileage } = filters;
      const normalizedSearch = searchText.trim().toLowerCase();
      const visiblePrice = getVisibleCatalogPrice(v);
      const vehicleKm = Number(v.chilometraggio) || 0;
      const searchableText = `${v.marca} ${v.modello} ${v.versione ?? ''} ${v.targa ?? ''}`.toLowerCase();

      return (
        (normalizedSearch === '' || searchableText.includes(normalizedSearch)) &&
        (!favoritesOnly || favoriteIds.includes(v.id)) &&
        (brand === 'all' || v.marca === brand) &&
        (model === 'all' || v.modello === model) &&
        (fuel === 'all' || v.carburante === fuel) &&
        (transmission === 'all' || v.cambio === transmission) &&
        (v.stato === 'In arrivo' || (visiblePrice >= price[0] && visiblePrice <= price[1])) &&
        vehicleKm >= mileage[0] && vehicleKm <= mileage[1]
      );
    });

    return filtered.sort((a, b) => {
      const incomingOrder = Number(b.stato === 'In arrivo') - Number(a.stato === 'In arrivo');
      if (incomingOrder !== 0) return incomingOrder;

      switch (sortBy) {
        case 'price-asc':
          return getVisibleCatalogPrice(a) - getVisibleCatalogPrice(b);
        case 'price-desc':
          return getVisibleCatalogPrice(b) - getVisibleCatalogPrice(a);
        case 'year-desc':
          return new Date(b.data_immatricolazione).getTime() - new Date(a.data_immatricolazione).getTime();
        case 'year-asc':
          return new Date(a.data_immatricolazione).getTime() - new Date(b.data_immatricolazione).getTime();
        default:
          return 0;
      }
    });
  }, [normalizedVehicles, filters, sortBy, favoriteIds, isRegisteredUser, isAdmin, hasExtendedCatalogAccess]);
  const incomingCatalogVehicles = filteredAndSortedVehicles.filter(vehicle => vehicle.stato === 'In arrivo');
  const availableCatalogVehicles = filteredAndSortedVehicles.filter(vehicle => vehicle.stato !== 'In arrivo');

  return (
    <div className="container mx-auto px-4 py-5 sm:py-8">
      {showCatalogLoadingOverlay ? (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/20">
          <div className="w-[min(92vw,520px)] rounded-2xl border border-border/70 bg-background/95 px-3 py-4 shadow-2xl">
            <BrandedLoader
              className="max-w-full"
              label="Sto caricando il catalogo..."
              imageClassName="h-8 max-w-[110px]"
            />
          </div>
        </div>
      ) : null}
      <TraderAccessPopup />
      <DidYouKnowPopup />
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold font-headline sm:text-3xl">Catalogo Auto</h2>
          {!isLoading && (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatNumber(filteredAndSortedVehicles.length)} risultati disponibili
            </p>
          )}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-10 w-full gap-1.5 text-sm lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              Filtri e ordinamento
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[84vw] max-w-[320px] overflow-y-auto px-0">
            <SheetHeader className="border-b px-3 pb-3 text-left">
              <SheetTitle className="text-base">Filtri e ordinamento</SheetTitle>
              <SheetDescription>
                Aggiorna il catalogo senza perdere spazio utile sullo schermo.
              </SheetDescription>
            </SheetHeader>
            <div className="p-3">
              <FilterSidebar
                brands={brands}
                models={models}
                filters={filters}
                setFilters={setFilters}
                sortBy={sortBy}
                setSortBy={setSortBy}
                favoriteCount={favoriteIds.length}
                priceRange={initialPriceRange}
                mileageRange={initialMileageRange}
                disabled={isLoading}
                compactMobile
                className="border-0 shadow-none"
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <div className="h-fit lg:sticky" style={{ top: 'calc(var(--site-header-height) + 0.75rem)' }}>
          <FilterSidebar
            brands={brands}
            models={models}
            filters={filters}
            setFilters={setFilters}
            sortBy={sortBy}
            setSortBy={setSortBy}
            favoriteCount={favoriteIds.length}
            priceRange={initialPriceRange}
            mileageRange={initialMileageRange}
            disabled={isLoading}
            enableAdvancedInternalScroll
            className="hidden lg:block"
          />
        </div>
        <div className="lg:col-span-3">
          {!isLoading && (incomingCatalogVehicles.length > 0 || isLoadingIncoming) ? (
            <section className="mb-8 rounded-lg border border-sky-100 bg-sky-50/70 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {isLoadingIncoming
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-80 w-full rounded-lg" />
                    ))
                  : incomingCatalogVehicles.map(vehicle => (
                      <div key={vehicle.id} className="w-full">
                        <VehicleCard vehicle={vehicle} />
                      </div>
                    ))}
              </div>
            </section>
          ) : null}
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
          ) : availableCatalogVehicles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {availableCatalogVehicles.map(vehicle => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          ) : filteredAndSortedVehicles.length === 0 && !isLoadingIncoming ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
                <h2 className="text-xl font-semibold">Nessun veicolo trovato</h2>
                <p className="mt-2 text-muted-foreground">Prova a modificare i filtri di ricerca.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}