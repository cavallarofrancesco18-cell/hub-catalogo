'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Send, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getWhatsAppUrl, siteConfig } from '@/lib/site';

const contactSchema = z.object({
  nome: z.string().min(2, 'Inserisci il nome.'),
  cognome: z.string().min(2, 'Inserisci il cognome.'),
  telefono: z.string().min(6, 'Inserisci un numero di telefono valido.'),
  email: z.string().email('Inserisci un indirizzo email valido.'),
  messaggio: z.string().min(20, 'Scrivi un messaggio più dettagliato.'),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Devi confermare di aver letto l’informativa privacy.' }),
  }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const defaultValues: ContactFormValues = {
  nome: '',
  cognome: '',
  telefono: '',
  email: '',
  messaggio: '',
  privacyAccepted: true,
};

export function ContactForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues,
  });

  async function onSubmit(values: ContactFormValues) {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; emailSent?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'CONTACT_REQUEST_FAILED');
      }

      toast({
        title: 'Richiesta inviata',
        description: result?.emailSent
          ? 'Abbiamo preso in carico la tua richiesta e l’abbiamo inoltrata al team.'
          : 'Abbiamo preso in carico la tua richiesta e la trovi registrata nel sistema.',
      });

      form.reset(defaultValues);
    } catch (error) {
      console.error('Invio contatto fallito:', error);
      toast({
        variant: 'destructive',
        title: 'Invio non riuscito',
        description: 'Riprova tra qualche istante oppure contattaci via WhatsApp.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-3xl border border-border/60 bg-card p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Nome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cognome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cognome</FormLabel>
                <FormControl>
                  <Input placeholder="Cognome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefono</FormLabel>
                <FormControl>
                  <Input placeholder="+39 ..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="nome@azienda.it" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="messaggio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Messaggio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Raccontaci cosa stai cercando, se vuoi valutare un finanziamento o una permuta, e il veicolo di tuo interesse."
                  className="min-h-[180px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="privacyAccepted"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={checked => field.onChange(Boolean(checked))} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-medium">
                  Ho letto l&apos;informativa privacy e acconsento al trattamento dei dati per essere ricontattato.
                </FormLabel>
                <p className="text-sm text-muted-foreground">
                  I dati vengono usati solo per gestire la richiesta, in linea con la privacy policy pubblicata.
                </p>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="sm:min-w-[220px]" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Invia richiesta
          </Button>
          <Button asChild variant="outline" className="sm:min-w-[220px]">
            <a href={getWhatsAppUrl('Buongiorno, vorrei ricevere informazioni su AutoTrade HUB.')} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Messaggio privacy GDPR: i dati sono trattati esclusivamente per rispondere alla tua richiesta e non vengono ceduti a terzi per finalità commerciali.
        </p>
        <p className="text-xs text-muted-foreground">
          Dati del titolare: {siteConfig.companyName}, {siteConfig.address.streetAddress}, {siteConfig.address.postalCode} {siteConfig.address.addressLocality} ({siteConfig.address.addressRegion}), {siteConfig.email}.
        </p>
      </form>
    </Form>
  );
}
