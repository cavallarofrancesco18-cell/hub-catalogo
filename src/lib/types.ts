export type VehicleImageCategory =
  | 'showroom-hub'
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

export type AdminNotification = {
  id: string;
  type: 'vehicle_reservation';
  title: string;
  message: string;
  vehicleId: string;
  vehicleSlug: string;
  vehicleLabel: string;
  contractId: string;
  customerName?: string | null;
  createdByUid: string;
  createdByName: string;
  createdByEmail?: string | null;
  source: 'contract' | 'admin';
  createdAt?: any;
};

export type Vehicle = {
  id: string;
  numeroRiferimento?: number;
  data_inserimento?: string;
  coverImageUrl?: string | null;
  stato: 'In vendita' | 'Venduto' | 'Prenotato' | 'In arrivo' | 'Trasferita';
  adminOnly?: boolean;
  marca: string;
  modello: string;
  versione: string;
  data_immatricolazione: string;
  chilometraggio: number;
  carburante: 'Benzina' | 'GPL' | 'Diesel' | 'Elettrica' | 'Ibrida';
  tipo_ibrido?: 'MHEV' | 'Full Hybrid' | 'Plug-in Hybrid' | null;
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
  prezzoValutazione?: number; // Costo HUB visibile solo ad admin e seller HUB
  targa?: string;
  vin?: string | null;
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
  // Traccia sempre chi e quando ha effettuato l'ultimo cambio di stato (visibile solo ad admin)
  statusChangeActorUid?: string | null;
  statusChangeActorName?: string | null;
  statusChangeActorEmail?: string | null;
  statusChangedAt?: string | null;
  postVenditaDataVendita?: string | null;
  postVenditaDataIncassoSaldo?: string | null;
  postVenditaDataInvioLibrettoAgenziaItalia?: string | null;
  postVenditaDataInvioLibrettoClienteFinale?: string | null;
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
  parentId?: string | null;
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

export type VehicleDocumentFolder = {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt?: any;
  createdByUid?: string | null;
  createdByEmail?: string | null;
};

export type VehicleDocument = {
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

export type Customer = {
  id: string;
  adminOnly?: boolean;
  name: string;
  address: string;
  cf: string; // Codice Fiscale o P.IVA
  docNumber?: string; // Numero documento
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  email?: string;
  customerType: 'privato' | 'commerciante';
  totalPurchases?: number; // Numero totale di acquisti
  totalSpent?: number; // Importo totale speso
  notes?: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string; // UID dell'admin che ha registrato il cliente
};

export type Contract = {
  id: string; // Will be same as vehicleId
  vehicleId: string;
  adminOnly?: boolean;
  taxRate?: 0 | 4 | 22;
  customerId?: string; // Reference to Customer document
  companyProfileId?: string | null;
  creatorId: string;
  adminOnlyManagement?: boolean;
  adminOnlyManagementReason?: string | null;
  adminOnlyManagementSetAt?: any;
  adminOnlyManagementSetByUid?: string | null;
  adminOnlyManagementSetByEmail?: string | null;
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
  // Vehicle pricing info
  vehicleSalePrice: number; // Prezzo di vendita al cliente
  vehicleCostPrice?: number; // Prezzo di costo della vettura
  price: number;
  costoVultura?: number;
  costoVulturaCaricoCliente?: boolean;
  discount?: number;
  // Additional costs/revenues
  costiShipping?: number;
  costiAllestimento?: number;
  costiPratiche?: number;
  ricaviCommissioni?: number;
  // Payment info
  paymentMethod: 'contanti' | 'bonifico' | 'assegno' | 'finanziamento';
  financingCompany?: string;
  numberOfInstallments?: number;
  installmentAmount?: number;
  totalFinancedAmount?: number;
  vehiclePublicPrice?: number;
  vehicleMerchantPrice?: number;
  warrantyPrice?: number;
  hasInsurance?: 'si' | 'no';
  insurancePrice?: number;
  notes?: string;
  contractDate?: string;
  deliveryDate?: string;
  caparra?: number;
  caparraDate?: string;
  caparraPaymentMethod?: 'contanti' | 'bonifico' | 'assegno' | 'pos';
  caparraBankAccount?: string;
  sellerDetails?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  secondaryBuyer?: {
    name?: string;
    address?: string;
    cf?: string;
    docNumber?: string;
    birthDate?: string;
    birthPlace?: string;
    phone?: string;
    email?: string;
    customerType?: 'privato' | 'commerciante';
  };
  tradeInVehicle?: {
    brand?: string;
    model?: string;
    plate?: string;
    vin?: string;
    color?: string;
    value?: number;
    km?: number;
    owner?: string;
    notes?: string;
  };
  workItems?: Array<{
    description?: string;
    cost?: number;
  }>;
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
  phone?: string;
  createdAt: any;
  sellerType?: string | null;
  companyName?: string | null;
  companyLegalAddress?: string | null;
  companyVatNumber?: string | null;
  companyLogoUrl?: string | null;
  companyLogoStoragePath?: string | null;
  companyVisuraStoragePath?: string | null;
  companyVisuraFileName?: string | null;
  companyVisuraUploadedAt?: any;
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
  carburante?: 'Benzina' | 'GPL' | 'Diesel' | 'Elettrica' | 'Ibrida' | null;
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
