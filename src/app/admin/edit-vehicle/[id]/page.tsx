'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
import { generateSlug, getDirectImageUrl } from '@/lib/utils';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { X } from 'lucide-react';

const vehicleSchema = z.object({
  marca: z.string().min(1, 'La marca è obbligatoria.'),
  modello: z.string().min(1, 'Il modello è obbligatorio.'),
  versione: z.string().min(1, 'La versione è obbligatoria.'),
  anno: z.coerce.number().int().min(1900, 'Anno non valido.').max(new Date().getFullYear() + 1),
  chilometraggio: z.coerce.number().int().min(0, 'Chilometraggio non valido.'),
  carburante: z.enum(['Benzina', 'Diesel', 'Elettrica', 'Ibrida']),
  cambio: z.enum(['Manuale', 'Automatico']),
  potenza: z.coerce.number().int().min(1, 'Potenza non valida.'),
  potenza_kw: z.coerce.number().int().min(1, 'Potenza non valida.').optional().or(z.literal('')),
  cilindrata: z.coerce.number().int().min(1, 'Cilindrata non valida.').optional().or(z.literal('')),
  colore_esterno: z.string().min(1, 'Il colore è obbligatorio.'),
  colore_interni: z.string().optional(),
  prezzo: z.coerce.number().min(0, 'Prezzo non valido.'),
  targa: z.string().optional(),
  garanzia: z.string().optional(),
  classe_emissioni: z.string().optional(),
  bollo: z.string().optional(),
  descrizione: z.string().min(10, 'La descrizione è troppo corta.'),
  immagini: z.string().optional(),
  link_canva: z.string().url('URL non valido.').optional().or(z.literal('')),
  stato: z.enum(['In vendita', 'Venduto']),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = getStorage(app);
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const vehicleId = params.id as string;
  
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      marca: '',
      modello: '',
      versione: '',
      anno: new Date().getFullYear(),
      chilometraggio: 0,
      carburante: 'Benzina',
      cambio: 'Manuale',
      potenza: 0,
      potenza_kw: '',
      cilindrata: '',
      colore_esterno: '',
      colore_interni: '',
      prezzo: 0,
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
          const dataForForm = {
            ...vehicleData,
            potenza_kw: vehicleData.potenza_kw ?? '',
            cilindrata: vehicleData.cilindrata ?? '',
            colore_interni: vehicleData.colore_interni ?? '',
            targa: vehicleData.targa ?? '',
            garanzia: vehicleData.garanzia ?? '',
            classe_emissioni: vehicleData.classe_emissioni ?? '',
            bollo: vehicleData.bollo ?? '',
            link_canva: vehicleData.link_canva ?? '',
            immagini: '', // Keep textarea for new URLs empty
          };
          form.reset(dataForForm as VehicleFormValues);
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
        const uniqueNewFiles = newFiles.filter(
          newFile => !prevFiles.some(prevFile => prevFile.name === newFile.name)
        );
        return [...prevFiles, ...uniqueNewFiles];
      });
    }
  };

  const removeNewFile = (fileName: string) => {
    setFilesToUpload(prevFiles => prevFiles.filter(file => file.name !== fileName));
  };
  
  const removeExistingImage = (urlToRemove: string) => {
    setExistingImages(prev => prev.filter(url => url !== urlToRemove));
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
    
    const hasImageUrlsFromTextArea = data.immagini && data.immagini.trim() !== '';
    const hasExistingImages = existingImages.length > 0;
    const hasFiles = filesToUpload.length > 0;
    const hasCanvaLink = data.link_canva && data.link_canva.trim() !== '';

    if (!hasExistingImages && !hasFiles && !hasCanvaLink && !hasImageUrlsFromTextArea) {
        toast({
            variant: "destructive",
            title: "Nessuna immagine fornita",
            description: "È necessario avere almeno un'immagine, un link Canva, caricare un nuovo file o inserire un URL.",
        });
        return;
    }

    setIsSubmitting(true);

    let uploadedImageUrls: string[] = [];
    if (filesToUpload.length > 0) {
      setIsUploading(true);
      setUploadProgress({});
      try {
        const uploadPromises = filesToUpload.map(file => {
          const storageRef = ref(storage, `vehicles/${vehicleId}/${Date.now()}-${file.name}`);
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
        console.error('Errore durante l\'aggiornamento delle immagini:', error);
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
        potenza_kw: data.potenza_kw ? Number(data.potenza_kw) : null,
        cilindrata: data.cilindrata ? Number(data.cilindrata) : null,
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
        console.error('Errore durante l\'aggiornamento:', error);
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
                Modifica i dati base del veicolo.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
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
                    <FormLabel>Modello</FormLabel>
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
                    <FormLabel>Versione/Allestimento</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Sportback 35 TFSI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="anno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anno</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 2022" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chilometraggio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chilometraggio</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 45000" {...field} />
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
                      <Input type="number" placeholder="Es. 32000" {...field} />
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
                      <Input type="number" placeholder="Es. 150" {...field} />
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
                    <FormLabel>Potenza (kW) (Opzionale)</FormLabel>
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
                    <FormLabel>Cilindrata (cc) (Opzionale)</FormLabel>
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
                    <FormLabel>Classe Emissioni (Opzionale)</FormLabel>
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
                        <Input placeholder="Es. Grigio Daytona" {...field} />
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
                        <FormLabel>Colore Interni (Opzionale)</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. Pelle Nera" {...field} value={field.value ?? ''} />
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
                        <FormLabel>Targa (Opzionale)</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. AB123CD" {...field} value={field.value ?? ''} />
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
                        <FormLabel>Garanzia (Opzionale)</FormLabel>
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
                        <FormLabel>Bollo (Opzionale)</FormLabel>
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
                    <FormLabel>Descrizione Commerciale</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descrivi il veicolo in modo accattivante..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
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
                    Gestisci le immagini del veicolo. Devi fornire almeno un'immagine. La prima sarà quella di copertina.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div>
                    <FormLabel>Immagini Esistenti</FormLabel>
                    {existingImages.length > 0 ? (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {existingImages.map((url, index) => (
                                <div key={`${url}-${index}`} className="relative group aspect-w-16 aspect-h-9">
                                    <Image
                                        src={getDirectImageUrl(url)}
                                        alt="Immagine veicolo esistente"
                                        fill
                                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                        className="object-cover rounded-md"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeExistingImage(url)} disabled={isSubmitting}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
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
                            accept="image/png, image/jpeg, image/gif, image/webp"
                        />
                    </FormControl>
                    {filesToUpload.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium">File pronti per il caricamento:</p>
                            <ul className="space-y-3">
                                {filesToUpload.map((file) => (
                                     <li key={file.name} className="text-sm bg-muted p-3 rounded-md">
                                        <div className="flex items-start justify-between">
                                            <span className="truncate pr-4 font-medium text-foreground">{file.name}</span>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 shrink-0" 
                                                onClick={() => removeNewFile(file.name)}
                                                disabled={isUploading}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {isUploading && uploadProgress[file.name] != null && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <Progress value={uploadProgress[file.name]} className="h-1.5" />
                                                <span className="text-xs font-mono text-muted-foreground w-10 text-right shrink-0">
                                                    {`${Math.round(uploadProgress[file.name])}%`}
                                                </span>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
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
                name="immagini"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Immagini (uno per riga, per nuove immagini)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="https://.../immagine1.jpg&#x000A;https://.../immagine2.png"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>Aggiungi qui nuovi URL di immagini. Le immagini esistenti sono mostrate sopra.</FormDescription>
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


          <div className="flex justify-end gap-4">
             <Button variant="outline" asChild>
                <Link href="/admin">Annulla</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? (isUploading ? 'Caricamento immagini...' : 'Salvataggio in corso...') : 'Salva Modifiche'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
