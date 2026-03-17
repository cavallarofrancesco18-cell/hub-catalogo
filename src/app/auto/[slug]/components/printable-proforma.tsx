'use client';

import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { BrandingProfile } from '@/lib/branding';

interface CustomerData {
  name: string;
  address: string;
  cf: string;
  docNumber?: string;
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  email?: string;
}

interface PrintableProformaProps {
  vehicle: Vehicle;
  customer: CustomerData;
  price: number;
  costoVultura: number;
  customerType: 'privato' | 'commerciante';
  paymentMethod: string;
  warranty: string;
  insurance: string;
  wearAndTear: string;
  documentation: string;
  withdrawal: string;
  date: string;
  branding: BrandingProfile;
  logoUrl: string;
  financingCompany?: string;
  numberOfInstallments?: number;
  installmentAmount?: number;
  totalFinancedAmount?: number;
}

export function PrintableProforma({ vehicle, customer, price, costoVultura, customerType, paymentMethod, warranty, insurance, wearAndTear, documentation, withdrawal, date, branding, logoUrl, financingCompany, numberOfInstallments, installmentAmount, totalFinancedAmount }: PrintableProformaProps) {
  
  const { companyName, companyAddress, companyContact } = branding;
  const totalPrice = price + costoVultura;

  const DetailRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <tr className="border-b border-gray-200" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <td className="py-2 pr-4 font-medium text-gray-600 w-1/3">{label}</td>
        <td className="py-2 font-semibold">{value}</td>
    </tr>
  );

  return (
    <div className="bg-white text-black p-6 text-sm" style={{ fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: '1.4' }}>
      <header className="flex justify-between items-start pb-4 mb-6 border-b-2 border-gray-300" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div className="flex items-center gap-4">
          {logoUrl ? (
             <img
              src={logoUrl}
              crossOrigin="anonymous"
              alt={`${companyName} Logo`}
              style={{ width: '200px', height: 'auto', maxHeight: '64px' }}
            />
          ) : (
            <h1 className="text-xl font-bold">{companyName}</h1>
          )}
        </div>
        <div className="text-right text-xs">
          <p className="font-bold">{companyName}</p>
          <p>{companyAddress}</p>
          <p>{companyContact}</p>
        </div>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '24px', letterSpacing: '0.5px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 'bold' }}>CONTRATTO DI COMPRAVENDITA DI AUTOVEICOLO USATO</h1>
        <p style={{ fontSize: '14px', marginTop: '4px' }}>redatto in duplice copia originale</p>
      </div>

      <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h2 className="font-bold text-base mb-2 pb-1 border-b">TRA</h2>
        <p style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}><span className="font-semibold">{companyName}</span>, con sede in {companyAddress}, in qualità di VENDITORE</p>
        <h2 className="font-bold text-base mt-4 mb-2 pb-1 border-b">E</h2>
        <p style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <span className="font-semibold">{customer.name}</span>
          {customerType === 'privato' && customer.birthPlace && customer.birthDate && (
             <>, nato/a a <span className="font-semibold">{customer.birthPlace}</span> il <span className="font-semibold">{new Date(customer.birthDate).toLocaleDateString('it-IT')}</span></>
          )}
          , residente in <span className="font-semibold">{customer.address}</span>,
          {customerType === 'privato' ? ' C.F. ' : ' P.IVA '}<span className="font-semibold">{customer.cf}</span>
          {customerType === 'privato' && customer.docNumber && (
            <>, documento n. <span className="font-semibold">{customer.docNumber}</span></>
          )}
          {customer.phone && <>, tel. <span className="font-semibold">{customer.phone}</span></>}
          {customer.email && <>, email <span className="font-semibold">{customer.email}</span></>}
          , in qualità di ACQUIRENTE
        </p>
      </section>

      <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 1 - Oggetto del Contratto</h2>
        <p className="mb-3" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>Il VENDITORE vende e cede all'ACQUIRENTE, che accetta, il seguente autoveicolo usato:</p>
        <table className="w-full text-left" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
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

      <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 2 - Prezzo e Pagamento</h2>
        <p style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>Il prezzo di vendita è convenuto come segue:</p>
         <table className="w-2/3 text-left my-3 text-base" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <tbody>
                <tr className="border-b" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <td className="py-2 pr-4">Prezzo veicolo</td>
                    <td className="py-2 font-semibold text-right">{formatCurrency(price)}</td>
                </tr>
                <tr className="border-b" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <td className="py-2 pr-4">Costo Voltura</td>
                    <td className="py-2 font-semibold text-right">{formatCurrency(costoVultura)}</td>
                </tr>
                <tr className="" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <td className="pt-3 pr-4 font-bold text-lg">PREZZO TOTALE</td>
                    <td className="pt-3 font-bold text-right text-lg">{formatCurrency(totalPrice)}</td>
                </tr>
            </tbody>
        </table>
        <p className="mt-2" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>Modalità di pagamento: <span className="font-bold capitalize">{paymentMethod}</span>.</p>
        
        {paymentMethod === 'finanziamento' && financingCompany && (
            <div className="mt-4 border-t pt-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <h3 className="font-semibold text-base mb-2">Dettagli del Finanziamento</h3>
                <table className="w-full text-left text-sm" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <tbody>
                        <tr className="border-b border-gray-200" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                            <td className="py-2 pr-4 font-medium text-gray-600 w-1/3">Finanziaria</td>
                            <td className="py-2 font-semibold">{financingCompany}</td>
                        </tr>
                        {numberOfInstallments && installmentAmount && (
                             <tr className="border-b border-gray-200" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                <td className="py-2 pr-4 font-medium text-gray-600">Rate</td>
                                <td className="py-2 font-semibold">{numberOfInstallments} da {formatCurrency(installmentAmount)}</td>
                            </tr>
                        )}
                        {totalFinancedAmount && (
                             <tr className="border-b border-gray-200" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                                <td className="py-2 pr-4 font-medium text-gray-600">Importo Totale Finanziato</td>
                                <td className="py-2 font-semibold">{formatCurrency(totalFinancedAmount)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}
      </section>

      <section className="mb-4" style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 3 - Garanzia</h2>
        {customerType === 'privato' ? (
          <p style={{ whiteSpace: 'pre-wrap', breakInside: 'avoid', pageBreakInside: 'avoid' }}>{warranty || 'Nessuna garanzia specificata.'}</p>
        ) : (
          <p style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>La vettura viene acquistata vista e piaciuta.</p>
        )}
      </section>

      {customerType === 'privato' && (
        <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 4 - Stato d'Uso del Mezzo</h2>
          <p style={{ whiteSpace: 'pre-wrap', breakInside: 'avoid', pageBreakInside: 'avoid' }}>{wearAndTear || 'Nessuna dichiarazione sullo stato d\'uso.'}</p>
        </section>
      )}
      
      {customerType === 'privato' && (
        <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 5 - Consegna e Documentazione</h2>
            <p style={{ whiteSpace: 'pre-wrap', breakInside: 'avoid', pageBreakInside: 'avoid' }}>{documentation || 'Nessuna indicazione sulla documentazione.'}</p>
        </section>
      )}

      <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h2 className="font-bold text-base mb-2 pb-1 border-b">{`Art. ${customerType === 'privato' ? '6' : '4'} - Assicurazione`}</h2>
        <p style={{ whiteSpace: 'pre-wrap', breakInside: 'avoid', pageBreakInside: 'avoid' }}>{insurance || 'Nessuna indicazione sull\'assicurazione.'}</p>
      </section>
      
      {customerType === 'privato' && (
        <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 7 - Diritto di Recesso</h2>
          <p style={{ whiteSpace: 'pre-wrap', breakInside: 'avoid', pageBreakInside: 'avoid' }}>{withdrawal || 'Nessuna indicazione sul diritto di recesso.'}</p>
        </section>
      )}
      
      <section className="mb-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <h2 className="font-bold text-base mb-2 pb-1 border-b">{`Art. ${customerType === 'privato' ? '8' : '5'} - Dichiarazioni Finali`}</h2>
        <p style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>L'ACQUIRENTE dichiara di aver ispezionato il veicolo e di averlo trovato in buono stato d'uso, idoneo all'uso cui è destinato e di proprio gradimento. Il passaggio di proprietà avverrà contestualmente al saldo del prezzo.</p>
      </section>

      <footer className="mt-10" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <p>Letto, approvato e sottoscritto.</p>
        <p>Data: {date}</p>
        <div className="mt-8">
            <p className="font-bold">Caparra Controfirmatoria</p>
            <div className="mt-6 border-b border-gray-400"></div>
        </div>
        <div className="flex justify-between mt-8">
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
