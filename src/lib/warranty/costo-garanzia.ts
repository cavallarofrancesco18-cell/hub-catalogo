import listino from './mawdy-copertura-organi.json';

export type WarrantyAgeBand = 'A' | 'B';
export type WarrantyCategoryKey = 'fino-2500' | 'oltre-2500' | 'lr-jaguar';
export type WarrantySupplementKey = 'hybrid' | 'automatico';
export type WarrantyMissingField =
  | 'annoImmatricolazione'
  | 'marca'
  | 'cambio'
  | 'cilindrata'
  | 'carburante'
  | 'tipoIbrido';

export const WARRANTY_MISSING_FIELD_LABELS: Record<WarrantyMissingField, string> = {
  annoImmatricolazione: 'Anno di immatricolazione',
  marca: 'Marca',
  cambio: 'Tipo cambio',
  cilindrata: 'Cilindrata (cc)',
  carburante: 'Alimentazione',
  tipoIbrido: 'Tipo ibrido',
};

export const WARRANTY_HYBRID_TYPES = ['MHEV', 'Full Hybrid', 'Plug-in Hybrid'] as const;
export type WarrantyHybridType = (typeof WARRANTY_HYBRID_TYPES)[number];

export interface WarrantyQuoteInput {
  annoImmatricolazione?: number | null;
  marca?: string | null;
  cambio?: string | null;
  cilindrata?: number | null;
  carburante?: string | null;
  tipoIbrido?: string | null;
  annoRiferimento?: number;
}

export interface WarrantyDurationQuote {
  mesi: number;
  prezzo: number;
  polizza: number;
  imponibile: number;
  iva: number;
  totale: number;
}

export interface WarrantyQuote {
  disponibile: boolean;
  motivoNonDisponibile?: string;
  campiMancanti: WarrantyMissingField[];
  etaVeicolo?: number;
  fasciaEta?: WarrantyAgeBand;
  fasciaEtaLabel?: string;
  categoria?: WarrantyCategoryKey;
  categoriaLabel?: string;
  supplementi: WarrantySupplementKey[];
  supplementiLabels: string[];
  durate: WarrantyDurationQuote[];
}

type TariffaVoce = {
  prezzo: number[];
  polizza: number[];
  imponibile: number[];
  iva: number[];
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeBrand(value: string): string {
  return value.toLocaleLowerCase('it-IT').replace(/[^a-z0-9]/g, '');
}

function matchesBrand(marca: string, brands: string[]): boolean {
  const normalized = normalizeBrand(marca);
  return brands.some(brand => normalizeBrand(brand) === normalized);
}

export function isMildHybrid(tipoIbrido?: string | null): boolean {
  if (!tipoIbrido) return false;
  const normalized = tipoIbrido.toLocaleLowerCase('it-IT');
  return normalized.includes('mhev') || normalized.includes('mild');
}

export function calcolaCostoGaranzia(input: WarrantyQuoteInput): WarrantyQuote {
  const annoRiferimento = input.annoRiferimento ?? new Date().getFullYear();
  const marca = input.marca?.trim() || null;
  const cambio = input.cambio?.trim() || null;
  const carburante = input.carburante?.trim() || null;
  const tipoIbrido = input.tipoIbrido?.trim() || null;
  const cilindrata =
    typeof input.cilindrata === 'number' && Number.isFinite(input.cilindrata) && input.cilindrata > 0
      ? input.cilindrata
      : null;
  const annoImmatricolazione =
    typeof input.annoImmatricolazione === 'number' &&
    Number.isFinite(input.annoImmatricolazione) &&
    input.annoImmatricolazione > 0
      ? input.annoImmatricolazione
      : null;

  const isLrJaguar = marca ? matchesBrand(marca, listino.marcheLrJaguar) : false;
  const isSupercarBrand = marca ? matchesBrand(marca, listino.marcheSupercar) : false;

  const campiMancanti: WarrantyMissingField[] = [];
  if (!annoImmatricolazione) campiMancanti.push('annoImmatricolazione');
  if (!marca) campiMancanti.push('marca');
  if (!cambio) campiMancanti.push('cambio');
  if (!carburante) campiMancanti.push('carburante');
  if (carburante === 'Ibrida' && !tipoIbrido) campiMancanti.push('tipoIbrido');
  // La cilindrata serve solo se la marca non determina gia' la categoria
  if (marca && !isLrJaguar && !isSupercarBrand && !cilindrata) {
    campiMancanti.push('cilindrata');
  }

  const baseResult = {
    campiMancanti,
    supplementi: [] as WarrantySupplementKey[],
    supplementiLabels: [] as string[],
    durate: [] as WarrantyDurationQuote[],
  };

  if (campiMancanti.length > 0) {
    return { ...baseResult, disponibile: false };
  }

  const etaVeicolo = annoRiferimento - annoImmatricolazione!;
  const fasciaEta = (Object.keys(listino.fascieEta) as WarrantyAgeBand[]).find(key => {
    const fascia = listino.fascieEta[key];
    return etaVeicolo >= fascia.etaMin && etaVeicolo <= fascia.etaMax;
  });

  if (!fasciaEta) {
    return {
      ...baseResult,
      disponibile: false,
      motivoNonDisponibile: `Garanzia non disponibile: il veicolo ha ${etaVeicolo} anni (oltre 15 anni).`,
      etaVeicolo,
    };
  }

  const categoria: WarrantyCategoryKey = isLrJaguar
    ? 'lr-jaguar'
    : isSupercarBrand || (cilindrata !== null && cilindrata > listino.cilindrataSupercarSoglia)
      ? 'oltre-2500'
      : 'fino-2500';

  const supplementi: WarrantySupplementKey[] = [];
  if (carburante === 'Ibrida' && !isMildHybrid(tipoIbrido)) supplementi.push('hybrid');
  if (cambio === 'Automatico') supplementi.push('automatico');

  const tariffaBase = listino.categorie[categoria][fasciaEta] as TariffaVoce;
  const voci: TariffaVoce[] = [
    tariffaBase,
    ...supplementi.map(key => listino.supplementi[key] as TariffaVoce),
  ];

  const durate: WarrantyDurationQuote[] = listino.durate.map((mesi, index) => {
    const prezzo = round2(voci.reduce((sum, voce) => sum + voce.prezzo[index], 0));
    const polizza = round2(voci.reduce((sum, voce) => sum + voce.polizza[index], 0));
    const imponibile = round2(voci.reduce((sum, voce) => sum + voce.imponibile[index], 0));
    const iva = round2(voci.reduce((sum, voce) => sum + voce.iva[index], 0));
    return { mesi, prezzo, polizza, imponibile, iva, totale: round2(prezzo + iva) };
  });

  return {
    disponibile: true,
    campiMancanti,
    etaVeicolo,
    fasciaEta,
    fasciaEtaLabel: `Listino ${fasciaEta} - ${listino.fascieEta[fasciaEta].label}`,
    categoria,
    categoriaLabel: listino.categorie[categoria].label,
    supplementi,
    supplementiLabels: supplementi.map(key => listino.supplementi[key].label),
    durate,
  };
}
