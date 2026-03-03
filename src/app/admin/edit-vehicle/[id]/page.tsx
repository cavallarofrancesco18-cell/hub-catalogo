'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { useFirestore } from '@/firebase';
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
import { generateSlug } from '@/lib/utils';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import Link from 'next/link';

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
  immagini: z.string().min(1, 'Inserire almeno un URL di immagine.'),
  link_canva: z.string().url('URL non valido.').optional().or(z.literal('')),
  stato: z.enum(['In vendita', 'Venduto']),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const vehicleId = params.id as string;

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (!vehicleId) return;

    const fetchVehicle = async () => {
      setIsLoading(true);
      try {
        const vehicleRef = doc(firestore, 'vehicles', vehicleId);
        const docSnap = await getDoc(vehicleRef);

        if (docSnap.exists()) {
          const vehicleData = docSnap.data();
          form.reset({
            ...vehicleData,
            immagini: (vehicleData.immagini || []).join('\n'),
          } as VehicleFormValues);
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

  async function onSubmit(data: VehicleFormValues) {
    setIsSubmitting(true);
    try {
      const vehicleRef = doc(firestore, 'vehicles', vehicleId);

      const immaginiArray = data.immagini.split('\n').filter(url => url.trim() !== '');

      const slug = generateSlug({
        ...data,
        id: vehicleId,
      });

      await updateDocumentNonBlocking(vehicleRef, {
        ...data,
        immagini: immaginiArray,
        slug,
        potenza_kw: data.potenza_kw ? Number(data.potenza_kw) : null,
        cilindrata: data.cilindrata ? Number(data.cilindrata) : null,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Veicolo aggiornato!',
        description: `${data.marca} ${data.modello} è stato aggiornato.`,
      });
      router.push('/admin');
    } catch (error) {
      console.error('Errore durante l\'aggiornamento:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Qualcosa è andato storto.',
        description: 'Impossibile salvare le modifiche.',
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <Button asChild variant="outline">
          <Link href="/admin">Elenco Auto</Link>
        </Button>
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
              <CardTitle>Descrizione e Immagini</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
              <FormField
                control={form.control}
                name="immagini"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Immagini</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Inserisci un URL per riga..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Inserisci un link per ogni immagine, uno per riga. La prima sarà l'immagine di copertina.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="link_canva"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Link Galleria Completa (Canva - Opzionale)</FormLabel>
                      <FormControl>
                      <Input placeholder="https://..." {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
            </CardContent>
          </Card>


          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Salvataggio in corso...' : 'Salva Modifiche'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
