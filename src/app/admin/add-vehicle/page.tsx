
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
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
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Trash } from 'lucide-react';

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
  immagini: z.array(z.object({ url: z.string().url('URL immagine non valido') })).min(1, 'Aggiungi almeno un\'immagine'),
  targa: z.string().optional(),
  garanzia: z.string().optional(),
  bollo: z.string().optional(),
  stato: z.enum(['In vendita', 'Venduto']),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;

export default function AddVehiclePage() {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      anno: new Date().getFullYear(),
      chilometraggio: 0,
      potenza: 0,
      prezzo: 0,
      immagini: [{ url: '' }],
      stato: 'In vendita',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'immagini',
  });

  async function onSubmit(data: VehicleFormValues) {
    try {
      const vehicleData = {
        ...data,
        immagini: data.immagini.map(img => img.url),
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
                  name="anno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anno *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
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
                        <Input type="number" {...field} />
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
                        <Input type="number" {...field} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Input type="number" {...field} />
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
                        <Input type="number" {...field} />
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
                        <Input type="number" {...field} />
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
                        <Input placeholder="Es. Euro 6" {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input {...field} />
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
                        <Input placeholder="Es. 12 mesi" {...field} />
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
                        <Input placeholder="Es. Pagato fino a 05/2025" {...field} />
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
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Textarea rows={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                   <FormLabel>Immagini *</FormLabel>
                   <div className='space-y-4 mt-2'>
                    {fields.map((field, index) => (
                         <FormField
                            key={field.id}
                            control={form.control}
                            name={`immagini.${index}.url`}
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            <Input placeholder="https://..." {...field} />
                                        </FormControl>
                                        {fields.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <Trash className="h-4 w-4 text-destructive" />
                                            </Button>
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ))}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => append({ url: '' })}
                    >
                        Aggiungi URL immagine
                    </Button>
                </div>


              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvataggio...' : 'Salva veicolo'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
