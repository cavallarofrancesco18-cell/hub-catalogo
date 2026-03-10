export type Vehicle = {
  id: string;
  data_inserimento: string;
  stato: 'In vendita' | 'Venduto' | 'Prenotato';
  marca: string;
  modello: string;
  versione: string;
  data_immatricolazione: string;
  chilometraggio: number;
  carburante: 'Benzina' | 'Diesel' | 'Elettrica' | 'Ibrida';
  cambio: 'Manuale' | 'Automatico';
  potenza: number; // CV
  potenza_kw?: number;
  bollo?: string;
  cilindrata?: number;
  classe_emissioni?: string;
  colore_esterno: string;
  colore_interni?: string;
  prezzo: number;
  targa?: string;
  garanzia?: string;
  descrizione: string;
  immagini: string[];
  link_canva?: string;
  slug: string;
  anno?: number; // For legacy data
  createdAt?: any;
  updatedAt?: any;
};

export type Form = {
  id: string;
  title: string;
  category: 'cliente' | 'commerciante';
  fileUrl: string;
  fileName: string;
  createdAt: any;
};

export type SellerRole = {
  assignedAt?: any;
  sellerType?: 'TIPO_A' | 'TIPO_B' | 'TIPO_C' | 'TIPO_D';
};
