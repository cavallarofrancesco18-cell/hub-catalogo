'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { formatCurrency } from '@/lib/utils';
import type { Vehicle } from '@/lib/types';

interface FilterSidebarProps {
  brands: string[];
  filters: {
    brand: string;
    fuel: string;
    transmission: string;
    price: [number, number];
  };
  setFilters: React.Dispatch<React.SetStateAction<FilterSidebarProps['filters']>>;
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  priceRange: [number, number];
  disabled: boolean;
}

export function FilterSidebar({ brands, filters, setFilters, sortBy, setSortBy, priceRange, disabled }: FilterSidebarProps) {
  
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const fuelOptions: Vehicle['carburante'][] = ['Benzina', 'Diesel', 'Elettrica', 'Ibrida'];
  const transmissionOptions: Vehicle['cambio'][] = ['Manuale', 'Automatico'];

  return (
    <Card className="lg:sticky lg:top-20 h-fit">
      <CardHeader>
        <CardTitle>Filtri e Ordina</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="brand">Marca</Label>
          <Select
            value={filters.brand}
            onValueChange={value => handleFilterChange('brand', value)}
            disabled={disabled}
            name="brand"
          >
            <SelectTrigger id="brand">
              <SelectValue placeholder="Tutte le marche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le marche</SelectItem>
              {brands.map(brand => (
                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Prezzo</Label>
          <Slider
            value={filters.price}
            onValueChange={value => handleFilterChange('price', value)}
            min={priceRange[0]}
            max={priceRange[1]}
            step={1000}
            disabled={disabled}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatCurrency(filters.price[0])}</span>
            <span>{formatCurrency(filters.price[1])}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuel">Carburante</Label>
          <Select
            value={filters.fuel}
            onValueChange={value => handleFilterChange('fuel', value)}
            disabled={disabled}
            name="fuel"
          >
            <SelectTrigger id="fuel">
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              {fuelOptions.map(fuel => (
                <SelectItem key={fuel} value={fuel}>{fuel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transmission">Cambio</Label>
          <Select
            value={filters.transmission}
            onValueChange={value => handleFilterChange('transmission', value)}
            disabled={disabled}
            name="transmission"
          >
            <SelectTrigger id="transmission">
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              {transmissionOptions.map(trans => (
                <SelectItem key={trans} value={trans}>{trans}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort">Ordina per</Label>
          <Select value={sortBy} onValueChange={setSortBy} disabled={disabled} name="sort">
            <SelectTrigger id="sort">
              <SelectValue placeholder="Ordina per..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-asc">Prezzo (crescente)</SelectItem>
              <SelectItem value="price-desc">Prezzo (decrescente)</SelectItem>
              <SelectItem value="year-desc">Anno (più recente)</SelectItem>
              <SelectItem value="year-asc">Anno (meno recente)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
