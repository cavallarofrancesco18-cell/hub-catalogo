'use client';

import { FormEvent, useState } from 'react';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const initialState = {
  nome: '',
  cognome: '',
  telefono: '',
  email: '',
  budget: '',
  anticipo: '',
  messaggio: '',
};

export function FinanceForm() {
  const [formData, setFormData] = useState(initialState);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [feedback, setFeedback] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState('submitting');
    setFeedback('');

    try {
      const response = await fetch('/api/finance-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || 'La richiesta non puo essere inviata in questo momento.');
      }

      setSubmitState('success');
      setFeedback(payload?.message || 'Richiesta di consulenza ricevuta correttamente.');
      setFormData(initialState);
    } catch (error) {
      setSubmitState('error');
      setFeedback(error instanceof Error ? error.message : 'Si e verificato un errore inatteso.');
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-slate-950 p-6 text-white shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)] sm:p-8">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Nome</span>
            <input required value={formData.nome} onChange={event => setFormData(current => ({ ...current, nome: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:bg-white/10" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Cognome</span>
            <input required value={formData.cognome} onChange={event => setFormData(current => ({ ...current, cognome: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:bg-white/10" />
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Telefono</span>
            <input required value={formData.telefono} onChange={event => setFormData(current => ({ ...current, telefono: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:bg-white/10" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Email</span>
            <input required type="email" value={formData.email} onChange={event => setFormData(current => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:bg-white/10" />
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Budget indicativo</span>
            <input value={formData.budget} onChange={event => setFormData(current => ({ ...current, budget: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:bg-white/10" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Anticipo desiderato</span>
            <input value={formData.anticipo} onChange={event => setFormData(current => ({ ...current, anticipo: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:bg-white/10" />
          </label>
        </div>
        <label className="space-y-2 text-sm font-medium text-slate-200">
          <span>Messaggio</span>
          <textarea rows={5} value={formData.messaggio} onChange={event => setFormData(current => ({ ...current, messaggio: event.target.value }))} className="w-full rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400 focus:bg-white/10" />
        </label>

        {feedback ? <p className={submitState === 'success' ? 'text-sm font-medium text-emerald-300' : 'text-sm font-medium text-rose-300'}>{feedback}</p> : null}

        <button type="submit" disabled={submitState === 'submitting'} className="inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70">
          {submitState === 'submitting' ? 'Invio in corso...' : 'Richiedi consulenza'}
        </button>
      </form>
    </div>
  );
}

export default FinanceForm;