'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, deleteDoc, deleteField, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, listAll, ref, uploadBytesResumable, getBytes } from 'firebase/storage';
import type { StorageReference } from 'firebase/storage';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  Edit2,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Scissors,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc, useFirebaseApp, useFirestore, useMemoFirebase, useUser, useUserRole } from '@/firebase';
import type { Contract, Vehicle, VehicleDocument, VehicleDocumentFolder } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { canPreviewDocumentFile, DocumentPreviewContent, getDocumentProxyUrl } from '@/components/document-preview-content';
import { VehicleDamageSheetPrintButton } from '@/components/vehicle-damage-sheet-print-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const FOLDERS_SUBCOLLECTION = 'documentFolders';
const DOCUMENTS_SUBCOLLECTION = 'documents';
const SIGNED_CONTRACT_FOLDER_ID = 'contratti';
const SIGNED_CONTRACT_FOLDER_NAME = 'Contratti';

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDocumentDate(value: any) {
  if (!value) return 'Data non disponibile';
  if (typeof value?.toDate === 'function') {
    return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(value.toDate());
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data non disponibile';
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function formatFileSize(sizeBytes?: number | null) {
  if (!sizeBytes || sizeBytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1; }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getDocumentTimestamp(value: any) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getFileExtension(fileName?: string | null) {
  if (!fileName || !fileName.includes('.')) return '';
  return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

function isPdfFileValue(value?: string | null) {
  if (!value) return false;

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  if (normalizedValue.endsWith('.pdf')) {
    return true;
  }

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith('.pdf')) {
      return true;
    }

    const objectPath = decodeURIComponent(pathname);
    return objectPath.endsWith('.pdf');
  } catch {
    return false;
  }
}

function getLegacyPeriziaAsset(vehicle?: Vehicle | null) {
  const candidates = (vehicle?.mediaAssets ?? [])
    .filter(asset => Boolean(asset.url) || Boolean(asset.storagePath))
    .filter(asset => {
      const hasPdfFile = isPdfFileValue(asset.storagePath) || isPdfFileValue(asset.url);
      const hasPeriziaText = isPeriziaLikeText(asset.label) || isPeriziaLikeText(asset.url) || isPeriziaLikeText(asset.storagePath);

      return !isImageLikeAsset(asset) && (hasPdfFile || hasPeriziaText);
    })
    .sort((left, right) => {
      const leftScore = Number(isPdfFileValue(left.storagePath) || isPdfFileValue(left.url)) * 2
        + Number(isPeriziaLikeText(left.label) || isPeriziaLikeText(left.url) || isPeriziaLikeText(left.storagePath));
      const rightScore = Number(isPdfFileValue(right.storagePath) || isPdfFileValue(right.url)) * 2
        + Number(isPeriziaLikeText(right.label) || isPeriziaLikeText(right.url) || isPeriziaLikeText(right.storagePath));

      return rightScore - leftScore;
    });

  return candidates[0] ?? null;
}

function getFileNameFromPathLike(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.split('?')[0].split('#')[0];
  const segments = normalizedValue.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';

  try {
    const decodedSegment = decodeURIComponent(lastSegment);
    const decodedSegments = decodedSegment.split('/').filter(Boolean);
    return decodedSegments[decodedSegments.length - 1] || decodedSegment || null;
  } catch {
    return lastSegment || null;
  }
}

function inferContentTypeFromFileName(fileName?: string | null) {
  const normalizedFileName = fileName?.toLowerCase() ?? '';
  if (normalizedFileName.endsWith('.pdf')) return 'application/pdf';
  if (normalizedFileName.endsWith('.png')) return 'image/png';
  if (normalizedFileName.endsWith('.jpg') || normalizedFileName.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedFileName.endsWith('.webp')) return 'image/webp';
  return null;
}

function inferAssetContentType(asset: {
  url?: string | null;
  storagePath?: string | null;
}) {
  return inferContentTypeFromFileName(getFileNameFromPathLike(asset.storagePath))
    || inferContentTypeFromFileName(getFileNameFromPathLike(asset.url));
}

function isImageLikeAsset(asset: {
  url?: string | null;
  storagePath?: string | null;
}) {
  return inferAssetContentType(asset)?.startsWith('image/') ?? false;
}

function buildStorageSourceUrl(storagePath?: string | null) {
  const normalizedPath = storagePath?.trim();
  if (!normalizedPath) {
    return null;
  }

  return `gs://studio-3074982188-44660.firebasestorage.app/${normalizedPath}`;
}

function getPeriziaUrlFromPerformance(vehicleId: string) {
  if (typeof performance === 'undefined') {
    return null;
  }

  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const normalizedVehicleId = vehicleId.toLowerCase();
  const encodedPerizieSegment = `perizie%2f${normalizedVehicleId}%2f`;
  const encodedDownloadSegment = `download%2f${normalizedVehicleId}%2f`;
  const match = entries.find(entry => {
    const url = entry.name.toLowerCase();
    return (
      url.includes(`/perizie/${normalizedVehicleId}/`)
      || url.includes(`/download/${normalizedVehicleId}/`)
      || url.includes(encodedPerizieSegment)
      || url.includes(encodedDownloadSegment)
    ) && (url.endsWith('.pdf') || url.includes('.pdf?') || url.includes('alt=media'));
  });

  return match?.name ?? null;
}

function isDocumentLikeMediaAsset(asset: {
  category?: string | null;
  label?: string | null;
  url?: string | null;
  storagePath?: string | null;
}) {
  const documentCategories = new Set(['dettaglio-danni', 'libretto', 'kilometri']);
  if (asset.category && documentCategories.has(asset.category)) {
    return true;
  }

  const normalizedText = [asset.label, asset.url, asset.storagePath]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!normalizedText) {
    return false;
  }

  return (
    normalizedText.includes('perizia')
    || normalizedText.includes('danni')
    || normalizedText.includes('libretto')
    || normalizedText.includes('document')
    || normalizedText.includes('riconsegna')
    || normalizedText.includes('verbale')
  );
}

function isPeriziaLikeText(value?: string | null) {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  return (
    normalizedValue.includes('perizia')
    || normalizedValue.includes('danni')
    || normalizedValue.includes('riconsegna')
    || normalizedValue.includes('verbale')
  );
}

function isPeriziaMediaAsset(asset: {
  category?: string | null;
  label?: string | null;
  url?: string | null;
  storagePath?: string | null;
}) {
  return Boolean(
    isPdfFileValue(asset.storagePath)
    || isPdfFileValue(asset.url)
    || isPeriziaLikeText(asset.label)
    || isPeriziaLikeText(asset.url)
    || isPeriziaLikeText(asset.storagePath)
  );
}

function getDocumentationBucket(document: Pick<VehicleDocument, 'title' | 'titleKey' | 'fileName' | 'fileUrl' | 'storagePath'>) {
  const normalizedText = [document.title, document.fileName, document.fileUrl, document.storagePath]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!normalizedText) {
    return null;
  }

  if (
    document.titleKey === 'linked-perizia-file'
    || document.titleKey === 'linked-perizia-loading'
    || normalizedText.includes('perizia')
    || normalizedText.includes('verbale')
    || normalizedText.includes('danni')
  ) {
    return 'perizia' as const;
  }

  if (normalizedText.includes('libretto')) {
    return 'libretto' as const;
  }

  if (normalizedText.includes('km') || normalizedText.includes('chilometri') || normalizedText.includes('kilometri')) {
    return 'kilometri' as const;
  }

  return null;
}

function buildLinkedMediaTitle(asset: {
  category?: string | null;
  label?: string | null;
  url?: string | null;
  storagePath?: string | null;
}, index: number) {
  const explicitLabel = asset.label?.trim();
  if (explicitLabel) {
    return explicitLabel;
  }

  const normalizedText = [asset.category, asset.url, asset.storagePath]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (asset.category === 'libretto' || normalizedText.includes('libretto')) {
    return `Libretto - foto ${index + 1}`;
  }

  if (asset.category === 'kilometri' || normalizedText.includes('kilometri') || normalizedText.includes('chilometri') || normalizedText.includes('km')) {
    return `Chilometraggio - foto ${index + 1}`;
  }

  return asset.category || `Documento allegato ${index + 1}`;
}

function getDocumentIcon(document: VehicleDocument) {
  const extension = getFileExtension(document.fileName);
  const contentType = document.contentType?.toLowerCase() ?? '';
  if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension))
    return <FileImage className="h-4 w-4 shrink-0 text-sky-500" />;
  if (contentType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi'].includes(extension))
    return <FileVideo className="h-4 w-4 shrink-0 text-violet-500" />;
  if (contentType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension))
    return <FileAudio className="h-4 w-4 shrink-0 text-fuchsia-500" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension))
    return <FileArchive className="h-4 w-4 shrink-0 text-amber-600" />;
  if (['xls', 'xlsx', 'csv'].includes(extension))
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (['json', 'xml', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'md'].includes(extension))
    return <FileCode className="h-4 w-4 shrink-0 text-indigo-500" />;
  return <FileText className="h-4 w-4 shrink-0 text-primary" />;
}

type DocumentSortKey = 'title' | 'updatedAt' | 'sizeBytes';

type FolderListItem = VehicleDocumentFolder & { depth: number; pathLabel: string };

interface VehicleDocumentsSectionProps {
  vehicleId: string;
  vehicleLabel?: string;
  vehicle?: Vehicle | null;
  linkedPeriziaUrl?: string | null;
  documentationMode?: 'all' | 'relevant-only';
}

export function VehicleDocumentsSection({ vehicleId, vehicleLabel, vehicle: vehicleProp, linkedPeriziaUrl: forcedPeriziaUrl, documentationMode = 'all' }: VehicleDocumentsSectionProps) {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const { user } = useUser();
  const { role, roleData } = useUserRole();
  const { toast } = useToast();
  const storage = useMemo(() => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'), [app]);
  const [resolvedDocumentUrls, setResolvedDocumentUrls] = useState<Record<string, string>>({});
  const [storageFallbackDocuments, setStorageFallbackDocuments] = useState<VehicleDocument[]>([]);

  const isAdmin = role === 'admin';
  const normalizedSellerType = (roleData?.sellerType ?? '').trim().toUpperCase();
  const isHubSeller = role === 'seller' && normalizedSellerType === 'HUB';
  const canViewPerizia = isAdmin || role === 'seller';
  const canAccess = isAdmin || isHubSeller;

  const vehicleDocRef = useMemoFirebase(
    () => (firestore && vehicleId ? doc(firestore, 'vehicles', vehicleId) : null),
    [firestore, vehicleId]
  );
  const contractDocRef = useMemoFirebase(
    () => (firestore && vehicleId && canAccess ? doc(firestore, 'contracts', vehicleId) : null),
    [firestore, vehicleId, canAccess]
  );
  const foldersRef = useMemoFirebase(
    () => (vehicleDocRef && canAccess ? collection(vehicleDocRef, FOLDERS_SUBCOLLECTION) : null),
    [vehicleDocRef, canAccess]
  );
  const documentsRef = useMemoFirebase(
    () => (vehicleDocRef && canAccess ? collection(vehicleDocRef, DOCUMENTS_SUBCOLLECTION) : null),
    [vehicleDocRef, canAccess]
  );

  const { data: documents, isLoading: isLoadingDocuments, error: documentsError } =
    useCollection<VehicleDocument>(documentsRef);
  const { data: folders } = useCollection<VehicleDocumentFolder>(foldersRef);
  const { data: fetchedVehicleData } = useDoc<Vehicle>(vehicleDocRef);
  const { data: contractData } = useDoc<Contract>(contractDocRef);
  const vehicleData = vehicleProp ?? fetchedVehicleData;

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string>('none');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [directoryFiles, setDirectoryFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isImportingDirectory, setIsImportingDirectory] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [showNewSubfolderInput, setShowNewSubfolderInput] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [previewDocument, setPreviewDocument] = useState<VehicleDocument | null>(null);
  const [savingSpreadsheetDocumentId, setSavingSpreadsheetDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [folderSearch, setFolderSearch] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [documentSortKey, setDocumentSortKey] = useState<DocumentSortKey>('updatedAt');
  const [documentSortDirection, setDocumentSortDirection] = useState<'asc' | 'desc'>('desc');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [renameDocumentValue, setRenameDocumentValue] = useState('');
  const [clipboardFolderId, setClipboardFolderId] = useState<string | null>(null);
  const [clipboardAction, setClipboardAction] = useState<'copy' | 'cut' | null>(null);
  const [deletingFolderConfirm, setDeletingFolderConfirm] = useState<VehicleDocumentFolder | null>(null);
  const [linkedPeriziaUrl, setLinkedPeriziaUrl] = useState<string | null>(null);
  const [isResolvingLinkedPerizia, setIsResolvingLinkedPerizia] = useState(false);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const legacyPeriziaAsset = useMemo(() => getLegacyPeriziaAsset(vehicleData), [vehicleData]);
  const explicitPeriziaPdfName = vehicleData?.periziaPdfName || null;
  const explicitPeriziaPdfStoragePath = vehicleData?.periziaPdfStoragePath || null;
  const explicitPeriziaPdfUrl = vehicleData?.periziaPdfUrl || null;
  const hasExplicitPdfName = inferContentTypeFromFileName(explicitPeriziaPdfName) === 'application/pdf';
  const periziaPdfStoragePath =
    (explicitPeriziaPdfStoragePath && (isPdfFileValue(explicitPeriziaPdfStoragePath) || hasExplicitPdfName)
      ? explicitPeriziaPdfStoragePath
      : null)
    || legacyPeriziaAsset?.storagePath
    || null;
  const periziaPdfLegacyUrl =
    (explicitPeriziaPdfUrl && (isPdfFileValue(explicitPeriziaPdfUrl) || hasExplicitPdfName)
      ? explicitPeriziaPdfUrl
      : null)
    || legacyPeriziaAsset?.url
    || null;
  const periziaPdfName =
    explicitPeriziaPdfName
    || getFileNameFromPathLike(periziaPdfStoragePath)
    || getFileNameFromPathLike(periziaPdfLegacyUrl)
    || getFileNameFromPathLike(forcedPeriziaUrl)
    || 'perizia-riconsegna.pdf';
  const logPeriziaResolution = (source: string, resolvedUrl: string | null) => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const sanitizedUrl = resolvedUrl ? resolvedUrl.split('?')[0] : null;
    console.info('[perizia][documents-section]', {
      vehicleId,
      numeroRiferimento: vehicleData?.numeroRiferimento ?? null,
      source,
      hasUrl: Boolean(resolvedUrl),
      url: sanitizedUrl,
    });
  };

  useEffect(() => {
    let cancelled = false;

    const parseDateLikeValue = (value: unknown): Date | null => {
      if (!value) {
        return null;
      }

      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }

        const italianDateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (italianDateMatch) {
          const [, day, month, year] = italianDateMatch;
          const parsedItalianDate = new Date(Number(year), Number(month) - 1, Number(day));
          return Number.isNaN(parsedItalianDate.getTime()) ? null : parsedItalianDate;
        }

        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (typeof value === 'object' && value !== null && 'toDate' in value) {
        const maybeTimestamp = value as { toDate?: () => Date };
        if (typeof maybeTimestamp.toDate === 'function') {
          const parsed = maybeTimestamp.toDate();
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
      }

      return null;
    };

    const buildPeriziaFolderCandidates = () => {
      const candidates = new Set<string>();
      if (vehicleId) {
        candidates.add(vehicleId);
      }

      if (typeof vehicleData?.numeroRiferimento === 'number') {
        const addedAt =
          parseDateLikeValue(vehicleData.createdAt)
          ?? parseDateLikeValue(vehicleData.data_inserimento);

        if (addedAt) {
          const dayMonthSuffix = `${String(addedAt.getDate()).padStart(2, '0')}${String(addedAt.getMonth() + 1).padStart(2, '0')}`;
          candidates.add(`${vehicleData.numeroRiferimento}-${dayMonthSuffix}`);
        }

        candidates.add(String(vehicleData.numeroRiferimento));
      }

      return [...candidates].filter(Boolean);
    };

    if (!canViewPerizia) {
      setLinkedPeriziaUrl(null);
      setIsResolvingLinkedPerizia(false);
      logPeriziaResolution('access-denied', null);
      return () => {
        cancelled = true;
      };
    }

    if (forcedPeriziaUrl) {
      setLinkedPeriziaUrl(forcedPeriziaUrl);
      setIsResolvingLinkedPerizia(false);
      logPeriziaResolution('forced-url', forcedPeriziaUrl);
      return () => {
        cancelled = true;
      };
    }

    const pickLikelyPeriziaRef = (items: StorageReference[]) => {
      const pdfByName = items.find(item => item.name.toLowerCase().endsWith('.pdf'));
      if (pdfByName) {
        return pdfByName;
      }

      const periziaDocumentByName = items.find(item => {
        const fileName = item.name.toLowerCase();
        const isImageFile = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName);
        return !isImageFile && (fileName.includes('perizia') || fileName.includes('danni') || fileName.includes('riconsegna') || fileName.includes('verbale'));
      });

      if (periziaDocumentByName) {
        return periziaDocumentByName;
      }

      return null;
    };

    const resolvePeriziaFromFolder = async () => {
      const folderCandidates = buildPeriziaFolderCandidates();
      if (!folderCandidates.length) {
        if (!cancelled) {
          setLinkedPeriziaUrl(null);
          setIsResolvingLinkedPerizia(false);
        }
        return;
      }

      try {
        for (const folderCandidate of folderCandidates) {
          for (const baseFolder of ['perizie', 'download']) {
            try {
              const listing = await listAll(ref(storage, `${baseFolder}/${folderCandidate}`));
              const candidate = pickLikelyPeriziaRef(listing.items);
              if (!candidate) {
                continue;
              }

              const resolvedUrl = await getDownloadURL(candidate);
              if (!cancelled) {
                setLinkedPeriziaUrl(resolvedUrl);
                setIsResolvingLinkedPerizia(false);
                logPeriziaResolution(`folder:${baseFolder}/${folderCandidate}`, resolvedUrl);
              }
              return;
            } catch {
              // Continue searching on remaining candidates.
            }
          }
        }

        if (!cancelled) {
          setLinkedPeriziaUrl(null);
          setIsResolvingLinkedPerizia(false);
          logPeriziaResolution('folder:not-found', null);
        }
      } catch {
        if (!cancelled) {
          setLinkedPeriziaUrl(null);
          setIsResolvingLinkedPerizia(false);
          logPeriziaResolution('folder:error', null);
        }
      }
    };

    if (!periziaPdfStoragePath) {
      if (periziaPdfLegacyUrl) {
        setLinkedPeriziaUrl(periziaPdfLegacyUrl);
        setIsResolvingLinkedPerizia(false);
        logPeriziaResolution('legacy-url', periziaPdfLegacyUrl);
      } else {
        const performancePeriziaUrl = getPeriziaUrlFromPerformance(vehicleId);
        if (performancePeriziaUrl) {
          setLinkedPeriziaUrl(performancePeriziaUrl);
          setIsResolvingLinkedPerizia(false);
          logPeriziaResolution('performance-url', performancePeriziaUrl);
        } else {
          setIsResolvingLinkedPerizia(true);
          void resolvePeriziaFromFolder();
        }
      }
      return () => {
        cancelled = true;
      };
    }

    getDownloadURL(ref(storage, periziaPdfStoragePath))
      .then(resolvedUrl => {
        if (cancelled) {
          return;
        }

        setLinkedPeriziaUrl(resolvedUrl);
        setIsResolvingLinkedPerizia(false);
        logPeriziaResolution('storage-path', resolvedUrl);
      })
      .catch(() => {
        if (!cancelled) {
          if (periziaPdfLegacyUrl) {
            setLinkedPeriziaUrl(periziaPdfLegacyUrl);
            setIsResolvingLinkedPerizia(false);
            logPeriziaResolution('legacy-url-fallback', periziaPdfLegacyUrl);
          } else {
            const performancePeriziaUrl = getPeriziaUrlFromPerformance(vehicleId);
            if (performancePeriziaUrl) {
              setLinkedPeriziaUrl(performancePeriziaUrl);
              setIsResolvingLinkedPerizia(false);
              logPeriziaResolution('performance-url-fallback', performancePeriziaUrl);
            } else {
              setIsResolvingLinkedPerizia(true);
              void resolvePeriziaFromFolder();
            }
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canViewPerizia, forcedPeriziaUrl, periziaPdfStoragePath, periziaPdfLegacyUrl, storage, user?.uid, vehicleId, vehicleData?.numeroRiferimento, vehicleData?.createdAt, vehicleData?.data_inserimento]);

  const linkedPeriziaDocument = useMemo<VehicleDocument | null>(() => {
    if (!linkedPeriziaUrl) {
      return null;
    }

    const actualLinkedFileName =
      getFileNameFromPathLike(linkedPeriziaUrl)
      || getFileNameFromPathLike(periziaPdfStoragePath)
      || null;
    const expectedContentType = inferContentTypeFromFileName(periziaPdfName);
    const actualContentType = inferContentTypeFromFileName(actualLinkedFileName);
    const hasPdfNameMismatch =
      expectedContentType === 'application/pdf'
      && Boolean(actualContentType)
      && actualContentType !== 'application/pdf';
    const resolvedFileName = hasPdfNameMismatch
      ? (actualLinkedFileName || periziaPdfName)
      : periziaPdfName;
    const resolvedContentType = hasPdfNameMismatch
      ? actualContentType
      : (expectedContentType || actualContentType);

    return {
      id: `linked-perizia-${vehicleId}`,
      title: 'Perizia riconsegna',
      titleKey: 'linked-perizia-file',
      fileName: resolvedFileName,
      fileUrl: linkedPeriziaUrl,
      storagePath: periziaPdfStoragePath || '',
      contentType: resolvedContentType,
      sizeBytes: null,
      folderId: null,
      createdAt: vehicleData?.createdAt,
      updatedAt: vehicleData?.updatedAt,
      uploadedByUid: null,
      uploadedByEmail: null,
    };
  }, [linkedPeriziaUrl, periziaPdfName, periziaPdfStoragePath, vehicleData?.createdAt, vehicleData?.updatedAt, vehicleId]);

  const linkedPeriziaLoadingDocument = useMemo<VehicleDocument | null>(() => {
    if (!isResolvingLinkedPerizia || linkedPeriziaUrl) {
      return null;
    }

    return {
      id: `linked-perizia-loading-${vehicleId}`,
      title: 'Perizia riconsegna (in caricamento...)',
      titleKey: 'linked-perizia-loading',
      fileName: periziaPdfName,
      fileUrl: '',
      storagePath: '',
      contentType: inferContentTypeFromFileName(periziaPdfName),
      sizeBytes: null,
      folderId: null,
      createdAt: vehicleData?.createdAt,
      updatedAt: vehicleData?.updatedAt,
      uploadedByUid: null,
      uploadedByEmail: null,
    };
  }, [isResolvingLinkedPerizia, linkedPeriziaUrl, periziaPdfName, vehicleData?.createdAt, vehicleData?.updatedAt, vehicleId]);

  const linkedMediaDocuments = useMemo<VehicleDocument[]>(() => {
    const candidates = (vehicleData?.mediaAssets ?? [])
      .filter(asset => Boolean(asset.url) && isDocumentLikeMediaAsset(asset) && !isPeriziaMediaAsset(asset));

    return candidates.map((asset, index) => {
      const inferredFileName =
        getFileNameFromPathLike(asset.storagePath)
        || getFileNameFromPathLike(asset.url)
        || `${asset.category || 'documento'}-${index + 1}`;

      return {
        id: `linked-media-${vehicleId}-${index}`,
        title: buildLinkedMediaTitle(asset, index),
        titleKey: 'linked-media-asset',
        fileName: inferredFileName,
        fileUrl: asset.url,
        storagePath: asset.storagePath || '',
        contentType: inferContentTypeFromFileName(inferredFileName),
        sizeBytes: null,
        folderId: null,
        createdAt: vehicleData?.createdAt,
        updatedAt: vehicleData?.updatedAt,
        uploadedByUid: null,
        uploadedByEmail: null,
      };
    });
  }, [vehicleData?.mediaAssets, vehicleData?.createdAt, vehicleData?.updatedAt, vehicleId]);

  const linkedSignedContractDocument = useMemo<VehicleDocument | null>(() => {
    const signedContractUrl = contractData?.signedContractUrl?.trim() || '';
    const signedContractStoragePath = contractData?.signedContractStoragePath?.trim() || '';

    if (!signedContractUrl && !signedContractStoragePath) {
      return null;
    }

    const resolvedFileName =
      contractData?.signedContractName
      || getFileNameFromPathLike(signedContractStoragePath)
      || getFileNameFromPathLike(signedContractUrl)
      || 'contratto-firmato.pdf';
    const resolvedFileUrl = signedContractUrl || buildStorageSourceUrl(signedContractStoragePath) || '';

    return {
      id: `linked-signed-contract-${vehicleId}`,
      title: 'Contratto firmato',
      titleKey: 'linked-signed-contract',
      fileName: resolvedFileName,
      fileUrl: resolvedFileUrl,
      storagePath: signedContractStoragePath,
      contentType: 'application/pdf',
      sizeBytes: null,
      folderId: SIGNED_CONTRACT_FOLDER_ID,
      createdAt: contractData?.createdAt ?? vehicleData?.createdAt,
      updatedAt: contractData?.signedContractUploadedAt ?? contractData?.updatedAt ?? vehicleData?.updatedAt,
      uploadedByUid: contractData?.signedContractUploadedBy ?? null,
      uploadedByEmail: null,
    };
  }, [
    contractData?.createdAt,
    contractData?.signedContractName,
    contractData?.signedContractStoragePath,
    contractData?.signedContractUploadedAt,
    contractData?.signedContractUploadedBy,
    contractData?.signedContractUrl,
    contractData?.updatedAt,
    vehicleData?.createdAt,
    vehicleData?.updatedAt,
    vehicleId,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!canAccess || !vehicleId) {
      setStorageFallbackDocuments([]);
      return () => {
        cancelled = true;
      };
    }

    const walkStorageRefs = async (currentPath: string): Promise<Array<{ path: string; url: string }>> => {
      const listing = await listAll(ref(storage, currentPath));
      const currentItems = await Promise.all(
        listing.items.map(async itemRef => {
          try {
            const url = await getDownloadURL(itemRef);
            return { path: itemRef.fullPath, url };
          } catch {
            return null;
          }
        })
      );

      const nestedItems = await Promise.all(
        listing.prefixes.map(prefixRef => walkStorageRefs(prefixRef.fullPath))
      );

      const flattenedNestedItems = nestedItems.flat();
      return [...currentItems.filter(Boolean) as Array<{ path: string; url: string }>, ...flattenedNestedItems];
    };

    Promise.all([
      walkStorageRefs(`vehicle-documents/${vehicleId}`),
      walkStorageRefs(`download/${vehicleId}`),
    ])
      .then(results => {
        if (cancelled) {
          return;
        }

        const items = results.flat();
        const uniqueItems = items.filter((item, index, allItems) =>
          index === allItems.findIndex(other => other.path === item.path || other.url === item.url)
        );

        const normalizedDocuments = uniqueItems.map(item => {
          const pathSegments = item.path.split('/').filter(Boolean);
          const parentSegment = pathSegments[pathSegments.length - 2] || 'documento';
          const fileSegment = pathSegments[pathSegments.length - 1] || 'content';
          const fallbackName = fileSegment === 'content' ? `${parentSegment}.bin` : fileSegment;

          return {
            id: `storage-fallback-${item.path.replace(/[^a-zA-Z0-9_-]+/g, '-')}`,
            title: parentSegment,
            titleKey: 'storage-fallback-readonly',
            fileName: fallbackName,
            fileUrl: item.url,
            storagePath: item.path,
            contentType: null,
            sizeBytes: null,
            folderId: null,
            createdAt: null,
            updatedAt: null,
            uploadedByUid: null,
            uploadedByEmail: null,
          } as VehicleDocument;
        });

        setStorageFallbackDocuments(normalizedDocuments);
      })
      .catch(() => {
        if (!cancelled) {
          setStorageFallbackDocuments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canAccess, storage, vehicleId]);

  useEffect(() => {
    let cancelled = false;

    const sourceDocuments = documents ?? [];
    if (!sourceDocuments.length) {
      setResolvedDocumentUrls({});
      return () => {
        cancelled = true;
      };
    }

    const documentsWithStoragePath = sourceDocuments.filter(document => Boolean(document.storagePath));
    if (!documentsWithStoragePath.length) {
      setResolvedDocumentUrls({});
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      documentsWithStoragePath.map(async document => {
        try {
          const freshUrl = await getDownloadURL(ref(storage, document.storagePath));
          return [document.id, freshUrl] as const;
        } catch {
          return null;
        }
      })
    ).then(entries => {
      if (cancelled) {
        return;
      }

      const nextResolvedUrls: Record<string, string> = {};
      entries.forEach(entry => {
        if (!entry) {
          return;
        }

        const [documentId, freshUrl] = entry;
        nextResolvedUrls[documentId] = freshUrl;
      });

      setResolvedDocumentUrls(nextResolvedUrls);
    });

    return () => {
      cancelled = true;
    };
  }, [documents, storage]);

  const allDocuments = useMemo(() => {
    const baseDocuments = (documents ?? []).map(document => ({
      ...document,
      fileUrl: resolvedDocumentUrls[document.id] || document.fileUrl,
    }));
    const storageOnlyDocuments = storageFallbackDocuments.filter(fallbackDocument =>
      !baseDocuments.some(baseDocument =>
        baseDocument.storagePath === fallbackDocument.storagePath
        || baseDocument.fileUrl === fallbackDocument.fileUrl
      )
    );
    const mergedDocuments = [...baseDocuments, ...storageOnlyDocuments];

    const withPeriziaDocument = (() => {
      if (!linkedPeriziaDocument) {
        if (!linkedPeriziaLoadingDocument) {
          return mergedDocuments;
        }

        const alreadyIncludedLoading = mergedDocuments.some(document =>
          document.id === linkedPeriziaLoadingDocument.id
        );

        if (alreadyIncludedLoading) {
          return mergedDocuments;
        }

        return [linkedPeriziaLoadingDocument, ...mergedDocuments];
      }

      const alreadyIncluded = mergedDocuments.some(document =>
        document.storagePath === linkedPeriziaDocument.storagePath ||
        document.fileUrl === linkedPeriziaDocument.fileUrl ||
        document.id === linkedPeriziaDocument.id
      );

      if (alreadyIncluded) {
        return mergedDocuments;
      }

      return [linkedPeriziaDocument, ...mergedDocuments];
    })();

    const withSignedContractDocument = (() => {
      if (!linkedSignedContractDocument) {
        return withPeriziaDocument;
      }

      const alreadyIncluded = withPeriziaDocument.some(document =>
        document.storagePath === linkedSignedContractDocument.storagePath
        || document.fileUrl === linkedSignedContractDocument.fileUrl
        || document.id === linkedSignedContractDocument.id
      );

      if (alreadyIncluded) {
        return withPeriziaDocument;
      }

      return [linkedSignedContractDocument, ...withPeriziaDocument];
    })();

    const withMediaDocuments = [...withSignedContractDocument];
    for (const mediaDocument of linkedMediaDocuments) {
      const alreadyIncluded = withMediaDocuments.some(existingDocument =>
        existingDocument.fileUrl === mediaDocument.fileUrl
        || (existingDocument.storagePath && existingDocument.storagePath === mediaDocument.storagePath)
      );

      if (!alreadyIncluded) {
        withMediaDocuments.unshift(mediaDocument);
      }
    }

    return withMediaDocuments;
  }, [documents, linkedPeriziaDocument, linkedPeriziaLoadingDocument, linkedMediaDocuments, linkedSignedContractDocument, resolvedDocumentUrls, storageFallbackDocuments]);

  const documentationDocuments = useMemo(() => {
    if (documentationMode === 'all') {
      return allDocuments;
    }

    const mediaCategoryByKey = new Map<string, string>();

    for (const asset of vehicleData?.mediaAssets ?? []) {
      const assetKey = asset.url || asset.storagePath || '';
      if (!assetKey) {
        continue;
      }

      mediaCategoryByKey.set(assetKey, asset.category || '');
    }

    const periziaDocument = linkedPeriziaDocument ?? linkedPeriziaLoadingDocument ?? null;
    let librettoDocument: VehicleDocument | null = null;
    let kilometersDocument: VehicleDocument | null = null;

    for (const document of linkedMediaDocuments) {
      const documentCategory = mediaCategoryByKey.get(document.fileUrl) || mediaCategoryByKey.get(document.storagePath) || '';
      const normalizedText = `${document.title ?? ''} ${document.fileName ?? ''}`.toLowerCase();

      const isLibretto = documentCategory === 'libretto' || normalizedText.includes('libretto');
      const isKilometers = documentCategory === 'kilometri' || documentCategory === 'kilometri' || normalizedText.includes('kilometri') || normalizedText.includes('chilometri') || normalizedText.includes('km');

      if (isLibretto && !librettoDocument && isAdmin) {
        librettoDocument = document;
      }

      if (isKilometers && !kilometersDocument) {
        kilometersDocument = document;
      }
    }

    return [periziaDocument, librettoDocument, kilometersDocument].filter((document): document is VehicleDocument => Boolean(document));
  }, [allDocuments, documentationMode, isAdmin, linkedMediaDocuments, linkedPeriziaDocument, linkedPeriziaLoadingDocument, vehicleData?.mediaAssets]);

  const isReadonlyLinkedDocument = (document?: VehicleDocument | null) =>
    Boolean(
      document
      && (
        document.titleKey === 'linked-perizia-file'
        || document.titleKey === 'linked-perizia-loading'
        || document.titleKey === 'linked-signed-contract'
        || document.titleKey === 'storage-fallback-readonly'
        || document.titleKey === 'linked-media-asset'
      )
    );

  const isSignedContractDocument = (document?: VehicleDocument | null) =>
    Boolean(
      document
      && (
        document.titleKey === 'linked-signed-contract'
        || document.title === 'Contratto firmato'
        || (contractData?.signedContractStoragePath && document.storagePath === contractData.signedContractStoragePath)
      )
    );

  const canDeleteDocument = (document?: VehicleDocument | null) =>
    Boolean(document && ((isAdmin && !isReadonlyLinkedDocument(document)) || (canAccess && isSignedContractDocument(document))));

  const isLoadingLinkedDocument = (document?: VehicleDocument | null) =>
    document?.titleKey === 'linked-perizia-loading';

  const availableFolders = useMemo<VehicleDocumentFolder[]>(() => {
    const baseFolders = folders ?? [];
    const hasSignedContractFolder = baseFolders.some(folder => folder.id === SIGNED_CONTRACT_FOLDER_ID);

    if (!linkedSignedContractDocument || hasSignedContractFolder) {
      return baseFolders;
    }

    return [
      ...baseFolders,
      {
        id: SIGNED_CONTRACT_FOLDER_ID,
        name: SIGNED_CONTRACT_FOLDER_NAME,
        parentId: null,
        createdAt: linkedSignedContractDocument.createdAt,
      },
    ];
  }, [folders, linkedSignedContractDocument]);

  const folderMap = useMemo(
    () => new Map(availableFolders.map(f => [f.id, f])),
    [availableFolders]
  );

  const childFolderIdsByParent = useMemo(() => {
    const map = new Map<string | null, VehicleDocumentFolder[]>();
    for (const folder of availableFolders) {
      const parentId = folder.parentId ?? null;
      const siblings = map.get(parentId) ?? [];
      siblings.push(folder);
      map.set(parentId, siblings);
    }
    for (const [parentId, items] of map.entries()) {
      map.set(parentId, [...items].sort((a, b) => a.name.localeCompare(b.name, 'it')));
    }
    return map;
  }, [availableFolders]);

  const getFolderPathLabel = (folderId: string | null | undefined): string => {
    if (!folderId) return '';
    const segments: string[] = [];
    let current = folderMap.get(folderId) ?? null;
    while (current) {
      segments.unshift(current.name);
      current = current.parentId ? folderMap.get(current.parentId) ?? null : null;
    }
    return segments.join(' / ');
  };

  const flattenedFolders = useMemo(() => {
    const items: FolderListItem[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const folder of childFolderIdsByParent.get(parentId) ?? []) {
        items.push({ ...folder, depth, pathLabel: getFolderPathLabel(folder.id) });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return items;
  }, [childFolderIdsByParent, folderMap]);

  const filteredFolders = useMemo(() => {
    const query = folderSearch.trim().toLowerCase();
    if (!query) return flattenedFolders;
    return flattenedFolders.filter(f => f.pathLabel.toLowerCase().includes(query));
  }, [folderSearch, flattenedFolders]);

  const filteredDocuments = useMemo(() => {
    const all = [...documentationDocuments];
    if (selectedFolderId === null) return all;
    if (selectedFolderId === '__none__') return all.filter(d => !d.folderId);
    return all.filter(d => d.folderId === selectedFolderId);
  }, [documentationDocuments, selectedFolderId]);

  const searchedDocuments = useMemo(() => {
    const query = documentSearch.trim().toLowerCase();
    if (!query) return filteredDocuments;
    return filteredDocuments.filter(d => {
      const t = d.title?.toLowerCase() ?? '';
      const f = d.fileName?.toLowerCase() ?? '';
      return t.includes(query) || f.includes(query);
    });
  }, [filteredDocuments, documentSearch]);

  const visibleDocuments = useMemo(() => {
    return [...searchedDocuments].sort((a, b) => {
      if (documentSortKey === 'title') {
        const result = (a.title ?? '').localeCompare(b.title ?? '', 'it', { sensitivity: 'base' });
        return documentSortDirection === 'asc' ? result : -result;
      }
      if (documentSortKey === 'sizeBytes') {
        const result = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
        return documentSortDirection === 'asc' ? result : -result;
      }
      const leftValue = getDocumentTimestamp(a.updatedAt ?? a.createdAt);
      const rightValue = getDocumentTimestamp(b.updatedAt ?? b.createdAt);
      const result = leftValue - rightValue;
      return documentSortDirection === 'asc' ? result : -result;
    });
  }, [searchedDocuments, documentSortKey, documentSortDirection]);

  const currentFolderLabel = useMemo(() => {
    if (selectedFolderId === null) return 'Tutti i file';
    if (selectedFolderId === '__none__') return 'Senza cartella';
    return getFolderPathLabel(selectedFolderId) || 'Cartella';
  }, [selectedFolderId, flattenedFolders]);

  const selectedRootFolderId = useMemo(() => {
    if (!selectedFolderId || selectedFolderId === '__none__') return selectedFolderId;
    let current = folderMap.get(selectedFolderId);
    while (current?.parentId) current = folderMap.get(current.parentId);
    return current?.id ?? selectedFolderId;
  }, [selectedFolderId, folderMap]);

  const currentSubfolders = useMemo(() => {
    if (!selectedFolderId || selectedFolderId === '__none__') return [];
    return childFolderIdsByParent.get(selectedFolderId) ?? [];
  }, [selectedFolderId, childFolderIdsByParent]);

  if (!canAccess) {
    if (!canViewPerizia) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Perizia riconsegna</h3>
        {linkedPeriziaDocument ? (
          <a
            href={linkedPeriziaDocument.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
          >
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{linkedPeriziaDocument.fileName}</span>
            <Download className="h-4 w-4 shrink-0" />
          </a>
        ) : isResolvingLinkedPerizia ? (
          <p className="text-sm text-muted-foreground">Caricamento perizia...</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna perizia disponibile.</p>
        )}
      </div>
    );
  }

  // ---- helpers ----
  const buildFolderId = (folderName: string, parentId: string | null) => {
    const normalized = normalizeKey(folderName);
    if (!normalized) return '';
    return parentId ? `${parentId}__${normalized}` : normalized;
  };

  const createFolderRecord = async (folderName: string, parentId: string | null): Promise<string | null> => {
    if (!firestore || !user || !vehicleDocRef) return null;
    const trimmed = folderName.trim();
    const folderId = buildFolderId(trimmed, parentId);
    if (!folderId) return null;
    const folderRef = doc(vehicleDocRef, FOLDERS_SUBCOLLECTION, folderId);
    const existing = await getDoc(folderRef);
    if (!existing.exists()) {
      await setDocumentNonBlocking(folderRef, {
        id: folderId, name: trimmed, parentId, createdAt: serverTimestamp(),
        createdByUid: user.uid, createdByEmail: user.email ?? null,
      }, {});
    }
    return folderId;
  };

  const handleCreateFolder = async (parentId: string | null) => {
    if (!firestore || !user || !vehicleDocRef) return;
    const trimmed = newFolderName.trim();
    if (!trimmed) { toast({ variant: 'destructive', title: 'Nome cartella obbligatorio' }); return; }
    const folderId = buildFolderId(trimmed, parentId);
    if (!folderId) { toast({ variant: 'destructive', title: 'Nome non valido' }); return; }
    setIsCreatingFolder(true);
    try {
      const folderRef = doc(vehicleDocRef, FOLDERS_SUBCOLLECTION, folderId);
      if ((await getDoc(folderRef)).exists()) {
        toast({ variant: 'destructive', title: 'Cartella già esistente' }); return;
      }
      await setDocumentNonBlocking(folderRef, {
        id: folderId, name: trimmed, parentId, createdAt: serverTimestamp(),
        createdByUid: user.uid, createdByEmail: user.email ?? null,
      }, {});
      setNewFolderName(''); setShowNewFolderInput(false);
      toast({ title: `Cartella "${trimmed}" creata` });
    } catch (error) {
      console.error('Errore creazione cartella veicolo', error);
      toast({ variant: 'destructive', title: 'Errore creazione cartella' });
    } finally { setIsCreatingFolder(false); }
  };

  const handleCreateSubfolder = async () => {
    if (!firestore || !user || !vehicleDocRef || !selectedFolderId || selectedFolderId === '__none__') return;
    const trimmed = newSubfolderName.trim();
    if (!trimmed) { toast({ variant: 'destructive', title: 'Nome sottocartella obbligatorio' }); return; }
    const folderId = buildFolderId(trimmed, selectedFolderId);
    if (!folderId) { toast({ variant: 'destructive', title: 'Nome non valido' }); return; }
    setIsCreatingFolder(true);
    try {
      const folderRef = doc(vehicleDocRef, FOLDERS_SUBCOLLECTION, folderId);
      if ((await getDoc(folderRef)).exists()) {
        toast({ variant: 'destructive', title: 'Cartella già esistente' }); return;
      }
      await setDocumentNonBlocking(folderRef, {
        id: folderId, name: trimmed, parentId: selectedFolderId, createdAt: serverTimestamp(),
        createdByUid: user.uid, createdByEmail: user.email ?? null,
      }, {});
      setNewSubfolderName(''); setShowNewSubfolderInput(false);
      toast({ title: `Sottocartella "${trimmed}" creata` });
    } catch (error) {
      console.error('Errore creazione sottocartella veicolo', error);
      toast({ variant: 'destructive', title: 'Errore creazione sottocartella' });
    } finally { setIsCreatingFolder(false); }
  };

  const handleDeleteFolder = async (folder: VehicleDocumentFolder) => {
    if (!firestore || !vehicleDocRef) return;

    // Raccoglie ricorsivamente tutti gli ID cartelle figlie
    const collectDescendantFolderIds = (folderId: string): string[] => {
      const children = childFolderIdsByParent.get(folderId) ?? [];
      return children.flatMap(child => [child.id, ...collectDescendantFolderIds(child.id)]);
    };

    const allFolderIds = [folder.id, ...collectDescendantFolderIds(folder.id)];
    const allDocs = (documents ?? []).filter(d => d.folderId && allFolderIds.includes(d.folderId));

    try {
      // Elimina tutti i file nei documenti delle cartelle
      await Promise.all(allDocs.map(async d => {
        try {
          if (d.storagePath) await deleteObject(ref(storage, d.storagePath));
          await deleteDoc(doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, d.id));
        } catch (err) {
          console.error('Errore eliminazione documento nella cartella', err);
        }
      }));
      // Elimina tutte le sottocartelle e la cartella stessa
      await Promise.all(allFolderIds.map(id => deleteDoc(doc(vehicleDocRef, FOLDERS_SUBCOLLECTION, id))));
      if (allFolderIds.includes(selectedFolderId ?? '')) setSelectedFolderId(null);
      if (previewDocument && allDocs.some(d => d.id === previewDocument.id)) setPreviewDocument(null);
      toast({ title: `Cartella "${folder.name}" eliminata`, description: allDocs.length > 0 ? `${allDocs.length} file eliminati.` : undefined });
    } catch (error) {
      console.error('Errore eliminazione cartella veicolo', error);
      toast({ variant: 'destructive', title: 'Impossibile eliminare la cartella' });
    }
  };

  const handleCopyFolder = (folder: VehicleDocumentFolder) => {
    setClipboardFolderId(folder.id);
    setClipboardAction('copy');
    toast({ title: 'Cartella copiata', description: `"${folder.name}" è pronta per il copia.` });
  };

  const handleCutFolder = (folder: VehicleDocumentFolder) => {
    setClipboardFolderId(folder.id);
    setClipboardAction('cut');
    toast({ title: 'Cartella tagliata', description: `"${folder.name}" è pronta per lo spostamento.` });
  };

  const handlePasteFolder = async (targetParentId: string | null) => {
    if (!firestore || !vehicleDocRef || !clipboardFolderId || !clipboardAction) return;
    
    const folderToCopy = folderMap.get(clipboardFolderId);
    if (!folderToCopy) return;

    // Prevent pasting a folder into itself or its children
    if (clipboardAction === 'copy' || clipboardAction === 'cut') {
      let current = folderMap.get(targetParentId ?? '');
      while (current) {
        if (current.id === clipboardFolderId) {
          toast({ variant: 'destructive', title: 'Operazione non valida', description: 'Non puoi spostare una cartella dentro se stessa o nei suoi sottoelementi.' });
          return;
        }
        current = current.parentId ? folderMap.get(current.parentId) : undefined;
      }
    }

    try {
      if (clipboardAction === 'copy') {
        // Deep copy folder and all its contents
        const newFolderId = `${folderToCopy.id}-copy-${Date.now()}`;
        await setDocumentNonBlocking(doc(vehicleDocRef, FOLDERS_SUBCOLLECTION, newFolderId), {
          id: newFolderId,
          name: `${folderToCopy.name} (copia)`,
          parentId: targetParentId ?? null,
          createdAt: serverTimestamp(),
          createdByUid: user?.uid ?? null,
          createdByEmail: user?.email ?? null,
        }, { merge: true });

        // Copy all documents in the folder
        const docsInFolder = (documents ?? []).filter(d => d.folderId === clipboardFolderId);
        for (const documentItem of docsInFolder) {
          const newDocId = `${documentItem.id}-copy-${Date.now()}`;
          const newStoragePath = `vehicle-documents/${vehicleId}/${newDocId}/content`;
          try {
            const oldStorageRef = ref(storage, documentItem.storagePath);
            const newStorageRef = ref(storage, newStoragePath);
            const bytes = await getBytes(oldStorageRef);
            const uploadTask = uploadBytesResumable(newStorageRef, bytes, {
              contentType: documentItem.contentType || 'application/octet-stream',
              customMetadata: { originalName: documentItem.fileName },
            });
            await new Promise<void>((resolve, reject) => {
              uploadTask.on('state_changed', undefined, reject, () => resolve());
            });
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            await setDocumentNonBlocking(doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, newDocId), {
              id: newDocId,
              title: documentItem.title,
              titleKey: documentItem.titleKey,
              fileName: documentItem.fileName,
              fileUrl: downloadUrl,
              storagePath: newStoragePath,
              contentType: documentItem.contentType || null,
              sizeBytes: documentItem.sizeBytes,
              folderId: newFolderId,
              uploadedByUid: user?.uid ?? null,
              uploadedByEmail: user?.email ?? null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } catch (error) {
            console.error('Errore copia documento', error);
          }
        }

        toast({ title: 'Cartella copiata', description: `"${folderToCopy.name}" è stata copiata.` });
      } else if (clipboardAction === 'cut') {
        // Move folder to new parent
        await setDocumentNonBlocking(doc(vehicleDocRef, FOLDERS_SUBCOLLECTION, clipboardFolderId), {
          parentId: targetParentId ?? null,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        toast({ title: 'Cartella spostata', description: `"${folderToCopy.name}" è stata spostata.` });
      }

      setClipboardFolderId(null);
      setClipboardAction(null);
    } catch (error) {
      console.error('Errore operazione clipboard cartella', error);
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile completare l\'operazione.' });
    }
  };

  const handleUpload = async () => {
    if (!firestore || !user || !selectedFile || !vehicleDocRef) {
      toast({ variant: 'destructive', title: 'Seleziona un file prima di avviare l\'upload.' }); return;
    }
    const trimmedTitle = selectedFile.name.replace(/\.[^.]+$/, '').trim() || selectedFile.name.trim();
    if (!trimmedTitle) { toast({ variant: 'destructive', title: 'Nome file non valido' }); return; }
    const documentKey = normalizeKey(`${vehicleId}-${trimmedTitle}`);
    if (!documentKey) { toast({ variant: 'destructive', title: 'Nome file non valido' }); return; }
    const folderId = uploadFolderId === 'none' ? null : uploadFolderId;
    setIsUploading(true); setUploadProgress(0);
    try {
      const documentRef = doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, documentKey);
      const existingSnapshot = await getDoc(documentRef);
      const storagePath = `vehicle-documents/${vehicleId}/${documentKey}/content`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile, {
        contentType: selectedFile.type || 'application/octet-stream',
        customMetadata: { originalName: selectedFile.name },
      });
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', snapshot => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), reject, () => resolve());
      });
      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      await setDocumentNonBlocking(documentRef, {
        id: documentKey, title: trimmedTitle, titleKey: documentKey,
        fileName: selectedFile.name, fileUrl: downloadUrl, storagePath,
        contentType: selectedFile.type || null, sizeBytes: selectedFile.size,
        folderId,
        uploadedByUid: user.uid, uploadedByEmail: user.email ?? null,
        createdAt: existingSnapshot.exists() ? existingSnapshot.data().createdAt ?? serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSelectedFile(null);
      toast({ title: 'Documento caricato', description: `${trimmedTitle} è pronto.` });
    } catch (error) {
      console.error('Errore caricamento documento veicolo', error);
      toast({ variant: 'destructive', title: 'Upload fallito' });
    } finally { setIsUploading(false); setUploadProgress(0); }
  };

  const handleUploadMultiple = async () => {
    if (!firestore || !user || selectedFiles.length === 0 || !vehicleDocRef) {
      toast({ variant: 'destructive', title: 'Seleziona almeno un file prima di avviare l\'upload.' }); return;
    }
    const folderId = uploadFolderId === 'none' ? null : uploadFolderId;
    setIsUploading(true);
    let uploadedCount = 0;
    const totalCount = selectedFiles.length;
    const failedFiles: File[] = [];
    let firstUploadError: unknown = null;
    try {
      // Carica i file in parallelo (max 5 contemporaneamente)
      const chunkSize = 5;
      for (let i = 0; i < selectedFiles.length; i += chunkSize) {
        const chunk = selectedFiles.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (file, chunkIndex) => {
          try {
            const trimmedTitle = file.name.replace(/\.[^.]+$/, '').trim() || file.name.trim();
            if (!trimmedTitle) throw new Error('Nome file non valido');
            const documentKey = normalizeKey(`${vehicleId}-${trimmedTitle}`);
            if (!documentKey) throw new Error('Nome file non valido');
            const documentRef = doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, documentKey);
            const existingSnapshot = await getDoc(documentRef);
            const storagePath = `vehicle-documents/${vehicleId}/${documentKey}/content`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file, {
              contentType: file.type || 'application/octet-stream',
              customMetadata: { originalName: file.name },
            });
            await new Promise<void>((resolve, reject) => {
              uploadTask.on('state_changed', undefined, reject, () => resolve());
            });
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            await setDocumentNonBlocking(documentRef, {
              id: documentKey, title: trimmedTitle, titleKey: documentKey,
              fileName: file.name, fileUrl: downloadUrl, storagePath,
              contentType: file.type || null, sizeBytes: file.size,
              folderId,
              uploadedByUid: user.uid, uploadedByEmail: user.email ?? null,
              createdAt: existingSnapshot.exists() ? existingSnapshot.data().createdAt ?? serverTimestamp() : serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
            uploadedCount++;
            setUploadProgress((uploadedCount / totalCount) * 100);
          } catch (error) {
            console.error('Errore caricamento file:', error);
            firstUploadError ??= error;
            failedFiles.push(file);
          }
        }));
      }
      if (failedFiles.length === 0) {
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        toast({ title: 'Upload completato', description: `${uploadedCount}/${totalCount} file caricati con successo.` });
      } else {
        setSelectedFiles(failedFiles);
        const errorCode = firstUploadError && typeof firstUploadError === 'object' && 'code' in firstUploadError
          ? String(firstUploadError.code)
          : '';
        toast({
          variant: 'destructive',
          title: uploadedCount > 0 ? 'Upload parziale' : 'Upload fallito',
          description: errorCode === 'storage/unauthorized'
            ? `${uploadedCount}/${totalCount} file caricati. Permessi Storage insufficienti; i file non caricati restano selezionati.`
            : `${uploadedCount}/${totalCount} file caricati. I file non riusciti restano selezionati per un nuovo tentativo.`,
        });
      }
    } catch (error) {
      console.error('Errore upload multiplo documento veicolo', error);
      toast({ variant: 'destructive', title: 'Upload fallito' });
    } finally { setIsUploading(false); setUploadProgress(0); }
  };

  const handleDirectoryImport = async () => {
    if (!firestore || !user || !vehicleDocRef || directoryFiles.length === 0) {
      toast({ variant: 'destructive', title: 'Seleziona una cartella da importare.' }); return;
    }
    setIsImportingDirectory(true); setUploadProgress(0);
    try {
      const selectedParentId = selectedFolderId && selectedFolderId !== '__none__' ? selectedFolderId : null;
      for (let i = 0; i < directoryFiles.length; i++) {
        const file = directoryFiles[i];
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const pathSegments = relativePath.split('/').filter(Boolean);
        const fileName = pathSegments[pathSegments.length - 1] || file.name;
        const folderSegments = pathSegments.slice(0, -1);
        let currentParentId = selectedParentId;
        for (const segment of folderSegments) currentParentId = await createFolderRecord(segment, currentParentId);
        const titleValue = fileName.replace(/\.[^.]+$/, '') || fileName;
        const documentKey = normalizeKey(`${vehicleId}-${currentParentId ?? 'root'}-${relativePath}`);
        const documentRef = doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, documentKey);
        const storagePath = `vehicle-documents/${vehicleId}/${documentKey}/content`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
          customMetadata: { originalName: file.name, relativePath },
        });
        await new Promise<void>((resolve, reject) => { uploadTask.on('state_changed', undefined, reject, () => resolve()); });
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        await setDocumentNonBlocking(documentRef, {
          id: documentKey, title: titleValue, titleKey: normalizeKey(titleValue),
          fileName, fileUrl: downloadUrl, storagePath,
          contentType: file.type || null, sizeBytes: file.size,
          folderId: currentParentId ?? null,
          uploadedByUid: user.uid, uploadedByEmail: user.email ?? null,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }, { merge: true });
        setUploadProgress(((i + 1) / directoryFiles.length) * 100);
      }
      setDirectoryFiles([]);
      if (directoryInputRef.current) directoryInputRef.current.value = '';
      toast({ title: 'Cartella importata', description: `${directoryFiles.length} file importati.` });
    } catch (error) {
      console.error('Errore import cartella veicolo', error);
      toast({ variant: 'destructive', title: 'Import cartella fallito' });
    } finally { setIsImportingDirectory(false); setUploadProgress(0); }
  };

  const handleDeleteDocument = async (documentToDelete: VehicleDocument) => {
    if (documentToDelete.titleKey === 'linked-perizia-file') {
      toast({
        title: 'Documento collegato',
        description: 'La perizia collegata si elimina dalla scheda Perizia del veicolo.',
      });
      return;
    }
    if (!firestore || !vehicleDocRef) return;
    setDeletingDocumentId(documentToDelete.id);
    try {
      if (isSignedContractDocument(documentToDelete)) {
        if (contractData?.signedContractStoragePath) {
          try {
            await deleteObject(ref(storage, contractData.signedContractStoragePath));
          } catch (storageError) {
            console.warn('Impossibile eliminare il contratto firmato da Storage, proseguo con la pulizia dei metadati.', storageError);
          }
        }
        if (contractDocRef) {
          await updateDoc(contractDocRef, {
            signedContractName: deleteField(),
            signedContractStoragePath: deleteField(),
            signedContractUrl: deleteField(),
            signedContractUploadedAt: deleteField(),
            signedContractUploadedBy: deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
        try {
          await deleteDoc(doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, documentToDelete.id));
        } catch (documentDeleteError) {
          console.warn('Impossibile eliminare la copia del contratto dalla documentazione veicolo.', documentDeleteError);
        }
        if (previewDocument?.id === documentToDelete.id) setPreviewDocument(null);
        toast({ title: 'Contratto firmato eliminato' });
        return;
      }
      if (documentToDelete.storagePath) await deleteObject(ref(storage, documentToDelete.storagePath));
      await deleteDoc(doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, documentToDelete.id));
      if (previewDocument?.id === documentToDelete.id) setPreviewDocument(null);
      toast({ title: 'Documento eliminato' });
    } catch (error) {
      console.error('Errore eliminazione documento veicolo', error);
      toast({ variant: 'destructive', title: 'Impossibile eliminare il documento' });
    } finally { setDeletingDocumentId(c => c === documentToDelete.id ? null : c); }
  };

  const handleSaveSpreadsheetDocument = async (
    documentToUpdate: VehicleDocument,
    payload: { blob: Blob; fileName: string; contentType: string; sizeBytes: number }
  ) => {
    if (!firestore || !vehicleDocRef || !user) {
      throw new Error('AUTH_REQUIRED');
    }

    setSavingSpreadsheetDocumentId(documentToUpdate.id);

    try {
      const storagePath = documentToUpdate.storagePath || `vehicle-documents/${vehicleId}/${documentToUpdate.id}/content`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, payload.blob, {
        contentType: payload.contentType || documentToUpdate.contentType || 'application/octet-stream',
        customMetadata: { originalName: payload.fileName || documentToUpdate.fileName },
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', undefined, reject, () => resolve());
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

      await setDocumentNonBlocking(
        doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, documentToUpdate.id),
        {
          fileName: payload.fileName || documentToUpdate.fileName,
          fileUrl: downloadUrl,
          storagePath,
          contentType: payload.contentType || documentToUpdate.contentType || null,
          sizeBytes: payload.sizeBytes,
          uploadedByUid: user.uid,
          uploadedByEmail: user.email ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setPreviewDocument(current => {
        if (!current || current.id !== documentToUpdate.id) {
          return current;
        }

        return {
          ...current,
          fileName: payload.fileName || current.fileName,
          fileUrl: `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}portalEdit=${Date.now()}`,
          storagePath,
          contentType: payload.contentType || current.contentType,
          sizeBytes: payload.sizeBytes,
        };
      });

      toast({
        title: 'File aggiornato',
        description: 'Le modifiche sono state salvate direttamente nella sezione documenti veicolo.',
      });
    } catch (error) {
      console.error('Errore salvataggio foglio documento veicolo', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio fallito',
        description: 'Non riesco ad aggiornare il file caricato del veicolo.',
      });
      throw error;
    } finally {
      setSavingSpreadsheetDocumentId(current => (current === documentToUpdate.id ? null : current));
    }
  };

  const handleRenameFolder = async (folder: VehicleDocumentFolder) => {
    if (!firestore || !vehicleDocRef) return;
    const trimmed = renameFolderValue.trim();
    if (!trimmed || trimmed === folder.name) { setRenamingFolderId(null); setRenameFolderValue(''); return; }
    try {
      await setDocumentNonBlocking(doc(vehicleDocRef, FOLDERS_SUBCOLLECTION, folder.id), { name: trimmed, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: `Cartella rinominata a "${trimmed}"` });
    } catch (error) {
      console.error('Errore rinomina cartella veicolo', error);
      toast({ variant: 'destructive', title: 'Impossibile rinominare la cartella' });
    } finally { setRenamingFolderId(null); setRenameFolderValue(''); }
  };

  const handleRenameDocument = async (document: VehicleDocument) => {
    if (document.titleKey === 'linked-perizia-file') {
      toast({
        title: 'Documento collegato',
        description: 'Rinomina la perizia dalla scheda del veicolo se necessario.',
      });
      return;
    }
    if (!firestore || !vehicleDocRef) return;
    const trimmed = renameDocumentValue.trim();
    if (!trimmed || trimmed === document.title) { setRenamingDocumentId(null); setRenameDocumentValue(''); return; }
    try {
      await setDocumentNonBlocking(doc(vehicleDocRef, DOCUMENTS_SUBCOLLECTION, document.id), { title: trimmed, updatedAt: serverTimestamp() }, { merge: true });
      if (previewDocument?.id === document.id) setPreviewDocument({ ...previewDocument, title: trimmed });
      toast({ title: `Documento rinominato a "${trimmed}"` });
    } catch (error) {
      console.error('Errore rinomina documento veicolo', error);
      toast({ variant: 'destructive', title: 'Impossibile rinominare il documento' });
    } finally { setRenamingDocumentId(null); setRenameDocumentValue(''); }
  };

  const handleSortChange = (nextKey: DocumentSortKey) => {
    setDocumentSortDirection(current => documentSortKey === nextKey ? (current === 'asc' ? 'desc' : 'asc') : (nextKey === 'title' ? 'asc' : 'desc'));
    setDocumentSortKey(nextKey);
  };

  const sortedFolders = flattenedFolders;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-1">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background p-3">
        <div>
          <p className="text-sm font-semibold">Scheda danni veicolo</p>
          <p className="text-xs text-muted-foreground">Compilabile e stampabile per questo veicolo.</p>
        </div>
        <VehicleDamageSheetPrintButton vehicle={vehicleData} vehicleLabel={vehicleLabel} />
      </div>
      {/* Upload area – admin only */}
      {isAdmin ? (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="mb-3 text-sm font-semibold text-foreground">Carica documento</p>
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
              <SelectTrigger className="md:col-span-1">
                <SelectValue placeholder="Seleziona cartella" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Senza cartella</SelectItem>
                {sortedFolders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>{folder.pathLabel || folder.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex md:col-span-2">
              <input ref={fileInputRef} type="file" multiple className="flex-1 block cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium" onChange={e => { 
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) {
                  setSelectedFiles(files);
                  setSelectedFile(null);
                  setDirectoryFiles([]);
                }
              }} />
              <input
                ref={node => {
                  directoryInputRef.current = node;
                  if (node) { node.setAttribute('webkitdirectory', ''); node.setAttribute('directory', ''); }
                }}
                type="file" multiple className="hidden"
                onChange={event => { setDirectoryFiles(Array.from(event.target.files ?? [])); setSelectedFile(null); setSelectedFiles([]); }}
              />
              <Button
                type="button"
                onClick={selectedFiles.length > 0 ? handleUploadMultiple : handleUpload}
                disabled={isUploading || (selectedFiles.length === 0 && !selectedFile)}
                className="shrink-0"
              >
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploading ? 'Caricamento...' : selectedFiles.length > 0 ? `Carica (${selectedFiles.length})` : 'Carica'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" disabled={isUploading || isImportingDirectory}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => directoryInputRef.current?.click()}>
                    <FolderOpen className="mr-2 h-4 w-4" /> Importa cartella
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {selectedFiles.length > 0 ? (
            <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background p-2.5">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
                <p className="text-sm font-medium">{selectedFiles.length} file selezionati</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Cancella tutti
                </button>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 rounded-md border border-border/40 p-2 bg-muted/30">
                    <div className="flex min-w-0 items-center gap-2 flex-1">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate text-foreground">{file.name.replace(/\.[^.]+$/, '') || file.name}</p>
                        <p className="text-xs text-muted-foreground">{file.name} · {formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="Rimuovi"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedFile ? (
            <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{selectedFile.name.replace(/\.[^.]+$/, '') || selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedFile.name} · {formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  title="Rimuovi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : directoryFiles.length > 0 ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background p-2.5">
              <p className="text-xs text-muted-foreground">
                <FolderOpen className="mr-1 inline h-3 w-3" />{directoryFiles.length} file selezionati dalla cartella
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDirectoryImport}
                  disabled={isImportingDirectory || isUploading}
                >
                  {isImportingDirectory ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
                  {isImportingDirectory ? 'Importazione...' : `Carica cartella (${directoryFiles.length})`}
                </Button>
                <button type="button" className="text-xs text-destructive hover:underline" onClick={() => { setDirectoryFiles([]); if (directoryInputRef.current) directoryInputRef.current.value = ''; }}>Rimuovi</button>
              </div>
            </div>
          ) : null}
          {isUploading || isImportingDirectory ? <Progress value={uploadProgress} className="mt-2 h-1.5" /> : null}
        </div>
      ) : null}

      {/* Main 2-panel layout */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Folder sidebar */}
        <aside className="rounded-2xl border border-border/60 bg-muted/20 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Folder className="h-4 w-4 text-primary" /> Cartelle
            </div>
            {isAdmin ? (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => setShowNewFolderInput(v => !v)}>
                <FolderPlus className="h-3.5 w-3.5" /> Nuova
              </Button>
            ) : null}
          </div>

          {showNewFolderInput ? (
            <div className="mb-3 space-y-2 rounded-xl border border-border/60 bg-background p-2">
              <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nome cartella" autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleCreateFolder(null);
                  if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); }
                }}
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => void handleCreateFolder(null)} disabled={isCreatingFolder}>
                  {isCreatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crea'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}>Annulla</Button>
              </div>
            </div>
          ) : null}

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={folderSearch} onChange={e => setFolderSearch(e.target.value)} placeholder="Cerca cartella" className="h-9 pl-9 pr-9" />
            {folderSearch ? (
              <button type="button" onClick={() => setFolderSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Azzera ricerca">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="max-h-[360px] space-y-1 overflow-auto pr-1">
            <button type="button" onClick={() => setSelectedFolderId(null)}
              className={cn('flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors',
                selectedFolderId === null ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted')}>
              <span className="inline-flex items-center gap-2"><HardDrive className="h-4 w-4" />Tutti i file</span>
              <span className="text-xs">{documentationDocuments.length}</span>
            </button>
            <button type="button" onClick={() => setSelectedFolderId('__none__')}
              className={cn('flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors',
                selectedFolderId === '__none__' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted')}>
              <span className="inline-flex items-center gap-2"><FolderOpen className="h-4 w-4" />Senza cartella</span>
              <span className="text-xs">{documentationDocuments.filter(d => !d.folderId).length}</span>
            </button>

            {filteredFolders.filter(f => f.depth === 0).map(folder => (
              <div key={folder.id} className="group flex items-center gap-1">
                <button type="button" onClick={() => setSelectedFolderId(folder.id)}
                  className={cn('flex min-w-0 flex-1 items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    selectedRootFolderId === folder.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted')}>
                  <span className="inline-flex min-w-0 items-center gap-2"><FolderOpen className="h-4 w-4 shrink-0" /><span className="truncate">{folder.name}</span></span>
                  <span className="text-xs">{documentationDocuments.filter(d => d.folderId === folder.id).length}</span>
                </button>
                {isAdmin ? (
                  <>
                    <button type="button" className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      onClick={() => { setRenamingFolderId(folder.id); setRenameFolderValue(folder.name); }} title="Rinomina">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      onClick={() => handleCopyFolder(folder)} title="Copia">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      onClick={() => handleCutFolder(folder)} title="Taglia">
                      <Scissors className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100"
                      onClick={() => setDeletingFolderConfirm(folder)} title="Elimina">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            ))}

            {filteredFolders.filter(f => f.depth === 0).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">Nessuna cartella.</div>
            ) : null}
          </div>
        </aside>

        {/* Document panel */}
        <section className="rounded-2xl border border-border/60 bg-background">
          <div className="border-b border-border/60 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                {selectedFolderId && selectedFolderId !== '__none__' && folderMap.get(selectedFolderId)?.parentId ? (
                  <button type="button" onClick={() => setSelectedFolderId(folderMap.get(selectedFolderId!)?.parentId ?? null)} className="mr-1 rounded-md p-0.5 hover:bg-muted" title="Torna alla cartella superiore">
                    <ArrowLeft className="h-4 w-4 text-foreground" />
                  </button>
                ) : null}
                <span className="font-medium text-foreground">Documenti</span>
                <ChevronRight className="h-4 w-4" />
                <span>{currentFolderLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && selectedFolderId && selectedFolderId !== '__none__' ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => setShowNewSubfolderInput(v => !v)}>
                    <FolderPlus className="h-3.5 w-3.5" /> Nuova sottocartella
                  </Button>
                ) : null}
                {isAdmin && clipboardFolderId && selectedFolderId && selectedFolderId !== '__none__' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => handlePasteFolder(selectedFolderId)}
                    title={`${clipboardAction === 'copy' ? 'Copia' : 'Sposta'} cartella qui`}
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    {clipboardAction === 'copy' ? 'Incolla copia' : 'Sposta qui'}
                  </Button>
                ) : null}
                <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                  <Button type="button" variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
                  <Button type="button" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            {showNewSubfolderInput && selectedFolderId && selectedFolderId !== '__none__' ? (
              <div className="mb-3 space-y-2 rounded-xl border border-border/60 bg-background p-2">
                <p className="text-xs text-muted-foreground">Sottocartella dentro <span className="font-medium text-foreground">{folderMap.get(selectedFolderId)?.name}</span></p>
                <Input value={newSubfolderName} onChange={e => setNewSubfolderName(e.target.value)} placeholder="Nome sottocartella" autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleCreateSubfolder();
                    if (e.key === 'Escape') { setShowNewSubfolderInput(false); setNewSubfolderName(''); }
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => void handleCreateSubfolder()} disabled={isCreatingFolder}>
                    {isCreatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crea'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewSubfolderInput(false); setNewSubfolderName(''); }}>Annulla</Button>
                </div>
              </div>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} placeholder="Cerca file per nome o titolo" className="h-9 pl-9" />
            </div>
          </div>

          {/* Subfolders */}
          {currentSubfolders.length > 0 ? (
            <div className="border-b border-border/60 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sottocartelle</p>
                {isAdmin && clipboardFolderId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => handlePasteFolder(selectedFolderId)}
                    title={`${clipboardAction === 'copy' ? 'Copia' : 'Sposta'} cartella qui`}
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    {clipboardAction === 'copy' ? 'Incolla copia' : 'Sposta qui'}
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {currentSubfolders.map(subfolder => (
                  <div key={subfolder.id} className="group flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelectedFolderId(subfolder.id)}>
                      <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 truncate text-sm font-medium">{subfolder.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{documentationDocuments.filter(d => d.folderId === subfolder.id).length}</span>
                    </button>
                    {isAdmin ? (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => { setRenamingFolderId(subfolder.id); setRenameFolderValue(subfolder.name); }} title="Rinomina"><Edit2 className="h-3 w-3" /></button>
                        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => handleCopyFolder(subfolder)} title="Copia"><Copy className="h-3 w-3" /></button>
                        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => handleCutFolder(subfolder)} title="Taglia"><Scissors className="h-3 w-3" /></button>
                        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-destructive" onClick={() => setDeletingFolderConfirm(subfolder)} title="Elimina"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Documents list/grid */}
          {documentsError ? (
            <p className="p-4 text-sm text-destructive">Errore nel caricamento dei documenti.</p>
          ) : isLoadingDocuments ? (
            <div className="space-y-2 p-3">
              <div className="h-12 rounded-lg bg-muted/50" />
              <div className="h-12 rounded-lg bg-muted/50" />
              <div className="h-12 rounded-lg bg-muted/50" />
            </div>
          ) : visibleDocuments.length > 0 ? (
            viewMode === 'list' ? (
              <div className="max-h-[480px] overflow-auto">
                <div className="hidden grid-cols-[minmax(0,2.3fr)_minmax(0,0.7fr)_104px_68px_180px] border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                  <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => handleSortChange('title')}>Nome <ArrowUpDown className="h-3.5 w-3.5" /></button>
                  <span>Cartella</span>
                  <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => handleSortChange('updatedAt')}>Aggiornato <ArrowUpDown className="h-3.5 w-3.5" /></button>
                  <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => handleSortChange('sizeBytes')}>Dim <ArrowUpDown className="h-3.5 w-3.5" /></button>
                  <span className="text-right">Azioni</span>
                </div>
                {visibleDocuments.map(document => {
                  const folderName = sortedFolders.find(f => f.id === document.folderId)?.name;
                  const isLoadingDocument = isLoadingLinkedDocument(document);
                  const supportsPreview = canPreviewDocumentFile(document);
                  return (
                    <div key={document.id} className="grid gap-2 border-b border-border/60 px-4 py-2.5 md:grid-cols-[minmax(0,2.3fr)_minmax(0,0.7fr)_104px_68px_180px] md:items-center">
                      <div className="min-w-0 pr-2">
                        <button type="button" onClick={() => setPreviewDocument(document)} disabled={isLoadingDocument} className="inline-flex min-w-0 items-center gap-2 text-left font-medium text-foreground hover:text-primary disabled:cursor-wait disabled:opacity-70">
                          {isLoadingDocument ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : getDocumentIcon(document)}<span className="block min-w-0 truncate">{document.title}</span>
                        </button>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{document.fileName}</p>
                      </div>
                      <div className="min-w-0 text-sm text-muted-foreground md:pr-2">
                        {folderName ? (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs"><FolderOpen className="h-3 w-3" /><span className="truncate">{folderName}</span></span>
                        ) : <span className="text-xs">Senza cartella</span>}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">{formatDocumentDate(document.updatedAt ?? document.createdAt ?? null)}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{formatFileSize(document.sizeBytes) ?? '-'}</div>
                      <div className="flex flex-wrap justify-start gap-1.5 md:justify-end">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPreviewDocument(document)} disabled={isLoadingDocument}>
                          <FileText className="mr-1 h-3.5 w-3.5" />{supportsPreview ? 'Anteprima' : 'Apri'}
                        </Button>
                        {isLoadingDocument ? (
                          <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-xs" disabled>
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />In caricamento
                          </Button>
                        ) : (
                          <Button asChild variant="secondary" size="sm" className="h-7 px-2 text-xs">
                            <a href={getDocumentProxyUrl(document, 'attachment')} target="_blank" rel="noreferrer" download={document.fileName}>
                              <Download className="mr-1 h-3.5 w-3.5" />Scarica
                            </a>
                          </Button>
                        )}
                        {isAdmin && !isReadonlyLinkedDocument(document) ? (
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { setRenamingDocumentId(document.id); setRenameDocumentValue(document.title); }}>
                            <Edit2 className="mr-1 h-3.5 w-3.5" />Rinomina
                          </Button>
                        ) : null}
                        {canDeleteDocument(document) ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="destructive" size="sm" className="h-7 px-2 text-xs" disabled={deletingDocumentId === document.id}>
                                {deletingDocumentId === document.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}Elimina
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminare questo documento?</AlertDialogTitle>
                                <AlertDialogDescription>L'operazione non può essere annullata.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void handleDeleteDocument(document)}>Elimina definitivamente</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto p-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleDocuments.map(document => {
                    const folderName = sortedFolders.find(f => f.id === document.folderId)?.name;
                    const isLoadingDocument = isLoadingLinkedDocument(document);
                    const supportsPreview = canPreviewDocumentFile(document);
                    return (
                      <div key={document.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <button type="button" onClick={() => setPreviewDocument(document)} disabled={isLoadingDocument} className="mb-2 inline-flex min-w-0 items-center gap-2 text-left font-medium text-foreground hover:text-primary disabled:cursor-wait disabled:opacity-70">
                          {isLoadingDocument ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : getDocumentIcon(document)}<span className="truncate">{document.title}</span>
                        </button>
                        <p className="truncate text-xs text-muted-foreground">{document.fileName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {folderName ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5"><FolderOpen className="h-3 w-3" />{folderName}</span>
                          ) : <span className="rounded-full border border-border/60 bg-background px-2 py-0.5">Senza cartella</span>}
                          <span className="rounded-full border border-border/60 bg-background px-2 py-0.5">{formatFileSize(document.sizeBytes) ?? '-'}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDocumentDate(document.updatedAt ?? document.createdAt ?? null)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewDocument(document)} disabled={isLoadingDocument}>{supportsPreview ? 'Anteprima' : 'Apri'}</Button>
                          {isLoadingDocument ? (
                            <Button type="button" size="sm" variant="secondary" disabled>
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />In caricamento
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="secondary">
                              <a href={getDocumentProxyUrl(document, 'attachment')} target="_blank" rel="noreferrer" download={document.fileName}>Scarica</a>
                            </Button>
                          )}
                          {canDeleteDocument(document) ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button type="button" size="sm" variant="destructive" disabled={deletingDocumentId === document.id}>
                                  {deletingDocumentId === document.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}Elimina
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminare questo documento?</AlertDialogTitle>
                                  <AlertDialogDescription>L'operazione non può essere annullata.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void handleDeleteDocument(document)}>Elimina definitivamente</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              {selectedFolderId !== null ? 'Nessun documento nella cartella selezionata.' : 'Nessun documento caricato.'}
            </div>
          )}
        </section>
      </div>

      {/* Document preview dialog */}
      <Dialog open={Boolean(previewDocument)} onOpenChange={open => !open && setPreviewDocument(null)}>
        <DialogContent className="flex h-[92vh] w-[97vw] max-w-7xl flex-col">
          <DialogHeader>
            <DialogTitle>{previewDocument?.title ?? 'Anteprima documento'}</DialogTitle>
            <DialogDescription>{previewDocument?.fileName ?? ''}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
            {previewDocument ? (
              <DocumentPreviewContent
                {...previewDocument}
                title={previewDocument.title}
                editable={isAdmin}
                isSavingSpreadsheet={savingSpreadsheetDocumentId === previewDocument.id}
                onSaveSpreadsheet={payload => handleSaveSpreadsheetDocument(previewDocument, payload)}
              />
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button asChild>
              <a href={previewDocument ? getDocumentProxyUrl(previewDocument, 'attachment') : '#'} target="_blank" rel="noreferrer" download={previewDocument?.fileName}>
                <Download className="mr-2 h-4 w-4" />Scarica
              </a>
            </Button>
            {previewDocument && canDeleteDocument(previewDocument) ? (
              <Button type="button" variant="destructive" disabled={deletingDocumentId === previewDocument.id} onClick={() => void handleDeleteDocument(previewDocument)}>
                {deletingDocumentId === previewDocument.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Elimina
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename document dialog */}
      <Dialog open={renamingDocumentId !== null} onOpenChange={open => !open && setRenamingDocumentId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rinomina documento</DialogTitle><DialogDescription>Inserisci il nuovo nome.</DialogDescription></DialogHeader>
          <Input value={renameDocumentValue} onChange={e => setRenameDocumentValue(e.target.value)} placeholder="Nuovo nome" autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && renamingDocumentId) { const d = documents?.find(doc => doc.id === renamingDocumentId); if (d) void handleRenameDocument(d); }
              if (e.key === 'Escape') setRenamingDocumentId(null);
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingDocumentId(null)}>Annulla</Button>
            <Button onClick={() => { const d = documents?.find(doc => doc.id === renamingDocumentId); if (d) void handleRenameDocument(d); }}>Rinomina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename folder dialog */}
      <Dialog open={renamingFolderId !== null} onOpenChange={open => !open && setRenamingFolderId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rinomina cartella</DialogTitle><DialogDescription>Inserisci il nuovo nome.</DialogDescription></DialogHeader>
          <Input value={renameFolderValue} onChange={e => setRenameFolderValue(e.target.value)} placeholder="Nuovo nome" autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && renamingFolderId) { const f = folders?.find(folder => folder.id === renamingFolderId); if (f) void handleRenameFolder(f); }
              if (e.key === 'Escape') setRenamingFolderId(null);
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingFolderId(null)}>Annulla</Button>
            <Button onClick={() => { const f = folders?.find(folder => folder.id === renamingFolderId); if (f) void handleRenameFolder(f); }}>Rinomina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder confirmation dialog */}
      <AlertDialog open={deletingFolderConfirm !== null} onOpenChange={open => !open && setDeletingFolderConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la cartella "{deletingFolderConfirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno eliminati anche tutti i file e le sottocartelle contenuti. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingFolderConfirm) { void handleDeleteFolder(deletingFolderConfirm); setDeletingFolderConfirm(null); } }}
            >
              Elimina tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
