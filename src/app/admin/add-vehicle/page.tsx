
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { UploadCloud, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';

const vehicleSchema = z.object({
  marca: z.string().min(1, 'La marca è obbligatoria'),
  modello: z.string().min(1, 'Il modello è obbligatorio'),
  versione: z.string().min(1, 'La versione è obbligatoria'),
  anno: z.coerce.number().min(1900, 'Anno non valido').max(new Date().getFullYear() + 1),
  chilometraggio: z.coerce.number().min(0, 'Chilometraggio non valido'),
  carburante: z.enum(['Benzina', 'Diesel', 'Elettrica', 'Ibrida']),
  cambio: z.enum(['Manuale', 'Automatico']),
  potenza: z.coerce.number().min(1, 'Potenza non valida'),
  potenza_kw: z.coerce.number().optional(),
  cilindrata: z.coerce.number().optional(),
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
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      anno: new Date().getFullYear(),
      chilometraggio: 0,
      potenza: 0,
      prezzo: 0,
      stato: 'In vendita',
    },
  });

  useEffect(() => {
    // Cleanup object URLs on component unmount
    return () => {
      imagePreviews.forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [imagePreviews]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setImageFiles(prev => [...prev, ...files]);
      
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (indexToRemove: number) => {
    URL.revokeObjectURL(imagePreviews[indexToRemove]);
    setImageFiles(files => files.filter((_, i) => i !== indexToRemove));
    setImagePreviews(previews => previews.filter((_, i) => i !== indexToRemove));
  };

  async function onSubmit(data: VehicleFormValues) {
     if (imageFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: "Aggiungi almeno un'immagine.",
      });
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);

    try {
      let totalBytes = imageFiles.reduce((acc, file) => acc + file.size, 0);
      let totalBytesTransferred = 0;

      const uploadPromises = imageFiles.map(file => {
        const storageRef = ref(storage, `vehicles/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        return new Promise<string>((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              // This logic for aggregate progress is a bit tricky, but this should work.
              // For simplicity, we calculate progress based on number of files, not size.
            },
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadProgress(prev => prev + (1 / imageFiles.length) * 100);
              resolve(downloadURL);
            }
          );
        });
      });

      const imageUrls = await Promise.all(uploadPromises);

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
    } catch (error) {
      console.error('Error adding document: ', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile aggiungere il veicolo. Riprova più tardi.',
      });
    } finally {
        setIsUploading(false);
    }
  }

  const { formState: { isSubmitting } } = form;
  const isFormDisabled = isSubmitting || isUploading;

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
                        <Input placeholder="Es. Audi" {...field} disabled={isFormDisabled} />
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
                        <Input placeholder="Es. A3" {...field} disabled={isFormDisabled} />
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
                        <Input placeholder="Es. Sportback 35 TFSI" {...field} disabled={isFormDisabled} />
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
                        <Input type="number" {...field} disabled={isFormDisabled} />
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
                        <Input type="number" {...field} disabled={isFormDisabled} />
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
                        <Input type="number" {...field} disabled={isFormDisabled} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFormDisabled}>
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
                       <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFormDisabled}>
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
                        <Input type="number" {...field} disabled={isFormDisabled} />
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
                        <Input type="number" {...field} disabled={isFormDisabled} />
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
                        <Input type="number" {...field} disabled={isFormDisabled} />
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
                        <Input placeholder="Es. Euro 6" {...field} disabled={isFormDisabled} />
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
                        <Input {...field} disabled={isFormDisabled} />
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
                        <Input {...field} disabled={isFormDisabled} />
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
                        <Input {...field} disabled={isFormDisabled} />
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
                        <Input placeholder="Es. 12 mesi" {...field} disabled={isFormDisabled} />
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
                        <Input placeholder="Es. Pagato fino a 05/2025" {...field} disabled={isFormDisabled} />
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
                       <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFormDisabled}>
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
                        <Textarea rows={5} {...field} disabled={isFormDisabled} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Immagini *</FormLabel>
                  <FormControl>
                    <div
                      className="relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer border-input hover:border-primary/50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="w-10 h-10 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Clicca per caricare</span> o trascina le foto
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP</p>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isFormDisabled}
                      />
                    </div>
                  </FormControl>
                  {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={preview} className="relative aspect-square">
                        <Image
                          src={preview}
                          alt={`Anteprima immagine ${index + 1}`}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                          className="object-cover rounded-md"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeImage(index)}
                          disabled={isFormDisabled}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                 <FormMessage />
                </div>
                
              {isUploading && (
                <div className="space-y-2">
                    <Label>Caricamento immagini... {Math.round(uploadProgress)}%</Label>
                    <Progress value={uploadProgress} className="w-full" />
                </div>
              )}


              <Button type="submit" disabled={isFormDisabled}>
                {isUploading ? `Caricamento... ${Math.round(uploadProgress)}%` : (isSubmitting ? 'Salvataggio...' : 'Salva veicolo')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
