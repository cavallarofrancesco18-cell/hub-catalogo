'use client';

import { FormEvent, useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const MAX_FILE_SIZE_MB = 8;
const MAX_LOGO_SIZE_MB = 4;
const ACCEPTED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const TRADER_POPUP_STORAGE_KEY = 'autotrade-trader-popup-shown';
const TRADER_POPUP_DELAY_MS = 2000;

export function TraderAccessPopup() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted flag after component mounts on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show popup on mount for users who are not logged in
  useEffect(() => {
    if (!isMounted) return;

    if (isUserLoading) return;

    if (user) return;
    if (typeof window === 'undefined') return;

    const hasAlreadySeenPopup = window.localStorage.getItem(TRADER_POPUP_STORAGE_KEY) === 'true';
    if (hasAlreadySeenPopup) return;

    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(TRADER_POPUP_STORAGE_KEY, 'true');
      setIsPromptVisible(true);
    }, TRADER_POPUP_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isMounted, isUserLoading, user]);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedCompanyName = companyName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2 || trimmedCompanyName.length < 2 || trimmedPhone.length < 6
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || !certificateFile || !privacyAccepted) {
      setSubmitState('error');
      toast({
        variant: 'destructive',
        title: 'Dati incompleti',
        description: 'Compila tutti i campi obbligatori e accetta il consenso privacy.',
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

    if (companyLogoFile && (companyLogoFile.size > MAX_LOGO_SIZE_MB * 1024 * 1024 || !ACCEPTED_LOGO_TYPES.has(companyLogoFile.type))) {
      setSubmitState('error');
      toast({
        variant: 'destructive',
        title: 'Logo non valido',
        description: `Carica un logo PNG, JPG o WebP fino a ${MAX_LOGO_SIZE_MB} MB.`,
      });
      return;
    }

    const payload = new FormData();
    payload.append('name', trimmedName);
    payload.append('companyName', trimmedCompanyName);
    payload.append('phone', trimmedPhone);
    payload.append('email', trimmedEmail);
    payload.append('companyCertificate', certificateFile);
    payload.append('privacyAccepted', String(privacyAccepted));
    if (companyLogoFile) payload.append('companyLogo', companyLogoFile);

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
      setCompanyName('');
      setPhone('');
      setEmail('');
      setCertificateFile(null);
      setCompanyLogoFile(null);
      setPrivacyAccepted(false);

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
      {isPromptVisible ? (
        <aside className="fixed bottom-4 right-4 z-40 w-[min(92vw,24rem)] rounded-xl border border-border bg-background p-4 shadow-xl">
          <button
            type="button"
            onClick={() => setIsPromptVisible(false)}
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Chiudi invito commercianti"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="pr-7 text-sm font-semibold">Sei un commerciante?</h2>
          <p className="mt-1 pr-2 text-sm text-muted-foreground">
            Richiedi l’accesso ai prezzi esclusivi e alla collaborazione con AutoTrade HUB.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => {
              setIsPromptVisible(false);
              setIsDialogOpen(true);
            }}
          >
            Richiedi accesso
          </Button>
        </aside>
      ) : null}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sei un commerciante?</DialogTitle>
              <DialogDescription>
                Per richiedere l’accesso, indica i dati aziendali e allega la visura camerale. Il logo è facoltativo e potrà essere aggiunto in seguito.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="trader-name">Nome</Label>
                <Input
                  id="trader-popup-name"
                  name="name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Nome e cognome"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trader-popup-company-name">Nome azienda</Label>
                <Input
                  id="trader-popup-company-name"
                  name="companyName"
                  value={companyName}
                  onChange={event => setCompanyName(event.target.value)}
                  placeholder="Ragione sociale"
                  autoComplete="organization"
                  minLength={2}
                  maxLength={120}
                  required
                  disabled={submitState === 'submitting'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trader-phone">Telefono</Label>
                <Input
                  id="trader-popup-phone"
                  name="phone"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  placeholder="+39..."
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trader-email">Email</Label>
                <Input
                  id="trader-popup-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="nome@azienda.it"
                  autoComplete="email"
                  maxLength={254}
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

              <div className="space-y-2">
                <Label htmlFor="trader-popup-company-logo">Logo aziendale (facoltativo)</Label>
                <Input
                  id="trader-popup-company-logo"
                  name="companyLogo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={submitState === 'submitting'}
                  onChange={event => setCompanyLogoFile(event.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">PNG, JPG o WebP. Massimo {MAX_LOGO_SIZE_MB} MB.</p>
              </div>

              <label className="flex items-start gap-3 rounded-md border p-3 text-sm leading-5">
                <input
                  type="checkbox"
                  name="privacyAccepted"
                  checked={privacyAccepted}
                  onChange={event => setPrivacyAccepted(event.target.checked)}
                  required
                  disabled={submitState === 'submitting'}
                  className="mt-1 size-4 shrink-0 accent-sky-700"
                />
                <span>
                  Acconsento al trattamento dei dati aziendali e del logo esclusivamente per la gestione interna della richiesta e del rapporto commerciale e per personalizzare i documenti interni. Logo e dati aziendali non saranno pubblicati sul sito. Ho letto la{' '}
                  <Link href="/privacy-policy" className="font-medium text-sky-700 underline underline-offset-2">Privacy Policy</Link>.
                </span>
              </label>

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
