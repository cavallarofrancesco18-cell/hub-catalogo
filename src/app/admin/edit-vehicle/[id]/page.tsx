'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import Image from 'next/image';

import { useFirestore, useFirebaseApp } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { generateSlug, getDirectImageUrl, cn } from '@/lib/utils';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Loader2, X, Trash2, Star, Sparkles } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { generateVehicleDescription } from '@/ai/flows/generate-vehicle-description';

const vehicleSchema = z.object({
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
  prezzo: z.coerce.number().optional().or(z.literal('')),
  garanzia: z.string().optional(),
  classe_emissioni: z.string().optional(),
  bollo: z.string().optional(),
  descrizione: z.string().optional(),
  immagini: z.string().optional(),
  link_canva: z.string().url('URL non valido.').optional().or(z.literal('')),
  stato: z.enum(['In vendita', 'Venduto', 'Prenotato']).optional(),
});


type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = getStorage(app, 'gs://studio-3074982188-44660.appspot.com');
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const vehicleId = params.id as string;
  
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<{ file: File; previewUrl: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const [folderPath, setFolderPath] = useState('');
  const [isImportingFolder, setIsImportingFolder] = useState(false);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      marca: '',
      modello: '',
      versione: '',
      data_immatricolazione: new Date().toISOString().split('T')[0],
      chilometraggio: '',
      potenza: '',
      potenza_kw: '',
      cilindrata: '',
      colore_esterno: '',
      colore_interni: '',
      prezzo: '',
      targa: '',
      garanzia: '',
      classe_emissioni: '',
      bollo: '',
      descrizione: '',
      immagini: '',
      link_canva: '',
      stato: 'In vendita',
    },
  });

  useEffect(() => {
    if (!vehicleId || !firestore) return;

    const fetchVehicle = async () => {
      setIsLoading(true);
      try {
        const vehicleRef = doc(firestore, 'vehicles', vehicleId);
        const docSnap = await getDoc(vehicleRef);

        if (docSnap.exists()) {
          const vehicleData = docSnap.data();
          const registrationDateISO = vehicleData.data_immatricolazione || (vehicleData.anno ? new Date(vehicleData.anno, 0, 1).toISOString() : new Date().toISOString());
          const dataForForm = {
            ...vehicleData,
            chilometraggio: vehicleData.chilometraggio ?? '',
            potenza: vehicleData.potenza ?? '',
            prezzo: vehicleData.prezzo ?? '',
            carburante: vehicleData.carburante ?? undefined,
            cambio: vehicleData.cambio ?? undefined,
            colore_esterno: vehicleData.colore_esterno ?? '',
            descrizione: vehicleData.descrizione ?? '',
            stato: vehicleData.stato ?? 'In vendita',
            targa: vehicleData.targa ?? '',
            data_immatricolazione: new Date(registrationDateISO).toISOString().split('T')[0],
            potenza_kw: vehicleData.potenza_kw ?? '',
            cilindrata: vehicleData.cilindrata ?? '',
            colore_interni: vehicleData.colore_interni ?? '',
            garanzia: vehicleData.garanzia ?? '',
            classe_emissioni: vehicleData.classe_emissioni ?? '',
            bollo: vehicleData.bollo ?? '',
            link_canva: vehicleData.link_canva ?? '',
            immagini: '', // Keep textarea for new URLs empty
          };
          form.reset(dataForForm as any);
          setExistingImages(vehicleData.immagini || []);
        } else {
          toast({
            variant: 'destructive',
            title: 'Errore',
            description: 'Veicolo non trovato.',
          });
          router.push('/admin');
        }
      } catch (error) {
        console.error("Errore nel caricamento del veicolo:", error);
        toast({
          variant: 'destructive',
          title: 'Uh oh! Qualcosa è andato storto.',
          description: 'Impossibile caricare i dati del veicolo.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchVehicle();
  }, [vehicleId, firestore, form, router, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFilesToUpload(prevFiles => {
        const existingFileNames = new Set(prevFiles.map(f => f.file.name));
        const uniqueNewFiles = newFiles
          .filter(f => !existingFileNames.has(f.name))
          .map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
        
        return [...prevFiles, ...uniqueNewFiles];
      });
    }
  };

  const removeNewFile = (fileName: string) => {
    setFilesToUpload(prevFiles => {
        const fileToRemove = prevFiles.find(f => f.file.name === fileName);
        if (fileToRemove) {
            URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        return prevFiles.filter(f => f.file.name !== fileName);
    });
  };
  
  const removeExistingImage = (urlToRemove: string) => {
    setExistingImages(prev => prev.filter(url => url !== urlToRemove));
  };

  const setAsCoverImage = (urlToSet: string) => {
    setExistingImages(prev => {
      const newOrder = prev.filter(url => url !== urlToSet);
      newOrder.unshift(urlToSet);
      return newOrder;
    });
  };

  const handleDelete = async () => {
    if (!firestore || !vehicleId) return;

    setIsDeleting(true);
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    
    try {
      const deleteImagePromises = existingImages.map(url => {
        if (url.includes('firebasestorage.googleapis.com')) {
          const imageRef = ref(storage, url);
          return deleteObject(imageRef).catch(err => {
              console.error(`Impossibile eliminare l'immagine ${url}:`, err);
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(deleteImagePromises);
      await deleteDocumentNonBlocking(vehicleRef);
      
      toast({
        title: "Veicolo eliminato!",
        description: `Il veicolo è stato rimosso dal catalogo.`,
      });
      router.push("/admin");
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      toast({
        variant: "destructive",
        title: "Uh oh! Qualcosa è andato storto.",
        description: "Impossibile eliminare il veicolo.",
      });
    } finally {
        setIsDeleting(false);
    }
  };

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  };

  const handleGenerateDescription = async () => {
    setIsGeneratingDescription(true);
    try {
      await form.trigger(); // Trigger validation to ensure data is available
      const data = form.getValues();

      const requiredFields: (keyof VehicleFormValues)[] = [
        'marca',
        'modello',
        'versione',
        'data_immatricolazione',
        'chilometraggio',
        'carburante',
        'cambio',
        'potenza',
        'colore_esterno',
      ];

      const missingFields = requiredFields.filter(field => !data[field]);

      if (missingFields.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Dati mancanti',
          description: `Per generare la descrizione, compila almeno i campi principali e tecnici. Campi mancanti: ${missingFields.join(
            ', '
          )}.`,
        });
        setIsGeneratingDescription(false);
        return;
      }

      const imageDataUris = await Promise.all(
        filesToUpload.map(f => fileToDataUri(f.file))
      );
      const textAreaUrls =
        data.immagini?.split('\n').filter(url => url.trim() !== '') ?? [];
      const allImageSources = [
        ...new Set([...existingImages, ...textAreaUrls, ...imageDataUris]),
      ];

      if (allImageSources.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nessuna immagine',
          description: `Per una descrizione migliore, assicurati che ci siano immagini esistenti, caricate o inserite tramite URL.`,
        });
        setIsGeneratingDescription(false);
        return;
      }

      const aiInput = {
        marca: data.marca!,
        modello: data.modello!,
        versione: data.versione!,
        anno: new Date(data.data_immatricolazione!).getFullYear(),
        chilometraggio: Number(data.chilometraggio),
        carburante: data.carburante!,
        cambio: data.cambio!,
        potenza: Number(data.potenza),
        colore_esterno: data.colore_esterno!,
        prezzo: data.prezzo ? Number(data.prezzo) : undefined,
        immagini: allImageSources,
      };

      const description = await generateVehicleDescription(aiInput);

      if (!description) {
        toast({
          variant: 'destructive',
          title: 'Uh oh! Qualcosa è andato storto.',
          description:
            'Il servizio AI è momentaneamente occupato o non è riuscito a generare una descrizione. Riprova tra qualche istante.',
        });
        return;
      }

      form.setValue('descrizione', description, { shouldValidate: true });

      toast({
        title: 'Descrizione generata!',
        description: 'La descrizione è stata inserita nel campo apposito.',
      });
    } catch (error) {
      console.error('Errore durante la generazione della descrizione:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Qualcosa è andato storto.',
        description:
          'Impossibile generare la descrizione in questo momento a causa di un errore imprevisto.',
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleImportFromFolder = async () => {
    const originalPath = folderPath.trim();
    if (!originalPath) {
      toast({
        variant: 'destructive',
        title: 'Percorso mancante',
        description: 'Inserisci un percorso di cartella valido.',
      });
      return;
    }
    if (!storage) return;

    setIsImportingFolder(true);

    let pathToUse = originalPath;
    if (pathToUse.includes('console.firebase.google.com')) {
        try {
            // This is a URL from the Firebase Console browser bar. We need to parse it.
            // e.g., https://console.firebase.google.com/project/.../storage/.../files/~2Fmy-folder
            const pathParts = pathToUse.split('/files/');
            if (pathParts.length > 1) {
                let consolePath = pathParts[1];
                // The console path might start with ~2F which represents a leading '/'
                if (consolePath.startsWith('~2F')) {
                    consolePath = consolePath.substring(3);
                }
                // It also uses ~2F for sub-folder slashes
                pathToUse = decodeURIComponent(consolePath.replace(/~2F/g, '/'));
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'URL non valido',
                    description: "L'URL della console non è valido. Copia il percorso della cartella (es. 'download/abc-123') e non l'intero URL del browser.",
                });
                setIsImportingFolder(false);
                return;
            }
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Importazione fallita',
                description: 'Impossibile analizzare l\'URL della console. Riprova con il percorso diretto.',
            });
            setIsImportingFolder(false);
            return;
        }
    }
    
    try {
      const folderRef = ref(storage, pathToUse);
      const result = await listAll(folderRef);

      if (result.items.length === 0) {
        toast({
          title: 'Nessuna immagine trovata',
          description: `La cartella "${pathToUse}" è vuota o non esiste.`,
        });
        return;
      }

      const urlPromises = result.items.map(itemRef => getDownloadURL(itemRef));
      const newUrls = await Promise.all(urlPromises);
      
      setExistingImages(prev => [...new Set([...prev, ...newUrls])]);

      toast({
        title: 'Importazione completata!',
        description: `${newUrls.length} immagini aggiunte alla galleria.`,
      });
      setFolderPath('');
    } catch (error: any) {
      console.error('Errore durante l\'importazione dalla cartella:', error);
      let description = 'Si è verificato un errore imprevisto.';
      if (error.code === 'storage/object-not-found') {
          description = `Cartella "${pathToUse}" non trovata. Controlla il percorso e riprova.`;
      } else if (error.code === 'storage/invalid-url') {
          description = `Il percorso "${originalPath}" non è un URL o un percorso valido per lo storage.`;
      }
      toast({
        variant: 'destructive',
        title: 'Importazione fallita',
        description,
      });
    } finally {
      setIsImportingFolder(false);
    }
  };

  async function onSubmit(data: VehicleFormValues) {
    if (!firestore) {
        toast({
            variant: 'destructive',
            title: 'Errore di connessione',
            description: 'Impossibile connettersi al database. Riprova più tardi.',
        });
        return;
    }
    
    setIsSubmitting(true);

    let uploadedImageUrls: string[] = [];
    if (filesToUpload.length > 0) {
      setIsUploading(true);
      setUploadProgress({});
      try {
        const uploadPromises = filesToUpload.map(({ file }) => {
          const storageRef = ref(storage, `download/${vehicleId}/${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          return new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
              },
              (error) => reject(error),
              () => {
                getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
              }
            );
          });
        });
        uploadedImageUrls = await Promise.all(uploadPromises);
      } catch (error) {
        console.error('Errore during l\'aggiornamento delle immagini:', error);
        toast({
            variant: 'destructive',
            title: 'Uh oh! Qualcosa è andato storto.',
            description: error instanceof Error ? error.message : 'Impossibile caricare le nuove immagini.',
        });
        setIsSubmitting(false);
        setIsUploading(false);
        return;
      }
    }
    
    setIsUploading(false);

    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    
    const textAreaUrls = data.immagini?.split('\n').filter(url => url.trim() !== '') ?? [];
    const allImageUrls = [...new Set([...existingImages, ...uploadedImageUrls, ...textAreaUrls])];

    const slug = generateSlug({
      ...data,
      id: vehicleId,
    });
    
    const { immagini, ...restOfData } = data;

    const dataToSave = {
        ...restOfData,
        immagini: allImageUrls,
        slug,
        chilometraggio: data.chilometraggio ? Number(data.chilometraggio) : null,
        potenza: data.potenza ? Number(data.potenza) : null,
        prezzo: data.prezzo ? Number(data.prezzo) : null,
        potenza_kw: data.potenza_kw ? Number(data.potenza_kw) : null,
        cilindrata: data.cilindrata ? Number(data.cilindrata) : null,
        data_immatricolazione: new Date(data.data_immatricolazione).toISOString(),
        updatedAt: serverTimestamp(),
    };
    
    updateDocumentNonBlocking(vehicleRef, dataToSave)
    .then(() => {
        toast({
            title: 'Veicolo aggiornato!',
            description: `${data.marca} ${data.modello} è stato aggiornato.`,
        });
        router.push('/admin');
    })
    .catch((error) => {
        console.error('Errore during l\'aggiornamento:', error);
        toast({
            variant: 'destructive',
            title: 'Uh oh! Qualcosa è andato storto.',
            description: 'Impossibile salvare le modifiche.',
        });
    })
    .finally(() => {
        setIsSubmitting(false);
    });
  }

  if (isLoading) {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Caricamento...</h1>
            <div className="space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
                 <Skeleton className="h-10 w-32 ml-auto" />
            </div>
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-headline">Modifica Veicolo</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader>
              <CardTitle>Informazioni Principali</CardTitle>
              <CardDescription>
                Modifica i dati base del veicolo. I campi con * sono obbligatori.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Audi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="modello"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modello *</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. A3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="versione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versione/Allestimento *</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Sportback 35 TFSI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_immatricolazione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data di Immatricolazione *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="targa"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Targa *</FormLabel>
                    <FormControl>
                        <Input placeholder="Es. AB123CD" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prezzo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prezzo</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 32000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dati Tecnici</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <FormField
                control={form.control}
                name="chilometraggio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chilometraggio</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 45000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carburante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carburante</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona carburante" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Benzina">Benzina</SelectItem>
                        <SelectItem value="Diesel">Diesel</SelectItem>
                        <SelectItem value="Elettrica">Elettrica</SelectItem>
                        <SelectItem value="Ibrida">Ibrida</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cambio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Cambio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipo cambio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Manuale">Manuale</SelectItem>
                        <SelectItem value="Automatico">Automatico</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="potenza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potenza (CV)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 150" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="potenza_kw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potenza (kW)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 110" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cilindrata"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cilindrata (cc)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 1998" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="classe_emissioni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classe Emissioni</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Euro 6d" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle>Estetica e Dati Amministrativi</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormField
                    control={form.control}
                    name="colore_esterno"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Colore Esterno</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. Grigio Daytona" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="colore_interni"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Colore Interni</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. Pelle Nera" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="garanzia"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Garanzia</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. 12 mesi" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="bollo"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bollo</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. Pagato fino a 12/2024" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="stato"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Stato Annuncio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Seleziona stato" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="In vendita">In vendita</SelectItem>
                            <SelectItem value="Prenotato">Prenotato</SelectItem>
                            <SelectItem value="Venduto">Venduto</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
           </Card>

           <Card>
            <CardHeader>
              <CardTitle>Descrizione</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="descrizione"
                render={({ field }) => (
                  <FormItem>
                     <div className="flex justify-between items-center mb-2">
                        <FormLabel>Descrizione Commerciale</FormLabel>
                         <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={handleGenerateDescription}
                            disabled={isGeneratingDescription || isSubmitting}
                        >
                            {isGeneratingDescription ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            Genera con AI
                        </Button>
                      </div>
                    <FormControl>
                      <Textarea
                        placeholder="Descrivi il veicolo in modo accattivante..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                     <FormDescription>
                       L'AI può generare una descrizione basata sui dati inseriti e sulle immagini disponibili.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Immagini e Galleria</CardTitle>
                <CardDescription>
                    Gestisci le immagini del veicolo. La prima immagine sarà la copertina. Se non ci sono immagini, verrà mostrato un segnaposto.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div>
                    <FormLabel>Immagini Esistenti</FormLabel>
                    {existingImages.length > 0 ? (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {existingImages.map((url, index) => {
                                const imageUrl = getDirectImageUrl(url);
                                if (!imageUrl) return null;

                                return (
                                <div key={`${url}-${index}`} className="relative group aspect-[16/9]">
                                    {index === 0 && (
                                        <Badge variant="default" className="absolute top-2 left-2 z-10">Copertina</Badge>
                                    )}
                                    <Image
                                        src={imageUrl}
                                        alt="Immagine veicolo esistente"
                                        fill
                                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                        className="object-cover rounded-md"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        {index > 0 && (
                                            <Button type="button" variant="secondary" size="icon" className="h-8 w-8" onClick={() => setAsCoverImage(url)} disabled={isSubmitting} title="Imposta come copertina">
                                                <Star className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeExistingImage(url)} disabled={isSubmitting} title="Rimuovi immagine">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Nessuna immagine esistente. Caricane di nuove qui sotto.</p>
                    )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Aggiungi Nuove Immagini
                    </span>
                  </div>
                </div>

                 <div>
                    <FormLabel>Carica da dispositivo</FormLabel>
                    <FormControl>
                        <Input 
                            type="file" 
                            multiple 
                            onChange={handleFileChange}
                            className="mt-2 h-auto p-4 border-dashed cursor-pointer"
                            accept="image/png, image/jpeg, image/webp"
                        />
                    </FormControl>
                    {filesToUpload.length > 0 && (
                       <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Nuove immagini da caricare:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                              {filesToUpload.map(({ file, previewUrl }) => (
                                  <div key={file.name} className="relative group aspect-[16/9]">
                                      <Image
                                          src={previewUrl}
                                          alt={`Anteprima di ${file.name}`}
                                          fill
                                          sizes="20vw"
                                          className="object-cover rounded-md"
                                      />
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                                          <Button 
                                              type="button" 
                                              variant="destructive" 
                                              size="icon" 
                                              className="h-7 w-7 shrink-0 absolute top-1 right-1 z-10"
                                              onClick={() => removeNewFile(file.name)}
                                              disabled={isUploading}
                                          >
                                              <X className="h-4 w-4" />
                                          </Button>
                                          <p className="text-xs text-white truncate w-full mt-auto">{file.name}</p>
                                           {isUploading && uploadProgress[file.name] != null && (
                                              <div className="w-full px-1 pt-1">
                                                  <Progress value={uploadProgress[file.name]} className="h-1" />
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                    )}
                 </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Oppure importa nuovi URL
                    </span>
                  </div>
                </div>
              
                <FormField
                control={form.control}
                name="immagini"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aggiungi URL Immagini (uno per riga)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="https://.../immagine1.jpg
https://.../immagine2.png"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>Per importare da Firebase Storage, apri ogni immagine e copia il suo "URL di download". Incolla un URL per riga. Non è possibile usare il link di una cartella.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Oppure importa da cartella
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                  <FormLabel>Importa da cartella Storage</FormLabel>
                  <div className="flex items-center gap-2">
                      <Input 
                          placeholder="Es. download/VEHICLE_ID" 
                          value={folderPath} 
                          onChange={(e) => setFolderPath(e.target.value)}
                      />
                      <Button 
                          type="button" 
                          variant="secondary" 
                          onClick={handleImportFromFolder}
                          disabled={isImportingFolder || isSubmitting}
                      >
                          {isImportingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Importa'}
                      </Button>
                  </div>
                  <FormDescription>
                      Dalla console di Firebase Storage, copia il percorso (es. "download/xyz-123") che trovi sopra la lista dei file. Questo metodo è più veloce rispetto all'URL completo.
                  </FormDescription>
              </div>

               <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Oppure
                    </span>
                  </div>
                </div>

              <FormField
                  control={form.control}
                  name="link_canva"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Link Galleria Completa (Canva)</FormLabel>
                      <FormControl>
                      <Input placeholder="https://..." {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
            </CardContent>
          </Card>


          <div className="flex items-center justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button" disabled={isSubmitting || isLoading || isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina Veicolo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione non può essere annullata. Questo eliminerà permanentemente il veicolo.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? "Eliminazione..." : "Conferma eliminazione"}
                    </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                  <Link href="/admin">Annulla</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoading || isDeleting}>
                {isSubmitting ? (isUploading ? 'Caricamento immagini...' : 'Salvataggio in corso...') : 'Salva Modifiche'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
