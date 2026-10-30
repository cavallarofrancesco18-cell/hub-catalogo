'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { Vehicle } from '@/lib/types';
import { formatCurrencyPrecise } from '@/lib/utils';
import {
  calcolaCostoGaranzia,
  WARRANTY_HYBRID_TYPES,
  WARRANTY_MISSING_FIELD_LABELS,
  type WarrantyMissingField,
  type WarrantyQuoteInput,
} from '@/lib/warranty/costo-garanzia';

type WarrantyOverrides = Partial<{
  annoImmatricolazione: number;
  marca: string;
  cambio: string;
  cilindrata: number;
  carburante: string;
  tipoIbrido: string;
}>;

function getVehicleQuoteInput(vehicle: Vehicle): WarrantyQuoteInput {
  const parsedYear = vehicle.data_immatricolazione
    ? new Date(vehicle.data_immatricolazione).getFullYear()
    : NaN;
  return {
    annoImmatricolazione: Number.isFinite(parsedYear)
      ? parsedYear
      : (vehicle.anno ?? null),
    marca: vehicle.marca ?? null,
    cambio: vehicle.cambio ?? null,
    cilindrata: vehicle.cilindrata ?? null,
    carburante: vehicle.carburante ?? null,
    tipoIbrido: vehicle.tipo_ibrido ?? null,
  };
}

export function WarrantyCostDialog({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [overrides, setOverrides] = useState<WarrantyOverrides>({});

  useEffect(() => {
    if (open) {
      setOverrides({});
    }
  }, [open, vehicle?.id]);

  const quote = useMemo(() => {
    if (!vehicle) return null;
    const base = getVehicleQuoteInput(vehicle);
    return calcolaCostoGaranzia({ ...base, ...overrides });
  }, [vehicle, overrides]);

  const setOverride = <K extends keyof WarrantyOverrides>(
    key: K,
    value: WarrantyOverrides[K]
  ) => {
    setOverrides(current => ({ ...current, [key]: value }));
  };

  const renderMissingField = (field: WarrantyMissingField) => {
    const label = WARRANTY_MISSING_FIELD_LABELS[field];
    switch (field) {
      case 'annoImmatricolazione':
        return (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Input
              type="number"
              placeholder="Es. 2020"
              value={overrides.annoImmatricolazione ?? ''}
              onChange={event =>
                setOverride(
                  'annoImmatricolazione',
                  event.target.value ? Number(event.target.value) : undefined
                )
              }
            />
          </div>
        );
      case 'marca':
        return (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Input
              placeholder="Es. Audi"
              value={overrides.marca ?? ''}
              onChange={event => setOverride('marca', event.target.value || undefined)}
            />
          </div>
        );
      case 'cambio':
        return (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Select
              value={overrides.cambio ?? ''}
              onValueChange={value => setOverride('cambio', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo cambio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Manuale">Manuale</SelectItem>
                <SelectItem value="Automatico">Automatico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'cilindrata':
        return (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Input
              type="number"
              placeholder="Es. 1998"
              value={overrides.cilindrata ?? ''}
              onChange={event =>
                setOverride(
                  'cilindrata',
                  event.target.value ? Number(event.target.value) : undefined
                )
              }
            />
          </div>
        );
      case 'carburante':
        return (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Select
              value={overrides.carburante ?? ''}
              onValueChange={value => setOverride('carburante', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona alimentazione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Benzina">Benzina</SelectItem>
                <SelectItem value="GPL">GPL</SelectItem>
                <SelectItem value="Diesel">Diesel</SelectItem>
                <SelectItem value="Elettrica">Elettrica</SelectItem>
                <SelectItem value="Ibrida">Ibrida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'tipoIbrido':
        return (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Select
              value={overrides.tipoIbrido ?? ''}
              onValueChange={value => setOverride('tipoIbrido', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo ibrido" />
              </SelectTrigger>
              <SelectContent>
                {WARRANTY_HYBRID_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type === 'MHEV' ? 'Mild hybrid (MHEV)' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Costo garanzia - Copertura Organi Mawdy</DialogTitle>
          <DialogDescription>
            {vehicle
              ? `${vehicle.marca} ${vehicle.modello}${vehicle.targa ? ` · ${vehicle.targa}` : ''}`
              : 'Nessun veicolo selezionato'}
          </DialogDescription>
        </DialogHeader>

        {!vehicle ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Seleziona prima il veicolo.</AlertDescription>
          </Alert>
        ) : quote && quote.campiMancanti.length > 0 ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Alcuni dati del veicolo mancano: indicali a mano per calcolare il costo della
                garanzia.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {quote.campiMancanti.map(renderMissingField)}
            </div>
          </div>
        ) : quote && !quote.disponibile ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {quote.motivoNonDisponibile ?? 'Garanzia non disponibile per questo veicolo.'}
            </AlertDescription>
          </Alert>
        ) : quote ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-sky-100 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">Classificazione veicolo</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Fascia eta:</span>
                  <p className="font-medium text-slate-900">
                    {quote.fasciaEtaLabel}
                    {typeof quote.etaVeicolo === 'number' && ` (${quote.etaVeicolo} anni)`}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Categoria:</span>
                  <p className="font-medium text-slate-900">{quote.categoriaLabel}</p>
                </div>
                <div>
                  <span className="text-slate-500">Supplementi:</span>
                  <p className="font-medium text-slate-900">
                    {quote.supplementiLabels.length > 0
                      ? quote.supplementiLabels.join(' + ')
                      : 'Nessuno'}
                  </p>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Durata</TableHead>
                  <TableHead className="text-right">Polizza (imposte incluse)</TableHead>
                  <TableHead className="text-right">Imponibile servizio</TableHead>
                  <TableHead className="text-right">IVA 22%</TableHead>
                  <TableHead className="text-right">Prezzo</TableHead>
                  <TableHead className="text-right">Totale con IVA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.durate.map(durata => (
                  <TableRow key={durata.mesi}>
                    <TableCell className="font-medium">{durata.mesi} mesi</TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyPrecise(durata.polizza)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyPrecise(durata.imponibile)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyPrecise(durata.iva)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyPrecise(durata.prezzo)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrencyPrecise(durata.totale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-slate-500">
              Prezzo = Polizza (imposte incluse 21,25%) + Imponibile servizio. L&apos;IVA 22% si
              applica solo all&apos;imponibile servizio. Totale con IVA = Prezzo + IVA.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
