'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';

interface FilterSidebarProps {
  brands: string[];
  models: string[];
  filters: {
    searchText: string;
    favoritesOnly: boolean;
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
  favoriteCount?: number;
  priceRange: [number, number];
  mileageRange: [number, number];
  disabled: boolean;
  layout?: 'vertical' | 'horizontal';
  tone?: 'default' | 'dark';
  className?: string;
  enableAdvancedInternalScroll?: boolean;
  compactMobile?: boolean;
}

      export function FilterSidebar({ brands, models, filters, setFilters, sortBy, setSortBy, favoriteCount = 0, priceRange, mileageRange, disabled, layout = 'vertical', tone = 'default', className, enableAdvancedInternalScroll = false, compactMobile = false }: FilterSidebarProps) {
  const isHorizontal = layout === 'horizontal';
  const isDarkSurface = tone === 'dark';
  const isMobileCompact = compactMobile && !isHorizontal;
  const isCompactActions = isHorizontal || isDarkSurface;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const shouldUseInternalScroll = enableAdvancedInternalScroll && !isHorizontal;
  const compactControlClass = cn(
    isHorizontal && 'h-9 text-sm',
    isMobileCompact && 'h-8 text-xs'
  );
  const compactLabelClass = cn(
    isHorizontal && 'text-[11px] font-medium',
    isMobileCompact && 'text-[11px] font-semibold'
  );
  const labelClass = cn(compactLabelClass, isDarkSurface ? 'text-sky-100' : '');
  const nativeSelectClass = cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    compactControlClass,
    isDarkSurface && 'border-sky-200/30 bg-white text-slate-900'
  );

  
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

    const parsed = Number(nextValue.replace(/[^\d-]/g, ''));

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
  
  const fuelOptions: Vehicle['carburante'][] = ['Benzina', 'GPL', 'Diesel', 'Elettrica', 'Ibrida'];
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
      favoritesOnly: false,
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
      <CardHeader className={cn(isHorizontal && 'px-4 py-2 pb-1', isMobileCompact && 'px-3 py-3 pb-2')}>
        <div className={cn('gap-3', isHorizontal ? 'flex items-center justify-between' : 'flex flex-wrap items-start justify-between')}>
          <CardTitle className={cn(isHorizontal && 'text-sm', isMobileCompact && 'text-base leading-none', isDarkSurface && 'text-slate-50')}>Ricerca Auto</CardTitle>
          <div className={cn('flex shrink-0 items-center gap-1.5', !isHorizontal && 'ml-auto flex-wrap justify-end')}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn(
                isCompactActions && 'h-7 px-2 text-[11px] leading-none',
                isMobileCompact && 'h-6 px-2 text-[10px]',
                'whitespace-nowrap',
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
                isMobileCompact && 'h-6 px-2 text-[10px]',
                'whitespace-nowrap',
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
      <CardContent
        className={cn(
          isHorizontal ? 'space-y-2 px-4 pb-3 pt-1' : 'space-y-6',
          isMobileCompact && 'space-y-4 px-3 pb-3 pt-0',
          shouldUseInternalScroll && 'home-filter-scroll pr-2 max-h-[calc(100vh-var(--site-header-height)-10.5rem)] overflow-y-auto'
        )}
      >
        <div className={cn(isHorizontal ? 'grid gap-2 md:grid-cols-2 xl:grid-cols-4' : 'space-y-6', isMobileCompact && 'space-y-4')}>
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
          <div
            className={cn(
              'flex items-center justify-between rounded-md border border-input px-3 py-2',
              isMobileCompact && 'py-1.5'
            )}
          >
            <Label htmlFor="favoritesOnly" className={cn('mb-0 flex items-center gap-2 text-xs sm:text-sm', isDarkSurface && 'text-sky-100')}>
              <Heart className="h-3.5 w-3.5" />
              Preferite
            </Label>
            <Checkbox
              id="favoritesOnly"
              checked={filters.favoritesOnly}
              onCheckedChange={checked => handleFilterChange('favoritesOnly', checked === true)}
              disabled={disabled}
            />
          </div>
          </div>

          <div className="space-y-2">
          <Label htmlFor="brand" className={labelClass}>Marca</Label>
          <select
            id="brand"
            className={nativeSelectClass}
            value={filters.brand}
            onChange={event => handleFilterChange('brand', event.target.value)}
            disabled={disabled}
            name="brand"
          >
            <option value="all">Tutte le marche</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          </div>

          <div className="space-y-2">
          <Label htmlFor="model" className={labelClass}>Modello</Label>
          <select
            id="model"
            className={nativeSelectClass}
            value={filters.model}
            onChange={event => handleFilterChange('model', event.target.value)}
            disabled={disabled || filters.brand === 'all' || models.length === 0}
            name="model"
          >
            <option value="all">
              {filters.brand === 'all' ? 'Seleziona prima una marca' : 'Tutti i modelli'}
            </option>
            {models.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
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
                type="text"
                inputMode="numeric"
                placeholder="Min"
                min={priceRange[0]}
                max={priceRange[1]}
                value={formatNumber(filters.price[0])}
                onFocus={event => event.currentTarget.select()}
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
                type="text"
                inputMode="numeric"
                placeholder="Max"
                min={priceRange[0]}
                max={priceRange[1]}
                value={formatNumber(filters.price[1])}
                onFocus={event => event.currentTarget.select()}
                onChange={event =>
                  handleRangeInputChange('price', 1, event.target.value, priceRange)
                }
                disabled={disabled}
              />
            </div>
          </div>
          {!isHorizontal && !isMobileCompact && (
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
            <div className={cn('flex justify-between text-sm text-muted-foreground', isMobileCompact && 'text-xs')}>
              <span>{formatCurrency(filters.price[0])}</span>
              <span>{formatCurrency(filters.price[1])}</span>
            </div>
          )}
        </div>
        </div>

        {showAdvanced && (
          <div className={cn('rounded-xl border border-sky-300/40 bg-white/55 p-3', isHorizontal ? 'grid gap-3 xl:grid-cols-4' : 'space-y-6', isMobileCompact && 'space-y-4 p-2.5')}>
            <div className="space-y-2">
              <Label htmlFor="fuel" className={labelClass}>Carburante</Label>
              <select
                id="fuel"
                className={nativeSelectClass}
                value={filters.fuel}
                onChange={event => handleFilterChange('fuel', event.target.value)}
                disabled={disabled}
                name="fuel"
              >
                <option value="all">Tutti i tipi</option>
                {fuelOptions.map(fuel => (
                  <option key={fuel} value={fuel}>{fuel}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transmission" className={labelClass}>Cambio</Label>
              <select
                id="transmission"
                className={nativeSelectClass}
                value={filters.transmission}
                onChange={event => handleFilterChange('transmission', event.target.value)}
                disabled={disabled}
                name="transmission"
              >
                <option value="all">Tutti i tipi</option>
                {transmissionOptions.map(trans => (
                  <option key={trans} value={trans}>{trans}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort" className={labelClass}>Ordina per</Label>
              <select
                id="sort"
                className={nativeSelectClass}
                value={sortBy}
                onChange={event => setSortBy(event.target.value)}
                disabled={disabled}
                name="sort"
              >
                <option value="price-asc">Prezzo (crescente)</option>
                <option value="price-desc">Prezzo (decrescente)</option>
                <option value="year-desc">Anno (più recente)</option>
                <option value="year-asc">Anno (meno recente)</option>
              </select>
            </div>

        <div className="space-y-2">
          <Label className={labelClass}>Chilometraggio</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="mileage-min" className={cn('text-xs', isHorizontal && 'text-[10px]', isDarkSurface ? 'text-sky-200/85' : 'text-muted-foreground')}>Min</Label>
              <Input
                id="mileage-min"
                className={compactControlClass}
                type="text"
                inputMode="numeric"
                min={mileageRange[0]}
                max={mileageRange[1]}
                value={formatNumber(filters.mileage[0])}
                onFocus={event => event.currentTarget.select()}
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
                type="text"
                inputMode="numeric"
                min={mileageRange[0]}
                max={mileageRange[1]}
                value={formatNumber(filters.mileage[1])}
                onFocus={event => event.currentTarget.select()}
                onChange={event =>
                  handleRangeInputChange('mileage', 1, event.target.value, mileageRange)
                }
                disabled={disabled}
              />
            </div>
          </div>
          {!isHorizontal && !isMobileCompact && (
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
            <div className={cn('flex justify-between text-sm text-muted-foreground', isMobileCompact && 'text-xs')}>
              <span>{formatNumber(filters.mileage[0])} km</span>
              <span>{formatNumber(filters.mileage[1])} km</span>
            </div>
          )}
        </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}