'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, storage } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { UploadCloud, X } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';

const vehicleSchema = z.object({
  marca: z.string().min(1, 'La marca è obbligatoria'),
  modello: z.string().min(1, 'Il modello è obbligatorio'),
  versione: z.string().min(1, 'La versione è obbligatoria'),
  anno: z.coerce.number().min(1900, 'Anno non valido').max(new Date().getFullYear() + 1),
  chilometraggio: z.coerce.number().min(0, 'Chilometraggio non valido'),
  carburante: z.enum(['Benzina', 'Diesel', 'Elettrica', 'Ibrida'], {
    errorMap: () => ({ message: 'Seleziona un tipo di carburante.' }),
  }),
  cambio: z.enum(['Manuale', 'Automatico'], {
    errorMap: () => ({ message: 'Seleziona un tipo di cambio.' }),
  }),
  potenza: z.coerce.number().min(1, 'Potenza non valida'),
  potenza_kw: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.coerce.number({invalid_type_error: 'Potenza (kW) deve essere un numero.'}).positive('Potenza (kW) deve essere un numero positivo.').optional()
  ),
  cilindrata: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.coerce.number({invalid_type_error: 'Cilindrata deve essere un numero.'}).positive('Cilindrata deve essere un numero positivo.').optional()
  ),
  classe_emissioni: z.string().optional(),
  colore_esterno: z.string().min(1, 'Il colore è obbligatorio'),
  colore_interni: z.string().optional(),
  prezzo: z.coerce.number().min(0, 'Prezzo non valido'),
  descrizione: z.string().min(10, 'La descrizione è troppo corta'),
  targa: z.string().optional(),
  garanzia: z.string().optional(),
  bollo: z.string().optional(),
  stato: z.enum(['In vendita', 'Venduto']),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function AddVehiclePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      marca: '',
      modello: '',
      versione: '',
      anno: new Date().getFullYear(),
      chilometraggio: 0,
      carburante: undefined,
      cambio: undefined,
      potenza: 0,
      potenza_kw: undefined,
      cilindrata: undefined,
      classe_emissioni: '',
      colore_esterno: '',
      colore_interni: '',
      prezzo: 0,
      descrizione: '',
      targa: '',
      garanzia: '',
      bollo: '',
      stato: 'In vendita',
    },
  });
  
  const { formState: { isSubmitting } } = form;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setImageFiles(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };


  async function onSubmit(data: VehicleFormValues) {
     if (imageFiles.length === 0) {
      form.setError('root.serverError', {
        type: 'manual',
        message: 'Devi caricare almeno un\'immagine.'
      });
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Devi caricare almeno un\'immagine.',
      });
      return;
    }

    setUploadProgress(0);

    try {
      const imageUrls: string[] = [];
      const totalFiles = imageFiles.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = imageFiles[i];
        // Create a unique file name to avoid collisions in storage
        const fileName = `vehicle-${Date.now()}-${i}-${file.name}`;
        const storageRef = ref(storage, `vehicles/${fileName}`);
        
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        imageUrls.push(downloadURL);

        // Update progress
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      const vehicleData = {
        ...data,
        immagini: imageUrls,
        data_inserimento: serverTimestamp(),
      };
      await addDoc(collection(db, 'vehicles'), vehicleData);

      toast({
        title: 'Successo!',
        description: 'Veicolo aggiunto al catalogo.',
      });
      router.push('/auto');
    } catch (error: any) {
      console.error('Error adding document: ', error);
      
      let description = 'Impossibile salvare il veicolo. Si è verificato un errore sconosciuto.';
      if (error.code === 'storage/unauthorized') {
          description = 'Errore di permessi per il caricamento delle immagini. Controlla le regole di sicurezza di Firebase Storage.';
      } else if (error.code === 'permission-denied') {
        description = 'Errore di permessi. Controlla le regole di sicurezza di Firestore.';
      }

      toast({
        variant: 'destructive',
        title: 'Errore durante il salvataggio',
        description: description,
      });
    } finally {
        setUploadProgress(null);
    }
  }


  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Aggiungi un nuovo veicolo</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca *</FormLabel>
                      <FormControl>
                        <Input placeholder="Es. Audi" {...field} disabled={isSubmitting} />
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
                        <Input placeholder="Es. A3" {...field} disabled={isSubmitting} />
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
                        <Input placeholder="Es. Sportback 35 TFSI" {...field} disabled={isSubmitting} />
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
                      <FormLabel>Anno *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} disabled={isSubmitting} />
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
                      <FormLabel>Chilometraggio *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} disabled={isSubmitting} />
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
                      <FormLabel>Prezzo *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} disabled={isSubmitting} />
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
                      <FormLabel>Carburante *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
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
                      <FormLabel>Cambio *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
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
                      <FormLabel>Potenza (CV) *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} disabled={isSubmitting} />
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
                        <Input type="number" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input type="number" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input placeholder="Es. Euro 6" {...field} value={field.value ?? ''} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="colore_esterno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colore Esterno *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                      <FormLabel>Targa</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input placeholder="Es. 12 mesi" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input placeholder="Es. Pagato fino a 05/2025" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                      <FormLabel>Stato Annuncio *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
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
              </div>

              <FormField
                control={form.control}
                name="descrizione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione *</FormLabel>
                    <FormControl>
                      <Textarea rows={5} {...field} value={field.value ?? ''} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Immagini *</FormLabel>
                <FormControl>
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clicca per caricare</span> o trascina</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP</p>
                      </div>
                      <Input 
                        id="dropzone-file" 
                        type="file" 
                        className="hidden" 
                        multiple 
                        onChange={handleFileChange}
                        accept="image/png, image/jpeg, image/webp"
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>
                </FormControl>
                <FormDescription>
                  La prima immagine caricata sarà quella di copertina.
                </FormDescription>
                <FormMessage />
              </div>

              {imageFiles.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Immagini selezionate:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imageFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={URL.createObjectURL(file)}
                          alt={`Anteprima ${index + 1}`}
                          width={200}
                          height={150}
                          onLoad={() => URL.revokeObjectURL(URL.createObjectURL(file))}
                          className="object-cover w-full h-24 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-75 group-hover:opacity-100 transition-opacity"
                          aria-label="Rimuovi immagine"
                          disabled={isSubmitting}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadProgress !== null && (
                  <div className="space-y-2">
                      <FormLabel>{uploadProgress === 100 ? 'Finalizzazione...' : 'Caricamento in corso...'}</FormLabel>
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-muted-foreground text-center">{Math.round(uploadProgress)}%</p>
                  </div>
              )}
              
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvataggio...' : 'Salva veicolo'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
