'use client';

import { createContext, useContext } from 'react';

import type { Vehicle } from '@/lib/types';

const VehicleInitialDataContext = createContext<Vehicle | null>(null);

export function VehicleInitialDataProvider({
  vehicle,
  children,
}: {
  vehicle: Vehicle;
  children: React.ReactNode;
}) {
  return (
    <VehicleInitialDataContext.Provider value={vehicle}>
      {children}
    </VehicleInitialDataContext.Provider>
  );
}

export function useInitialVehicle() {
  return useContext(VehicleInitialDataContext);
}