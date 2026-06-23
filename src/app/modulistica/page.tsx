'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useFirebaseApp, useMemoFirebase, useUserRole, useUser } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, deleteObject, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Form as FormType, User as SellerUser } from '@/lib/types';
import { canPreviewDocumentFile, DocumentPreviewContent, getDocumentOpenUrl, getDocumentProxyUrl } from '@/components/document-preview-content';
import { Skeleton } from '@/components/ui/skeleton';
import { Code2, Download, Eye, FileText, Loader2, Mail, Paperclip, SendHorizontal, Trash2, Upload, UploadCloud, Users, X } from 'lucide-react';
import { deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { getUploadErrorMessage } from '@/lib/image-upload';

const formSchema = z.object({
  title: z.string().min(3, 'Il titolo è obbligatorio e deve avere almeno 3 caratteri.'),
  category: z.enum(['cliente', 'commerciante'], {
    required_error: 'La categoria è obbligatoria.',
  }),
  fileUrl: z.string().url("Per favore, inserisci un URL valido.").min(1, "L'URL del file è obbligatorio."),
});

type FormValues = z.infer<typeof formSchema>;

const newsletterSchema = z.object({
  subject: z.string().min(3, 'L\'oggetto deve avere almeno 3 caratteri.'),
  message: z.string().min(10, 'Il messaggio deve avere almeno 10 caratteri.'),
  useHtml: z.boolean().default(false),
  sellerTypes: z.array(z.string()).default([]),
  sellerIds: z.array(z.string()).default([]),
});

type NewsletterValues = z.infer<typeof newsletterSchema>;

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'uploaded' | 'error';
  storagePath: string;
  url?: string;
  errorMessage?: string;
};

type NewsletterHistoryItem = {
  id: string;
  subject: string;
  message: string;
  useHtml: boolean;
  messageHtml: string | null;
  sellerTypes: string[];
  sellerIds: string[];
  attachments: Array<{ filename: string }>;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  createdByUid: string;
  createdByEmail: string;
  createdAt: string | null;
};

type NewsletterGroupItem = {
  id: string;
  name: string;
  sellerTypes: string[];
  sellerIds: string[];
  createdByUid: string;
  createdByEmail: string;
  createdAt: string | null;
};

const SELLER_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'hub', label: 'HUB' },
  { value: 'express', label: 'EXPRESS' },
  { value: 'mgv', label: 'MGV' },
  { value: 'tantibuonikm', label: 'tantibuonikm' },
  { value: 'gruppodinamica', label: 'gruppodinamica' },
] as const;

function normalizeSellerType(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === 'standard' ? 'standard' : normalized;
}

function formatHistoryDate(value: string | null) {
  if (!value) {
    return 'Data non disponibile';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Data non disponibile';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function getSellerTypeLabel(value: string) {
  return SELLER_TYPE_OPTIONS.find(option => option.value === value)?.label || value;
}

function escapePreviewHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildNewsletterPreviewDocument(message: string, useHtml: boolean) {
  const content = message.trim()
    ? useHtml
      ? message
      : `<div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#111827;">${escapePreviewHtml(message)}</div>`
    : '<div style="font-size:14px;line-height:1.7;color:#6b7280;">Il contenuto del messaggio comparirà qui in anteprima.</div>';

  return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:16px;background:#ffffff;font-family:Arial,sans-serif;color:#111827;">
    ${content}
  </body>
</html>`;
}

function getFormOpenUrl(form: FormType) {
  return getDocumentOpenUrl({
    fileName: form.fileName,
    fileUrl: form.fileUrl,
  });
}

function canPreviewForm(form: FormType) {
  return canPreviewDocumentFile({
    fileName: form.fileName,
    fileUrl: form.fileUrl,
  });
}

function FormList({ forms, isAdmin, onDelete }: { forms: FormType[], isAdmin: boolean, onDelete: (form: FormType) => void }) {
    const [previewForm, setPreviewForm] = useState<FormType | null>(null);

    if (!forms || forms.length === 0) {
        return <p className="text-muted-foreground mt-4">Nessun modulo in questa categoria.</p>
    }

    const supportsPreview = previewForm ? canPreviewForm(previewForm) : false;

    return (
        <>
          <div className="space-y-3 mt-4">
              {forms.map((form) => (
                  <Card key={form.id} className="flex items-center justify-between p-4 gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                          <FileText className="h-6 w-6 shrink-0 text-primary" />
                          <button
                            type="button"
                            onClick={() => setPreviewForm(form)}
                            className="truncate text-left font-medium hover:underline"
                          >
                              {form.title}
                          </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setPreviewForm(form)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Anteprima
                        </Button>
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href={getDocumentProxyUrl({
                              fileName: form.fileName,
                              fileUrl: form.fileUrl,
                              contentType: form.contentType,
                            }, 'attachment')}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={form.fileName}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Scarica
                          </a>
                        </Button>
                        {isAdmin && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Questa azione non può essere annullata. Eliminerà permanentemente il modulo.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(form)}>Conferma</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                      </div>
                  </Card>
              ))}
          </div>

          <Dialog open={Boolean(previewForm)} onOpenChange={open => !open && setPreviewForm(null)}>
            <DialogContent className="flex h-[90vh] w-[95vw] max-w-6xl flex-col">
              <DialogHeader>
                <DialogTitle>{previewForm?.title ?? 'Anteprima documento'}</DialogTitle>
                <DialogDescription>
                  {previewForm?.fileName ?? 'Visualizzazione del file selezionato.'}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                {previewForm ? (
                  supportsPreview ? (
                    <DocumentPreviewContent
                      fileName={previewForm.fileName}
                      fileUrl={previewForm.fileUrl}
                      title={previewForm.title}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                      <p>Anteprima non disponibile per questo formato.</p>
                      <p>Puoi aprire il file in una nuova scheda o scaricarlo.</p>
                    </div>
                  )
                ) : null}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" asChild>
                  <a href={previewForm ? getFormOpenUrl(previewForm) : '#'} target="_blank" rel="noopener noreferrer">
                    Apri in nuova scheda
                  </a>
                </Button>
                <Button asChild>
                  <a
                    href={previewForm ? getDocumentProxyUrl({
                      fileName: previewForm.fileName,
                      fileUrl: previewForm.fileUrl,
                      contentType: previewForm.contentType,
                    }, 'attachment') : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={previewForm?.fileName}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Scarica
                  </a>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
    );
}


export default function ModulisticaPage() {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const { user } = useUser();
  const { role, isLoading: isLoadingRole } = useUserRole();
  const storage = useMemo(() => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'), [app]);
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingNewsletter, setIsSendingNewsletter] = useState(false);
  const [newsletterHistory, setNewsletterHistory] = useState<NewsletterHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingNewsletterHistoryId, setDeletingNewsletterHistoryId] = useState<string | null>(null);
  const [isClearingNewsletterHistory, setIsClearingNewsletterHistory] = useState(false);
  const [newsletterGroups, setNewsletterGroups] = useState<NewsletterGroupItem[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [newsletterAttachmentItems, setNewsletterAttachmentItems] = useState<UploadItem[]>([]);
  const [isDraggingNewsletterAttachments, setIsDraggingNewsletterAttachments] = useState(false);
  const [uploadItem, setUploadItem] = useState<UploadItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newsletterAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  
  const formsRef = useMemoFirebase(() => { if (!firestore || !user) return null; return collection(firestore, 'forms'); }, [firestore, user]);
  const { data: forms, isLoading: isLoadingForms } = useCollection<FormType>(formsRef);
  const sellersRef = useMemoFirebase(
    () => (firestore && user && role === 'admin' ? collection(firestore, 'seller') : null),
    [firestore, user, role]
  );
  const { data: sellers, isLoading: isLoadingSellers } = useCollection<SellerUser>(sellersRef);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      storage.maxUploadRetryTime = 5000;
    }
  }, [storage]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        title: '',
        category: undefined,
        fileUrl: '',
    }
  });

  const newsletterForm = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: {
      subject: '',
      message: '',
      useHtml: false,
      sellerTypes: [],
      sellerIds: [],
    },
  });

  const isAdmin = role === 'admin';
  const hasUploadingItem = uploadItem?.status === 'uploading';
  const watchedNewsletter = newsletterForm.watch();

  const selectedSellerTypes = watchedNewsletter.sellerTypes ?? [];
  const selectedSellerIds = watchedNewsletter.sellerIds ?? [];

  const { clientForms, merchantForms } = useMemo(() => {
    const clientForms: FormType[] = [];
    const merchantForms: FormType[] = [];
    forms?.forEach(form => {
      if (form.category === 'cliente') {
        clientForms.push(form);
      } else if (form.category === 'commerciante') {
        merchantForms.push(form);
      }
    });
    return { clientForms, merchantForms };
  }, [forms]);

  const filteredSellerRecipients = useMemo(() => {
    const sellerList = sellers ?? [];
    return sellerList.filter(seller => {
      if (!seller.email?.trim()) {
        return false;
      }

      if (selectedSellerTypes.length === 0 && selectedSellerIds.length === 0) {
        return true;
      }

      return (
        selectedSellerTypes.includes(normalizeSellerType(seller.sellerType)) ||
        selectedSellerIds.includes(seller.id)
      );
    });
  }, [selectedSellerIds, selectedSellerTypes, sellers]);

  const selectedSellerLabels = selectedSellerTypes.map(getSellerTypeLabel);
  const selectedSpecificSellers = useMemo(
    () => (sellers ?? []).filter(seller => selectedSellerIds.includes(seller.id)),
    [selectedSellerIds, sellers]
  );

  const hasUploadingNewsletterAttachments = newsletterAttachmentItems.some(
    item => item.status === 'uploading'
  );

  const loadNewsletterHistory = async () => {
    if (!user || role !== 'admin') {
      setNewsletterHistory([]);
      return;
    }

    setIsLoadingHistory(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/send-seller-newsletter', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; items?: NewsletterHistoryItem[] }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'NEWSLETTER_HISTORY_FAILED');
      }

      setNewsletterHistory(result?.items ?? []);
    } catch (error) {
      console.error('Errore durante il caricamento storico newsletter:', error);
      toast({
        variant: 'destructive',
        title: 'Storico non disponibile',
        description: 'Impossibile caricare lo storico delle newsletter in questo momento.',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadNewsletterHistory();
  }, [role, user]);

  const deleteNewsletterHistoryItem = async (historyId: string) => {
    if (!user) {
      return;
    }

    setDeletingNewsletterHistoryId(historyId);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/send-seller-newsletter', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ historyId }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'NEWSLETTER_HISTORY_DELETE_FAILED');
      }

      setNewsletterHistory(current => current.filter(item => item.id !== historyId));
      toast({
        title: 'Voce eliminata',
        description: 'La newsletter è stata rimossa dallo storico.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'NEWSLETTER_HISTORY_DELETE_FAILED';
      toast({
        variant: 'destructive',
        title: 'Eliminazione non riuscita',
        description: `Impossibile eliminare la voce dallo storico. Motivo: ${message}`,
      });
    } finally {
      setDeletingNewsletterHistoryId(current => (current === historyId ? null : current));
    }
  };

  const clearNewsletterHistory = async () => {
    if (!user) {
      return;
    }

    setIsClearingNewsletterHistory(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/send-seller-newsletter', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ clearAll: true }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; deletedCount?: number }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'NEWSLETTER_HISTORY_CLEAR_FAILED');
      }

      setNewsletterHistory([]);
      toast({
        title: 'Storico svuotato',
        description: `Newsletter eliminate: ${result?.deletedCount ?? 0}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'NEWSLETTER_HISTORY_CLEAR_FAILED';
      toast({
        variant: 'destructive',
        title: 'Svuotamento non riuscito',
        description: `Impossibile cancellare lo storico newsletter. Motivo: ${message}`,
      });
    } finally {
      setIsClearingNewsletterHistory(false);
    }
  };

  const loadNewsletterGroups = async () => {
    if (!user || role !== 'admin') {
      setNewsletterGroups([]);
      return;
    }

    setIsLoadingGroups(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/seller-newsletter-groups', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; items?: NewsletterGroupItem[] }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'NEWSLETTER_GROUPS_FAILED');
      }

      setNewsletterGroups(result?.items ?? []);
    } catch (error) {
      console.error('Errore durante il caricamento gruppi newsletter:', error);
      toast({
        variant: 'destructive',
        title: 'Gruppi non disponibili',
        description: 'Impossibile caricare i gruppi personalizzati in questo momento.',
      });
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    void loadNewsletterGroups();
  }, [role, user]);

  const handleDelete = async (formToDelete: FormType) => {
    if (!firestore || !storage) return;

    toast({ title: 'Eliminazione in corso...' });

    try {
      const fileRef = ref(storage, formToDelete.fileUrl);
      await deleteObject(fileRef);

      const docRef = doc(firestore, 'forms', formToDelete.id);
      await deleteDocumentNonBlocking(docRef);

      toast({
        title: 'Modulo eliminato!',
        description: `"${formToDelete.title}" è stato rimosso.`,
      });
    } catch (error: any) {
        console.error("Errore durante l'eliminazione:", error);
        toast({
            variant: "destructive",
            title: "Uh oh! Qualcosa è andato storto.",
            description: "Impossibile eliminare il modulo. Controlla se il file esiste ancora nello storage.",
        });
    }
  };

  const handleSelectedFile = (selectedFile: File | null) => {
    if (!selectedFile) {
      return;
    }

    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Accesso richiesto',
        description: 'Accedi prima di caricare un file.',
      });
      return;
    }

    const uploadId = crypto.randomUUID();
    const storagePath = `forms/${user.uid}/${uploadId}-${selectedFile.name}`;

    setUploadItem({
      id: uploadId,
      file: selectedFile,
      progress: 0,
      status: 'uploading',
      storagePath,
    });

    form.setValue('fileUrl', '', { shouldValidate: true, shouldDirty: true });

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    uploadTask.on(
      'state_changed',
      snapshot => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadItem(currentItem =>
          currentItem && currentItem.id === uploadId
            ? { ...currentItem, progress }
            : currentItem
        );
      },
      error => {
        const errorMessage = getUploadErrorMessage(error);

        setUploadItem(currentItem =>
          currentItem && currentItem.id === uploadId
            ? {
                ...currentItem,
                status: 'error',
                errorMessage,
              }
            : currentItem
        );

        toast({
          variant: 'destructive',
          title: 'Upload fallito',
          description: `${selectedFile.name}: ${errorMessage}`,
        });
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then(url => {
            setUploadItem(currentItem =>
              currentItem && currentItem.id === uploadId
                ? {
                    ...currentItem,
                    status: 'uploaded',
                    progress: 100,
                    url,
                  }
                : currentItem
            );

            form.setValue('fileUrl', url, {
              shouldValidate: true,
              shouldDirty: true,
            });

            toast({
              title: 'File caricato',
              description: `${selectedFile.name} è pronto per il salvataggio del modulo.`,
            });
          })
          .catch(error => {
            const errorMessage = getUploadErrorMessage(error);

            setUploadItem(currentItem =>
              currentItem && currentItem.id === uploadId
                ? {
                    ...currentItem,
                    status: 'error',
                    errorMessage,
                  }
                : currentItem
            );
          });
      }
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      handleSelectedFile(event.target.files[0]);
      event.target.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 0) {
      handleSelectedFile(event.dataTransfer.files[0]);
    }
  };

  const removeUploadItem = async () => {
    if (!uploadItem || uploadItem.status === 'uploading') {
      return;
    }

    const currentUpload = uploadItem;
    setUploadItem(null);
    form.setValue('fileUrl', '', { shouldValidate: true, shouldDirty: true });

    if (!currentUpload.storagePath) {
      return;
    }

    try {
      await deleteObject(ref(storage, currentUpload.storagePath));
    } catch (error) {
      console.error('Errore durante la rimozione del file caricato:', error);
      toast({
        variant: 'destructive',
        title: 'Rimozione incompleta',
        description: 'Il file è stato rimosso dalla schermata, ma non dallo storage.',
      });
    }
  };

  const updateNewsletterAttachmentItem = (itemId: string, updater: (item: UploadItem) => UploadItem) => {
    setNewsletterAttachmentItems(currentItems =>
      currentItems.map(item => (item.id === itemId ? updater(item) : item))
    );
  };

  const handleSelectedNewsletterFiles = (selectedFiles: File[]) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Accesso richiesto',
        description: 'Accedi come admin prima di caricare allegati.',
      });
      return;
    }

    selectedFiles.forEach(file => {
      const uploadId = crypto.randomUUID();
      const storagePath = `newsletter-attachments/${user.uid}/${uploadId}-${file.name}`;

      setNewsletterAttachmentItems(currentItems => [
        ...currentItems,
        {
          id: uploadId,
          file,
          progress: 0,
          status: 'uploading',
          storagePath,
        },
      ]);

      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          updateNewsletterAttachmentItem(uploadId, item => ({ ...item, progress }));
        },
        error => {
          const errorMessage = getUploadErrorMessage(error);
          updateNewsletterAttachmentItem(uploadId, item => ({
            ...item,
            status: 'error',
            errorMessage,
          }));

          toast({
            variant: 'destructive',
            title: 'Upload allegato fallito',
            description: `${file.name}: ${errorMessage}`,
          });
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref)
            .then(url => {
              updateNewsletterAttachmentItem(uploadId, item => ({
                ...item,
                status: 'uploaded',
                progress: 100,
                url,
              }));
            })
            .catch(error => {
              const errorMessage = getUploadErrorMessage(error);
              updateNewsletterAttachmentItem(uploadId, item => ({
                ...item,
                status: 'error',
                errorMessage,
              }));
            });
        }
      );
    });
  };

  const removeNewsletterAttachment = async (itemId: string) => {
    const itemToRemove = newsletterAttachmentItems.find(item => item.id === itemId);
    if (!itemToRemove || itemToRemove.status === 'uploading') {
      return;
    }

    setNewsletterAttachmentItems(currentItems => currentItems.filter(item => item.id !== itemId));

    if (!itemToRemove.storagePath) {
      return;
    }

    try {
      await deleteObject(ref(storage, itemToRemove.storagePath));
    } catch (error) {
      console.error('Errore durante la rimozione allegato newsletter:', error);
    }
  };

  const saveNewsletterGroup = async () => {
    if (!user) {
      return;
    }

    const trimmedName = groupName.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Nome gruppo mancante',
        description: 'Inserisci un nome per salvare il gruppo personalizzato.',
      });
      return;
    }

    if (selectedSellerTypes.length === 0 && selectedSellerIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Gruppo vuoto',
        description: 'Seleziona almeno un tipo seller o un venditore specifico prima di salvare il gruppo.',
      });
      return;
    }

    setIsSavingGroup(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/seller-newsletter-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          sellerTypes: selectedSellerTypes,
          sellerIds: selectedSellerIds,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; item?: NewsletterGroupItem }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'GROUP_SAVE_FAILED');
      }

      if (result?.item) {
        setNewsletterGroups(current => [result.item!, ...current]);
      } else {
        await loadNewsletterGroups();
      }

      setGroupName('');
      toast({
        title: 'Gruppo salvato',
        description: `Il gruppo "${trimmedName}" è disponibile per i prossimi invii.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GROUP_SAVE_FAILED';
      toast({
        variant: 'destructive',
        title: 'Salvataggio gruppo fallito',
        description: `Impossibile salvare il gruppo. Motivo: ${message}`,
      });
    } finally {
      setIsSavingGroup(false);
    }
  };

  const applyNewsletterGroup = (group: NewsletterGroupItem) => {
    newsletterForm.setValue('sellerTypes', group.sellerTypes, { shouldDirty: true, shouldValidate: true });
    newsletterForm.setValue('sellerIds', group.sellerIds, { shouldDirty: true, shouldValidate: true });
    setGroupName(group.name);
  };

  const deleteNewsletterGroup = async (groupId: string) => {
    if (!user) {
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/admin/seller-newsletter-groups?id=${groupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error || 'GROUP_DELETE_FAILED');
      }

      setNewsletterGroups(current => current.filter(group => group.id !== groupId));
      toast({
        title: 'Gruppo eliminato',
        description: 'Il gruppo personalizzato è stato rimosso.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GROUP_DELETE_FAILED';
      toast({
        variant: 'destructive',
        title: 'Eliminazione gruppo fallita',
        description: `Impossibile eliminare il gruppo. Motivo: ${message}`,
      });
    }
  };

  async function onNewsletterSubmit(data: NewsletterValues) {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Accesso richiesto',
        description: 'Accedi come admin per inviare una newsletter.',
      });
      return;
    }

    setIsSendingNewsletter(true);

    try {
      if (hasUploadingNewsletterAttachments) {
        throw new Error('ATTACHMENTS_UPLOAD_IN_PROGRESS');
      }

      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/send-seller-newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...data,
          useHtml: data.useHtml,
          sellerTypes: data.sellerTypes,
          sellerIds: data.sellerIds,
          attachments: newsletterAttachmentItems
            .filter(item => item.status === 'uploaded' && item.url)
            .map(item => ({
              filename: item.file.name,
              url: item.url,
              contentType: item.file.type || undefined,
            })),
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            deliveredCount?: number;
            failedCount?: number;
            recipientCount?: number;
            historyEntry?: NewsletterHistoryItem;
          }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'NEWSLETTER_SEND_FAILED');
      }

      toast({
        title: 'Newsletter inviata',
        description: `Destinatari: ${result?.recipientCount ?? 0}. Email consegnate: ${result?.deliveredCount ?? 0}. Errori: ${result?.failedCount ?? 0}.`,
      });
      if (result?.historyEntry) {
        setNewsletterHistory(current => [result.historyEntry!, ...current].slice(0, 20));
      } else {
        await loadNewsletterHistory();
      }
      setNewsletterAttachmentItems([]);
      newsletterForm.reset({ subject: '', message: '', useHtml: false, sellerTypes: [], sellerIds: [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'NEWSLETTER_SEND_FAILED';
      toast({
        variant: 'destructive',
        title: 'Invio fallito',
        description: `Impossibile inviare la newsletter. Motivo: ${message}`,
      });
    } finally {
      setIsSendingNewsletter(false);
    }
  }

  async function onSubmit(data: FormValues) {
    if (!firestore) return;

    if (hasUploadingItem) {
      toast({
        variant: 'destructive',
        title: 'Upload ancora in corso',
        description: 'Attendi il completamento del file prima di salvare il modulo.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
        const newDocRef = doc(collection(firestore, 'forms'));

      let fileName = uploadItem?.file.name?.trim() || 'file_sconosciuto';
        try {
        if (!uploadItem?.file.name) {
          const decodedUrl = decodeURIComponent(data.fileUrl);
          const pathWithQuery = decodedUrl.split('?')[0];
          const pathSegments = pathWithQuery.split('/');
          fileName = pathSegments[pathSegments.length - 1] || fileName;
        }
        } catch (e) {
            console.error("Could not parse file name from URL", e);
        }

        const formData = {
            id: newDocRef.id,
            title: data.title,
            category: data.category,
            fileUrl: data.fileUrl,
            fileName: fileName,
        storagePath: uploadItem?.storagePath,
        contentType: uploadItem?.file.type || null,
            createdAt: serverTimestamp(),
        };

        await setDocumentNonBlocking(newDocRef, formData, {});

        toast({
            title: "Modulo aggiunto!",
            description: `"${data.title}" è stato aggiunto con successo.`,
        });
        setUploadItem(null);
        form.reset({ title: '', category: undefined, fileUrl: '' });

    } catch (error) {
        console.error("Error saving document:", error);
        toast({
            variant: "destructive",
            title: "Salvataggio fallito",
            description: "Impossibile salvare i dati del modulo in Firestore.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const isLoading = isLoadingForms || isLoadingRole;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Comunicazioni</h1>
      </div>

      {isAdmin && (
        <Card className="mb-8 overflow-hidden border-0 shadow-lg shadow-slate-200/60">
          <CardHeader className="border-b bg-gradient-to-r from-slate-900 via-slate-800 to-blue-700 text-white">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/80">
                  <Mail className="h-3.5 w-3.5" />
                  Area Newsletter
                </div>
                <CardTitle className="text-3xl text-white">Newsletter ai Venditori</CardTitle>
                <CardDescription className="max-w-2xl text-blue-50/85">
                  Componi il messaggio, scegli i destinatari e controlla l'anteprima senza scorrere tutta la pagina.
                </CardDescription>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="text-white/70">Destinatari</div>
                  <div className="mt-1 text-lg font-semibold text-white">{isLoadingSellers ? '...' : filteredSellerRecipients.length}</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="text-white/70">Allegati</div>
                  <div className="mt-1 text-lg font-semibold text-white">{newsletterAttachmentItems.length}</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="text-white/70">Formato</div>
                  <div className="mt-1 text-lg font-semibold text-white">{watchedNewsletter.useHtml ? 'HTML' : 'Testo'}</div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Form {...newsletterForm}>
              <form onSubmit={newsletterForm.handleSubmit(onNewsletterSubmit)} className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_560px]">
                <div className="space-y-6 p-6 lg:p-8">
                  <div className="rounded-3xl border bg-card p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Composizione</h2>
                        <p className="text-sm text-muted-foreground">Definisci oggetto, contenuto e formato del messaggio.</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <FormField
                        control={newsletterForm.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Oggetto</FormLabel>
                            <FormControl>
                              <Input placeholder="Es. Nuove regole pubblicazione veicoli" className="h-12 text-base" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newsletterForm.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Messaggio</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Scrivi qui la newsletter da inviare a tutti i seller..."
                                className="min-h-[260px] resize-y rounded-2xl text-sm leading-7"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {watchedNewsletter.useHtml
                                ? 'Il codice HTML viene filtrato lato server prima dell\'invio. Script e markup pericoloso vengono rimossi.'
                                : 'I ritorni a capo vengono mantenuti nell\'email inviata.'}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newsletterForm.control}
                        name="useHtml"
                        render={({ field }) => (
                          <FormItem className="rounded-2xl border border-dashed bg-muted/20 p-5">
                            <div className="flex items-start gap-4">
                              <div className="rounded-2xl bg-background p-3 shadow-sm">
                                <Code2 className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={checked => field.onChange(checked === true)}
                                  />
                                  <div>
                                    <FormLabel>Interpreta il messaggio come HTML</FormLabel>
                                    <FormDescription>
                                      Attiva HTML filtrato per link, immagini, tabelle e impaginazioni più ricche.
                                    </FormDescription>
                                  </div>
                                </div>
                                {field.value && (
                                  <div className="rounded-xl bg-background p-3 text-xs text-muted-foreground shadow-sm">
                                    Esempi supportati: paragrafi, liste, link, tabelle, immagini e titoli. I tag non consentiti vengono rimossi automaticamente.
                                  </div>
                                )}
                              </div>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-dashed bg-card p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Paperclip className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Allegati</h2>
                        <p className="text-sm text-muted-foreground">Carica i file che verranno inclusi nella newsletter.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div
                        className={cn(
                          'rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
                          'cursor-pointer bg-background hover:border-primary/60 hover:bg-primary/5',
                          isDraggingNewsletterAttachments ? 'border-primary bg-primary/10' : 'border-border'
                        )}
                        onClick={() => newsletterAttachmentInputRef.current?.click()}
                        onDragEnter={event => {
                          event.preventDefault();
                          setIsDraggingNewsletterAttachments(true);
                        }}
                        onDragLeave={event => {
                          event.preventDefault();
                          setIsDraggingNewsletterAttachments(false);
                        }}
                        onDragOver={event => {
                          event.preventDefault();
                          setIsDraggingNewsletterAttachments(true);
                        }}
                        onDrop={event => {
                          event.preventDefault();
                          setIsDraggingNewsletterAttachments(false);
                          handleSelectedNewsletterFiles(Array.from(event.dataTransfer.files));
                        }}
                      >
                        <Input
                          ref={newsletterAttachmentInputRef}
                          type="file"
                          multiple
                          onChange={event => {
                            if (event.target.files) {
                              handleSelectedNewsletterFiles(Array.from(event.target.files));
                              event.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium">Trascina qui gli allegati oppure clicca per selezionarli</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Gli allegati vengono caricati subito e saranno inclusi nella newsletter inviata.
                        </p>
                      </div>
                      {newsletterAttachmentItems.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {newsletterAttachmentItems.map(item => (
                            <div key={item.id} className="rounded-2xl border bg-background p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.status === 'uploaded'
                                      ? 'Caricato e pronto per l\'invio'
                                      : item.status === 'error'
                                        ? item.errorMessage || 'Upload fallito'
                                        : item.progress === 0
                                          ? 'Connessione a Firebase Storage...'
                                          : `Caricamento ${Math.round(item.progress)}%`}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void removeNewsletterAttachment(item.id)}
                                  disabled={item.status === 'uploading' || isSendingNewsletter}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              {item.status === 'uploading' && (
                                <Progress value={item.progress} className="mt-3 h-1.5" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t bg-muted/20 p-6 lg:border-l lg:border-t-0 lg:p-8">
                  <div className="space-y-6 lg:sticky lg:top-6">
                    <div className="rounded-3xl border bg-card p-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold">Destinatari e gruppi</h2>
                          <p className="text-sm text-muted-foreground">Gestisci target, eccezioni e combinazioni salvate.</p>
                        </div>
                      </div>
                      <Accordion type="multiple" defaultValue={["seller-types", "preview"]} className="w-full">
                        <AccordionItem value="seller-types">
                          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Filtra per tipo seller</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3">
                              <p className="text-sm text-muted-foreground">
                                Se non selezioni nulla, la newsletter viene inviata a tutti i seller con email valida.
                              </p>
                              <div className="grid grid-cols-2 gap-3 rounded-2xl border p-4">
                                {SELLER_TYPE_OPTIONS.map(option => {
                                  const checked = selectedSellerTypes.includes(option.value);
                                  return (
                                    <label key={option.value} className="flex items-center gap-3 text-sm font-medium">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={nextChecked => {
                                          const currentValues = newsletterForm.getValues('sellerTypes') ?? [];
                                          const nextValues = nextChecked
                                            ? [...currentValues, option.value]
                                            : currentValues.filter(value => value !== option.value);

                                          newsletterForm.setValue('sellerTypes', nextValues, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                          });
                                        }}
                                      />
                                      <span>{option.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="seller-ids">
                          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Venditori specifici</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3">
                              <p className="text-sm text-muted-foreground">
                                I venditori selezionati qui vengono inclusi anche se non rientrano nel filtro per tipo seller.
                              </p>
                              <div className="max-h-64 overflow-y-auto rounded-2xl border p-4">
                                <div className="space-y-3">
                                  {(sellers ?? []).filter(seller => !!seller.email?.trim()).map(seller => {
                                    const checked = selectedSellerIds.includes(seller.id);
                                    return (
                                      <label key={seller.id} className="flex items-start gap-3 text-sm">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={nextChecked => {
                                            const currentValues = newsletterForm.getValues('sellerIds') ?? [];
                                            const nextValues = nextChecked
                                              ? [...currentValues, seller.id]
                                              : currentValues.filter(value => value !== seller.id);

                                            newsletterForm.setValue('sellerIds', nextValues, {
                                              shouldDirty: true,
                                              shouldValidate: true,
                                            });
                                          }}
                                        />
                                        <span className="flex flex-col">
                                          <span className="font-medium">{seller.nome || seller.name || seller.email}</span>
                                          <span className="text-muted-foreground">{seller.email} · {getSellerTypeLabel(normalizeSellerType(seller.sellerType))}</span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="groups">
                          <AccordionTrigger className="text-sm font-semibold hover:no-underline">Gruppi personalizzati</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              <div className="flex flex-col gap-3">
                                <Input
                                  placeholder="Es. Seller premium nord"
                                  value={groupName}
                                  onChange={event => setGroupName(event.target.value)}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={saveNewsletterGroup}
                                  disabled={isSavingGroup}
                                >
                                  {isSavingGroup ? 'Salvataggio...' : 'Salva gruppo'}
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {isLoadingGroups ? (
                                  <Skeleton className="h-16 w-full" />
                                ) : newsletterGroups.length > 0 ? (
                                  newsletterGroups.map(group => (
                                    <div key={group.id} className="rounded-2xl border p-4">
                                      <div className="font-medium">{group.name}</div>
                                      <div className="mt-1 text-sm text-muted-foreground">
                                        Tipi: {group.sellerTypes.length > 0 ? group.sellerTypes.map(getSellerTypeLabel).join(', ') : 'nessuno'}
                                        {' · '}
                                        Seller specifici: {group.sellerIds.length}
                                      </div>
                                      <div className="mt-3 flex gap-2">
                                        <Button type="button" variant="outline" onClick={() => applyNewsletterGroup(group)}>
                                          Applica
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={() => void deleteNewsletterGroup(group.id)}>
                                          Elimina
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">Nessun gruppo salvato.</p>
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

                    <div className="rounded-3xl border bg-card p-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                          <Eye className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold">Anteprima e invio</h2>
                          <p className="text-sm text-muted-foreground">Controlla il risultato finale e invia quando il target è corretto.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-muted/40 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Target</div>
                          <div className="mt-2 text-sm font-medium">
                            {selectedSellerLabels.length > 0 ? selectedSellerLabels.join(', ') : 'tutti i seller'}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-muted/40 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Venditori extra</div>
                          <div className="mt-2 text-sm font-medium">{selectedSpecificSellers.length}</div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border bg-muted/30 p-5">
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Comunicazione AUTOTRADE
                        </div>
                        <h3 className="mt-3 text-2xl font-bold">
                          {watchedNewsletter.subject?.trim() || 'Oggetto newsletter'}
                        </h3>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Ciao venditore, ecco come apparirà l'introduzione della tua email.
                        </p>
                        {watchedNewsletter.useHtml && (
                          <div className="mt-4 inline-flex rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
                            Anteprima HTML sandboxata
                          </div>
                        )}
                        <div className="mt-5 overflow-hidden rounded-2xl bg-background shadow-sm">
                          {watchedNewsletter.useHtml ? (
                            <iframe
                              title="Anteprima HTML newsletter"
                              sandbox=""
                              srcDoc={buildNewsletterPreviewDocument(watchedNewsletter.message?.trim() || '', true)}
                              className="h-[320px] w-full bg-white"
                            />
                          ) : (
                            <div className="min-h-[180px] whitespace-pre-wrap p-4 text-sm leading-7">
                              {watchedNewsletter.message?.trim() || 'Il contenuto del messaggio comparirà qui in anteprima.'}
                            </div>
                          )}
                        </div>
                        {newsletterAttachmentItems.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {newsletterAttachmentItems.map(item => (
                              <span key={item.id} className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
                                Allegato: {item.file.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                          Destinatari stimati: <span className="font-semibold text-foreground">{isLoadingSellers ? 'calcolo in corso...' : filteredSellerRecipients.length}</span>
                        </div>
                        <Button type="submit" size="lg" className="gap-2" disabled={isSendingNewsletter || isLoading}>
                          <SendHorizontal className="h-4 w-4" />
                          {isSendingNewsletter ? 'Invio in corso...' : 'Invia newsletter'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mb-8">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Storico Newsletter</CardTitle>
              <CardDescription>
                Le ultime comunicazioni inviate ai seller con dettaglio su destinatari ed esito.
              </CardDescription>
            </div>
            {newsletterHistory.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" disabled={isClearingNewsletterHistory || deletingNewsletterHistoryId !== null}>
                    {isClearingNewsletterHistory ? 'Svuotamento...' : 'Svuota storico'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancellare tutto lo storico newsletter?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione elimina tutte le newsletter salvate nello storico e non può essere annullata.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void clearNewsletterHistory()}>
                      Conferma
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingHistory ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="mt-3 h-4 w-72" />
                  <Skeleton className="mt-4 h-16 w-full" />
                </div>
              ))
            ) : newsletterHistory.length > 0 ? (
              <Accordion type="single" collapsible className="rounded-xl border px-4">
                {newsletterHistory.map(item => (
                  <AccordionItem key={item.id} value={item.id} className="border-b last:border-b-0">
                    <AccordionTrigger className="py-4 text-left hover:no-underline">
                      <div className="flex w-full flex-col gap-3 pr-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold">{item.subject}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatHistoryDate(item.createdAt)}
                            {item.createdByEmail ? ` · ${item.createdByEmail}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground md:justify-end">
                          <span className="rounded-full bg-muted px-3 py-1">Destinatari: {item.recipientCount}</span>
                          <span className="rounded-full bg-muted px-3 py-1">Consegnate: {item.deliveredCount}</span>
                          <span className="rounded-full bg-muted px-3 py-1">Errori: {item.failedCount}</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-3 py-1">
                          Formato: {item.useHtml ? 'HTML' : 'testo semplice'}
                        </span>
                        <span className="rounded-full bg-muted px-3 py-1">
                          Target: {item.sellerTypes.length > 0 ? item.sellerTypes.map(getSellerTypeLabel).join(', ') : 'tutti i seller'}
                        </span>
                        {item.sellerIds.length > 0 && (
                          <span className="rounded-full bg-muted px-3 py-1">
                            Seller specifici: {item.sellerIds.length}
                          </span>
                        )}
                        {item.attachments.length > 0 && (
                          <span className="rounded-full bg-muted px-3 py-1">
                            Allegati: {item.attachments.map(attachment => attachment.filename).join(', ')}
                          </span>
                        )}
                      </div>
                      {item.useHtml && item.messageHtml ? (
                        <div className="mt-4 rounded-xl border bg-background p-4 text-sm leading-6 text-foreground/80">
                          <div dangerouslySetInnerHTML={{ __html: item.messageHtml }} />
                        </div>
                      ) : (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{item.message}</p>
                      )}
                      <div className="mt-4 flex justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={isClearingNewsletterHistory || deletingNewsletterHistoryId === item.id}
                            >
                              {deletingNewsletterHistoryId === item.id ? 'Eliminazione...' : 'Elimina voce'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare questa newsletter dallo storico?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Verrà rimossa solo la voce di storico relativa a “{item.subject}”. Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void deleteNewsletterHistoryItem(item.id)}>
                                Conferma
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna newsletter inviata finora.</p>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Aggiungi Nuovo Documento</CardTitle>
            <CardDescription>
              Carica documenti condivisi per clienti e commercianti nell'area comunicazioni.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Titolo Modulo *</FormLabel>
                        <FormControl>
                            <Input placeholder="Es. Contratto di vendita" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Categoria *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona una categoria" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="cliente">Per il Cliente</SelectItem>
                            <SelectItem value="commerciante">Per il Commerciante</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="fileUrl"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>File Modulo *</FormLabel>
                        <div className="space-y-4">
                          <div
                            className={cn(
                              'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                              'cursor-pointer bg-background hover:border-primary/60 hover:bg-primary/5',
                              isDragging ? 'border-primary bg-primary/10' : 'border-border'
                            )}
                            onClick={() => fileInputRef.current?.click()}
                            onDragEnter={(event) => {
                              event.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={(event) => {
                              event.preventDefault();
                              setIsDragging(false);
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setIsDragging(true);
                            }}
                            onDrop={handleDrop}
                          >
                            <Input
                              ref={fileInputRef}
                              type="file"
                              onChange={handleFileChange}
                              className="hidden"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                            />
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 text-sm font-medium">Trascina qui il file oppure clicca per selezionarlo</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Il caricamento parte subito, come per le foto auto. Poi ti basta salvare il modulo.
                            </p>
                            <div className="mt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  fileInputRef.current?.click();
                                }}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Carica da dispositivo
                              </Button>
                            </div>
                          </div>

                          {uploadItem && (
                            <div className="rounded-lg border p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{uploadItem.file.name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {uploadItem.status === 'uploaded'
                                      ? 'Caricato e pronto per il salvataggio'
                                      : uploadItem.status === 'error'
                                        ? uploadItem.errorMessage || 'Upload fallito'
                                        : uploadItem.progress === 0
                                          ? 'Connessione a Firebase Storage...'
                                          : `Caricamento ${Math.round(uploadItem.progress)}%`}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void removeUploadItem()}
                                  disabled={uploadItem.status === 'uploading' || isSubmitting}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              {uploadItem.status === 'uploading' && (
                                <Progress value={uploadItem.progress} className="mt-3 h-1.5" />
                              )}
                            </div>
                          )}

                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-card px-2 text-muted-foreground">
                                Oppure incolla URL
                              </span>
                            </div>
                          </div>

                          <FormControl>
                              <Input placeholder="https://firebasestorage.googleapis.com/..." {...field} value={field.value ?? ''} />
                          </FormControl>
                        </div>
                        <FormDescription>
                          Puoi caricare il file dal dispositivo oppure incollare manualmente l'URL di download da Firebase Storage.
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting || hasUploadingItem}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvataggio...
                        </>
                    ) : (
                        <>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Aggiungi Modulo
                        </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="cliente" className="w-full">
        <TabsList>
                <TabsTrigger value="cliente">Per il Cliente</TabsTrigger>
                <TabsTrigger value="commerciante">Per il Commerciante</TabsTrigger>
        </TabsList>
        <TabsContent value="cliente">
            {isLoading ? <Skeleton className="h-24 w-full" /> : <FormList forms={clientForms} isAdmin={isAdmin} onDelete={handleDelete} />}
        </TabsContent>
        <TabsContent value="commerciante">
            {isLoading ? <Skeleton className="h-24 w-full" /> : <FormList forms={merchantForms} isAdmin={isAdmin} onDelete={handleDelete} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
