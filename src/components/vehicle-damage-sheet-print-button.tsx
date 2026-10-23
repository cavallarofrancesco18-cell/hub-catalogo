'use client';

import { useRef, useState } from 'react';
import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Vehicle } from '@/lib/types';

type Props = {
  vehicle?: Partial<Vehicle> | null;
  vehicleLabel?: string;
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') return toDate.call(value).toLocaleDateString('it-IT');
  }
  return String(value);
};

const registrationDate = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? displayValue(value) : parsed.toLocaleDateString('it-IT');
};

const mileage = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${new Intl.NumberFormat('it-IT').format(parsed)} km` : '—';
};

function buildSheet(vehicle: Partial<Vehicle> | null | undefined, vehicleLabel: string | undefined, baseUrl: string) {
  const model = [vehicle?.marca, vehicle?.modello, vehicle?.versione].filter(Boolean).join(' ') || vehicleLabel || 'Veicolo';
  const safe = (value: unknown) => escapeHtml(displayValue(value));
  const fields = [
    ['Marca', safe(vehicle?.marca)],
    ['Modello / versione', safe([vehicle?.modello, vehicle?.versione].filter(Boolean).join(' ') || vehicleLabel)],
    ['Targa', safe(vehicle?.targa)],
    ['N. riferimento', safe(vehicle?.numeroRiferimento)],
    ['Immatricolazione', escapeHtml(registrationDate(vehicle?.data_immatricolazione))],
    ['Chilometraggio', escapeHtml(mileage(vehicle?.chilometraggio))],
    ['Alimentazione', safe(vehicle?.carburante)],
    ['Cambio', safe(vehicle?.cambio)],
    ['Colore', safe(vehicle?.colore_esterno)],
  ];
  const today = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short' }).format(new Date());

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scheda danni - ${escapeHtml(model)}</title>
<style>
@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:10pt Arial,Helvetica,sans-serif}.sheet{width:190mm;margin:0 auto}
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #12304a;padding-bottom:4mm}.logo{width:54mm;height:auto}.kind{text-align:right;color:#526171;font-size:9pt}
h1{margin:4mm 0 2mm;color:#102b43;font-size:19pt}.model{margin:0 0 4mm;color:#526171}.data{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;border:1px solid #cbd5df;padding:3mm}
.field{min-height:11mm;border-bottom:1px solid #d7dee6;padding:1mm 1.5mm}.label{display:block;margin-bottom:1mm;color:#607080;font-size:7pt;text-transform:uppercase}.value{font-size:9pt;font-weight:600;overflow-wrap:anywhere}
h2{margin:4mm 0 1mm;color:#102b43;font-size:11pt}.diagram-wrap{display:flex;justify-content:center;border:1px solid #d7dee6;padding:1mm 3mm}.diagram{height:88mm;width:auto;max-width:100%}
.legend{display:grid;grid-template-columns:repeat(2,1fr);gap:1.5mm 5mm;margin-top:2mm}.legend-item{display:flex;align-items:center;gap:2mm;font-size:8pt}.dot{width:5mm;height:5mm;border:1px solid #768392;border-radius:50%}
.notes{margin-top:3mm}.notes-title{margin-bottom:1mm;font-weight:700}.line{height:7mm;border-bottom:1px solid #b8c2ce}.footer{display:flex;gap:12mm;margin-top:4mm;font-size:8pt}.signature{flex:1;padding-top:7mm;border-bottom:1px solid #7d8996}.signature-label{margin-top:1mm;color:#526171}
@media screen{body{min-height:100vh;padding:12mm;background:#e9eef3}.sheet{min-height:277mm;padding:10mm;background:#fff;box-shadow:0 2mm 8mm #102b4320}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:auto}}
</style></head><body><main class="sheet">
<header class="header"><img class="logo" src="${baseUrl}/autotradelogo.png" alt="AutoTrade"><div class="kind">SCHEDA VEICOLO<br>Data compilazione: ${today}</div></header>
<h1>Accertamento dei danni</h1><p class="model">${escapeHtml(model)}</p>
<section class="data">${fields.map(([label, value]) => `<div class="field"><span class="label">${label}</span><span class="value">${value}</span></div>`).join('')}</section>
<h2>Schema danni</h2><div class="diagram-wrap">
<svg class="diagram" viewBox="0 0 440 620" role="img" aria-label="Schema vettura visto dall'alto">
<g fill="none" stroke="#687583" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
<path d="M168 28Q133 30 117 70L91 159Q83 178 89 204L82 410Q78 438 91 463L107 533Q116 574 160 589H280Q324 574 333 533L349 463Q362 438 358 410L351 204Q357 178 349 159L323 70Q307 30 272 28Z" fill="#fff"/>
<path d="M145 83Q153 57 181 55H259Q287 57 295 83L315 150Q318 170 296 178H124Q102 170 105 150Z" fill="#f5f7f9"/>
<path d="M124 189Q220 176 316 189L327 246H113Z" fill="#fafbfc"/><path d="M112 260Q220 248 328 260L331 385Q220 398 109 385Z" fill="#f8fafb"/>
<path d="M113 399H327L317 471Q309 489 289 493H151Q131 489 123 471Z" fill="#f5f7f9"/><path d="M145 504Q220 493 295 504L282 548Q276 562 256 565H184Q164 562 158 548Z" fill="#fafbfc"/>
<path d="M220 34V585M96 214H344M91 391H349" stroke-dasharray="7 8" stroke-width="1.5"/>
<g fill="#e8edf1" stroke="#687583" stroke-width="2"><rect x="39" y="131" width="42" height="90" rx="16"/><rect x="359" y="131" width="42" height="90" rx="16"/><rect x="39" y="410" width="42" height="90" rx="16"/><rect x="359" y="410" width="42" height="90" rx="16"/></g>
<g fill="#fff" stroke="#7c8793" stroke-width="2"><circle cx="60" cy="176" r="22"/><circle cx="380" cy="176" r="22"/><circle cx="60" cy="455" r="22"/><circle cx="380" cy="455" r="22"/></g>
<g stroke="#87929d" stroke-width="1.5"><circle cx="60" cy="176" r="12"/><circle cx="380" cy="176" r="12"/><circle cx="60" cy="455" r="12"/><circle cx="380" cy="455" r="12"/><path d="M60 164V188M48 176H72M380 164V188M368 176H392M60 443V467M48 455H72M380 443V467M368 455H392"/></g>
<g fill="#fff" stroke="#586675" stroke-width="2"><rect x="207" y="121" width="26" height="26"/><rect x="121" y="280" width="24" height="24"/><rect x="295" y="280" width="24" height="24"/><rect x="121" y="345" width="24" height="24"/><rect x="295" y="345" width="24" height="24"/><rect x="207" y="520" width="26" height="26"/></g>
</g></svg></div>
<div class="legend"><div class="legend-item"><span class="dot" style="background:#2585d8"></span>Sostituzione cristallo</div><div class="legend-item"><span class="dot" style="background:#ef5548"></span>Sostituzione lamierato</div><div class="legend-item"><span class="dot" style="background:#f1d744"></span>Verniciatura lamierato</div><div class="legend-item"><span class="dot" style="background:#35a66c"></span>Riparazione a freddo</div></div>
<section class="notes"><div class="notes-title">Altri danni / interventi da eseguire</div><div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></section>
<footer class="footer"><div class="signature"><div class="signature-label">Data e luogo</div></div><div class="signature"><div class="signature-label">Firma</div></div></footer>
</main></body></html>`;
}

export function VehicleDamageSheetPrintButton({ vehicle, vehicleLabel }: Props) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPreviewHtml(buildSheet(vehicle, vehicleLabel, window.location.origin))}
      >
        <Printer className="mr-2 h-4 w-4" />
        Stampa scheda danni
      </Button>
      <Dialog open={Boolean(previewHtml)} onOpenChange={open => !open && setPreviewHtml(null)}>
        <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Scheda danni veicolo</DialogTitle>
            <DialogDescription>Stampa la scheda o scegli “Salva come PDF” nella finestra di stampa.</DialogDescription>
          </DialogHeader>
          <iframe
            ref={previewFrameRef}
            srcDoc={previewHtml ?? ''}
            title="Anteprima scheda danni"
            className="min-h-0 flex-1 border-0 bg-slate-100"
            sandbox="allow-same-origin allow-modals"
          />
          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" onClick={() => previewFrameRef.current?.contentWindow?.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Stampa / Salva PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}