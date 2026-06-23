export type VehicleImageCategory =
  | 'fronte-dx'
  | 'fronte-sx'
  | 'posteriore-sx'
  | 'posteriore-dx'
  | 'interno'
  | 'cerchi'
  | 'baule'
  | 'dettaglio-danni'
  | 'kilometri'
  | 'libretto'
  | 'generica';

export type VehicleImageVisibility = 'public' | 'admin';
export type VehicleMediaType = 'image' | 'video360';

export type VehicleImageAsset = {
  url: string;
  category: VehicleImageCategory;
  label: string;
  visibility: VehicleImageVisibility;
  mediaType?: VehicleMediaType;
  storagePath?: string | null;
};

export type Vehicle = {
  id: string;
  numeroRiferimento?: number;
  data_inserimento?: string;
  coverImageUrl?: string | null;
  stato: 'In vendita' | 'Venduto' | 'Prenotato' | 'In arrivo';
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
  prezzoPrivati?: number; // Prezzo visibile ai seller (commerciante)
  garanzia_legale_prezzo?: number;
  targa?: string;
  garanzia?: string;
  descrizione: string;
  immagini: string[];
  immaginiRiservate?: string[];
  mediaAssets?: VehicleImageAsset[];
  link_canva?: string;
  periziaPdfUrl?: string | null;
  periziaPdfStoragePath?: string | null;
  periziaPdfName?: string | null;
  youtubeVideoUrl?: string | null;
  slug: string;
  anno?: number; // For legacy data
  createdAt?: any;
  updatedAt?: any;
  statusChangedBy?: string;
  statusChangedByName?: string;
  statusChangedByEmail?: string;
  reservationCreatedAt?: string | null;
  reservationExpiresAt?: string | null;
};

export type Form = {
  id: string;
  title: string;
  category: 'cliente' | 'commerciante';
  fileUrl: string;
  fileName: string;
  storagePath?: string;
  contentType?: string | null;
  createdAt: any;
};

export type HubDocumentFolder = {
  id: string;
  name: string;
  createdAt?: any;
  createdByUid?: string | null;
  createdByEmail?: string | null;
};

export type HubDocument = {
  id: string;
  title: string;
  titleKey: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  folderId?: string | null;
  createdAt?: any;
  updatedAt?: any;
  uploadedByUid?: string | null;
  uploadedByEmail?: string | null;
};

export type Contract = {
  id: string; // Will be same as vehicleId
  vehicleId: string;
  companyProfileId?: string | null;
  creatorId: string;
  signedContractUrl?: string | null;
  signedContractStoragePath?: string | null;
  signedContractName?: string | null;
  signedContractUploadedAt?: any;
  signedContractUploadedBy?: string | null;
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
  documentation?: string;
  withdrawal?: string;
  createdAt: any;
  updatedAt: any;
};

export type CustomerCompany = {
  id: string;
  name: string;
  address: string;
  cf: string;
  phone?: string;
  email?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
};

export type User = {
  id: string;
  email: string;
  nome?: string;
  name?: string;
  createdAt: any;
  sellerType?: 'HUB' | 'EXPRESS' | 'MGV' | 'STANDARD' | 'hub' | 'express' | 'mgv' | 'standard' | 'tantibuonikm' | 'gruppodinamica' | 'TANTIBUONIKM' | 'GRUPPODINAMICA' | null;
  status?: 'pending' | 'active' | 'disabled';
  allowedSections?: string[];
  capabilities?: string[];
  notes?: string | null;
};

export type AgentProfile = {
  id: string;
  email: string;
  nome?: string;
  name?: string;
  status?: 'pending' | 'active' | 'disabled';
  allowedSections?: string[];
  capabilities?: string[];
  notes?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

export type AgentVehicleReportAttachmentType =
  | 'libretto'
  | 'documento-cliente'
  | 'denuncia'
  | 'cessione-credito-firmata';

export type AgentVehicleReportAttachment = {
  url: string;
  filename: string;
  contentType?: string | null;
  type: AgentVehicleReportAttachmentType;
  storagePath?: string | null;
};

export type AgentVehicleReport = {
  id: string;
  agentId: string;
  agentEmail?: string | null;
  status: 'new' | 'reviewed' | 'archived';
  marca: string;
  modello: string;
  versione: string;
  data_immatricolazione: string;
  targa: string;
  chilometraggio?: number | null;
  carburante?: 'Benzina' | 'Diesel' | 'Elettrica' | 'Ibrida' | null;
  cambio?: 'Manuale' | 'Automatico' | null;
  potenza?: number | null;
  potenza_kw?: number | null;
  cilindrata?: number | null;
  colore_esterno?: string | null;
  colore_interni?: string | null;
  classe_emissioni?: string | null;
  tipoSinistro: string;
  descrizione: string;
  vehicleImages: string[];
  damageImages: string[];
  attachments: AgentVehicleReportAttachment[];
  createdAt?: any;
  updatedAt?: any;
};
