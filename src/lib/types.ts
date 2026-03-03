export type Vehicle = {
  id: string;
  data_inserimento: string;
  stato: 'In vendita' | 'Venduto';
  marca: string;
  modello: string;
  versione: string;
  anno: number;
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
};
