'use client';

import { FormEvent, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const MAX_FILE_SIZE_MB = 8;

export function TraderForm() {
  const { toast } = useToast();

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (trimmedName.length < 2 || trimmedPhone.length < 6 || !certificateFile) {
      setSubmitState('error');
      toast({
        variant: 'destructive',
        title: 'Dati incompleti',
        description: 'Compila nome, telefono e allega la visura camerale.',
      });
      return;
    }

    if (certificateFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setSubmitState('error');
      toast({
        variant: 'destructive',
        title: 'File troppo grande',
        description: `La visura non puo superare ${MAX_FILE_SIZE_MB} MB.`,
      });
      return;
    }

    const payload = new FormData();
    payload.append('name', trimmedName);
    payload.append('phone', trimmedPhone);
    payload.append('companyCertificate', certificateFile);

    setSubmitState('submitting');

    try {
      const response = await fetch('/api/trader-access-request', {
        method: 'POST',
        body: payload,
      });

      const result = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message || result?.error || 'REQUEST_FAILED');
      }

      setSubmitState('success');
      setName('');
      setPhone('');
      setCertificateFile(null);

      toast({
        title: 'Richiesta inviata',
        description:
          'Ti ricontatteremo con i dati di accesso per visualizzare i prezzi esclusivi dedicati ai commercianti.',
      });

      // Reset form after success
      setTimeout(() => {
        setSubmitState('idle');
      }, 2000);
    } catch (error) {
      setSubmitState('error');
      toast({
        variant: 'destructive',
        title: 'Invio non riuscito',
        description:
          error instanceof Error
            ? error.message
            : 'Impossibile inviare la richiesta in questo momento. Riprova tra poco.',
      });
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Sei un commerciante?</CardTitle>
        <CardDescription>
          Se vuoi accedere ai prezzi esclusivi e collaborare con noi, compila il form con i tuoi dati e allega la
          visura camerale. Verrai ricontattato per ricevere i dati di accesso dedicati.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="trader-name">Nome</Label>
            <Input
              id="trader-name"
              name="name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Nome e cognome"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trader-phone">Telefono</Label>
            <Input
              id="trader-phone"
              name="phone"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              placeholder="+39..."
              autoComplete="tel"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trader-certificate">Visura camerale</Label>
            <Input
              id="trader-certificate"
              name="companyCertificate"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              required
              onChange={event => setCertificateFile(event.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">Formati accettati: PDF, PNG, JPG. Dimensione massima: 8 MB.</p>
          </div>

          {submitState === 'success' ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              Richiesta ricevuta correttamente. Ti contatteremo a breve con i dati di accesso.
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitState === 'submitting'}>
            {submitState === 'submitting' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Invio in corso...
              </span>
            ) : (
              'Invia richiesta'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
