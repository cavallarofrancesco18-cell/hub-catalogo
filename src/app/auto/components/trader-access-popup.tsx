'use client';

import { FormEvent, useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const MAX_FILE_SIZE_MB = 8;
const SESSION_STORAGE_KEY = 'trader_popup_shown_auto';

export function TraderAccessPopup() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted flag after component mounts on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show popup on mount if not logged in and not yet shown
  useEffect(() => {
    if (!isMounted) return;

    // If user is still loading, don't show yet
    if (isUserLoading) return;

    // If user is logged in, don't show
    if (user) return;

    // Check for debug mode (show popup regardless of sessionStorage)
    const urlParams = new URLSearchParams(window.location.search);
    const debugPopup = urlParams.get('debug-popup') === '1';

    // Check if popup was already shown in this session
    const alreadyShown = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!alreadyShown || debugPopup) {
      setIsDialogOpen(true);
      if (!debugPopup) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      }
    }
  }, [isMounted, isUserLoading, user]);

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
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Sei un commerciante?</DialogTitle>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-4 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Chiudi</span>
                </Button>
              </DialogClose>
              <DialogDescription>
                Se vuoi accedere ai prezzi esclusivi e collaborare con noi, compila il form con i tuoi dati e allega la
                visura camerale. Verrai ricontattato per ricevere i dati di accesso dedicati.
              </DialogDescription>
            </DialogHeader>

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

              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Chiudi
                </Button>
                <Button type="submit" disabled={submitState === 'submitting'}>
                  {submitState === 'submitting' ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Invio in corso...
                    </span>
                  ) : (
                    'Invia richiesta'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </>
  );
}
