'use client';

import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  LOGO_URL,
  COMPANY_NAME,
  COMPANY_ADDRESS,
  COMPANY_CONTACT,
} from '@/lib/branding';
import Image from 'next/image';

interface CustomerData {
  name: string;
  address: string;
  cf: string;
  docNumber: string;
}

interface PrintableProformaProps {
  vehicle: Vehicle;
  customer: CustomerData;
  price: number;
  customerType: 'privato' | 'commerciante';
  warranty: string;
  date: string;
}

export function PrintableProforma({ vehicle, customer, price, customerType, warranty, date }: PrintableProformaProps) {

  const DetailRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <tr className="border-b border-gray-200">
        <td className="py-2 pr-4 font-medium text-gray-600 w-1/3">{label}</td>
        <td className="py-2 font-semibold">{value}</td>
    </tr>
  );

  return (
    <div className="bg-white text-black p-8 font-sans text-sm">
      <header className="flex justify-between items-start pb-4 mb-8 border-b-2 border-gray-300">
        <div className="flex items-center gap-4">
          {LOGO_URL ? (
             <Image
              src={LOGO_URL}
              alt={`${COMPANY_NAME} Logo`}
              width={180}
              height={45}
              className="h-10 w-auto"
            />
          ) : (
            <h1 className="text-xl font-bold">{COMPANY_NAME}</h1>
          )}
        </div>
        <div className="text-right text-xs">
          <p className="font-bold">{COMPANY_NAME}</p>
          <p>{COMPANY_ADDRESS}</p>
          <p>{COMPANY_CONTACT}</p>
        </div>
      </header>

      <div className="text-center mb-8">
        <h1 className="text-xl font-bold uppercase">Contratto di Compravendita di Autoveicolo Usato</h1>
        <p className="text-base">redatto in duplice copia originale</p>
      </div>

      <section className="mb-6">
        <h2 className="font-bold text-base mb-2 pb-1 border-b">TRA</h2>
        <p><span className="font-semibold">{COMPANY_NAME}</span>, con sede in {COMPANY_ADDRESS}, in qualità di VENDITORE</p>
        <h2 className="font-bold text-base mt-4 mb-2 pb-1 border-b">E</h2>
        <p><span className="font-semibold">{customer.name}</span>, residente in {customer.address}, C.F. {customer.cf}, documento n. {customer.docNumber}, in qualità di ACQUIRENTE</p>
      </section>

      <section className="mb-6">
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 1 - Oggetto del Contratto</h2>
        <p className="mb-3">Il VENDITORE vende e cede all'ACQUIRENTE, che accetta, il seguente autoveicolo usato:</p>
        <table className="w-full text-left">
            <tbody>
                <DetailRow label="Marca" value={vehicle.marca} />
                <DetailRow label="Modello" value={vehicle.modello} />
                <DetailRow label="Versione" value={vehicle.versione} />
                <DetailRow label="Targa" value={vehicle.targa || 'Non specificata'} />
                <DetailRow label="Data Immatricolazione" value={vehicle.data_immatricolazione ? new Date(vehicle.data_immatricolazione).toLocaleDateString('it-IT') : vehicle.anno} />
                <DetailRow label="Chilometraggio" value={`${formatNumber(vehicle.chilometraggio)} km`} />
                <DetailRow label="Carburante" value={vehicle.carburante} />
                <DetailRow label="Cambio" value={vehicle.cambio} />
                <DetailRow label="Potenza" value={`${vehicle.potenza} CV / ${vehicle.potenza_kw} kW`} />
                <DetailRow label="Colore Esterno" value={vehicle.colore_esterno} />
            </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 2 - Prezzo e Pagamento</h2>
        <p>Il prezzo di vendita è convenuto in <span className="font-bold">{formatCurrency(price)}</span> (IVA inclusa), che l'ACQUIRENTE si impegna a versare secondo le modalità concordate.</p>
      </section>

      <section className="mb-6">
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 3 - Garanzia</h2>
        {customerType === 'privato' ? (
          <p className="whitespace-pre-wrap">{warranty || 'Nessuna garanzia specificata.'}</p>
        ) : (
          <p>La vettura viene acquistata vista e piaciuta.</p>
        )}
      </section>
      
      <section className="mb-6">
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 4 - Dichiarazioni</h2>
        <p>L'ACQUIRENTE dichiara di aver ispezionato il veicolo e di averlo trovato in buono stato d'uso, idoneo all'uso cui è destinato e di proprio gradimento. Il passaggio di proprietà avverrà contestualmente al saldo del prezzo.</p>
      </section>

      <footer className="mt-16">
        <p>Letto, approvato e sottoscritto.</p>
        <p>Data: {date}</p>
        <div className="flex justify-between mt-12">
            <div className="w-2/5">
                <p className="font-bold">Firma del Venditore</p>
                <div className="mt-8 border-b border-gray-400"></div>
            </div>
            <div className="w-2/5">
                <p className="font-bold">Firma dell'Acquirente</p>
                <div className="mt-8 border-b border-gray-400"></div>
            </div>
        </div>
      </footer>
    </div>
  );
}
