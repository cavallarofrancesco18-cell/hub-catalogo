"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Vehicle } from '@/lib/types';
import { VehicleCard } from '@/components/vehicle-card';
import { Skeleton } from '@/components/ui/skeleton';
import { readFavoriteIds } from '@/lib/favorites';

export default function FavoritesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    setFavoriteIds(readFavoriteIds());
  }, []);

  const favoriteVehiclesQuery = useMemoFirebase(
    () =>
      firestore && favoriteIds.length > 0
        ? query(collection(firestore, 'vehicles'), where('id', 'in', favoriteIds))
        : null,
    [firestore, favoriteIds]
  );
  const bookedVehiclesQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'vehicles'),
            where('stato', '==', 'Prenotato'),
            where('statusChangedBy', '==', user.uid)
          )
        : null,
    [firestore, user]
  );
  const { data: favoriteVehicles, isLoading: isLoadingFavoriteVehicles } =
    useCollection<Vehicle>(favoriteVehiclesQuery);
  const { data: bookedVehicles, isLoading: isLoadingBookedVehicles } =
    useCollection<Vehicle>(bookedVehiclesQuery);

  const vehicles = useMemo(() => {
    const mergedVehicles = new Map<string, Vehicle>();

    (bookedVehicles ?? []).forEach(vehicle => {
      mergedVehicles.set(vehicle.id, vehicle);
    });

    (favoriteVehicles ?? []).forEach(vehicle => {
      mergedVehicles.set(vehicle.id, vehicle);
    });

    return Array.from(mergedVehicles.values());
  }, [bookedVehicles, favoriteVehicles]);

  const isLoading = isLoadingFavoriteVehicles || isLoadingBookedVehicles;
  const isPageLoading = isLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">I tuoi preferiti</h1>
      {isPageLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[300px] w-full rounded-lg" />
          ))}
        </div>
      ) : vehicles.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map(vehicle => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground">Nessun veicolo nei preferiti.</div>
      )}
    </div>
  );
}
