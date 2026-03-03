'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Vehicle } from '@/lib/types';
import { VehicleCard } from '@/components/vehicle-card';
import { FilterSidebar } from './components/filter-sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, getFirestore } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

export default function AutoPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [brands, setBrands] = useState<string[]>([]);
  const [initialPriceRange, setInitialPriceRange] = useState<[number, number]>([0, 100000]);

  const { data: vehicles = [], loading: vehiclesLoading } = useCollection<Vehicle>(
    useMemo(() => collection(getFirestore(), 'vehicles'), [])
  );
  
  const isLoading = authLoading || vehiclesLoading;

  const [filters, setFilters] = useState({
    brand: 'all',
    fuel: 'all',
    transmission: 'all',
    price: [0, 100000],
  });
  const [sortBy, setSortBy] = useState('price-asc');

  useEffect(() => {
    if (vehicles.length > 0) {
      const uniqueBrands = Array.from(new Set(vehicles.map(v => v.marca))).sort();
      setBrands(uniqueBrands);

      const prices = vehicles.map(v => v.prezzo);
      const priceRange: [number, number] = [Math.min(...prices), Math.max(...prices)];
      setInitialPriceRange(priceRange);
      if (filters.price[0] === 0 && filters.price[1] === 100000) {
         setFilters(prev => ({ ...prev, price: priceRange }));
      }
    }
  }, [vehicles]);

  const filteredAndSortedVehicles = useMemo(() => {
    let filtered = vehicles.filter(v => {
      const { brand, fuel, transmission, price } = filters;
      return (
        (brand === 'all' || v.marca === brand) &&
        (fuel === 'all' || v.carburante === fuel) &&
        (transmission === 'all' || v.cambio === transmission) &&
        v.prezzo >= price[0] && v.prezzo <= price[1]
      );
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.prezzo - b.prezzo;
        case 'price-desc':
          return b.prezzo - a.prezzo;
        case 'year-desc':
          return b.anno - a.anno;
        case 'year-asc':
          return a.anno - b.anno;
        default:
          return 0;
      }
    });
  }, [vehicles, filters, sortBy]);

  return (
    <div className="container mx-auto px-4 py-8">
      {isAdmin && !authLoading && (
        <div className="mb-4 flex justify-end">
          <Button asChild>
            <Link href="/admin">Pannello Admin</Link>
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <FilterSidebar
          brands={brands}
          filters={filters}
          setFilters={setFilters}
          sortBy={sortBy}
          setSortBy={setSortBy}
          priceRange={initialPriceRange}
          disabled={isLoading}
        />
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
