'use client';

import { createContext, useContext } from 'react';

import type { Vehicle } from '@/lib/types';

const CatalogInitialDataContext = createContext<Vehicle[]>([]);

export function CatalogInitialDataProvider({
  vehicles,
  children,
}: {
  vehicles: Vehicle[];
  children: React.ReactNode;
}) {
  return (
    <CatalogInitialDataContext.Provider value={vehicles}>
      {children}
    </CatalogInitialDataContext.Provider>
  );
}

export function useInitialCatalogVehicles() {
  return useContext(CatalogInitialDataContext);
}