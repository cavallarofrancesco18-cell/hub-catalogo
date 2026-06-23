'use client';

import { FormEvent, useMemo, useState } from 'react';

const initialState = {
  nome: '',
  cognome: '',
  telefono: '',
  email: '',
  messaggio: '',
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function ContactForm() {
  const [formData, setFormData] = useState(initialState);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [feedback, setFeedback] = useState('');

  const whatsappHref = useMemo(() => process.env.NEXT_PUBLIC_WHATSAPP_URL ?? '', []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState('submitting');
    setFeedback('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          privacyAccepted: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || 'La richiesta non puo essere inviata in questo momento.');
      }

      setSubmitState('success');
      setFeedback(payload?.message || 'Richiesta ricevuta correttamente.');
      setFormData(initialState);
    } catch (error) {
      setSubmitState('error');
      setFeedback(error instanceof Error ? error.message : 'Si e verificato un errore inatteso.');
    }
  }

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.25)] sm:p-8">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Nome</span>
            <input required value={formData.nome} onChange={event => setFormData(current => ({ ...current, nome: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Cognome</span>
            <input required value={formData.cognome} onChange={event => setFormData(current => ({ ...current, cognome: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white" />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Telefono</span>
            <input required value={formData.telefono} onChange={event => setFormData(current => ({ ...current, telefono: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Email</span>
            <input required type="email" value={formData.email} onChange={event => setFormData(current => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white" />
          </label>
        </div>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          <span>Messaggio</span>
          <textarea required rows={6} value={formData.messaggio} onChange={event => setFormData(current => ({ ...current, messaggio: event.target.value }))} className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white" />
        </label>

        <div className="rounded-3xl bg-slate-950 px-5 py-4 text-sm leading-6 text-slate-200">
          Inviando il modulo autorizzi HUB Mobility al trattamento dei dati esclusivamente per rispondere alla tua richiesta, in conformita al GDPR e alla pagina Privacy Policy del sito.
        </div>

        {feedback ? <p className={submitState === 'success' ? 'text-sm font-medium text-emerald-700' : 'text-sm font-medium text-rose-700'}>{feedback}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={submitState === 'submitting'} className="inline-flex flex-1 items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70">
            {submitState === 'submitting' ? 'Invio in corso...' : 'Invio richiesta'}
          </button>
          <a href={whatsappHref || '#'} target={whatsappHref ? '_blank' : undefined} rel={whatsappHref ? 'noreferrer' : undefined} aria-disabled={!whatsappHref} className={['inline-flex flex-1 items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold transition', whatsappHref ? 'border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white' : 'cursor-not-allowed border-slate-200 text-slate-400'].join(' ')}>
            WhatsApp
          </a>
        </div>
      </form>
    </div>
  );
}

export default ContactForm;