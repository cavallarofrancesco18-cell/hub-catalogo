'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { doc, collection, serverTimestamp } from 'firebase/firestore';
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
import { generateSlug } from '@/lib/utils';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { X } from 'lucide-react';

const vehicleSchema = z.object({
  marca: z.string().min(1, 'La marca è obbligatoria.'),
  modello: z.string().min(1, 'Il modello è obbligatorio.'),
  versione: z.string().min(1, 'La versione è obbligatoria.'),
  anno: z.coerce.number().int().min(1900, 'Anno non valido.').max(new Date().getFullYear() + 1),
  chilometraggio: z.coerce.number().int().min(0, 'Chilometraggio non valido.'),
  carburante: z.enum(['Benzina', 'Diesel', 'Elettrica', 'Ibrida'], { required_error: 'Seleziona un tipo di carburante.'}),
  cambio: z.enum(['Manuale', 'Automatico'], { required_error: 'Seleziona un tipo di cambio.'}),
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
  link_canva: z.string().url({ message: "URL non valido." }).optional().or(z.literal('')),
  stato: z.enum(['In vendita', 'Venduto']),
  data_inserimento: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function AddVehiclePage() {
  const router = useRouter();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [filesToUpload, setFilesToUpload] = useState<{ file: File; previewUrl: string }[]>([]);
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

  const removeFile = (fileName: string) => {
    setFilesToUpload(prevFiles => {
        const fileToRemove = prevFiles.find(f => f.file.name === fileName);
        if (fileToRemove) {
            URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        return prevFiles.filter(f => f.file.name !== fileName);
    });
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

    const hasImageUrls = data.immagini && data.immagini.trim() !== '';
    const hasCanvaLink = data.link_canva && data.link_canva.trim() !== '';
    const hasFiles = filesToUpload.length > 0;

    if (!hasImageUrls && !hasCanvaLink && !hasFiles) {
      toast({
        variant: 'destructive',
        title: 'Nessuna immagine fornita',
        description: "È necessario caricare almeno un'immagine, inserire URL o fornire un link Canva.",
      });
      return;
    }

    setIsSubmitting(true);

    const vehicleCollection = collection(firestore, 'vehicles');
    const newDocRef = doc(vehicleCollection);
    
    let uploadedImageUrls: string[] = [];
    if (filesToUpload.length > 0) {
      setIsUploading(true);
      setUploadProgress({});
      try {
        const uploadPromises = filesToUpload.map(({ file }) => {
          const storageRef = ref(storage, `vehicles/${newDocRef.id}/${file.name}`);
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
        console.error('Errore durante il caricamento delle immagini:', error);
        toast({
          variant: 'destructive',
          title: 'Uh oh! Qualcosa è andato storto.',
          description: error instanceof Error ? error.message : 'Impossibile caricare le immagini.',
        });
        setIsSubmitting(false);
        setIsUploading(false);
        return;
      }
    }
    
    setIsUploading(false);

    const textAreaUrls = data.immagini?.split('\n').filter(url => url.trim() !== '') ?? [];
    const allImageUrls = [...new Set([...textAreaUrls, ...uploadedImageUrls])];
    
    const slug = generateSlug({
      ...data,
      id: newDocRef.id,
    });

    const dataToSave = {
      ...data,
      id: newDocRef.id,
      immagini: allImageUrls,
      slug,
      potenza_kw: data.potenza_kw ? Number(data.potenza_kw) : null,
      cilindrata: data.cilindrata ? Number(data.cilindrata) : null,
      data_inserimento: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    setDocumentNonBlocking(newDocRef, dataToSave, { merge: true })
        .then(() => {
            toast({
                title: 'Veicolo aggiunto!',
                description: `${data.marca} ${data.modello} è stato aggiunto al catalogo.`,
            });
            router.push('/admin');
        })
        .catch((error) => {
            console.error('Errore durante il salvataggio:', error);
            let errorMessage = 'Si è verificato un errore durante il salvataggio.';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            toast({
                variant: 'destructive',
                title: 'Uh oh! Qualcosa è andato storto.',
                description: errorMessage,
            });
        })
        .finally(() => {
            setIsSubmitting(false);
        });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-headline">Aggiungi Nuovo Veicolo</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Principali</CardTitle>
              <CardDescription>
                Inserisci i dati base del veicolo.
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
                    Fornisci almeno una delle seguenti opzioni. L'upload da dispositivo è consigliato. La prima immagine sarà quella di copertina.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                          <p className="text-sm font-medium mb-2">Anteprima caricamento:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                              {filesToUpload.map(({ file, previewUrl }) => (
                                  <div key={file.name} className="relative group aspect-w-16 aspect-h-9">
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
                                              onClick={() => removeFile(file.name)}
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
                      Oppure
                    </span>
                  </div>
                </div>

              <FormField
                control={form.control}
                name="immagini"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Immagini (uno per riga)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="https://.../immagine1.jpg
https://.../immagine2.png"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                     <FormDescription>
                      Per usare immagini già caricate su Firebase Storage, copia e incolla qui il loro "URL di download".
                    </FormDescription>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isUploading ? 'Caricamento immagini...' : 'Salvataggio in corso...') : 'Salva Veicolo'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
