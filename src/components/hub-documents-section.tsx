'use client';

import { useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import {
  Download,
  Edit2,
  FileText,
  FolderOpen,
  FolderPlus,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
  Folder,
  HardDrive,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowUpDown,
  FileImage,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  FileVideo,
  FileAudio,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';

import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebaseApp, useFirestore, useMemoFirebase, useUser, useUserRole } from '@/firebase';
import type { HubDocument, HubDocumentFolder } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { canPreviewDocumentFile, DocumentPreviewContent, getDocumentProxyUrl } from '@/components/document-preview-content';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const HUB_DOCUMENTS_COLLECTION = 'hubDocuments';
const HUB_FOLDERS_COLLECTION = 'hubDocumentFolders';

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
  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getFileExtension(fileName?: string | null) {
  if (!fileName || !fileName.includes('.')) return '';
  return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

function getDocumentIcon(document: HubDocument) {
  const extension = getFileExtension(document.fileName);
  const contentType = document.contentType?.toLowerCase() ?? '';

  if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return <FileImage className="h-4 w-4 shrink-0 text-sky-500" />;
  }
  if (contentType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi'].includes(extension)) {
    return <FileVideo className="h-4 w-4 shrink-0 text-violet-500" />;
  }
  if (contentType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension)) {
    return <FileAudio className="h-4 w-4 shrink-0 text-fuchsia-500" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return <FileArchive className="h-4 w-4 shrink-0 text-amber-600" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />;
  }
  if (['json', 'xml', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'md'].includes(extension)) {
    return <FileCode className="h-4 w-4 shrink-0 text-indigo-500" />;
  }

  return <FileText className="h-4 w-4 shrink-0 text-primary" />;
}

type DocumentSortKey = 'title' | 'updatedAt' | 'sizeBytes';

type FolderListItem = HubDocumentFolder & {
  depth: number;
  pathLabel: string;
};

export function HubDocumentsSection() {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const { user } = useUser();
  const { role, roleData, isLoading } = useUserRole();
  const { toast } = useToast();
  const storage = useMemo(() => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'), [app]);

  const isAdmin = role === 'admin';
  const isHubSeller = role === 'seller' && roleData?.sellerType?.toUpperCase() === 'HUB';
  const canAccess = isAdmin || isHubSeller;
  const canUploadDocuments = canAccess;
  const canDeleteDocuments = canAccess;
  const canCreateFolders = canAccess;

  const documentsRef = useMemoFirebase(
    () => (firestore && canAccess ? collection(firestore, HUB_DOCUMENTS_COLLECTION) : null),
    [firestore, canAccess]
  );
  const foldersRef = useMemoFirebase(
    () => (firestore && canAccess ? collection(firestore, HUB_FOLDERS_COLLECTION) : null),
    [firestore, canAccess]
  );

  const { data: documents, isLoading: isLoadingDocuments, error: documentsError } =
    useCollection<HubDocument>(documentsRef);
  const { data: folders } = useCollection<HubDocumentFolder>(foldersRef);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<HubDocument | null>(null);
  const [savingSpreadsheetDocumentId, setSavingSpreadsheetDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [isImportingDirectory, setIsImportingDirectory] = useState(false);
  const [directoryFiles, setDirectoryFiles] = useState<File[]>([]);
  const [folderSearch, setFolderSearch] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [documentSortKey, setDocumentSortKey] = useState<DocumentSortKey>('updatedAt');
  const [documentSortDirection, setDocumentSortDirection] = useState<'asc' | 'desc'>('desc');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [moveFolderParentId, setMoveFolderParentId] = useState<string>('root');
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [renameDocumentValue, setRenameDocumentValue] = useState('');
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null);
  const [moveDocumentFolderId, setMoveDocumentFolderId] = useState<string>('none');
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [dropFolderTargetId, setDropFolderTargetId] = useState<string | '__none__' | null>(null);
  const [deletingFolderConfirm, setDeletingFolderConfirm] = useState<HubDocumentFolder | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showNewSubfolderInput, setShowNewSubfolderInput] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');

  const folderMap = useMemo(
    () => new Map((folders ?? []).map(folder => [folder.id, folder])),
    [folders]
  );

  const childFolderIdsByParent = useMemo(() => {
    const nextMap = new Map<string | null, HubDocumentFolder[]>();
    for (const folder of folders ?? []) {
      const parentId = folder.parentId ?? null;
      const siblings = nextMap.get(parentId) ?? [];
      siblings.push(folder);
      nextMap.set(parentId, siblings);
    }

    for (const [parentId, items] of nextMap.entries()) {
      nextMap.set(parentId, [...items].sort((left, right) => left.name.localeCompare(right.name, 'it')));
    }

    return nextMap;
  }, [folders]);

  const getFolderPathLabel = (folderId: string | null | undefined) => {
    if (!folderId) {
      return '';
    }

    const segments: string[] = [];
    let currentFolder = folderMap.get(folderId) ?? null;

    while (currentFolder) {
      segments.unshift(currentFolder.name);
      currentFolder = currentFolder.parentId ? folderMap.get(currentFolder.parentId) ?? null : null;
    }

    return segments.join(' / ');
  };

  const flattenedFolders = useMemo(() => {
    const items: FolderListItem[] = [];

    const walk = (parentId: string | null, depth: number) => {
      for (const folder of childFolderIdsByParent.get(parentId) ?? []) {
        items.push({
          ...folder,
          depth,
          pathLabel: getFolderPathLabel(folder.id),
        });
        walk(folder.id, depth + 1);
      }
    };

    walk(null, 0);
    return items;
  }, [childFolderIdsByParent, folderMap]);

  const sortedFolders = flattenedFolders;

  const filteredFolders = useMemo(() => {
    const query = folderSearch.trim().toLowerCase();
    if (!query) {
      return sortedFolders;
    }

    return sortedFolders.filter(folder => folder.pathLabel.toLowerCase().includes(query));
  }, [folderSearch, sortedFolders]);

  const getDescendantFolderIds = (folderId: string) => {
    const descendantIds = new Set<string>([folderId]);
    const queue = [folderId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const childFolder of childFolderIdsByParent.get(currentId) ?? []) {
        if (!descendantIds.has(childFolder.id)) {
          descendantIds.add(childFolder.id);
          queue.push(childFolder.id);
        }
      }
    }

    return descendantIds;
  };

  const movableParentFolders = useMemo(() => {
    if (!movingFolderId) {
      return sortedFolders;
    }

    const blockedIds = getDescendantFolderIds(movingFolderId);
    return sortedFolders.filter(folder => !blockedIds.has(folder.id));
  }, [movingFolderId, sortedFolders]);

  const filteredDocuments = useMemo(() => {
    const all = [...(documents ?? [])];
    if (selectedFolderId === null) return all;
    if (selectedFolderId === '__none__') return all.filter(d => !d.folderId);
    return all.filter(d => d.folderId === selectedFolderId);
  }, [documents, selectedFolderId]);

  const searchedDocuments = useMemo(() => {
    const query = documentSearch.trim().toLowerCase();
    if (!query) {
      return filteredDocuments;
    }

    return filteredDocuments.filter(document => {
      const title = document.title?.toLowerCase() ?? '';
      const fileName = document.fileName?.toLowerCase() ?? '';
      return title.includes(query) || fileName.includes(query);
    });
  }, [filteredDocuments, documentSearch]);

  const visibleDocuments = useMemo(() => {
    const ordered = [...searchedDocuments].sort((left, right) => {
      if (documentSortKey === 'title') {
        const result = (left.title ?? '').localeCompare(right.title ?? '', 'it', { sensitivity: 'base' });
        return documentSortDirection === 'asc' ? result : -result;
      }

      if (documentSortKey === 'sizeBytes') {
        const result = (left.sizeBytes ?? 0) - (right.sizeBytes ?? 0);
        return documentSortDirection === 'asc' ? result : -result;
      }

      const leftValue = getDocumentTimestamp(left.updatedAt ?? left.createdAt);
      const rightValue = getDocumentTimestamp(right.updatedAt ?? right.createdAt);
      const result = leftValue - rightValue;
      return documentSortDirection === 'asc' ? result : -result;
    });

    return ordered;
  }, [searchedDocuments, documentSortKey, documentSortDirection]);

  const currentFolderLabel = useMemo(() => {
    if (selectedFolderId === null) return 'Tutti i file';
    if (selectedFolderId === '__none__') return 'Senza cartella';
    return getFolderPathLabel(selectedFolderId) || 'Cartella';
  }, [selectedFolderId, sortedFolders]);

  const selectedRootFolderId = useMemo(() => {
    if (!selectedFolderId || selectedFolderId === '__none__') return selectedFolderId;
    let current = folderMap.get(selectedFolderId);
    while (current?.parentId) {
      current = folderMap.get(current.parentId);
    }
    return current?.id ?? selectedFolderId;
  }, [selectedFolderId, folderMap]);

  const currentSubfolders = useMemo(() => {
    if (!selectedFolderId || selectedFolderId === '__none__') return [];
    return childFolderIdsByParent.get(selectedFolderId) ?? [];
  }, [selectedFolderId, childFolderIdsByParent]);

  if (isLoading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardHeader><CardTitle>Documenti HUB</CardTitle><CardDescription>Caricamento permessi in corso.</CardDescription></CardHeader>
      </Card>
    );
  }

  if (!canAccess) return null;

  const buildFolderId = (folderName: string, parentId?: string | null) => {
    const normalizedName = normalizeKey(folderName);
    if (!normalizedName) {
      return '';
    }

    return parentId ? `${parentId}__${normalizedName}` : normalizedName;
  };

  const createFolderRecord = async (folderName: string, parentId?: string | null) => {
    if (!firestore || !user) {
      return null;
    }

    const trimmed = folderName.trim();
    const folderId = buildFolderId(trimmed, parentId ?? null);
    if (!folderId) {
      return null;
    }

    const folderRef = doc(firestore, HUB_FOLDERS_COLLECTION, folderId);
    const existing = await getDoc(folderRef);
    if (!existing.exists()) {
      await setDocumentNonBlocking(folderRef, {
        id: folderId,
        name: trimmed,
        parentId: parentId ?? null,
        createdAt: serverTimestamp(),
        createdByUid: user.uid,
        createdByEmail: user.email ?? null,
      }, {});
    }

    return folderId;
  };

  const handleCreateFolder = async (parentId: string | null) => {
    if (!firestore || !user) return;
    const trimmed = newFolderName.trim();
    if (!trimmed) { toast({ variant: 'destructive', title: 'Nome cartella obbligatorio' }); return; }
    const folderId = buildFolderId(trimmed, parentId);
    if (!folderId) { toast({ variant: 'destructive', title: 'Nome non valido' }); return; }
    setIsCreatingFolder(true);
    try {
      const folderRef = doc(firestore, HUB_FOLDERS_COLLECTION, folderId);
      const existing = await getDoc(folderRef);
      if (existing.exists()) {
        toast({ variant: 'destructive', title: 'Cartella gia esistente', description: `Una cartella "${trimmed}" esiste gia.` });
        return;
      }
      await setDocumentNonBlocking(folderRef, {
        id: folderId, name: trimmed, parentId, createdAt: serverTimestamp(),
        createdByUid: user.uid, createdByEmail: user.email ?? null,
      }, {});
      setNewFolderName('');
      setShowNewFolderInput(false);
      toast({ title: `Cartella "${trimmed}" creata` });
    } catch (error) {
      console.error('Errore creazione cartella HUB', error);
      toast({ variant: 'destructive', title: 'Errore creazione cartella' });
    } finally { setIsCreatingFolder(false); }
  };

  const handleCreateSubfolder = async () => {
    if (!firestore || !user || !selectedFolderId || selectedFolderId === '__none__') return;
    const trimmed = newSubfolderName.trim();
    if (!trimmed) { toast({ variant: 'destructive', title: 'Nome sottocartella obbligatorio' }); return; }
    const folderId = buildFolderId(trimmed, selectedFolderId);
    if (!folderId) { toast({ variant: 'destructive', title: 'Nome non valido' }); return; }
    setIsCreatingFolder(true);
    try {
      const folderRef = doc(firestore, HUB_FOLDERS_COLLECTION, folderId);
      const existing = await getDoc(folderRef);
      if (existing.exists()) {
        toast({ variant: 'destructive', title: 'Cartella gia esistente', description: `Una cartella "${trimmed}" esiste gia.` });
        return;
      }
      await setDocumentNonBlocking(folderRef, {
        id: folderId, name: trimmed, parentId: selectedFolderId, createdAt: serverTimestamp(),
        createdByUid: user.uid, createdByEmail: user.email ?? null,
      }, {});
      setNewSubfolderName('');
      setShowNewSubfolderInput(false);
      toast({ title: `Sottocartella "${trimmed}" creata` });
    } catch (error) {
      console.error('Errore creazione sottocartella HUB', error);
      toast({ variant: 'destructive', title: 'Errore creazione sottocartella' });
    } finally { setIsCreatingFolder(false); }
  };

  const handleDeleteFolder = async (folder: HubDocumentFolder) => {
    if (!firestore) return;

    const collectDescendantFolderIds = (folderId: string): string[] => {
      const children = childFolderIdsByParent.get(folderId) ?? [];
      return children.flatMap(child => [child.id, ...collectDescendantFolderIds(child.id)]);
    };

    const allFolderIds = [folder.id, ...collectDescendantFolderIds(folder.id)];
    const allDocs = (documents ?? []).filter(d => d.folderId && allFolderIds.includes(d.folderId));

    try {
      await Promise.all(allDocs.map(async d => {
        try {
          if (d.storagePath) await deleteObject(ref(storage, d.storagePath));
          await deleteDoc(doc(firestore, HUB_DOCUMENTS_COLLECTION, d.id));
        } catch (err) {
          console.error('Errore eliminazione documento nella cartella', err);
        }
      }));
      await Promise.all(allFolderIds.map(id => deleteDoc(doc(firestore, HUB_FOLDERS_COLLECTION, id))));
      if (allFolderIds.includes(selectedFolderId ?? '')) setSelectedFolderId(null);
      if (previewDocument && allDocs.some(d => d.id === previewDocument.id)) setPreviewDocument(null);
      toast({ title: `Cartella "${folder.name}" eliminata`, description: allDocs.length > 0 ? `${allDocs.length} file eliminati.` : undefined });
    } catch (error) {
      console.error('Errore eliminazione cartella HUB', error);
      toast({ variant: 'destructive', title: 'Impossibile eliminare la cartella' });
    }
  };

  const handleUpload = async () => {
    if (!firestore || !user || !selectedFile) {
      toast({ variant: 'destructive', title: 'Seleziona un file prima di avviare l upload.' });
      return;
    }
    const trimmedTitle = selectedFile.name.replace(/\.[^.]+$/, '').trim() || selectedFile.name.trim();
    if (!trimmedTitle) { toast({ variant: 'destructive', title: 'Nome file non valido' }); return; }
    const documentKey = normalizeKey(trimmedTitle);
    if (!documentKey) { toast({ variant: 'destructive', title: 'Nome file non valido' }); return; }
    const folderId = selectedFolderId && selectedFolderId !== '__none__' ? selectedFolderId : null;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const documentRef = doc(firestore, HUB_DOCUMENTS_COLLECTION, documentKey);
      const existingSnapshot = await getDoc(documentRef);
      const storagePath = `hub-documents/${user.uid}/${documentKey}/content`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile, {
        contentType: selectedFile.type || 'application/octet-stream',
        customMetadata: { originalName: selectedFile.name },
      });
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          snapshot => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          reject, () => resolve());
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
      toast({ title: 'Documento caricato', description: `${trimmedTitle} e pronto per il download.` });
    } catch (error) {
      console.error('Errore caricamento documento HUB', error);
      toast({ variant: 'destructive', title: 'Upload fallito', description: 'Impossibile caricare il documento. Riprova tra poco.' });
    } finally { setIsUploading(false); setUploadProgress(0); }
  };

  const handleDirectoryImport = async () => {
    if (!firestore || !user || directoryFiles.length === 0) {
      toast({ variant: 'destructive', title: 'Seleziona una cartella da importare.' });
      return;
    }

    setIsImportingDirectory(true);
    setUploadProgress(0);

    try {
      const selectedParentId = selectedFolderId && selectedFolderId !== '__none__' ? selectedFolderId : null;

      for (let fileIndex = 0; fileIndex < directoryFiles.length; fileIndex += 1) {
        const file = directoryFiles[fileIndex];
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const pathSegments = relativePath.split('/').filter(Boolean);
        const fileName = pathSegments[pathSegments.length - 1] || file.name;
        const folderSegments = pathSegments.slice(0, -1);

        let currentParentId = selectedParentId;
        for (const segment of folderSegments) {
          currentParentId = await createFolderRecord(segment, currentParentId);
        }

        const titleValue = fileName.replace(/\.[^.]+$/, '') || fileName;
        const documentKey = normalizeKey(`${currentParentId ?? 'root'}-${relativePath}`);
        const documentRef = doc(firestore, HUB_DOCUMENTS_COLLECTION, documentKey);
        const storagePath = `hub-documents/${user.uid}/${documentKey}/content`;
        const storageRef = ref(storage, storagePath);

        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
          customMetadata: { originalName: file.name, relativePath },
        });

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', undefined, reject, () => resolve());
        });

        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

        await setDocumentNonBlocking(documentRef, {
          id: documentKey,
          title: titleValue,
          titleKey: normalizeKey(titleValue),
          fileName,
          fileUrl: downloadUrl,
          storagePath,
          contentType: file.type || null,
          sizeBytes: file.size,
          folderId: currentParentId ?? null,
          uploadedByUid: user.uid,
          uploadedByEmail: user.email ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        setUploadProgress(((fileIndex + 1) / directoryFiles.length) * 100);
      }

      setDirectoryFiles([]);
      if (directoryInputRef.current) {
        directoryInputRef.current.value = '';
      }
      toast({ title: 'Cartella importata', description: `${directoryFiles.length} file importati con la struttura originale.` });
    } catch (error) {
      console.error('Errore import cartella HUB', error);
      toast({
        variant: 'destructive',
        title: 'Import cartella fallito',
        description: 'Non riesco a importare la cartella selezionata.',
      });
    } finally {
      setIsImportingDirectory(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (documentToDelete: HubDocument) => {
    if (!firestore || !storage) return;

    setDeletingDocumentId(documentToDelete.id);

    try {
      if (documentToDelete.storagePath) {
        await deleteObject(ref(storage, documentToDelete.storagePath));
      }

      await deleteDoc(doc(firestore, HUB_DOCUMENTS_COLLECTION, documentToDelete.id));

      if (previewDocument?.id === documentToDelete.id) {
        setPreviewDocument(null);
      }

      toast({
        title: 'Documento eliminato',
        description: `"${documentToDelete.title}" è stato rimosso.`,
      });
    } catch (error) {
      console.error('Errore eliminazione documento HUB', error);
      toast({
        variant: 'destructive',
        title: 'Impossibile eliminare il documento',
        description: 'Controlla i permessi o verifica che il file esista ancora nello storage.',
      });
    } finally {
      setDeletingDocumentId(current => (current === documentToDelete.id ? null : current));
    }
  };

  const handleSaveDocument = async (
    documentToUpdate: HubDocument,
    payload: { blob: Blob; fileName: string; contentType: string; sizeBytes: number }
  ) => {
    if (!firestore || !user) {
      throw new Error('AUTH_REQUIRED');
    }

    setSavingSpreadsheetDocumentId(documentToUpdate.id);

    try {
      const storagePath = documentToUpdate.storagePath || `hub-documents/${user.uid}/${documentToUpdate.id}/content`;
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
        doc(firestore, HUB_DOCUMENTS_COLLECTION, documentToUpdate.id),
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
        description: 'Le modifiche sono state salvate direttamente sul portale.',
      });
    } catch (error) {
      console.error('Errore salvataggio documento HUB', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio fallito',
        description: 'Non riesco ad aggiornare il file caricato. Riprova tra poco.',
      });
      throw error;
    } finally {
      setSavingSpreadsheetDocumentId(current => (current === documentToUpdate.id ? null : current));
    }
  };

  const handleRenameFolder = async (folder: HubDocumentFolder) => {
    if (!firestore) return;

    const trimmed = renameFolderValue.trim();
    if (!trimmed || trimmed === folder.name) {
      setRenamingFolderId(null);
      setRenameFolderValue('');
      return;
    }

    try {
      await setDocumentNonBlocking(
        doc(firestore, HUB_FOLDERS_COLLECTION, folder.id),
        { name: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );

      toast({
        title: 'Cartella rinominata',
        description: `Cartella rinominata a "${trimmed}".`,
      });
    } catch (error) {
      console.error('Errore rinomina cartella HUB', error);
      toast({
        variant: 'destructive',
        title: 'Impossibile rinominare la cartella',
      });
    } finally {
      setRenamingFolderId(null);
      setRenameFolderValue('');
    }
  };

  const handleMoveFolder = async () => {
    if (!firestore || !movingFolderId) {
      return;
    }

    const folderToMove = folders?.find(folder => folder.id === movingFolderId);
    if (!folderToMove) {
      return;
    }

    const nextParentId = moveFolderParentId === 'root' ? null : moveFolderParentId;
    if (folderToMove.parentId === nextParentId) {
      setMovingFolderId(null);
      setMoveFolderParentId('root');
      return;
    }

    const blockedIds = getDescendantFolderIds(folderToMove.id);
    if (nextParentId && blockedIds.has(nextParentId)) {
      toast({
        variant: 'destructive',
        title: 'Spostamento non valido',
        description: 'Non puoi spostare una cartella dentro sé stessa o una sua sottocartella.',
      });
      return;
    }

    try {
      await setDocumentNonBlocking(
        doc(firestore, HUB_FOLDERS_COLLECTION, folderToMove.id),
        { parentId: nextParentId, updatedAt: serverTimestamp() },
        { merge: true }
      );

      toast({
        title: 'Cartella spostata',
        description: nextParentId
          ? `La cartella "${folderToMove.name}" è stata spostata.`
          : `La cartella "${folderToMove.name}" è stata portata al livello principale.`,
      });
    } catch (error) {
      console.error('Errore spostamento cartella HUB', error);
      toast({
        variant: 'destructive',
        title: 'Impossibile spostare la cartella',
      });
    } finally {
      setMovingFolderId(null);
      setMoveFolderParentId('root');
    }
  };

  const handleRenameDocument = async (document: HubDocument) => {
    if (!firestore) return;

    const trimmed = renameDocumentValue.trim();
    if (!trimmed || trimmed === document.title) {
      setRenamingDocumentId(null);
      setRenameDocumentValue('');
      return;
    }

    try {
      await setDocumentNonBlocking(
        doc(firestore, HUB_DOCUMENTS_COLLECTION, document.id),
        { title: trimmed, updatedAt: serverTimestamp() },
        { merge: true }
      );

      if (previewDocument?.id === document.id) {
        setPreviewDocument({ ...previewDocument, title: trimmed });
      }

      toast({
        title: 'Documento rinominato',
        description: `Documento rinominato a "${trimmed}".`,
      });
    } catch (error) {
      console.error('Errore rinomina documento HUB', error);
      toast({
        variant: 'destructive',
        title: 'Impossibile rinominare il documento',
      });
    } finally {
      setRenamingDocumentId(null);
      setRenameDocumentValue('');
    }
  };

  const moveDocumentToFolder = async (documentId: string, nextFolderId: string | null) => {
    if (!firestore) {
      return;
    }

    const documentToMove = documents?.find(document => document.id === documentId);
    if (!documentToMove) {
      return;
    }

    if ((documentToMove.folderId ?? null) === nextFolderId) {
      return;
    }

    try {
      await setDocumentNonBlocking(
        doc(firestore, HUB_DOCUMENTS_COLLECTION, documentToMove.id),
        { folderId: nextFolderId, updatedAt: serverTimestamp() },
        { merge: true }
      );

      toast({
        title: 'Documento spostato',
        description: nextFolderId
          ? `Il file è stato spostato in "${getFolderPathLabel(nextFolderId)}".`
          : 'Il file è stato spostato in Senza cartella.',
      });
    } catch (error) {
      console.error('Errore spostamento documento HUB', error);
      toast({
        variant: 'destructive',
        title: 'Impossibile spostare il documento',
      });
    }
  };

  const handleMoveDocument = async () => {
    if (!movingDocumentId) {
      return;
    }

    const nextFolderId = moveDocumentFolderId === 'none' ? null : moveDocumentFolderId;
    await moveDocumentToFolder(movingDocumentId, nextFolderId);
    setMovingDocumentId(null);
    setMoveDocumentFolderId('none');
  };

  const handleDocumentDragStart = (documentId: string) => {
    setDraggedDocumentId(documentId);
  };

  const clearDocumentDragState = () => {
    setDraggedDocumentId(null);
    setDropFolderTargetId(null);
  };

  const handleFolderDragOver = (
    event: React.DragEvent<HTMLElement>,
    folderTargetId: string | '__none__'
  ) => {
    if (!draggedDocumentId) {
      return;
    }

    event.preventDefault();
    if (dropFolderTargetId !== folderTargetId) {
      setDropFolderTargetId(folderTargetId);
    }
  };

  const handleFolderDrop = async (
    event: React.DragEvent<HTMLElement>,
    folderTargetId: string | '__none__'
  ) => {
    event.preventDefault();

    if (!draggedDocumentId) {
      return;
    }

    const nextFolderId = folderTargetId === '__none__' ? null : folderTargetId;
    await moveDocumentToFolder(draggedDocumentId, nextFolderId);
    clearDocumentDragState();
  };

  const handleSortChange = (nextKey: DocumentSortKey) => {
    setDocumentSortDirection(current => {
      if (documentSortKey === nextKey) {
        return current === 'asc' ? 'desc' : 'asc';
      }
      return nextKey === 'title' ? 'asc' : 'desc';
    });
    setDocumentSortKey(nextKey);
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Documenti HUB</CardTitle>
            <CardDescription>
              Carica file condivisi, organizzali in cartelle e rendili disponibili al download.
            </CardDescription>
          </div>
          <div className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            Visibile solo ad admin e seller HUB
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Folder className="h-4 w-4 text-primary" />
                Cartelle
              </div>
              {canCreateFolders ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setShowNewFolderInput(v => !v)}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Nuova
                </Button>
              ) : null}
            </div>

            {showNewFolderInput ? (
              <div className="mb-3 space-y-2 rounded-xl border border-border/60 bg-background p-2">
                <Input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="Nome cartella"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleCreateFolder(null);
                    if (e.key === 'Escape') {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => void handleCreateFolder(null)} disabled={isCreatingFolder}>
                    {isCreatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crea'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }}
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={folderSearch}
                onChange={e => setFolderSearch(e.target.value)}
                placeholder="Cerca cartella"
                className="h-9 pl-9 pr-9"
              />
              {folderSearch ? (
                <button
                  type="button"
                  onClick={() => setFolderSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  aria-label="Azzera ricerca cartelle"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="max-h-[460px] space-y-1 overflow-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors',
                  selectedFolderId === null
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Tutti i file
                </span>
                <span className="text-xs">{documents?.length ?? 0}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFolderId('__none__')}
                onDragOver={event => handleFolderDragOver(event, '__none__')}
                onDrop={event => void handleFolderDrop(event, '__none__')}
                onDragLeave={() => {
                  if (dropFolderTargetId === '__none__') {
                    setDropFolderTargetId(null);
                  }
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors',
                  selectedFolderId === '__none__'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                  dropFolderTargetId === '__none__' && 'ring-2 ring-primary/60'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Senza cartella
                </span>
                <span className="text-xs">{documents?.filter(d => !d.folderId).length ?? 0}</span>
              </button>

              {filteredFolders.filter(f => f.depth === 0).map(folder => (
                <div key={folder.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    onDragOver={event => handleFolderDragOver(event, folder.id)}
                    onDrop={event => void handleFolderDrop(event, folder.id)}
                    onDragLeave={() => {
                      if (dropFolderTargetId === folder.id) {
                        setDropFolderTargetId(null);
                      }
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      selectedRootFolderId === folder.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted',
                      dropFolderTargetId === folder.id && 'ring-2 ring-primary/60'
                    )}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <span className="text-xs">{documents?.filter(d => d.folderId === folder.id).length ?? 0}</span>
                  </button>
                  {canCreateFolders ? (
                    <>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        onClick={() => {
                          setMovingFolderId(folder.id);
                          setMoveFolderParentId(folder.parentId ?? 'root');
                        }}
                        title="Sposta cartella"
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      {isAdmin ? (
                        <>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        onClick={() => {
                          setRenamingFolderId(folder.id);
                          setRenameFolderValue(folder.name);
                        }}
                        title="Rinomina cartella"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100"
                        onClick={() => setDeletingFolderConfirm(folder)}
                        title="Elimina cartella"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ))}

              {filteredFolders.filter(f => f.depth === 0).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                  Nessuna cartella trovata.
                </div>
              ) : null}
            </div>
          </aside>

          <section className="space-y-4">
              {canUploadDocuments ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Carica nuovo documento</p>
                  <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    {visibleDocuments.length} file
                  </span>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Destinazione upload: <span className="font-medium text-foreground">{currentFolderLabel}</span>
                </p>
                <div className="grid gap-3 md:grid-cols-1">
                  <div className="flex">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={e => {
                        setSelectedFile(e.target.files?.[0] ?? null);
                        setDirectoryFiles([]);
                      }}
                    />
                    <input
                      ref={node => {
                        directoryInputRef.current = node;
                        if (node) {
                          node.setAttribute('webkitdirectory', '');
                          node.setAttribute('directory', '');
                        }
                      }}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={event => {
                        setDirectoryFiles(Array.from(event.target.files ?? []));
                        setSelectedFile(null);
                      }}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isUploading || isImportingDirectory}
                          className="flex-1 justify-start rounded-r-none"
                        >
                          {directoryFiles.length > 0 ? (
                            <FolderOpen className="mr-2 h-4 w-4" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          {directoryFiles.length > 0
                            ? `Cartella selezionata (${directoryFiles.length})`
                            : selectedFile
                              ? `File selezionato: ${selectedFile.name}`
                              : 'Seleziona file o cartella'}
                          <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" sideOffset={6}>
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                          <FileText className="mr-2 h-4 w-4" />
                          Seleziona file
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => directoryInputRef.current?.click()}>
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Seleziona cartella
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      className="rounded-l-none border-l-0 px-2"
                      onClick={directoryFiles.length > 0 ? handleDirectoryImport : handleUpload}
                      disabled={isUploading || isImportingDirectory || (!selectedFile && directoryFiles.length === 0)}
                    >
                      {isUploading || isImportingDirectory ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {selectedFile ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <FileText className="mr-1 inline h-3 w-3" />
                    {selectedFile.name}{formatFileSize(selectedFile.size) ? ` · ${formatFileSize(selectedFile.size)}` : ''}
                  </p>
                ) : directoryFiles.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <FolderOpen className="mr-1 inline h-3 w-3" />
                    {directoryFiles.length} file selezionati dalla cartella
                    <button
                      type="button"
                      className="ml-2 text-destructive hover:underline"
                      onClick={() => { setDirectoryFiles([]); if (directoryInputRef.current) directoryInputRef.current.value = ''; }}
                    >
                      Rimuovi
                    </button>
                  </p>
                ) : null}
                {isUploading || isImportingDirectory ? <Progress value={uploadProgress} className="mt-2 h-1.5" /> : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border/60 bg-background">
              <div className="border-b border-border/60 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    {selectedFolderId && selectedFolderId !== '__none__' && folderMap.get(selectedFolderId)?.parentId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(folderMap.get(selectedFolderId!)?.parentId ?? null)}
                        className="mr-1 rounded-md p-0.5 hover:bg-muted"
                        title="Torna alla cartella superiore"
                      >
                        <ArrowLeft className="h-4 w-4 text-foreground" />
                      </button>
                    ) : null}
                    <span className="font-medium text-foreground">Il mio Drive</span>
                    <ChevronRight className="h-4 w-4" />
                    <span>{currentFolderLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {canCreateFolders && selectedFolderId && selectedFolderId !== '__none__' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => setShowNewSubfolderInput(v => !v)}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        Nuova sottocartella
                      </Button>
                    ) : null}
                    <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                      <Button
                        type="button"
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setViewMode('list')}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {showNewSubfolderInput && selectedFolderId && selectedFolderId !== '__none__' ? (
                  <div className="mb-3 space-y-2 rounded-xl border border-border/60 bg-background p-2">
                    <p className="text-xs text-muted-foreground">
                      Crea una sottocartella dentro <span className="font-medium text-foreground">{folderMap.get(selectedFolderId)?.name}</span>
                    </p>
                    <Input
                      value={newSubfolderName}
                      onChange={e => setNewSubfolderName(e.target.value)}
                      placeholder="Nome sottocartella"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleCreateSubfolder();
                        if (e.key === 'Escape') {
                          setShowNewSubfolderInput(false);
                          setNewSubfolderName('');
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => void handleCreateSubfolder()} disabled={isCreatingFolder}>
                        {isCreatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crea'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => { setShowNewSubfolderInput(false); setNewSubfolderName(''); }}
                      >
                        Annulla
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={documentSearch}
                    onChange={e => setDocumentSearch(e.target.value)}
                    placeholder="Cerca nei file per nome o titolo"
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              {currentSubfolders.length > 0 ? (
                <div className="border-b border-border/60 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sottocartelle</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {currentSubfolders.map(subfolder => (
                      <div key={subfolder.id} className="group flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => setSelectedFolderId(subfolder.id)}
                          onDragOver={event => handleFolderDragOver(event, subfolder.id)}
                          onDrop={event => void handleFolderDrop(event, subfolder.id)}
                          onDragLeave={() => {
                            if (dropFolderTargetId === subfolder.id) {
                              setDropFolderTargetId(null);
                            }
                          }}
                        >
                          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0 truncate text-sm font-medium">{subfolder.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {documents?.filter(d => d.folderId === subfolder.id).length ?? 0}
                          </span>
                        </button>
                        {canCreateFolders ? (
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                              onClick={() => {
                                setMovingFolderId(subfolder.id);
                                setMoveFolderParentId(subfolder.parentId ?? 'root');
                              }}
                              title="Sposta"
                            >
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                            {isAdmin ? (
                              <>
                            <button
                              type="button"
                              className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                              onClick={() => { setRenamingFolderId(subfolder.id); setRenameFolderValue(subfolder.name); }}
                              title="Rinomina"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                              onClick={() => setDeletingFolderConfirm(subfolder)}
                              title="Elimina"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {documentsError ? (
                <p className="p-4 text-sm text-destructive">Non riesco a caricare l archivio documenti in questo momento.</p>
              ) : isLoadingDocuments ? (
                <div className="space-y-2 p-3">
                  <div className="h-14 rounded-lg bg-muted/50" />
                  <div className="h-14 rounded-lg bg-muted/50" />
                  <div className="h-14 rounded-lg bg-muted/50" />
                </div>
              ) : visibleDocuments.length > 0 ? (
                viewMode === 'list' ? (
                  <div className="max-h-[640px] overflow-auto">
                    <div className="hidden grid-cols-[minmax(0,2.35fr)_minmax(0,0.72fr)_104px_72px_210px] border-b border-border/60 bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                      <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => handleSortChange('title')}>
                        Nome file <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <span>Cartella</span>
                      <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => handleSortChange('updatedAt')}>
                        Aggiornato <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className="inline-flex items-center gap-1 text-left" onClick={() => handleSortChange('sizeBytes')}>
                        Dimensione <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-right">Azioni</span>
                    </div>
                    {visibleDocuments.map(document => {
                      const folderName = sortedFolders.find(f => f.id === document.folderId)?.name;
                      const supportsPreview = canPreviewDocumentFile(document);
                      return (
                        <div
                          key={document.id}
                          draggable
                          onDragStart={() => handleDocumentDragStart(document.id)}
                          onDragEnd={clearDocumentDragState}
                          className={cn(
                            'grid gap-2 border-b border-border/60 px-4 py-2.5 md:grid-cols-[minmax(0,2.35fr)_minmax(0,0.72fr)_104px_72px_210px] md:items-center',
                            draggedDocumentId === document.id && 'opacity-60'
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <button
                              type="button"
                              onClick={() => setPreviewDocument(document)}
                              className="inline-flex min-w-0 items-center gap-2 text-left font-medium text-foreground hover:text-primary"
                            >
                              {getDocumentIcon(document)}
                              <span className="block min-w-0 truncate">{document.title}</span>
                            </button>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              {document.fileName}
                            </p>
                          </div>

                          <div className="min-w-0 text-sm text-muted-foreground md:pr-2">
                            {folderName ? (
                              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs">
                                <FolderOpen className="h-3 w-3" />
                                <span className="truncate">{folderName}</span>
                              </span>
                            ) : (
                              <span className="text-xs">Senza cartella</span>
                            )}
                          </div>

                          <div className="truncate text-[11px] text-muted-foreground">
                            {formatDocumentDate(document.updatedAt ?? document.createdAt ?? null)}
                          </div>

                          <div className="truncate text-[11px] text-muted-foreground">
                            {formatFileSize(document.sizeBytes) ?? '-'}
                          </div>

                          <div className="flex flex-wrap justify-start gap-1 md:justify-end">
                              <Button type="button" variant="outline" size="sm" className="h-7 px-1.5 text-[11px]" onClick={() => setPreviewDocument(document)}>
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              {supportsPreview ? 'Anteprima' : 'Apri'}
                            </Button>
                              <Button asChild variant="secondary" size="sm" className="h-7 px-1.5 text-[11px]">
                              <a
                                href={getDocumentProxyUrl(document, 'attachment')}
                                target="_blank"
                                rel="noreferrer"
                                download={document.fileName}
                              >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Scarica
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-1.5 text-[11px]"
                              onClick={() => {
                                setMovingDocumentId(document.id);
                                setMoveDocumentFolderId(document.folderId ?? 'none');
                              }}
                            >
                              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
                              Sposta
                            </Button>
                            {isAdmin ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-1.5 text-[11px]"
                                onClick={() => {
                                  setRenamingDocumentId(document.id);
                                  setRenameDocumentValue(document.title);
                                }}
                              >
                                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                                Rinomina
                              </Button>
                            ) : null}
                            {canDeleteDocuments ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" variant="destructive" size="sm" className="h-7 px-1.5 text-[11px]" disabled={deletingDocumentId === document.id}>
                                    {deletingDocumentId === document.id ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Elimina
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminare questo documento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Il file verrà rimosso da Firebase Storage e la scheda documento verrà cancellata.
                                      L operazione non può essere annullata.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => void handleDeleteDocument(document)}>
                                      Elimina definitivamente
                                    </AlertDialogAction>
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
                  <div className="max-h-[640px] overflow-auto p-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {visibleDocuments.map(document => {
                        const folderName = sortedFolders.find(f => f.id === document.folderId)?.name;
                        const supportsPreview = canPreviewDocumentFile(document);
                        return (
                          <div
                            key={document.id}
                            draggable
                            onDragStart={() => handleDocumentDragStart(document.id)}
                            onDragEnd={clearDocumentDragState}
                            className={cn(
                              'rounded-xl border border-border/60 bg-muted/20 p-3',
                              draggedDocumentId === document.id && 'opacity-60'
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewDocument(document)}
                              className="mb-2 inline-flex min-w-0 items-center gap-2 text-left font-medium text-foreground hover:text-primary"
                            >
                              {getDocumentIcon(document)}
                              <span className="truncate">{document.title}</span>
                            </button>
                            <p className="truncate text-xs text-muted-foreground">{document.fileName}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {folderName ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5">
                                  <FolderOpen className="h-3 w-3" />
                                  {folderName}
                                </span>
                              ) : (
                                <span className="rounded-full border border-border/60 bg-background px-2 py-0.5">Senza cartella</span>
                              )}
                              <span className="rounded-full border border-border/60 bg-background px-2 py-0.5">
                                {formatFileSize(document.sizeBytes) ?? '-'}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatDocumentDate(document.updatedAt ?? document.createdAt ?? null)}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1">
                              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setPreviewDocument(document)}>
                                {supportsPreview ? 'Anteprima' : 'Apri'}
                              </Button>
                              <Button asChild size="sm" variant="secondary" className="h-7 px-2 text-[11px]">
                                <a
                                  href={getDocumentProxyUrl(document, 'attachment')}
                                  target="_blank"
                                  rel="noreferrer"
                                  download={document.fileName}
                                >
                                  Scarica
                                </a>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => {
                                  setMovingDocumentId(document.id);
                                  setMoveDocumentFolderId(document.folderId ?? 'none');
                                }}
                              >
                                Sposta
                              </Button>
                              {isAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => {
                                    setRenamingDocumentId(document.id);
                                    setRenameDocumentValue(document.title);
                                  }}
                                >
                                  Rinomina
                                </Button>
                              ) : null}
                              {canDeleteDocuments ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2 text-[11px]"
                                  disabled={deletingDocumentId === document.id}
                                  onClick={() => void handleDeleteDocument(document)}
                                >
                                  {deletingDocumentId === document.id ? '...' : 'Elimina'}
                                </Button>
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
                  {selectedFolderId !== null
                    ? 'Nessun documento nella cartella selezionata.'
                    : 'Nessun documento condiviso disponibile.'}
                </div>
              )}
            </div>
          </section>
        </div>
      </CardContent>

      <Dialog open={Boolean(previewDocument)} onOpenChange={open => !open && setPreviewDocument(null)}>
        <DialogContent className="flex h-[92vh] w-[97vw] max-w-7xl flex-col">
          <DialogHeader>
            <DialogTitle>{previewDocument?.title ?? 'Anteprima documento'}</DialogTitle>
            <DialogDescription>
              {previewDocument ? previewDocument.fileName : 'Visualizzazione del file condiviso.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
            {previewDocument ? (
              <DocumentPreviewContent
                {...previewDocument}
                title={previewDocument.title}
                editable={canUploadDocuments}
                isSavingSpreadsheet={savingSpreadsheetDocumentId === previewDocument.id}
                onSaveSpreadsheet={payload => handleSaveDocument(previewDocument, payload)}
                onSaveWordDocument={payload => handleSaveDocument(previewDocument, payload)}
              />
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button asChild>
              <a
                href={previewDocument ? getDocumentProxyUrl(previewDocument, 'attachment') : '#'}
                target="_blank"
                rel="noreferrer"
                download={previewDocument?.fileName}
              >
                <Download className="mr-2 h-4 w-4" />
                Scarica
              </a>
            </Button>
            {previewDocument && canUploadDocuments ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMovingDocumentId(previewDocument.id);
                    setMoveDocumentFolderId(previewDocument.folderId ?? 'none');
                  }}
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Sposta
                </Button>
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setRenamingDocumentId(previewDocument.id);
                      setRenameDocumentValue(previewDocument.title);
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Rinomina
                  </Button>
                ) : null}
                {canDeleteDocuments ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deletingDocumentId === previewDocument.id}
                    onClick={() => void handleDeleteDocument(previewDocument)}
                  >
                    {deletingDocumentId === previewDocument.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Elimina
                  </Button>
                ) : null}
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renamingDocumentId !== null} onOpenChange={open => !open && setRenamingDocumentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rinomina documento</DialogTitle>
            <DialogDescription>Inserisci il nuovo nome per il documento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameDocumentValue}
              onChange={e => setRenameDocumentValue(e.target.value)}
              placeholder="Nuovo nome documento"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && renamingDocumentId) {
                  const docToRename = documents?.find(d => d.id === renamingDocumentId);
                  if (docToRename) void handleRenameDocument(docToRename);
                }
                if (e.key === 'Escape') setRenamingDocumentId(null);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingDocumentId(null)}>Annulla</Button>
            <Button onClick={() => {
              const docToRename = documents?.find(d => d.id === renamingDocumentId);
              if (docToRename) void handleRenameDocument(docToRename);
            }}>Rinomina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renamingFolderId !== null} onOpenChange={open => !open && setRenamingFolderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rinomina cartella</DialogTitle>
            <DialogDescription>Inserisci il nuovo nome per la cartella.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={renameFolderValue}
              onChange={e => setRenameFolderValue(e.target.value)}
              placeholder="Nuovo nome cartella"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && renamingFolderId) {
                  const folderToRename = folders?.find(f => f.id === renamingFolderId);
                  if (folderToRename) void handleRenameFolder(folderToRename);
                }
                if (e.key === 'Escape') setRenamingFolderId(null);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingFolderId(null)}>Annulla</Button>
            <Button onClick={() => {
              const folderToRename = folders?.find(f => f.id === renamingFolderId);
              if (folderToRename) void handleRenameFolder(folderToRename);
            }}>Rinomina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={movingDocumentId !== null}
        onOpenChange={open => {
          if (!open) {
            setMovingDocumentId(null);
            setMoveDocumentFolderId('none');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sposta file</DialogTitle>
            <DialogDescription>Seleziona la cartella di destinazione per il file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={moveDocumentFolderId} onValueChange={setMoveDocumentFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona destinazione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Senza cartella</SelectItem>
                {sortedFolders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.pathLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setMovingDocumentId(null);
                setMoveDocumentFolderId('none');
              }}
            >
              Annulla
            </Button>
            <Button onClick={() => void handleMoveDocument()}>Sposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={movingFolderId !== null}
        onOpenChange={open => {
          if (!open) {
            setMovingFolderId(null);
            setMoveFolderParentId('root');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sposta cartella</DialogTitle>
            <DialogDescription>Seleziona la cartella di destinazione dal menu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={moveFolderParentId} onValueChange={setMoveFolderParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona destinazione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Livello principale</SelectItem>
                {movableParentFolders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.pathLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setMovingFolderId(null);
                setMoveFolderParentId('root');
              }}
            >
              Annulla
            </Button>
            <Button onClick={() => void handleMoveFolder()}>Sposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </Card>
  );
}
