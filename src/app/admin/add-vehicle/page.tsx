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
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { List } from 'lucide-react';
import Link from 'next/link';

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
  immagini: z.string().min(1, 'Aggiungi almeno un URL di immagine.'),
  link_canva: z.string().url({ message: 'URL non valido.' }).optional().or(z.literal('')),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function AddVehiclePage() {
  const { toast } = useToast();
  const router = useRouter();

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
      immagini: '',
      link_canva: '',
    },
  });

  async function onSubmit(data: VehicleFormValues) {
    const imageUrls = data.immagini.split('\n').map(url => url.trim()).filter(Boolean);
    if (imageUrls.length === 0) {
      form.setError('immagini', {
        type: 'manual',
        message: 'Aggiungi almeno un URL di immagine.',
      });
      return;
    }

    const urlSchema = z.string().url();
    const invalidUrls = imageUrls.filter(url => !urlSchema.safeParse(url).success);
    if (invalidUrls.length > 0) {
      form.setError('immagini', {
        type: 'manual',
        message: `Uno o più URL delle immagini non sono validi: ${invalidUrls.join(', ')}`,
      });
      return;
    }

    try {
      const { immagini, ...restOfData } = data;
      const vehicleData = {
        ...restOfData,
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
      let description = 'Impossibile aggiungere il veicolo. Riprova più tardi.';
      if (error.code === 'permission-denied' || (error.message && error.message.includes('permission-denied'))){
        description = 'Errore di permessi. Controlla le regole di sicurezza di Firestore.';
      } else if (error.code === 'unavailable' || (error.message && error.message.toLowerCase().includes('fetch'))){
        description = 'Errore di connessione al database. Verifica la configurazione di Firebase e la connessione internet.'
      }

      toast({
        variant: 'destructive',
        title: 'Errore',
        description: description,
      });
    }
  }

  const { formState: { isSubmitting } } = form;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Aggiungi un nuovo veicolo</CardTitle>
            <Button asChild variant="outline">
              <Link href="/auto">
                <List className="mr-2 h-4 w-4" />
                Elenco Auto
              </Link>
            </Button>
          </div>
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
                        <Input placeholder="Es. Audi" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input placeholder="Es. A3" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input placeholder="Es. Sportback 35 TFSI" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input type="number" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input type="number" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input type="number" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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
                        <Input type="number" {...field} value={field.value ?? ''} disabled={isSubmitting} />
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

              <FormField
                control={form.control}
                name="immagini"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Immagini *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="https://.../immagine1.jpg
https://.../immagine2.jpg"
                        rows={5}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      Inserisci un URL di immagine per riga. La prima immagine sarà quella di copertina.
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
                    <FormLabel>Link Canva (Galleria Completa)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.canva.com/design/..." {...field} value={field.value ?? ''} disabled={isSubmitting} />
                    </FormControl>
                    <FormDescription>
                      Link a una presentazione Canva con la galleria fotografica completa del veicolo.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
