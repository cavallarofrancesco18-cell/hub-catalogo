'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FilterSidebarProps {
  brands: string[];
  models: string[];
  filters: {
    searchText: string;
    brand: string;
    model: string;
    fuel: string;
    transmission: string;
    price: [number, number];
    mileage: [number, number];
  };
  setFilters: React.Dispatch<React.SetStateAction<FilterSidebarProps['filters']>>;
  sortBy: string;
  setSortBy: React.Dispatch<React.SetStateAction<string>>;
  priceRange: [number, number];
  mileageRange: [number, number];
  disabled: boolean;
  layout?: 'vertical' | 'horizontal';
  tone?: 'default' | 'dark';
  className?: string;
}

export function FilterSidebar({ brands, models, filters, setFilters, sortBy, setSortBy, priceRange, mileageRange, disabled, layout = 'vertical', tone = 'default', className }: FilterSidebarProps) {
  const isHorizontal = layout === 'horizontal';
  const isDarkSurface = tone === 'dark';
  const isCompactActions = isHorizontal || isDarkSurface;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const compactControlClass = isHorizontal ? 'h-9 text-sm' : '';
  const compactLabelClass = isHorizontal ? 'text-[11px] font-medium' : '';
  const labelClass = cn(compactLabelClass, isDarkSurface ? 'text-sky-100' : '');

  
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters(prev => {
      if (key === 'brand') {
        return { ...prev, brand: value, model: 'all' };
      }

      return { ...prev, [key]: value };
    });
  };

  const handleRangeInputChange = (
    key: 'price' | 'mileage',
    index: 0 | 1,
    nextValue: string,
    bounds: [number, number]
  ) => {
    if (nextValue.trim() === '') {
      return;
    }

    const parsed = Number(nextValue);

    setFilters(prev => {
      if (Number.isNaN(parsed)) {
        return prev;
      }

      const [absoluteMin, absoluteMax] = bounds;
      const currentRange = prev[key];
      const bounded = Math.max(absoluteMin, Math.min(parsed, absoluteMax));
      const nextRange: [number, number] = [...currentRange] as [number, number];
      nextRange[index] = bounded;

      if (nextRange[0] > nextRange[1]) {
        if (index === 0) {
          nextRange[1] = nextRange[0];
        } else {
          nextRange[0] = nextRange[1];
        }
      }

      return { ...prev, [key]: nextRange };
    });
  };
  
  const fuelOptions: Vehicle['carburante'][] = ['Benzina', 'Diesel', 'Elettrica', 'Ibrida'];
  const transmissionOptions: Vehicle['cambio'][] = ['Manuale', 'Automatico'];
  const advancedButtonLabel = isCompactActions
    ? showAdvanced
      ? 'Nascondi'
      : 'Avanzati'
    : showAdvanced
      ? 'Nascondi avanzati'
      : 'Filtri avanzati';

  const resetFilters = () => {
    setFilters(prev => ({
      ...prev,
      searchText: '',
      brand: 'all',
      model: 'all',
      fuel: 'all',
      transmission: 'all',
      price: priceRange,
      mileage: mileageRange,
    }));
    setSortBy('price-asc');
  };

  return (
    <Card className={cn('h-fit home-filter-card', isHorizontal && 'home-filter-toolbar', className)}>
      <CardHeader className={cn(isHorizontal && 'px-4 py-2 pb-1')}>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className={cn(isHorizontal && 'text-sm', isDarkSurface && 'text-slate-50')}>Ricerca Auto</CardTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(
                isCompactActions && 'h-7 px-2 text-[11px] leading-none',
                isDarkSurface && 'border border-sky-200/30 bg-sky-400/15 text-sky-50 hover:bg-sky-400/25'
              )}
              onClick={() => setShowAdvanced(current => !current)}
              disabled={disabled}
            >
              {advancedButtonLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                isCompactActions && 'h-7 px-2 text-[11px] leading-none',
                isDarkSurface && 'border border-sky-200/30 bg-white/10 text-slate-100 hover:bg-white/20'
              )}
              onClick={resetFilters}
              disabled={disabled}
            >
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(isHorizontal ? 'space-y-2 px-4 pb-3 pt-1' : 'space-y-6')}>
        <div className={cn(isHorizontal ? 'grid gap-2 md:grid-cols-2 xl:grid-cols-4' : 'space-y-6')}>
          <div className={cn('space-y-2', isHorizontal && 'xl:col-span-1')}>
          <Label htmlFor="searchText" className={labelClass}>Ricerca testuale</Label>
          <Input
            id="searchText"
            className={compactControlClass}
            value={filters.searchText}
            onChange={event => handleFilterChange('searchText', event.target.value)}
            placeholder="Cerca marca, modello, versione o targa"
            disabled={disabled}
          />
          </div>

          <div className="space-y-2">
          <Label htmlFor="brand" className={labelClass}>Marca</Label>
          <Select
            value={filters.brand}
            onValueChange={value => handleFilterChange('brand', value)}
            disabled={disabled}
            name="brand"
          >
            <SelectTrigger id="brand" className={compactControlClass}>
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
          <Label htmlFor="model" className={labelClass}>Modello</Label>
          <Select
            value={filters.model}
            onValueChange={value => handleFilterChange('model', value)}
            disabled={disabled || filters.brand === 'all' || models.length === 0}
            name="model"
          >
            <SelectTrigger id="model" className={compactControlClass}>
              <SelectValue placeholder={filters.brand === 'all' ? 'Seleziona prima una marca' : 'Tutti i modelli'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i modelli</SelectItem>
              {models.map(model => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>

          <div className="space-y-2">
          <Label className={labelClass}>Prezzo</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(!isHorizontal && 'space-y-1')}>
              {!isHorizontal && (
                <Label htmlFor="price-min" className={cn('text-xs', isDarkSurface ? 'text-sky-200/85' : 'text-muted-foreground')}>Min</Label>
              )}
              <Input
                id="price-min"
                className={compactControlClass}
                type="number"
                inputMode="numeric"
                placeholder="Min"
                min={priceRange[0]}
                max={priceRange[1]}
                value={filters.price[0]}
                onChange={event =>
                  handleRangeInputChange('price', 0, event.target.value, priceRange)
                }
                disabled={disabled}
              />
            </div>
            <div className={cn(!isHorizontal && 'space-y-1')}>
              {!isHorizontal && (
                <Label htmlFor="price-max" className={cn('text-xs', isDarkSurface ? 'text-sky-200/85' : 'text-muted-foreground')}>Max</Label>
              )}
              <Input
                id="price-max"
                className={compactControlClass}
                type="number"
                inputMode="numeric"
                placeholder="Max"
                min={priceRange[0]}
                max={priceRange[1]}
                value={filters.price[1]}
                onChange={event =>
                  handleRangeInputChange('price', 1, event.target.value, priceRange)
                }
                disabled={disabled}
              />
            </div>
          </div>
          {!isHorizontal && (
            <Slider
              value={filters.price}
              onValueChange={value => handleFilterChange('price', value)}
              min={priceRange[0]}
              max={priceRange[1]}
              step={1000}
              disabled={disabled}
            />
          )}
          {!isHorizontal && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatCurrency(filters.price[0])}</span>
              <span>{formatCurrency(filters.price[1])}</span>
            </div>
          )}
        </div>
        </div>

        {showAdvanced && (
          <div className={cn('rounded-xl border border-sky-300/40 bg-white/55 p-3', isHorizontal ? 'grid gap-3 xl:grid-cols-4' : 'space-y-6')}>
            <div className="space-y-2">
              <Label htmlFor="fuel" className={labelClass}>Carburante</Label>
              <Select
                value={filters.fuel}
                onValueChange={value => handleFilterChange('fuel', value)}
                disabled={disabled}
                name="fuel"
              >
                <SelectTrigger id="fuel" className={compactControlClass}>
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
              <Label htmlFor="transmission" className={labelClass}>Cambio</Label>
              <Select
                value={filters.transmission}
                onValueChange={value => handleFilterChange('transmission', value)}
                disabled={disabled}
                name="transmission"
              >
                <SelectTrigger id="transmission" className={compactControlClass}>
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
              <Label htmlFor="sort" className={labelClass}>Ordina per</Label>
              <Select value={sortBy} onValueChange={setSortBy} disabled={disabled} name="sort">
                <SelectTrigger id="sort" className={compactControlClass}>
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

        <div className="space-y-2">
          <Label className={labelClass}>Chilometraggio</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="mileage-min" className={cn('text-xs', isHorizontal && 'text-[10px]', isDarkSurface ? 'text-sky-200/85' : 'text-muted-foreground')}>Min</Label>
              <Input
                id="mileage-min"
                className={compactControlClass}
                type="number"
                inputMode="numeric"
                min={mileageRange[0]}
                max={mileageRange[1]}
                value={filters.mileage[0]}
                onChange={event =>
                  handleRangeInputChange('mileage', 0, event.target.value, mileageRange)
                }
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mileage-max" className={cn('text-xs', isHorizontal && 'text-[10px]', isDarkSurface ? 'text-sky-200/85' : 'text-muted-foreground')}>Max</Label>
              <Input
                id="mileage-max"
                className={compactControlClass}
                type="number"
                inputMode="numeric"
                min={mileageRange[0]}
                max={mileageRange[1]}
                value={filters.mileage[1]}
                onChange={event =>
                  handleRangeInputChange('mileage', 1, event.target.value, mileageRange)
                }
                disabled={disabled}
              />
            </div>
          </div>
          {!isHorizontal && (
            <Slider
              value={filters.mileage}
              onValueChange={value => handleFilterChange('mileage', value)}
              min={mileageRange[0]}
              max={mileageRange[1]}
              step={1000}
              disabled={disabled}
            />
          )}
          {!isHorizontal && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{new Intl.NumberFormat('it-IT').format(filters.mileage[0])} km</span>
              <span>{new Intl.NumberFormat('it-IT').format(filters.mileage[1])} km</span>
            </div>
          )}
        </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}