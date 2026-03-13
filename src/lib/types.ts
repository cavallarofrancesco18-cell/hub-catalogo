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
  garanzia_legale_prezzo?: number;
  targa?: string;
  garanzia?: string;
  descrizione: string;
  immagini: string[];
  link_canva?: string;
  slug: string;
  anno?: number; // For legacy data
  createdAt?: any;
  updatedAt?: any;
  statusChangedBy?: string;
};

export type Form = {
  id: string;
  title: string;
  category: 'cliente' | 'commerciante';
  fileUrl: string;
  fileName: string;
  createdAt: any;
};

export type Contract = {
  id: string; // Will be same as vehicleId
  vehicleId: string;
  creatorId: string;
  name: string;
  address: string;
  cf: string;
  docNumber?: string;
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  email?: string;
  customerType: 'privato' | 'commerciante';
  price: number;
  costoVultura?: number;
  paymentMethod: 'contanti' | 'bonifico' | 'assegno' | 'finanziamento';
  financingCompany?: string;
  numberOfInstallments?: number;
  installmentAmount?: number;
  totalFinancedAmount?: number;
  warranty?: string;
  insurance?: string;
  wearAndTear?: string;
  withdrawal?: string;
  createdAt: any;
  updatedAt: any;
};

export type User = {
  id: string;
  email: string;
  createdAt: any;
  sellerType?: 'HUB' | 'EXPRESS' | 'MGV' | null;
};
