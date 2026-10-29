'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { User as UserData } from '@/lib/types';
import {
  useFirestore,
  useMemoFirebase,
  useCollection,
  useFirebaseApp,
  updateDocumentNonBlocking,
  useUserRole,
  useUser,
} from '@/firebase';
import { collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, type DocumentData, type UpdateData } from 'firebase/firestore';
import { deleteObject, getBlob, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Loader2, UserPlus, KeyRound, Eye, EyeOff, Search, ArrowUpDown, Save, Upload, FileText, Download, Tags } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
  } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { firebaseConfig } from '@/firebase/config';
import { readVisuraCompanyIdentity } from '@/lib/visura-extraction';


const registerSchema = z.object({
    name: z.string().trim().min(2, 'Inserisci nome e cognome.'),
    companyName: z.string().trim().min(2, 'Il nome azienda è obbligatorio.').max(120, 'Il nome azienda è troppo lungo.'),
  companyLegalAddress: z.string().trim().min(5, 'La sede legale non è stata rilevata.' ).max(250, 'La sede legale è troppo lunga.'),
  companyVatNumber: z.string().trim().regex(/^\d{11}$/, 'La partita IVA deve contenere 11 cifre.'),
    email: z.string().email('Inserisci un indirizzo email valido.'),
  phone: z.string().min(6, 'Inserisci un numero di telefono valido.'),
});
type RegisterFormValues = z.infer<typeof registerSchema>;

type SellerTypeOption = { id: string; name: string };
type SellerSortKey = 'name' | 'company' | 'type' | 'createdAt';
const MAX_COMPANY_VISURA_SIZE_MB = 10;

const DEFAULT_SELLER_TYPES: SellerTypeOption[] = [
  { id: 'standard', name: 'Standard' },
  { id: 'hub', name: 'HUB' },
  { id: 'express', name: 'EXPRESS' },
  { id: 'mgv', name: 'MGV' },
  { id: 'tantibuonikm', name: 'tantibuonikm' },
  { id: 'gruppodinamica', name: 'gruppodinamica' },
];

function createSellerTypeId(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function formatSellerTypeName(value?: string | null) {
  return value
    ?.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Standard';
}

function normalizeSellerTypeId(value?: string | null) {
  return formatSellerTypeName(value).toLowerCase();
}

function normalizeStoredSellerType(value?: string | null) {
  const normalized = value?.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '').trim();
  return normalized || null;
}

function getSellerTypeOptionLabel(value: string | null | undefined, options: SellerTypeOption[]) {
  const normalizedValue = normalizeSellerTypeId(value);
  return options.find(option => normalizeSellerTypeId(option.id) === normalizedValue)?.name
    || formatSellerTypeName(value);
}

function generateTemporarySellerPassword() {
  const characterGroups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
  ];
  const allCharacters = characterGroups.join('');
  const randomValues = crypto.getRandomValues(new Uint32Array(12));
  const passwordCharacters = characterGroups.map((group, index) => group[randomValues[index] % group.length]);

  for (let index = characterGroups.length; index < randomValues.length; index += 1) {
    passwordCharacters.push(allCharacters[randomValues[index] % allCharacters.length]);
  }

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomValues[index] % (index + 1);
    [passwordCharacters[index], passwordCharacters[swapIndex]] = [passwordCharacters[swapIndex], passwordCharacters[index]];
  }

  return passwordCharacters.join('');
}

function formatSellerCreatedAt(value: unknown): string {
  const date =
    value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : value
          ? new Date(value as string | number)
          : null;

  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('it-IT') : '—';
}

function getSellerCreatedAtTimestamp(value: unknown): number {
  const date =
    value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : value
          ? new Date(value as string | number)
          : null;

  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}


export default function UsersPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user: currentUser } = useUser();
  const { isPlatformAdmin, isLoading: isRoleLoading } = useUserRole();
  const { toast } = useToast();
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerSortKey, setSellerSortKey] = useState<SellerSortKey>('createdAt');
  const [sellerSortDirection, setSellerSortDirection] = useState<'asc' | 'desc'>('desc');

  const sellersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'seller') : null),
    [firestore]
  );
  const { data: sellers, isLoading, error } = useCollection<UserData>(sellersRef);
  const visibleSellers = useMemo(() => {
    const query = sellerSearch.trim().toLocaleLowerCase('it');
    const rows = (sellers ?? []).filter(seller => {
      if (!query) return true;
      return [seller.nome, seller.name, seller.email, seller.phone, seller.companyName, seller.sellerType]
        .some(value => value?.toLocaleLowerCase('it').includes(query));
    });

    return rows.sort((left, right) => {
      if (sellerSortKey === 'createdAt') {
        const comparison = getSellerCreatedAtTimestamp(left.createdAt) - getSellerCreatedAtTimestamp(right.createdAt);
        return sellerSortDirection === 'asc' ? comparison : -comparison;
      }

      const valueFor = (seller: UserData) => sellerSortKey === 'name'
        ? seller.nome || seller.name || ''
        : sellerSortKey === 'company'
          ? seller.companyName || ''
          : formatSellerTypeName(seller.sellerType);
      const comparison = valueFor(left).localeCompare(valueFor(right), 'it', { sensitivity: 'base' });
      return sellerSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sellers, sellerSearch, sellerSortKey, sellerSortDirection]);
  const sellerTypesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'sellerTypes') : null),
    [firestore]
  );
  const { data: storedSellerTypes, error: sellerTypesError } = useCollection<SellerTypeOption>(sellerTypesRef);
  const [sellerToDelete, setSellerToDelete] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isUpdatingPhone, setIsUpdatingPhone] = useState<string | null>(null);
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({});
  const [isUpdatingName, setIsUpdatingName] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSellerTypeManagerOpen, setIsSellerTypeManagerOpen] = useState(false);
  const [sellerTypeToDelete, setSellerTypeToDelete] = useState<SellerTypeOption | null>(null);
  const [sellerTypeReplacementDrafts, setSellerTypeReplacementDrafts] = useState<Record<string, string>>({});
  const [isDeletingSellerTypeId, setIsDeletingSellerTypeId] = useState<string | null>(null);
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [companyVisuraFile, setCompanyVisuraFile] = useState<File | null>(null);
  const companyVisuraInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingVisura, setIsExtractingVisura] = useState(false);
  const [companyDetailsSeller, setCompanyDetailsSeller] = useState<UserData | null>(null);
  const [companyDetailsDraft, setCompanyDetailsDraft] = useState({ fullName: '', phone: '', companyName: '', legalAddress: '', vatNumber: '' });
  const [companyDetailsLogoFile, setCompanyDetailsLogoFile] = useState<File | null>(null);
  const [companyDetailsLogoPreviewUrl, setCompanyDetailsLogoPreviewUrl] = useState<string | null>(null);
  const [companyDetailsVisuraFile, setCompanyDetailsVisuraFile] = useState<File | null>(null);
  const [isExtractingExistingVisura, setIsExtractingExistingVisura] = useState(false);
  const [isSavingCompanyDetails, setIsSavingCompanyDetails] = useState(false);
  const [isDownloadingVisuraSellerId, setIsDownloadingVisuraSellerId] = useState<string | null>(null);
  const [logoPreviewSeller, setLogoPreviewSeller] = useState<UserData | null>(null);
  const [isUploadingLogoSellerId, setIsUploadingLogoSellerId] = useState<string | null>(null);
  const logoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const hasCheckedSellerTypeWhitespaceRef = useRef(false);

    useEffect(() => {
      if (!isPlatformAdmin || isLoading || sellers === null || !firestore || hasCheckedSellerTypeWhitespaceRef.current) {
        return;
      }

      hasCheckedSellerTypeWhitespaceRef.current = true;
      const sellersToNormalize = sellers.filter(seller =>
        typeof seller.sellerType === 'string'
        && normalizeStoredSellerType(seller.sellerType) !== seller.sellerType
      );

      if (sellersToNormalize.length === 0) return;

      void Promise.all(sellersToNormalize.map(seller =>
        updateDoc(doc(firestore, 'seller', seller.id), {
          sellerType: normalizeStoredSellerType(seller.sellerType),
        })
      )).then(() => {
        toast({
          title: 'Tipi seller ripuliti',
          description: `Rimossi spazi iniziali o finali da ${sellersToNormalize.length} profili.`,
        });
      }).catch(error => {
        console.error('Pulizia spazi tipo seller fallita:', error);
        toast({
          variant: 'destructive',
          title: 'Pulizia non riuscita',
          description: 'Non è stato possibile aggiornare i tipi seller in Firestore.',
        });
      });
    }, [firestore, isLoading, isPlatformAdmin, sellers, toast]);
  const [passwordSeller, setPasswordSeller] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!companyDetailsLogoFile) {
      setCompanyDetailsLogoPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(companyDetailsLogoFile);
    setCompanyDetailsLogoPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [companyDetailsLogoFile]);

  const registrationForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      companyName: '',
      companyLegalAddress: '',
      companyVatNumber: '',
      email: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (error) {
        toast({
            variant: "destructive",
            title: "Errore nel caricamento dei venditori",
            description: "Impossibile recuperare la lista di venditori. Controlla i permessi o la console per i dettagli.",
        });
        console.error("Firestore Error:", error);
    }
  }, [error, toast]);

  useEffect(() => {
    if (sellerTypesError) {
      toast({
        variant: 'destructive',
        title: 'Tipi seller non caricati',
        description: 'Verifica i permessi Firestore della raccolta sellerTypes.',
      });
    }
  }, [sellerTypesError, toast]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const pendingNotice = sessionStorage.getItem('seller-created');
    if (pendingNotice === 'true') {
      setShowRegistrationNotice(true);
      sessionStorage.removeItem('seller-created');
    }

    const sellerTypeDeletedNotice = sessionStorage.getItem('seller-type-deleted');
    if (sellerTypeDeletedNotice) {
      sessionStorage.removeItem('seller-type-deleted');
      toast({
        title: 'Tipo seller aggiornato',
        description: sellerTypeDeletedNotice === 'merged'
          ? 'I seller assegnati sono stati spostati sul tipo duplicato e la lista è aggiornata.'
          : 'Il tipo seller è stato eliminato e la lista è aggiornata.',
      });
    }
  }, [toast]);

  useEffect(() => {
    if (!isRoleLoading && !isPlatformAdmin) {
      router.replace('/admin');
    }
  }, [isPlatformAdmin, isRoleLoading, router]);

  useEffect(() => {
    if (!sellers) return;

    setPhoneDrafts(currentDrafts => {
      const nextDrafts: Record<string, string> = {};

      sellers.forEach(seller => {
        if (currentDrafts[seller.id] !== undefined) {
          nextDrafts[seller.id] = currentDrafts[seller.id];
          return;
        }

        nextDrafts[seller.id] = seller.phone || '';
      });

      return nextDrafts;
    });

    setNameDrafts(currentDrafts => {
      const nextDrafts: Record<string, string> = {};

      sellers.forEach(seller => {
        if (currentDrafts[seller.id] !== undefined) {
          nextDrafts[seller.id] = currentDrafts[seller.id];
          return;
        }

        nextDrafts[seller.id] = seller.nome || seller.name || '';
      });

      return nextDrafts;
    });
  }, [sellers]);

  const sellerTypeOptionsForSelect = (() => {
    const options = new Map(DEFAULT_SELLER_TYPES.map(type => [type.id, type]));
    (storedSellerTypes ?? []).forEach(type => {
      const id = normalizeSellerTypeId(type.id);
      const name = type.name ? formatSellerTypeName(type.name) : '';
      if (id && name) options.set(id, { ...type, id, name });
    });
    (sellers ?? []).forEach(seller => {
      if (!seller.sellerType?.trim()) return;
      const name = formatSellerTypeName(seller.sellerType);
      const id = normalizeSellerTypeId(seller.sellerType);
      if (!options.has(id)) options.set(id, { id, name });
    });
    return [...options.values()].sort((left, right) => left.name.localeCompare(right.name, 'it'));
  })();
  const managedSellerTypes = (storedSellerTypes ?? [])
    .filter(type => type.id && type.name && !DEFAULT_SELLER_TYPES.some(defaultType => defaultType.id === type.id))
    .map(type => ({ ...type, name: formatSellerTypeName(type.name) }))
    .sort((left, right) => left.name.localeCompare(right.name, 'it') || left.id.localeCompare(right.id, 'it'));

  const getSellerTypeUsageCount = (sellerTypeId: string) => (sellers ?? [])
    .filter(seller => seller.sellerType?.trim().toLowerCase() === sellerTypeId.toLowerCase())
    .length;

  const getSameNameSellerTypes = (sellerType: SellerTypeOption) => managedSellerTypes.filter(type =>
    type.id !== sellerType.id
    && type.name.trim().toLocaleLowerCase('it') === sellerType.name.trim().toLocaleLowerCase('it')
  );

  async function ensureSellerTypeForCompany(companyName: string) {
    if (!firestore || !currentUser) throw new Error('ADMIN_NOT_AUTHENTICATED');
    const name = companyName.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 120) throw new Error('INVALID_COMPANY_NAME');

    const normalizedName = name.toLocaleLowerCase('it');
    const existingOption = (storedSellerTypes ?? []).find(
      type => type.name.trim().toLocaleLowerCase('it') === normalizedName
    );
    if (existingOption) return existingOption.id;

    const companyTypeSlug = createSellerTypeId(name);
    if (!companyTypeSlug) throw new Error('INVALID_SELLER_TYPE');
    const id = `azienda-${companyTypeSlug}`;

    const typeRef = doc(firestore, 'sellerTypes', id);
    const typeSnapshot = await getDoc(typeRef);
    if (typeSnapshot.exists()) {
      const existingName = typeSnapshot.data().name;
      if (typeof existingName === 'string' && existingName.trim().toLocaleLowerCase('it') === normalizedName) {
        return id;
      }
      throw new Error('SELLER_TYPE_ID_CONFLICT');
    }

    await setDoc(typeRef, {
      id,
      name,
      createdAt: serverTimestamp(),
      createdByUid: currentUser.uid,
    });
    return id;
  }

  async function handleConfirmSellerTypeDelete() {
    if (!sellerTypeToDelete || !currentUser || isDeletingSellerTypeId) return;
    const sellerType = sellerTypeToDelete;
    const replacementSellerTypeId = sellerTypeReplacementDrafts[sellerType.id] || '';
    setIsDeletingSellerTypeId(sellerType.id);

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/seller-types/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          sellerTypeId: sellerType.id,
          ...(replacementSellerTypeId ? { replacementSellerTypeId } : {}),
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string; reassignedCount?: number } | null;

      if (!response.ok) {
        const error = new Error(result?.error || 'SELLER_TYPE_DELETE_FAILED');
        throw error;
      }

      toast({
        title: 'Tipo seller eliminato',
        description: result?.reassignedCount
          ? `${result.reassignedCount} seller sono stati spostati sul tipo duplicato mantenuto.`
          : `Il tipo ${formatSellerTypeName(sellerType.name)} è stato rimosso.`,
      });
      setSellerTypeReplacementDrafts(current => {
        const next = { ...current };
        delete next[sellerType.id];
        return next;
      });
      setSellerTypeToDelete(null);
      setIsSellerTypeManagerOpen(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('seller-type-deleted', result?.reassignedCount ? 'merged' : 'deleted');
        window.location.reload();
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'SELLER_TYPE_DELETE_FAILED';
      toast({
        variant: 'destructive',
        title: 'Tipo seller non eliminato',
        description: code === 'SELLER_TYPE_IN_USE'
          ? 'Questo tipo è assegnato a dei seller. Seleziona il duplicato con lo stesso nome su cui spostarli.'
          : code === 'REPLACEMENT_NAME_MISMATCH'
            ? 'Puoi unire solo tipi con lo stesso nome.'
            : code === 'RESERVED_SELLER_TYPE' || code === 'RESERVED_REPLACEMENT_TYPE'
              ? 'I tipi di sistema non possono essere eliminati o usati come destinazione.'
              : 'Verifica il tipo selezionato e riprova.',
      });
    } finally {
      setIsDeletingSellerTypeId(null);
    }
  }

  const sortSellersBy = (key: SellerSortKey) => {
    if (sellerSortKey === key) {
      setSellerSortDirection(current => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSellerSortKey(key);
    setSellerSortDirection(key === 'createdAt' ? 'desc' : 'asc');
  };

  async function createSellerAccount(email: string, password: string) {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || 'SELLER_AUTH_CREATE_FAILED');
    return result as { localId: string; email: string; idToken: string };
  }

  async function deleteCreatedSellerAccount(idToken: string) {
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
  }

  const handleCompanyLogoUpload = async (seller: UserData, file: File) => {
    if (!firestore) return;
    if (file.size <= 0 || file.size > 4 * 1024 * 1024
      || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Logo non valido', description: 'Carica un logo PNG, JPG o WebP fino a 4 MB.' });
      return;
    }

    setIsUploadingLogoSellerId(seller.id);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `seller-company-logos/${seller.id}/${Date.now()}-${safeFileName}`;
    const logoRef = ref(getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`), storagePath);

    try {
      await uploadBytes(logoRef, file, {
        contentType: file.type.toLowerCase(),
        customMetadata: { sellerId: seller.id },
      });
      const companyLogoUrl = await getDownloadURL(logoRef);
      await updateDoc(doc(firestore, 'seller', seller.id), {
        companyLogoUrl,
        companyLogoStoragePath: storagePath,
      });
      toast({ title: 'Logo aziendale salvato', description: `Logo collegato a ${seller.companyName || seller.nome || seller.email}.` });
    } catch (error) {
      await deleteObject(logoRef).catch(() => undefined);
      console.error('Salvataggio logo seller fallito:', error);
      toast({ variant: 'destructive', title: 'Caricamento logo non riuscito', description: 'Verifica i permessi Storage e riprova.' });
    } finally {
      setIsUploadingLogoSellerId(null);
    }
  };

  async function handleCompanyVisuraDownload(seller: UserData) {
    if (!seller.companyVisuraStoragePath || isDownloadingVisuraSellerId) return;
    setIsDownloadingVisuraSellerId(seller.id);

    try {
      const storageRef = ref(
        getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`),
        seller.companyVisuraStoragePath
      );
      const blob = await getBlob(storageRef, MAX_COMPANY_VISURA_SIZE_MB * 1024 * 1024);
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = seller.companyVisuraFileName || 'visura-camerale.pdf';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error('Download visura camerale fallito:', error);
      toast({
        variant: 'destructive',
        title: 'Download non riuscito',
        description: 'La visura non è raggiungibile o non hai i permessi per scaricarla.',
      });
    } finally {
      setIsDownloadingVisuraSellerId(null);
    }
  }

  async function handleExistingSellerVisuraChange(file: File | null) {
    setCompanyDetailsVisuraFile(file);
    if (!file) return;

    if (file.size > MAX_COMPANY_VISURA_SIZE_MB * 1024 * 1024
      || !file.name.toLowerCase().endsWith('.pdf')
      || (file.type && file.type.toLowerCase() !== 'application/pdf')) {
      toast({ variant: 'destructive', title: 'Visura non valida', description: `Carica un PDF fino a ${MAX_COMPANY_VISURA_SIZE_MB} MB.` });
      setCompanyDetailsVisuraFile(null);
      return;
    }

    setIsExtractingExistingVisura(true);
    try {
      const identity = await readVisuraCompanyIdentity(file);
      setCompanyDetailsDraft(current => ({
        ...current,
        companyName: identity.companyName || current.companyName,
        legalAddress: identity.legalAddress || current.legalAddress,
        vatNumber: identity.vatNumber || current.vatNumber,
      }));
      const extractedCount = Number(Boolean(identity.companyName)) + Number(Boolean(identity.legalAddress)) + Number(Boolean(identity.vatNumber));
      toast({
        title: extractedCount === 3 ? 'Dati rilevati dalla visura' : 'Visura letta parzialmente',
        description: extractedCount > 0
          ? 'Ho precompilato ragione sociale, sede e P.IVA riconosciute. Controllale prima di salvare.'
          : 'Il PDF potrebbe essere una scansione. Inserisci i dati manualmente.',
      });
    } catch (error) {
      console.error('Lettura della visura camerale non riuscita:', error);
      toast({ variant: 'destructive', title: 'Visura non leggibile', description: 'Inserisci i dati aziendali manualmente.' });
    } finally {
      setIsExtractingExistingVisura(false);
    }
  }

  function handleCompanyDetailsLogoChange(file: File | null) {
    if (!file) {
      setCompanyDetailsLogoFile(null);
      return true;
    }

    if (file.size <= 0 || file.size > 4 * 1024 * 1024
      || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Logo non valido', description: 'Carica un logo PNG, JPG o WebP fino a 4 MB.' });
      setCompanyDetailsLogoFile(null);
      return false;
    }

    setCompanyDetailsLogoFile(file);
    return true;
  }

  async function handleSaveCompanyDetails() {
    if (!companyDetailsSeller || !firestore || isSavingCompanyDetails) return;
    const fullName = (companyDetailsDraft.fullName || companyDetailsSeller.nome || companyDetailsSeller.name || '').trim();
    const phone = (companyDetailsDraft.phone || companyDetailsSeller.phone || '').trim();
    const companyName = (companyDetailsDraft.companyName || '').trim();
    if (fullName && fullName.length < 2) {
      toast({ variant: 'destructive', title: 'Nome non valido', description: 'Inserisci almeno 2 caratteri per il nome.' });
      return;
    }
    if (phone && phone.length < 6) {
      toast({ variant: 'destructive', title: 'Telefono non valido', description: 'Inserisci un numero di almeno 6 caratteri.' });
      return;
    }
    if (companyName.length < 2 || companyName.length > 120) {
      toast({ variant: 'destructive', title: 'Ragione sociale non valida', description: 'Inserisci una ragione sociale di almeno 2 caratteri.' });
      return;
    }
    setIsSavingCompanyDetails(true);

    const seller = companyDetailsSeller;
    let visuraRef = null;
    let uploadedLogoStoragePath: string | null = null;
    try {
      const sellerTypeId = await ensureSellerTypeForCompany(companyName);
      const profileUpdates: UpdateData<DocumentData> = {
        companyName,
        sellerType: sellerTypeId,
        companyLegalAddress: (companyDetailsDraft.legalAddress || '').trim(),
        companyVatNumber: (companyDetailsDraft.vatNumber || '').trim(),
      };
      if (fullName) {
        profileUpdates.nome = fullName;
        profileUpdates.name = fullName;
      }
      if (phone) profileUpdates.phone = phone;

      if (companyDetailsLogoFile) {
        const safeFileName = companyDetailsLogoFile.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
        uploadedLogoStoragePath = `seller-company-logos/${seller.id}/${Date.now()}-${safeFileName}`;
        const logoRef = ref(getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`), uploadedLogoStoragePath);
        await uploadBytes(logoRef, companyDetailsLogoFile, {
          contentType: companyDetailsLogoFile.type.toLowerCase(),
          customMetadata: { sellerId: seller.id },
        });
        profileUpdates.companyLogoStoragePath = uploadedLogoStoragePath;
        profileUpdates.companyLogoUrl = await getDownloadURL(logoRef);
      }

      if (companyDetailsVisuraFile) {
        const safeFileName = companyDetailsVisuraFile.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
        const storagePath = `seller-company-documents/${seller.id}/${Date.now()}-${safeFileName}`;
        visuraRef = ref(getStorage(firebaseApp), storagePath);
        await uploadBytes(visuraRef, companyDetailsVisuraFile, {
          contentType: 'application/pdf',
          customMetadata: { sellerId: seller.id },
        });
        profileUpdates.companyVisuraStoragePath = storagePath;
        profileUpdates.companyVisuraFileName = companyDetailsVisuraFile.name;
        profileUpdates.companyVisuraUploadedAt = serverTimestamp();
      }

      await updateDoc(doc(firestore, 'seller', seller.id), profileUpdates);
      if (uploadedLogoStoragePath && seller.companyLogoStoragePath) {
        await deleteObject(ref(getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`), seller.companyLogoStoragePath))
          .catch(error => console.warn('Rimozione del vecchio logo seller non riuscita:', error));
      }
      toast({ title: 'Anagrafica aggiornata', description: `Profilo e tipo seller aggiornati per ${companyName}.` });
      setCompanyDetailsSeller(null);
      setCompanyDetailsLogoFile(null);
      setCompanyDetailsVisuraFile(null);
    } catch (error) {
      if (visuraRef) await deleteObject(visuraRef).catch(() => undefined);
      if (uploadedLogoStoragePath) {
        await deleteObject(ref(getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`), uploadedLogoStoragePath)).catch(() => undefined);
      }
      console.error('Salvataggio dati aziendali seller fallito:', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio non riuscito',
        description: companyDetailsVisuraFile
          ? 'Verifica che le regole Storage per le visure siano pubblicate e riprova.'
          : 'Impossibile aggiornare i dati aziendali. Riprova.',
      });
    } finally {
      setIsSavingCompanyDetails(false);
    }
  }

  async function sendSellerWelcomeEmail(email: string, name: string, password: string) {
    if (!currentUser) {
      throw new Error('ADMIN_NOT_AUTHENTICATED');
    }

    const adminIdToken = await currentUser.getIdToken();
    const response = await fetch('/api/admin/send-seller-welcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminIdToken}`,
      },
      body: JSON.stringify({ email, name, password }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(result?.error || 'EMAIL_SEND_FAILED');
    }
  }

  async function onRegisterSubmit(data: RegisterFormValues) {
    setIsRegistering(true);

    try {
      if (!currentUser || !firestore) throw new Error('ADMIN_NOT_AUTHENTICATED');
      if (!companyVisuraFile) throw new Error('COMPANY_VISURA_REQUIRED');
      if (companyLogoFile && (companyLogoFile.size > 4 * 1024 * 1024
        || !['image/png', 'image/jpeg', 'image/webp'].includes(companyLogoFile.type.toLowerCase()))) {
        throw new Error('INVALID_COMPANY_LOGO');
      }
      if (
        companyVisuraFile.size > MAX_COMPANY_VISURA_SIZE_MB * 1024 * 1024
        || !companyVisuraFile.name.toLowerCase().endsWith('.pdf')
        || (companyVisuraFile.type && companyVisuraFile.type.toLowerCase() !== 'application/pdf')
      ) {
        throw new Error('INVALID_COMPANY_VISURA');
      }

      const email = data.email.trim().toLowerCase();
      const name = data.name.trim();
      const temporaryPassword = generateTemporarySellerPassword();
      const authUser = await createSellerAccount(email, temporaryPassword);
      const sellerRef = doc(firestore, 'seller', authUser.localId);
      try {
        const sellerTypeId = await ensureSellerTypeForCompany(data.companyName);
        await setDoc(sellerRef, {
          id: authUser.localId,
          email: authUser.email,
          nome: name,
          name,
          phone: data.phone.trim(),
          sellerType: sellerTypeId,
          companyName: data.companyName.trim(),
          companyLegalAddress: data.companyLegalAddress.trim(),
          companyVatNumber: data.companyVatNumber.trim(),
          companyLogoUrl: null,
          companyLogoStoragePath: null,
          companyVisuraStoragePath: null,
          companyVisuraFileName: null,
          companyVisuraUploadedAt: null,
          createdAt: serverTimestamp(),
        });
      } catch (profileError) {
        await deleteCreatedSellerAccount(authUser.idToken).catch(cleanupError => {
          console.error('Cleanup account venditore fallito:', cleanupError);
        });
        throw profileError;
      }

      let logoUploadFailed = false;
      if (companyLogoFile) {
        const logoStoragePath = `seller-company-logos/${authUser.localId}/${Date.now()}-${companyLogoFile.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
        const logoRef = ref(getStorage(firebaseApp), logoStoragePath);
        try {
          await uploadBytes(logoRef, companyLogoFile, {
            contentType: companyLogoFile.type.toLowerCase(),
            customMetadata: { sellerId: authUser.localId },
          });
          const companyLogoUrl = await getDownloadURL(logoRef);
          await updateDoc(sellerRef, { companyLogoStoragePath: logoStoragePath, companyLogoUrl });
        } catch (logoError) {
          logoUploadFailed = true;
          console.error('Logo aziendale non caricato:', logoError);
          await deleteObject(logoRef).catch(() => undefined);
        }
      }

      let visuraUploadFailed = false;
      if (companyVisuraFile) {
        const visuraStoragePath = `seller-company-documents/${authUser.localId}/${Date.now()}-${companyVisuraFile.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
        const visuraRef = ref(getStorage(firebaseApp), visuraStoragePath);
        try {
          await uploadBytes(visuraRef, companyVisuraFile, {
            contentType: 'application/pdf',
            customMetadata: { sellerId: authUser.localId },
          });
          await updateDoc(sellerRef, {
            companyVisuraStoragePath: visuraStoragePath,
            companyVisuraFileName: companyVisuraFile.name,
            companyVisuraUploadedAt: serverTimestamp(),
          });
        } catch (visuraError) {
          visuraUploadFailed = true;
          console.error('Visura camerale non caricata:', visuraError);
        }
      }

      let emailSent = false;
      let emailErrorMessage: string | null = null;
      try {
        await sendSellerWelcomeEmail(email, name, temporaryPassword);
        emailSent = true;
      } catch (emailError) {
        console.error('Invio email venditore fallito:', emailError);
        emailErrorMessage = emailError instanceof Error ? emailError.message : 'EMAIL_SEND_FAILED';
      }

      const followUpMessages = [
        !emailSent ? `Email automatica non inviata${emailErrorMessage ? ` (${emailErrorMessage})` : ''}.` : '',
        logoUploadFailed ? 'Profilo creato senza logo: verifica i permessi Storage e caricalo successivamente.' : '',
        visuraUploadFailed ? 'Profilo creato, ma la visura non è stata caricata. Verifica i permessi Storage.' : '',
      ].filter(Boolean);
      toast({
        title: 'Venditore registrato!',
        description: followUpMessages.length > 0
          ? `L’utente ${email} è stato creato. ${followUpMessages.join(' ')}`
          : `L’utente ${email} è stato creato, aggiunto alla lista e ha ricevuto l’email con le credenziali.`,
      });

      registrationForm.reset();
      setCompanyLogoFile(null);
      setCompanyVisuraFile(null);
      if (companyVisuraInputRef.current) companyVisuraInputRef.current.value = '';
      setIsDialogOpen(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('seller-created', 'true');
      }
      router.replace('/admin/users');
      router.refresh();

    } catch (error: unknown) {
        console.error('Registrazione venditore fallita:', error);

        let description = 'Si è verificato un errore imprevisto. Controlla la console per dettagli.';

      const errorCode = error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : error instanceof Error ? error.message : '';

      if (errorCode === 'auth/email-already-in-use' || errorCode === 'EMAIL_EXISTS') {
            description = 'Questo indirizzo email è già stato registrato.';
      } else if (errorCode === 'INVALID_COMPANY_LOGO') {
        description = 'Il logo deve essere PNG, JPG o WebP e non superare 4 MB.';
      } else if (errorCode === 'INVALID_COMPANY_VISURA') {
        description = `La visura deve essere un PDF e non superare ${MAX_COMPANY_VISURA_SIZE_MB} MB.`;
      } else if (errorCode === 'COMPANY_VISURA_REQUIRED') {
        description = 'Carica la visura camerale prima di registrare il venditore.';
      } else if (errorCode === 'SELLER_TYPE_ID_CONFLICT') {
        description = 'Il nome azienda coincide con un tipo seller già esistente con dati diversi.';
      } else if (errorCode === 'INVALID_PAYLOAD' || errorCode === 'SELLER_CREATE_FAILED') {
        description = 'Impossibile creare il venditore con i dati inseriti. Verifica i campi e riprova.';
      } else if (errorCode === 'permission-denied') {
        description = 'Firestore ha negato la creazione del profilo. Pubblica le regole seller aggiornate e riprova.';
      } else if (errorCode === 'auth/invalid-email' || errorCode === 'INVALID_EMAIL') {
            description = "L'indirizzo email non è valido.";
      } else if (errorCode === 'auth/weak-password' || String(errorCode).startsWith('WEAK_PASSWORD')) {
        description = 'La password temporanea generata non è stata accettata. Riprova.';
      } else if (errorCode === 'OPERATION_NOT_ALLOWED') {
        description = 'La registrazione email/password non è abilitata nel progetto Firebase.';
      } else if (errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        description = 'Troppi tentativi. Riprova tra qualche minuto.';
      } else if (errorCode === 'PERMISSION_DENIED') {
        description = 'L’account è stato creato ma il profilo venditore non è stato salvato per un problema di permessi.';
      } else if (error instanceof Error) {
        description = error.message;
        }

        toast({
            variant: 'destructive',
            title: 'Registrazione fallita',
            description,
        });
    } finally {
        setIsRegistering(false);
    }
  }

  async function handleCompanyVisuraChange(file: File | null) {
    setCompanyVisuraFile(file);
    const clearExtractedFields = () => {
      registrationForm.setValue('companyName', '', { shouldDirty: true, shouldValidate: true });
      registrationForm.setValue('companyLegalAddress', '', { shouldDirty: true, shouldValidate: true });
      registrationForm.setValue('companyVatNumber', '', { shouldDirty: true, shouldValidate: true });
    };

    if (!file) {
      clearExtractedFields();
      return;
    }

    clearExtractedFields();
    if (file.size <= 0 || file.size > MAX_COMPANY_VISURA_SIZE_MB * 1024 * 1024
      || !file.name.toLowerCase().endsWith('.pdf')
      || (file.type && file.type.toLowerCase() !== 'application/pdf')) {
      setCompanyVisuraFile(null);
      if (companyVisuraInputRef.current) companyVisuraInputRef.current.value = '';
      toast({ variant: 'destructive', title: 'Visura non valida', description: `Carica un PDF fino a ${MAX_COMPANY_VISURA_SIZE_MB} MB.` });
      return;
    }

    setIsExtractingVisura(true);
    try {
      const identity = await readVisuraCompanyIdentity(file);
      if (identity.companyName) {
        registrationForm.setValue('companyName', identity.companyName, { shouldDirty: true, shouldValidate: true });
      }
      if (identity.legalAddress) {
        registrationForm.setValue('companyLegalAddress', identity.legalAddress, { shouldDirty: true, shouldValidate: true });
      }
      if (identity.vatNumber) {
        registrationForm.setValue('companyVatNumber', identity.vatNumber, { shouldDirty: true, shouldValidate: true });
      }

      const extractedCount = Number(Boolean(identity.companyName)) + Number(Boolean(identity.legalAddress)) + Number(Boolean(identity.vatNumber));
      toast({
        title: extractedCount === 3 ? 'Dati rilevati dalla visura' : 'Visura letta parzialmente',
        description: extractedCount > 0
          ? 'Controlla ragione sociale, sede e P.IVA prima di registrare.'
          : 'Il PDF potrebbe essere una scansione. Compila i dati aziendali manualmente.',
      });
    } catch (error) {
      console.error('Lettura della visura camerale non riuscita:', error);
      toast({
        variant: 'destructive',
        title: 'Visura non leggibile',
        description: 'Inserisci ragione sociale, sede legale e partita IVA manualmente.',
      });
    } finally {
      setIsExtractingVisura(false);
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordSeller || !currentUser || !isPlatformAdmin || isSavingPassword) return;
    setIsSavingPassword(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/seller-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sellerId: passwordSeller.id, password: newPassword }),
      });
      const result = await response.json().catch(() => null) as { emailSent?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(result?.error || 'PASSWORD_UPDATE_FAILED');
      if (!result?.emailSent) {
        toast({
          variant: 'destructive',
          title: 'Password aggiornata, email non inviata',
          description: 'Il cambio è stato salvato ma la mail non è partita. Verifica la configurazione email e riprova.',
        });
        return;
      }
      toast({ title: 'Password aggiornata', description: `La nuova password è stata inviata a ${passwordSeller.email}.` });
      setPasswordSeller(null);
      setNewPassword('');
      setShowPassword(false);
    } catch {
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile aggiornare la password. Riprova.' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!sellerToDelete || isDeleting) return;
    setIsDeleting(true);

    try {
      if (!currentUser) throw new Error('UNAUTHORIZED');
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/delete-seller', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ sellerId: sellerToDelete.id }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        throw new Error(result.error || 'SELLER_DELETE_FAILED');
      }

      toast({
        title: 'Venditore eliminato!',
        description: `Il venditore ${sellerToDelete.email} e il suo account Firebase sono stati eliminati.`,
      });
      setSellerToDelete(null);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'SELLER_DELETE_FAILED';
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: code === 'SELLER_PROFILE_DELETE_FAILED'
          ? 'Account di accesso eliminato, ma il profilo venditore non e stato rimosso. Riprova per completare la cancellazione.'
          : code === 'UNAUTHORIZED' || code === 'FORBIDDEN'
            ? 'Accesso non autorizzato. Accedi nuovamente come amministratore.'
            : code === 'PROTECTED_ACCOUNT'
              ? 'Non puoi eliminare l\'account amministratore.'
              : 'Impossibile eliminare il venditore e il suo account Firebase. Riprova.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSellerTypeChange = (sellerId: string, newType: string) => {
    if (!firestore) return;
    setIsUpdating(sellerId);

    const sellerDocRef = doc(firestore, 'seller', sellerId);
    const typeToSave = newType === 'standard' ? null : newType;

    updateDocumentNonBlocking(sellerDocRef, { sellerType: typeToSave })
      .then(() => {
        toast({ title: "Tipo di venditore aggiornato!" });
      })
      .catch((err) => {
        console.error(err);
        toast({ variant: 'destructive', title: "Errore", description: "Impossibile aggiornare il tipo di venditore." });
      })
      .finally(() => {
        setIsUpdating(null);
      });
  };

  const handlePhoneDraftChange = (sellerId: string, value: string) => {
    setPhoneDrafts(currentDrafts => ({
      ...currentDrafts,
      [sellerId]: value,
    }));
  };

  const handleNameDraftChange = (sellerId: string, value: string) => {
    setNameDrafts(currentDrafts => ({
      ...currentDrafts,
      [sellerId]: value,
    }));
  };

  const handleSavePhone = (seller: UserData) => {
    if (!firestore) return;

    const rawPhone = phoneDrafts[seller.id] ?? '';
    const normalizedPhone = rawPhone.trim();
    const currentPhone = (seller.phone || '').trim();

    if (normalizedPhone === currentPhone) {
      toast({
        title: 'Nessuna modifica',
        description: 'Il numero di telefono è invariato.',
      });
      return;
    }

    setIsUpdatingPhone(seller.id);
    const sellerDocRef = doc(firestore, 'seller', seller.id);

    updateDocumentNonBlocking(sellerDocRef, {
      phone: normalizedPhone.length > 0 ? normalizedPhone : null,
    })
      .then(() => {
        toast({
          title: 'Telefono aggiornato',
          description: `Numero di telefono salvato per ${seller.nome || seller.name || seller.email}.`,
        });
      })
      .catch(err => {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile aggiornare il numero di telefono.',
        });
      })
      .finally(() => {
        setIsUpdatingPhone(null);
      });
  };

  const handleSaveName = (seller: UserData) => {
    if (!firestore) return;

    const rawName = nameDrafts[seller.id] ?? '';
    const normalizedName = rawName.trim();
    const currentName = (seller.nome || seller.name || '').trim();

    if (!normalizedName) {
      toast({
        variant: 'destructive',
        title: 'Nome obbligatorio',
        description: 'Il nome completo non può essere vuoto.',
      });
      return;
    }

    if (normalizedName === currentName) {
      toast({
        title: 'Nessuna modifica',
        description: 'Il nome è invariato.',
      });
      return;
    }

    setIsUpdatingName(seller.id);
    const sellerDocRef = doc(firestore, 'seller', seller.id);

    updateDocumentNonBlocking(sellerDocRef, {
      nome: normalizedName,
      name: normalizedName,
    })
      .then(() => {
        toast({
          title: 'Nome aggiornato',
          description: `Nome completo aggiornato a ${normalizedName}.`,
        });
      })
      .catch(err => {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile aggiornare il nome completo.',
        });
      })
      .finally(() => {
        setIsUpdatingName(null);
      });
  };

  if (isRoleLoading || !isPlatformAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }


  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-headline">
            Gestione Venditori
          </h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Aggiungi Venditore
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-[576px] overflow-y-auto sm:max-w-[576px]">
                <DialogHeader>
                    <DialogTitle>Registra Nuovo Venditore</DialogTitle>
                    <DialogDescription>
                        Crea un nuovo account per un venditore. Verrà aggiunto alla lista e potrà accedere.
                    </DialogDescription>
                </DialogHeader>
                <Form {...registrationForm}>
                    <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <FormLabel htmlFor="seller-company-visura">Visura camerale *</FormLabel>
                      <Input
                        id="seller-company-visura"
                        ref={companyVisuraInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={event => void handleCompanyVisuraChange(event.target.files?.[0] ?? null)}
                        disabled={isRegistering || isExtractingVisura}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isExtractingVisura
                          ? 'Lettura della visura in corso...'
                          : companyVisuraFile?.name || `PDF fino a ${MAX_COMPANY_VISURA_SIZE_MB} MB`}
                      </p>
                    </div>
                    <FormField
                        control={registrationForm.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                            <Input placeholder="Mario Rossi" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={registrationForm.control}
                        name="email"
                        render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email di registrazione</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="nome@example.com" autoComplete="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={registrationForm.control}
                        name="phone"
                        render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefono</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="Es. +39 333 1234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        )}
                    />
                      <FormField
                        control={registrationForm.control}
                        name="companyName"
                        render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ragione sociale dalla visura</FormLabel>
                          <FormControl>
                            <Input placeholder="Verrà letta dalla visura" maxLength={120} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="companyLegalAddress"
                        render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sede legale</FormLabel>
                          <FormControl>
                            <Input placeholder="Indirizzo, CAP, Comune (Provincia)" maxLength={250} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        )}
                      />
                      <FormField
                        control={registrationForm.control}
                        name="companyVatNumber"
                        render={({ field }) => (
                        <FormItem>
                          <FormLabel>Partita IVA</FormLabel>
                          <FormControl>
                            <Input placeholder="Verrà letta dalla visura" maxLength={11} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        )}
                      />
                    <div className="space-y-2">
                      <FormLabel htmlFor="seller-company-type">Tipo seller</FormLabel>
                      <Input id="seller-company-type" value={registrationForm.watch('companyName')} placeholder="Uguale alla ragione sociale" readOnly />
                    </div>
                    <div className="space-y-2">
                      <FormLabel htmlFor="seller-company-logo">Logo aziendale (facoltativo)</FormLabel>
                      <Input
                        id="seller-company-logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={event => setCompanyLogoFile(event.target.files?.[0] ?? null)}
                      />
                      <p className="text-xs text-muted-foreground">PNG, JPG o WebP. Massimo 4 MB.</p>
                    </div>
                    <p className="text-xs text-muted-foreground">La password temporanea verrà generata e inviata all’email di registrazione.</p>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isRegistering || isExtractingVisura}>
                                Annulla
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isRegistering || isExtractingVisura || !companyVisuraFile}>
                            {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registra
                        </Button>
                    </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
          </Dialog>
        </div>

        {showRegistrationNotice && (
          <Alert className="mb-6 border-primary/30 bg-primary/5">
            <AlertTitle>Venditore creato correttamente</AlertTitle>
            <AlertDescription>
              Il nuovo utente è stato aggiunto all’elenco. Ora puoi modificare il tipo seller dalla colonna dedicata.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={sellerSearch}
              onChange={event => setSellerSearch(event.target.value)}
              placeholder="Cerca nome, email, telefono, azienda o tipo..."
              aria-label="Cerca venditori"
              className="pl-9"
            />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSellerTypeManagerOpen(true)}>
              <Tags className="mr-2 h-4 w-4" />
              Gestisci tipi seller
            </Button>
            <p className="text-sm text-muted-foreground">
              {visibleSellers.length} di {sellers?.length ?? 0} venditori
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[1320px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]" aria-sort={sellerSortKey === 'name' ? sellerSortDirection === 'asc' ? 'ascending' : 'descending' : 'none'}>
                  <Button type="button" variant="ghost" size="sm" className="h-auto px-1 font-semibold" onClick={() => sortSellersBy('name')}>
                    Venditore <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </TableHead>
                <TableHead className="w-[230px]">Telefono</TableHead>
                <TableHead className="w-[360px]" aria-sort={sellerSortKey === 'company' ? sellerSortDirection === 'asc' ? 'ascending' : 'descending' : 'none'}>
                  <Button type="button" variant="ghost" size="sm" className="h-auto px-1 font-semibold" onClick={() => sortSellersBy('company')}>
                    Azienda <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </TableHead>
                <TableHead className="w-[230px] px-2" aria-sort={sellerSortKey === 'type' ? sellerSortDirection === 'asc' ? 'ascending' : 'descending' : 'none'}>
                  <Button type="button" variant="ghost" size="sm" className="h-auto px-1 font-semibold" onClick={() => sortSellersBy('type')}>
                    Tipo seller <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </TableHead>
                <TableHead className="w-[140px] whitespace-nowrap" aria-sort={sellerSortKey === 'createdAt' ? sellerSortDirection === 'asc' ? 'ascending' : 'descending' : 'none'}>
                  <Button type="button" variant="ghost" size="sm" className="h-auto px-1 font-semibold" onClick={() => sortSellersBy('createdAt')}>
                    Aggiunto il <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </TableHead>
                <TableHead className="w-[100px] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-10 w-28" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && error && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                      Si è verificato un errore nel caricamento dei venditori.
                    </TableCell>
                  </TableRow>
              )}
              {!isLoading && !error && visibleSellers.length > 0 ? (
                visibleSellers.map(seller => (
                  <TableRow key={seller.id}>
                    <TableCell>
                      <div className="min-w-[220px] space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            aria-label={`Modifica nome per ${seller.email}`}
                            placeholder="Nome completo"
                            value={nameDrafts[seller.id] ?? ''}
                            onChange={event => handleNameDraftChange(seller.id, event.target.value)}
                            disabled={isUpdatingName === seller.id}
                            className="h-9"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={`Salva nome per ${seller.email}`}
                            title="Salva nome"
                            onClick={() => handleSaveName(seller)}
                            disabled={isUpdatingName === seller.id}
                          >
                            {isUpdatingName === seller.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{seller.email || '(Email non specificata)'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[180px] items-center gap-2">
                        <Input
                          type="tel"
                          placeholder="Inserisci telefono"
                          value={phoneDrafts[seller.id] ?? ''}
                          onChange={event => handlePhoneDraftChange(seller.id, event.target.value)}
                          disabled={isUpdatingPhone === seller.id}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Salva telefono per ${seller.email}`}
                          title="Salva telefono"
                          onClick={() => handleSavePhone(seller)}
                          disabled={isUpdatingPhone === seller.id}
                        >
                          {isUpdatingPhone === seller.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[240px] items-center gap-1">
                        {seller.companyLogoUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 p-1"
                            title={`Visualizza logo ${seller.companyName || 'azienda'}`}
                            aria-label={`Visualizza logo ${seller.companyName || 'azienda'}`}
                            onClick={() => setLogoPreviewSeller(seller)}
                          >
                            <Image src={seller.companyLogoUrl} alt="" width={32} height={32} unoptimized className="h-8 w-8 object-contain" />
                          </Button>
                        ) : (
                          <>
                            <input
                              ref={element => { logoInputRefs.current[seller.id] = element; }}
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              aria-label={`Seleziona logo per ${seller.companyName || seller.nome || seller.email}`}
                              onChange={event => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (file) void handleCompanyLogoUpload(seller, file);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0 px-1.5 text-xs"
                              title="Carica logo aziendale"
                              aria-label={`Carica logo per ${seller.companyName || seller.nome || seller.email}`}
                              onClick={() => logoInputRefs.current[seller.id]?.click()}
                              disabled={isUploadingLogoSellerId === seller.id}
                            >
                              {isUploadingLogoSellerId === seller.id
                                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                : <Upload className="mr-1 h-4 w-4" />}
                              Logo
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 gap-1 px-1.5 text-xs"
                          title="Apri anagrafica seller"
                          aria-label={`Apri anagrafica seller per ${seller.companyName || seller.nome || seller.email}`}
                          onClick={() => {
                            setCompanyDetailsSeller(seller);
                            setCompanyDetailsDraft({
                              fullName: nameDrafts[seller.id] ?? seller.nome ?? seller.name ?? '',
                              phone: phoneDrafts[seller.id] ?? seller.phone ?? '',
                              companyName: seller.companyName || '',
                              legalAddress: seller.companyLegalAddress || '',
                              vatNumber: seller.companyVatNumber || '',
                            });
                            setCompanyDetailsLogoFile(null);
                            setCompanyDetailsVisuraFile(null);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          <span>Anagrafica</span>
                        </Button>
                        {seller.companyVisuraStoragePath ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            title="Scarica visura camerale"
                            aria-label={`Scarica visura per ${seller.companyName || seller.nome || seller.email}`}
                            onClick={() => void handleCompanyVisuraDownload(seller)}
                            disabled={isDownloadingVisuraSellerId === seller.id}
                          >
                            {isDownloadingVisuraSellerId === seller.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                          </Button>
                        ) : null}
                        <span className="max-w-[130px] truncate" title={seller.companyName || undefined}>{seller.companyName || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2">
                        {isUpdating === seller.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Select
                                value={normalizeSellerTypeId(seller.sellerType)}
                                onValueChange={(value: string) => handleSellerTypeChange(seller.id, value)}
                                disabled={isUpdating === seller.id}
                            >
                              <SelectTrigger
                                className="w-full min-w-0 px-2"
                                title={getSellerTypeOptionLabel(seller.sellerType, sellerTypeOptionsForSelect)}
                              >
                                    <SelectValue placeholder="Seleziona tipo" className="min-w-0 flex-1 text-left">
                                      <span className="block truncate text-left">
                                        {getSellerTypeOptionLabel(seller.sellerType, sellerTypeOptionsForSelect)}
                                      </span>
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {sellerTypeOptionsForSelect.map(type => (
                                    <SelectItem key={type.id} value={type.id}>{formatSellerTypeName(type.name)}</SelectItem>
                                  ))}
                                </SelectContent>
                            </Select>
                        )}
                    </TableCell>
                      <TableCell className="whitespace-nowrap">{formatSellerCreatedAt(seller.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {isPlatformAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Imposta nuova password" aria-label={`Imposta nuova password per ${seller.email}`} onClick={() => setPasswordSeller(seller)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Elimina seller"
                        aria-label={`Elimina seller ${seller.email}`}
                        onClick={() => setSellerToDelete(seller)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && !error && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {sellerSearch.trim() ? 'Nessun venditore corrisponde alla ricerca.' : 'Nessun venditore trovato.'}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog open={isSellerTypeManagerOpen} onOpenChange={open => {
        if (!isDeletingSellerTypeId) setIsSellerTypeManagerOpen(open);
      }}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestisci tipi seller</DialogTitle>
            <DialogDescription>
              Puoi eliminare i tipi non assegnati. Per un doppione in uso, sposta prima i seller sul tipo omonimo da mantenere.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y">
            {managedSellerTypes.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Non ci sono tipi personalizzati da gestire.</p>
            ) : managedSellerTypes.map(type => {
              const assignedCount = getSellerTypeUsageCount(type.id);
              const duplicateTypes = getSameNameSellerTypes(type);
              const replacementId = sellerTypeReplacementDrafts[type.id] || '';

              return (
                <div key={type.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_250px_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{formatSellerTypeName(type.name)}</p>
                    <p className="truncate text-xs text-muted-foreground">ID: {type.id} · {assignedCount} seller assegnati</p>
                  </div>
                  {assignedCount > 0 && duplicateTypes.length > 0 ? (
                    <Select
                      value={replacementId}
                      onValueChange={value => setSellerTypeReplacementDrafts(current => ({ ...current, [type.id]: value }))}
                      disabled={isDeletingSellerTypeId === type.id}
                    >
                      <SelectTrigger aria-label={`Tipo duplicato da mantenere per ${formatSellerTypeName(type.name)}`}>
                        <SelectValue placeholder="Sposta sul tipo omonimo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {duplicateTypes.map(duplicate => (
                          <SelectItem key={duplicate.id} value={duplicate.id}>
                            {formatSellerTypeName(duplicate.name)} · {duplicate.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : assignedCount > 0 ? (
                    <p className="text-xs text-muted-foreground">In uso: modifica il tipo dei seller prima di eliminarlo.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Non assegnato</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setSellerTypeToDelete(type)}
                    disabled={isDeletingSellerTypeId === type.id || (assignedCount > 0 && (!duplicateTypes.length || !replacementId))}
                  >
                    {isDeletingSellerTypeId === type.id
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Trash2 className="mr-2 h-4 w-4" />}
                    Elimina
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(sellerTypeToDelete)} onOpenChange={open => {
        if (!open && !isDeletingSellerTypeId) setSellerTypeToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo tipo seller?</AlertDialogTitle>
            <AlertDialogDescription>
              {sellerTypeToDelete && getSellerTypeUsageCount(sellerTypeToDelete.id) > 0
                ? `${getSellerTypeUsageCount(sellerTypeToDelete.id)} seller verranno riassegnati al tipo omonimo selezionato.`
                : `Il tipo ${formatSellerTypeName(sellerTypeToDelete?.name)} verrà eliminato. Questa azione non può essere annullata.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(isDeletingSellerTypeId)}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                void handleConfirmSellerTypeDelete();
              }}
              disabled={Boolean(isDeletingSellerTypeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Conferma eliminazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(companyDetailsSeller)} onOpenChange={open => {
        if (!open && !isSavingCompanyDetails) {
          setCompanyDetailsSeller(null);
          setCompanyDetailsLogoFile(null);
          setCompanyDetailsVisuraFile(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[576px] overflow-y-auto sm:max-w-[576px]">
          <DialogHeader>
            <DialogTitle>Anagrafica seller</DialogTitle>
            <DialogDescription>
              Modifica i dati del seller e aggiorna ragione sociale e tipo dalla visura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="seller-company-logo-update" className="text-sm font-medium">Logo aziendale</label>
              <div className="flex items-center gap-4">
                {companyDetailsLogoPreviewUrl || companyDetailsSeller?.companyLogoUrl ? (
                  <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white p-2">
                    <img
                      src={companyDetailsLogoPreviewUrl || companyDetailsSeller?.companyLogoUrl || ''}
                      alt={`Logo ${companyDetailsSeller?.companyName || 'azienda'}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                    Nessun logo
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    id="seller-company-logo-update"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={event => {
                      const file = event.target.files?.[0] ?? null;
                      if (!handleCompanyDetailsLogoChange(file)) event.target.value = '';
                    }}
                    disabled={isSavingCompanyDetails}
                  />
                  <p className="text-xs text-muted-foreground">
                    {companyDetailsLogoFile?.name || 'PNG, JPG o WebP, massimo 4 MB.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="seller-profile-name" className="text-sm font-medium">Nome completo</label>
                <Input
                  id="seller-profile-name"
                  value={companyDetailsDraft.fullName}
                  maxLength={120}
                  onChange={event => setCompanyDetailsDraft(current => ({ ...current, fullName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="seller-profile-email" className="text-sm font-medium">Email di accesso</label>
                <Input id="seller-profile-email" type="email" value={companyDetailsSeller?.email || ''} readOnly />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="seller-profile-phone" className="text-sm font-medium">Telefono</label>
              <Input
                id="seller-profile-phone"
                type="tel"
                value={companyDetailsDraft.phone}
                maxLength={40}
                onChange={event => setCompanyDetailsDraft(current => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="seller-company-name-update" className="text-sm font-medium">Ragione sociale</label>
              <Input
                id="seller-company-name-update"
                value={companyDetailsDraft.companyName}
                maxLength={120}
                onChange={event => setCompanyDetailsDraft(current => ({ ...current, companyName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="seller-company-legal-address" className="text-sm font-medium">Sede legale</label>
              <Input
                id="seller-company-legal-address"
                value={companyDetailsDraft.legalAddress}
                maxLength={250}
                onChange={event => setCompanyDetailsDraft(current => ({ ...current, legalAddress: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="seller-company-vat-number" className="text-sm font-medium">Partita IVA</label>
              <Input
                id="seller-company-vat-number"
                value={companyDetailsDraft.vatNumber}
                maxLength={32}
                onChange={event => setCompanyDetailsDraft(current => ({ ...current, vatNumber: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="seller-company-type-update" className="text-sm font-medium">Tipo seller</label>
              <Input id="seller-company-type-update" value={companyDetailsDraft.companyName} readOnly />
              <p className="text-xs text-muted-foreground">Viene aggiornato automaticamente con la ragione sociale.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="seller-company-visura-update" className="text-sm font-medium">Visura camerale (PDF)</label>
              <Input
                id="seller-company-visura-update"
                type="file"
                accept="application/pdf,.pdf"
                onChange={event => void handleExistingSellerVisuraChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {isExtractingExistingVisura
                  ? 'Lettura del PDF in corso...'
                  : companyDetailsVisuraFile?.name
                    || companyDetailsSeller?.companyVisuraFileName
                    || `PDF fino a ${MAX_COMPANY_VISURA_SIZE_MB} MB. I campi riconosciuti vengono precompilati.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompanyDetailsSeller(null)} disabled={isSavingCompanyDetails}>
              Annulla
            </Button>
            <Button type="button" onClick={() => void handleSaveCompanyDetails()} disabled={isSavingCompanyDetails || isExtractingExistingVisura}>
              {isSavingCompanyDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva dati
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(logoPreviewSeller)} onOpenChange={open => !open && setLogoPreviewSeller(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Logo aziendale</DialogTitle>
            <DialogDescription>{logoPreviewSeller?.companyName || logoPreviewSeller?.nome || logoPreviewSeller?.email}</DialogDescription>
          </DialogHeader>
          {logoPreviewSeller?.companyLogoUrl ? (
            <div className="relative mx-auto h-[65vh] min-h-[260px] w-full overflow-hidden rounded-md border bg-white">
              <Image
                src={logoPreviewSeller.companyLogoUrl}
                alt={`Logo ${logoPreviewSeller.companyName || 'azienda'}`}
                fill
                sizes="(max-width: 768px) 95vw, 800px"
                unoptimized
                className="object-contain p-4"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(passwordSeller)} onOpenChange={open => {
        if (!open && !isSavingPassword) {
          setPasswordSeller(null);
          setNewPassword('');
          setShowPassword(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Imposta nuova password</DialogTitle>
            <DialogDescription>{passwordSeller?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <label htmlFor="seller-new-password" className="block text-sm font-medium">Nuova password</label>
            <div className="flex gap-2">
              <Input id="seller-new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={128} required value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={isSavingPassword} />
              <Button type="button" size="icon" variant="outline" title={showPassword ? 'Nascondi password' : 'Mostra password'} aria-label={showPassword ? 'Nascondi password' : 'Mostra password'} onClick={() => setShowPassword(previous => !previous)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSavingPassword}>{isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva password</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!sellerToDelete}
        onOpenChange={open => !open && !isDeleting && setSellerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Eliminerà il profilo
              venditore e il suo account Firebase Authentication, impedendo
              ulteriori accessi. Contratti, clienti e annunci non verranno eliminati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminazione...' : 'Conferma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
