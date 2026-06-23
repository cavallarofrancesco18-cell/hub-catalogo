'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { Loader2, Paperclip, ShieldAlert, Upload, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useFirebaseApp, useFirestore, useUser } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { normalizeBrandLabel } from '@/lib/brand-utils';
import { optimizeImageForUpload, getUploadErrorMessage } from '@/lib/image-upload';
import type { AgentVehicleReportAttachmentType } from '@/lib/types';
import { cn } from '@/lib/utils';

const agentVehicleSchema = z.object({
  marca: z.string().min(1, 'La marca è obbligatoria.'),
  modello: z.string().min(1, 'Il modello è obbligatorio.'),
  versione: z.string().min(1, 'La versione è obbligatoria.'),
  data_immatricolazione: z.string({ required_error: 'La data di immatricolazione è obbligatoria.' }),
  targa: z.string().min(1, 'La targa è obbligatoria.'),
  chilometraggio: z.coerce.number().int().optional().or(z.literal('')),
  carburante: z.enum(['Benzina', 'Diesel', 'Elettrica', 'Ibrida']).optional(),
  cambio: z.enum(['Manuale', 'Automatico']).optional(),
  potenza: z.coerce.number().int().optional().or(z.literal('')),
  potenza_kw: z.coerce.number().int().optional().or(z.literal('')),
  cilindrata: z.coerce.number().int().optional().or(z.literal('')),
  colore_esterno: z.string().optional(),
  colore_interni: z.string().optional(),
  classe_emissioni: z.string().optional(),
  tipoSinistro: z.string().min(1, 'Il tipo sinistro è obbligatorio.'),
  descrizione: z.string().min(1, 'La descrizione del sinistro è obbligatoria.'),
});

type AgentVehicleFormValues = z.infer<typeof agentVehicleSchema>;

type UploadImageKind = 'vehicle' | 'damage';

type UploadImageItem = {
  id: string;
  file: File;
  label: string;
  previewUrl: string;
  progress: number;
  status: 'preparing' | 'uploading' | 'error';
  storagePath: string;
  errorMessage?: string;
};

type UploadedImage = {
  url: string;
  storagePath: string;
  filename: string;
  label: string;
};

type AttachmentUploadItem = {
  id: string;
  file: File;
  attachmentType: AgentVehicleReportAttachmentType;
  progress: number;
  status: 'uploading' | 'error';
  storagePath: string;
  errorMessage?: string;
};

type UploadedAttachment = {
  url: string;
  storagePath: string;
  filename: string;
  contentType?: string | null;
  type: AgentVehicleReportAttachmentType;
};

const incidentTypeOptions = [
  'Tamponamento',
  'Grandine',
  'Urto laterale',
  'Furto/atto vandalico',
  'Danno parcheggio',
  'Altro',
];

const attachmentTypeOptions: Array<{
  value: AgentVehicleReportAttachmentType;
  label: string;
}> = [
  { value: 'libretto', label: 'Libretto' },
  { value: 'documento-cliente', label: 'Documento cliente' },
  { value: 'denuncia', label: 'Denuncia' },
  { value: 'cessione-credito-firmata', label: 'Cessione di credito firmata' },
];

const attachmentTypeLabel = (type: AgentVehicleReportAttachmentType) =>
  attachmentTypeOptions.find(option => option.value === type)?.label ?? type;

export default function AgentPage() {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'),
    [app]
  );
  const draftReportRef = useMemo(
    () => (firestore ? doc(collection(firestore, 'agentVehicleReports')) : null),
    [firestore]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAttachmentType, setSelectedAttachmentType] =
    useState<AgentVehicleReportAttachmentType>('libretto');
  const [vehicleUploadItems, setVehicleUploadItems] = useState<UploadImageItem[]>([]);
  const [damageUploadItems, setDamageUploadItems] = useState<UploadImageItem[]>([]);
  const [vehicleImages, setVehicleImages] = useState<UploadedImage[]>([]);
  const [damageImages, setDamageImages] = useState<UploadedImage[]>([]);
  const [attachmentUploadItems, setAttachmentUploadItems] = useState<AttachmentUploadItem[]>([]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const vehicleInputRef = useRef<HTMLInputElement | null>(null);
  const damageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const hasUploadingItems =
    vehicleUploadItems.some(item => item.status === 'preparing' || item.status === 'uploading')
    || damageUploadItems.some(item => item.status === 'preparing' || item.status === 'uploading')
    || attachmentUploadItems.some(item => item.status === 'uploading');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      storage.maxUploadRetryTime = 5000;
    }
  }, [storage]);

  const form = useForm<AgentVehicleFormValues>({
    resolver: zodResolver(agentVehicleSchema),
    defaultValues: {
      marca: '',
      modello: '',
      versione: '',
      data_immatricolazione: new Date().toISOString().split('T')[0],
      targa: '',
      chilometraggio: '',
      potenza: '',
      potenza_kw: '',
      cilindrata: '',
      colore_esterno: '',
      colore_interni: '',
      classe_emissioni: '',
      tipoSinistro: '',
      descrizione: '',
    },
  });

  const updateImageUploadItem = (
    kind: UploadImageKind,
    itemId: string,
    updater: (item: UploadImageItem) => UploadImageItem
  ) => {
    const setter = kind === 'vehicle' ? setVehicleUploadItems : setDamageUploadItems;
    setter(currentItems => currentItems.map(item => (item.id === itemId ? updater(item) : item)));
  };

  const handleSelectedImageFiles = (selectedFiles: File[], kind: UploadImageKind) => {
    if (!draftReportRef || !user) {
      toast({
        variant: 'destructive',
        title: 'Upload non disponibile',
        description: 'Accedi di nuovo e riprova il caricamento.',
      });
      return;
    }

    selectedFiles.forEach(file => {
      const uploadId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      const label = kind === 'vehicle' ? 'Foto vettura' : 'Foto danni';
      const setter = kind === 'vehicle' ? setVehicleUploadItems : setDamageUploadItems;

      setter(currentItems => [
        ...currentItems,
        {
          id: uploadId,
          file,
          label,
          previewUrl,
          progress: 0,
          status: 'preparing',
          storagePath: '',
        },
      ]);

      void (async () => {
        try {
          const optimizedFile = await optimizeImageForUpload(file);
          const storagePath = `agent-vehicle-reports/images/${user.uid}/${draftReportRef.id}/${kind}/${uploadId}-${optimizedFile.name}`;
          updateImageUploadItem(kind, uploadId, item => ({
            ...item,
            file: optimizedFile,
            status: 'uploading',
            storagePath,
          }));

          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, optimizedFile);

          uploadTask.on(
            'state_changed',
            snapshot => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              updateImageUploadItem(kind, uploadId, item => ({ ...item, progress }));
            },
            error => {
              const errorMessage = getUploadErrorMessage(error);
              updateImageUploadItem(kind, uploadId, item => ({
                ...item,
                status: 'error',
                errorMessage,
              }));
            },
            () => {
              getDownloadURL(uploadTask.snapshot.ref)
                .then(url => {
                  const uploadedImage = {
                    url,
                    storagePath,
                    filename: file.name,
                    label,
                  };

                  URL.revokeObjectURL(previewUrl);
                  setter(currentItems => currentItems.filter(item => item.id !== uploadId));

                  if (kind === 'vehicle') {
                    setVehicleImages(currentItems => [...currentItems, uploadedImage]);
                  } else {
                    setDamageImages(currentItems => [...currentItems, uploadedImage]);
                  }
                })
                .catch(error => {
                  const errorMessage = getUploadErrorMessage(error);
                  updateImageUploadItem(kind, uploadId, item => ({
                    ...item,
                    status: 'error',
                    errorMessage,
                  }));
                });
            }
          );
        } catch (error) {
          const errorMessage = getUploadErrorMessage(error);
          updateImageUploadItem(kind, uploadId, item => ({
            ...item,
            status: 'error',
            errorMessage,
          }));
        }
      })();
    });
  };

  const handleSelectedAttachmentFiles = (selectedFiles: File[]) => {
    if (!draftReportRef || !user) {
      toast({
        variant: 'destructive',
        title: 'Upload non disponibile',
        description: 'Accedi di nuovo e riprova il caricamento degli allegati.',
      });
      return;
    }

    selectedFiles.forEach(file => {
      const uploadId = crypto.randomUUID();
      const storagePath = `agent-vehicle-reports/attachments/${user.uid}/${draftReportRef.id}/${selectedAttachmentType}/${uploadId}-${file.name}`;

      setAttachmentUploadItems(currentItems => [
        ...currentItems,
        {
          id: uploadId,
          file,
          attachmentType: selectedAttachmentType,
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
          setAttachmentUploadItems(currentItems =>
            currentItems.map(item => (item.id === uploadId ? { ...item, progress } : item))
          );
        },
        error => {
          const errorMessage = getUploadErrorMessage(error);
          setAttachmentUploadItems(currentItems =>
            currentItems.map(item =>
              item.id === uploadId ? { ...item, status: 'error', errorMessage } : item
            )
          );
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref)
            .then(url => {
              setAttachmentUploadItems(currentItems => currentItems.filter(item => item.id !== uploadId));
              setAttachments(currentItems => [
                ...currentItems,
                {
                  url,
                  storagePath,
                  filename: file.name,
                  contentType: file.type || null,
                  type: selectedAttachmentType,
                },
              ]);
            })
            .catch(error => {
              const errorMessage = getUploadErrorMessage(error);
              setAttachmentUploadItems(currentItems =>
                currentItems.map(item =>
                  item.id === uploadId ? { ...item, status: 'error', errorMessage } : item
                )
              );
            });
        }
      );
    });
  };

  const removeUploadedImage = async (kind: UploadImageKind, imageToRemove: UploadedImage) => {
    try {
      await deleteObject(ref(storage, imageToRemove.storagePath));
    } catch (error) {
      console.error('Errore durante la rimozione immagine agente:', error);
    }

    if (kind === 'vehicle') {
      setVehicleImages(currentItems => currentItems.filter(item => item.url !== imageToRemove.url));
    } else {
      setDamageImages(currentItems => currentItems.filter(item => item.url !== imageToRemove.url));
    }
  };

  const removeAttachment = async (attachmentToRemove: UploadedAttachment) => {
    try {
      await deleteObject(ref(storage, attachmentToRemove.storagePath));
    } catch (error) {
      console.error('Errore durante la rimozione allegato agente:', error);
    }

    setAttachments(currentItems => currentItems.filter(item => item.url !== attachmentToRemove.url));
  };

  async function onSubmit(data: AgentVehicleFormValues) {
    if (!draftReportRef || !user) {
      toast({
        variant: 'destructive',
        title: 'Bozza non pronta',
        description: 'Attendi qualche istante e riprova.',
      });
      return;
    }

    if (hasUploadingItems) {
      toast({
        variant: 'destructive',
        title: 'Upload ancora in corso',
        description: 'Attendi il completamento di foto e allegati prima di salvare la pratica.',
      });
      return;
    }

    if (vehicleImages.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Foto vettura mancanti',
        description: 'Carica almeno una foto della vettura.',
      });
      return;
    }

    if (damageImages.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Foto danni mancanti',
        description: 'Carica almeno una foto dei danni.',
      });
      return;
    }

    setIsSubmitting(true);

    const normalizedBrand = normalizeBrandLabel(data.marca);

    const reportData = {
      id: draftReportRef.id,
      agentId: user.uid,
      agentEmail: user.email || null,
      status: 'new',
      marca: normalizedBrand,
      modello: data.modello,
      versione: data.versione,
      data_immatricolazione: new Date(data.data_immatricolazione).toISOString(),
      targa: data.targa,
      chilometraggio: data.chilometraggio ? Number(data.chilometraggio) : null,
      carburante: data.carburante ?? null,
      cambio: data.cambio ?? null,
      potenza: data.potenza ? Number(data.potenza) : null,
      potenza_kw: data.potenza_kw ? Number(data.potenza_kw) : null,
      cilindrata: data.cilindrata ? Number(data.cilindrata) : null,
      colore_esterno: data.colore_esterno || null,
      colore_interni: data.colore_interni || null,
      classe_emissioni: data.classe_emissioni || null,
      tipoSinistro: data.tipoSinistro,
      descrizione: data.descrizione,
      vehicleImages: vehicleImages.map(item => item.url),
      damageImages: damageImages.map(item => item.url),
      attachments: attachments.map(item => ({
        url: item.url,
        filename: item.filename,
        contentType: item.contentType || null,
        type: item.type,
        storagePath: item.storagePath,
      })),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDocumentNonBlocking(draftReportRef, reportData, { merge: true });
      toast({
        title: 'Pratica salvata',
        description: 'La vettura sinistrata è stata inviata agli admin per la valutazione.',
      });
      form.reset({
        marca: '',
        modello: '',
        versione: '',
        data_immatricolazione: new Date().toISOString().split('T')[0],
        targa: '',
        chilometraggio: '',
        carburante: undefined,
        cambio: undefined,
        potenza: '',
        potenza_kw: '',
        cilindrata: '',
        colore_esterno: '',
        colore_interni: '',
        classe_emissioni: '',
        tipoSinistro: '',
        descrizione: '',
      });
      setVehicleImages([]);
      setDamageImages([]);
      setAttachments([]);
    } catch (error) {
      console.error('Errore salvataggio pratica agente:', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio fallito',
        description: 'Impossibile salvare la pratica in questo momento.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const uploadZone = (
    title: string,
    description: string,
    inputRef: React.RefObject<HTMLInputElement | null>,
    onFilesSelected: (files: File[]) => void,
    accept: string,
    multiple = true
  ) => (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
        'cursor-pointer bg-background hover:border-primary/60 hover:bg-primary/5'
      )}
      onClick={() => inputRef.current?.click()}
    >
      <Input
        ref={inputRef}
        type="file"
        multiple={multiple}
        onChange={event => {
          if (event.target.files) {
            onFilesSelected(Array.from(event.target.files));
            event.target.value = '';
          }
        }}
        className="hidden"
        accept={accept}
      />
      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );

  const renderImageGrid = (items: UploadedImage[], kind: UploadImageKind) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map(item => (
        <div key={item.url} className="relative overflow-hidden rounded-md border aspect-[16/9]">
          <Image
            src={item.url}
            alt={item.filename}
            fill
            sizes="20vw"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute right-2 top-2">
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-7 w-7"
              onClick={() => void removeUploadedImage(kind, item)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-2 text-white">
            <p className="truncate text-xs font-medium">{item.filename}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-headline">Nuova Pratica Sinistro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inserisci i dati della vettura sinistrata. La pratica sarà visibile agli admin e non entrerà nel catalogo pubblico.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Dati Veicolo</CardTitle>
              <CardDescription>
                Compila le stesse informazioni base di una vettura in vendita, senza prezzi.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FormField control={form.control} name="marca" render={({ field }) => (
                <FormItem><FormLabel>Marca *</FormLabel><FormControl><Input placeholder="Es. Audi" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="modello" render={({ field }) => (
                <FormItem><FormLabel>Modello *</FormLabel><FormControl><Input placeholder="Es. A3" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="versione" render={({ field }) => (
                <FormItem><FormLabel>Versione *</FormLabel><FormControl><Input placeholder="Es. Sportback" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="data_immatricolazione" render={({ field }) => (
                <FormItem><FormLabel>Data di immatricolazione *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="targa" render={({ field }) => (
                <FormItem><FormLabel>Targa *</FormLabel><FormControl><Input placeholder="Es. AB123CD" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="chilometraggio" render={({ field }) => (
                <FormItem><FormLabel>Chilometraggio</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="carburante" render={({ field }) => (
                <FormItem><FormLabel>Carburante</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleziona carburante" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Benzina">Benzina</SelectItem><SelectItem value="Diesel">Diesel</SelectItem><SelectItem value="Elettrica">Elettrica</SelectItem><SelectItem value="Ibrida">Ibrida</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cambio" render={({ field }) => (
                <FormItem><FormLabel>Cambio</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleziona cambio" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Manuale">Manuale</SelectItem><SelectItem value="Automatico">Automatico</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="potenza" render={({ field }) => (
                <FormItem><FormLabel>Potenza (CV)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="potenza_kw" render={({ field }) => (
                <FormItem><FormLabel>Potenza (kW)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cilindrata" render={({ field }) => (
                <FormItem><FormLabel>Cilindrata</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="colore_esterno" render={({ field }) => (
                <FormItem><FormLabel>Colore esterno</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="colore_interni" render={({ field }) => (
                <FormItem><FormLabel>Colore interni</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="classe_emissioni" render={({ field }) => (
                <FormItem><FormLabel>Classe emissioni</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dettagli Sinistro</CardTitle>
              <CardDescription>
                Inserisci il tipo di sinistro e una descrizione utile alla valutazione admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField control={form.control} name="tipoSinistro" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo sinistro *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo sinistro" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {incidentTypeOptions.map(option => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  Visibilità pratica
                </div>
                <p className="mt-2 text-sm">
                  Questa segnalazione viene salvata in un'area privata. Non ha prezzi e non sarà visibile nel catalogo pubblico.
                </p>
              </div>
              <FormField control={form.control} name="descrizione" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Descrizione sinistro *</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[140px]"
                      placeholder="Descrivi dinamica del sinistro, entità del danno, stato del veicolo e note utili per gli admin..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Inserisci tutto ciò che può aiutare nella presa in carico: danni visibili, veicolo marciante, documenti disponibili, note del cliente.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Foto Veicolo</CardTitle>
              <CardDescription>
                Carica le foto generali della macchina e separatamente quelle dei danni.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Foto vettura</h3>
                    <p className="text-sm text-muted-foreground">Vista generale dell'auto, esterni e interno se utile.</p>
                  </div>
                  {uploadZone(
                    'Clicca per caricare foto vettura',
                    'Le immagini vengono ottimizzate e salvate subito in area privata.',
                    vehicleInputRef,
                    files => handleSelectedImageFiles(files, 'vehicle'),
                    'image/png, image/jpeg, image/webp'
                  )}
                  {vehicleUploadItems.length > 0 && vehicleUploadItems.map(item => (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{item.file.name}</span>
                        <span>{item.status === 'error' ? item.errorMessage || 'Errore' : `${Math.round(item.progress)}%`}</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  ))}
                  {vehicleImages.length > 0 && renderImageGrid(vehicleImages, 'vehicle')}
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Foto danni</h3>
                    <p className="text-sm text-muted-foreground">Dettagli ravvicinati dei punti danneggiati.</p>
                  </div>
                  {uploadZone(
                    'Clicca per caricare foto danni',
                    'Inserisci immagini chiare del sinistro e delle parti coinvolte.',
                    damageInputRef,
                    files => handleSelectedImageFiles(files, 'damage'),
                    'image/png, image/jpeg, image/webp'
                  )}
                  {damageUploadItems.length > 0 && damageUploadItems.map(item => (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{item.file.name}</span>
                        <span>{item.status === 'error' ? item.errorMessage || 'Errore' : `${Math.round(item.progress)}%`}</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  ))}
                  {damageImages.length > 0 && renderImageGrid(damageImages, 'damage')}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allegati</CardTitle>
              <CardDescription>
                Carica i documenti disponibili: libretto, documento cliente, denuncia e cessione di credito firmata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-[minmax(0,260px)_1fr]">
                <div className="space-y-2">
                  <FormLabel>Tipo allegato</FormLabel>
                  <Select value={selectedAttachmentType} onValueChange={value => setSelectedAttachmentType(value as AgentVehicleReportAttachmentType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo allegato" />
                    </SelectTrigger>
                    <SelectContent>
                      {attachmentTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {attachmentTypeOptions.map(option => (
                    <Badge key={option.value} variant={option.value === selectedAttachmentType ? 'default' : 'outline'}>
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {uploadZone(
                `Clicca per caricare ${attachmentTypeLabel(selectedAttachmentType)}`,
                'Sono accettati PDF e immagini. Gli allegati restano privati e visibili agli admin.',
                attachmentInputRef,
                handleSelectedAttachmentFiles,
                'application/pdf,image/png,image/jpeg,image/webp'
              )}

              {attachmentUploadItems.length > 0 && attachmentUploadItems.map(item => (
                <div key={item.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{item.file.name} · {attachmentTypeLabel(item.attachmentType)}</span>
                    <span>{item.status === 'error' ? item.errorMessage || 'Errore' : `${Math.round(item.progress)}%`}</span>
                  </div>
                  <Progress value={item.progress} className="h-1.5" />
                </div>
              ))}

              {attachments.length > 0 && (
                <div className="space-y-3">
                  {attachments.map(item => (
                    <div key={item.url} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">{item.filename}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{attachmentTypeLabel(item.type)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => void removeAttachment(item)} disabled={isSubmitting}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || hasUploadingItems}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Salvataggio in corso...' : 'Invia pratica agli admin'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}