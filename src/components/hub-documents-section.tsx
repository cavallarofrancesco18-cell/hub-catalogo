'use client';

import { useMemo, useState } from 'react';
import { collection, doc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { Download, Edit2, FileText, FolderOpen, FolderPlus, Loader2, Search, Trash2, Upload, X } from 'lucide-react';

import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirebaseApp, useFirestore, useMemoFirebase, useUser, useUserRole } from '@/firebase';
import type { HubDocument, HubDocumentFolder } from '@/lib/types';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { canPreviewDocumentFile, DocumentPreviewContent, getDocumentOpenUrl, getDocumentProxyUrl } from '@/components/document-preview-content';
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
  const [title, setTitle] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState<string>('none');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<HubDocument | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [folderSearch, setFolderSearch] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [renameDocumentValue, setRenameDocumentValue] = useState('');

  const sortedFolders = useMemo(
    () => [...(folders ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'it')),
    [folders]
  );

  const filteredFolders = useMemo(() => {
    const query = folderSearch.trim().toLowerCase();
    if (!query) {
      return sortedFolders;
    }

    return sortedFolders.filter(folder => folder.name.toLowerCase().includes(query));
  }, [folderSearch, sortedFolders]);

  const filteredDocuments = useMemo(() => {
    const all = [...(documents ?? [])].sort((l, r) => {
      const lv = typeof l.updatedAt?.toDate === 'function' ? l.updatedAt.toDate().getTime() : new Date(l.updatedAt ?? l.createdAt ?? 0).getTime();
      const rv = typeof r.updatedAt?.toDate === 'function' ? r.updatedAt.toDate().getTime() : new Date(r.updatedAt ?? r.createdAt ?? 0).getTime();
      return rv - lv;
    });
    if (selectedFolderId === null) return all;
    if (selectedFolderId === '__none__') return all.filter(d => !d.folderId);
    return all.filter(d => d.folderId === selectedFolderId);
  }, [documents, selectedFolderId]);

  if (isLoading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardHeader><CardTitle>Documenti HUB</CardTitle><CardDescription>Caricamento permessi in corso.</CardDescription></CardHeader>
      </Card>
    );
  }

  if (!canAccess) return null;

  const handleCreateFolder = async () => {
    if (!firestore || !user) return;
    const trimmed = newFolderName.trim();
    if (!trimmed) { toast({ variant: 'destructive', title: 'Nome cartella obbligatorio' }); return; }
    const folderId = normalizeKey(trimmed);
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
        id: folderId, name: trimmed, createdAt: serverTimestamp(),
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

  const handleDeleteFolder = async (folder: HubDocumentFolder) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, HUB_FOLDERS_COLLECTION, folder.id));
      if (selectedFolderId === folder.id) setSelectedFolderId(null);
      toast({ title: `Cartella "${folder.name}" eliminata`, description: 'I documenti sono ora visibili in "Senza cartella".' });
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
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { toast({ variant: 'destructive', title: 'Titolo obbligatorio' }); return; }
    const documentKey = normalizeKey(trimmedTitle);
    if (!documentKey) { toast({ variant: 'destructive', title: 'Titolo non valido' }); return; }
    const folderId = uploadFolderId === 'none' ? null : uploadFolderId;
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
      setTitle(''); setSelectedFile(null);
      toast({ title: 'Documento caricato', description: `${trimmedTitle} e pronto per il download.` });
    } catch (error) {
      console.error('Errore caricamento documento HUB', error);
      toast({ variant: 'destructive', title: 'Upload fallito', description: 'Impossibile caricare il documento. Riprova tra poco.' });
    } finally { setIsUploading(false); setUploadProgress(0); }
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

  const pillBase = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors';
  const pillActive = 'border-primary bg-primary text-primary-foreground';
  const pillInactive = 'border-border/60 bg-background text-muted-foreground hover:bg-muted';

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

      <CardContent className="space-y-6">

        {/* Gestione cartelle */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Cartelle</span>
                <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  {sortedFolders.length} totali
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cerca una cartella invece di scorrere tutta la lista quando l’archivio cresce.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 self-start"
              onClick={() => setShowNewFolderInput(v => !v)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Nuova cartella
            </Button>
          </div>

          {showNewFolderInput ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Nome cartella"
                className="max-w-xs"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); }
                }}
              />
              <Button type="button" size="sm" onClick={handleCreateFolder} disabled={isCreatingFolder}>
                {isCreatingFolder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crea'}
              </Button>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}>
                Annulla
              </Button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={folderSearch}
                onChange={e => setFolderSearch(e.target.value)}
                placeholder="Cerca cartelle per nome"
                className="h-10 pl-9 pr-10"
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
            <div className="rounded-full border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
              {filteredFolders.length} cartelle visibili
            </div>
          </div>

          <div className="mt-4 max-h-56 overflow-auto rounded-xl border border-border/60 bg-background/80 p-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedFolderId(null)}
                className={cn(pillBase, selectedFolderId === null ? pillActive : pillInactive)}>
                Tutti ({documents?.length ?? 0})
              </button>

              {filteredFolders.length > 0 ? (
                filteredFolders.map(folder => (
                  <div key={folder.id} className="group relative inline-flex items-center">
                    <button type="button" onClick={() => setSelectedFolderId(folder.id)}
                      className={cn(pillBase, 'pl-3', isAdmin ? 'pr-7' : 'pr-3',
                        selectedFolderId === folder.id ? pillActive : pillInactive)}>
                      <FolderOpen className="h-3 w-3" />
                      {folder.name} ({documents?.filter(d => d.folderId === folder.id).length ?? 0})
                    </button>
                    {isAdmin ? (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => {
                          setRenamingFolderId(folder.id);
                          setRenameFolderValue(folder.name);
                        }}
                          className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                          title="Rinomina cartella">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => handleDeleteFolder(folder)}
                          className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                          title="Elimina cartella">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="w-full rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                  Nessuna cartella corrisponde alla ricerca.
                </div>
              )}

              <button type="button" onClick={() => setSelectedFolderId('__none__')}
                className={cn(pillBase, selectedFolderId === '__none__' ? pillActive : pillInactive)}>
                Senza cartella ({documents?.filter(d => !d.folderId).length ?? 0})
              </button>
            </div>
          </div>
        </div>

        {/* Form upload */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">Carica nuovo documento</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="hub-document-title">Titolo</label>
              <Input id="hub-document-title" value={title}
                onChange={e => setTitle(e.target.value)} placeholder="Es. Listino HUB gennaio" />
              <p className="text-xs text-muted-foreground">Stesso titolo = aggiorna il file esistente.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="hub-document-folder">Cartella</label>
              <Select value={uploadFolderId} onValueChange={setUploadFolderId}>
                <SelectTrigger id="hub-document-folder">
                  <SelectValue placeholder="Seleziona cartella" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Senza cartella</SelectItem>
                  {sortedFolders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="hub-document-file">File</label>
              <Input id="hub-document-file" type="file"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
              {selectedFile ? (
                <p className="text-xs text-muted-foreground">
                  {selectedFile.name}{formatFileSize(selectedFile.size) ? ` · ${formatFileSize(selectedFile.size)}` : ''}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">PDF, ZIP, immagini e documenti.</p>
              )}
            </div>
          </div>
          {isUploading ? <Progress value={uploadProgress} className="h-1.5" /> : null}
          <Button type="button" onClick={handleUpload} disabled={isUploading} className="w-full sm:w-auto">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {isUploading ? 'Caricamento...' : 'Carica documento'}
          </Button>
        </div>

        {/* Lista documenti */}
        {documentsError ? (
          <p className="text-sm text-destructive">Non riesco a caricare l archivio documenti in questo momento.</p>
        ) : isLoadingDocuments ? (
          <div className="space-y-3">
            <div className="h-20 rounded-xl bg-muted/50" />
            <div className="h-20 rounded-xl bg-muted/50" />
          </div>
        ) : filteredDocuments.length > 0 ? (
          <div className="grid gap-3">
            {filteredDocuments.map(document => {
              const folderName = sortedFolders.find(f => f.id === document.folderId)?.name;
              const supportsPreview = canPreviewDocumentFile(document);
              return (
                <div key={document.id} className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewDocument(document)}
                          className={cn(
                            'font-medium text-left text-foreground transition-colors hover:text-primary',
                            !supportsPreview && 'hover:text-primary'
                          )}
                        >
                          {document.title}
                        </button>
                        {folderName ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            <FolderOpen className="h-3 w-3" />
                            {folderName}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {document.fileName}{document.sizeBytes ? ` · ${formatFileSize(document.sizeBytes)}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ultimo caricamento: {formatDocumentDate(document.updatedAt ?? document.createdAt ?? null)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:self-center"
                      onClick={() => setPreviewDocument(document)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {supportsPreview ? 'Anteprima' : 'Apri file'}
                    </Button>
                    <Button asChild variant="secondary" className="sm:self-center">
                      <a
                        href={getDocumentProxyUrl(document, 'attachment')}
                        target="_blank"
                        rel="noreferrer"
                        download={document.fileName}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Scarica
                      </a>
                    </Button>
                    {isAdmin ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="sm:self-center"
                          onClick={() => {
                            setRenamingDocumentId(document.id);
                            setRenameDocumentValue(document.title);
                          }}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Rinomina
                        </Button>
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="destructive"
                            className="sm:self-center"
                            disabled={deletingDocumentId === document.id}
                          >
                            {deletingDocumentId === document.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Elimina
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminare questo documento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Il file verrà rimosso da Firebase Storage e la scheda documento verrà cancellata.
                              L’operazione non può essere annullata.
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
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
            {selectedFolderId !== null ? 'Nessun documento in questa cartella.' : 'Nessun documento condiviso ancora disponibile.'}
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(previewDocument)} onOpenChange={open => !open && setPreviewDocument(null)}>
        <DialogContent className="flex h-[90vh] w-[95vw] max-w-6xl flex-col">
          <DialogHeader>
            <DialogTitle>{previewDocument?.title ?? 'Anteprima documento'}</DialogTitle>
            <DialogDescription>
              {previewDocument ? previewDocument.fileName : 'Visualizzazione del file condiviso.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
            {previewDocument ? <DocumentPreviewContent {...previewDocument} title={previewDocument.title} /> : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" asChild>
              <a
                href={previewDocument ? getDocumentOpenUrl(previewDocument) : '#'}
                target="_blank"
                rel="noreferrer"
              >
                Apri in nuova scheda
              </a>
            </Button>
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
            {isAdmin && previewDocument ? (
              <>
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
    </Card>
  );
}
