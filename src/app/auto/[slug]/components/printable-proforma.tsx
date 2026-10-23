'use client';

import { useEffect, useState } from 'react';

import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatCurrencyPrecise, formatNumber, formatVehicleReference } from '@/lib/utils';
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

interface SellerData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface TradeInVehicleData {
  brand?: string;
  model?: string;
  plate?: string;
  vin?: string;
  color?: string;
  value?: number;
  km?: number;
  owner?: string;
  notes?: string;
}

interface PrintableProformaProps {
  vehicle: Vehicle;
  customer: CustomerData;
  secondaryBuyer?: CustomerData & { customerType?: 'privato' | 'commerciante' };
  seller?: SellerData;
  tradeInVehicle?: TradeInVehicleData;
  price: number;
  vehiclePublicPrice?: number;
  taxRate?: number;
  costoVultura: number;
  costoVulturaCaricoCliente?: boolean;
  discount?: number;
  customerType: 'privato' | 'commerciante';
  paymentMethod: string;
  warranty: string;
  warrantyPrice?: number;
  insurance: string;
  insurancePrice?: number;
  hasInsurance?: string;
  wearAndTear: string;
  documentation: string;
  withdrawal: string;
  notes?: string;
  date: string;
  deliveryDate?: string;
  branding: BrandingProfile;
  logoUrl: string;
  financingCompany?: string;
  numberOfInstallments?: number;
  installmentAmount?: number;
  totalFinancedAmount?: number;
  caparra?: number;
  caparraDate?: string;
  caparraPaymentMethod?: string;
  caparraBankAccount?: string;
  workItems?: Array<{ description?: string; cost?: number }>;
}

interface PrintableSoldPlacardProps {
  vehicle: Vehicle;
  customer: CustomerData;
  secondaryBuyer?: CustomerData;
  seller: SellerData;
  contractDate: string;
  deliveryDate?: string;
  notes?: string;
  workItems?: Array<{ description?: string; cost?: number }>;
}

interface PrintablePurchaseQuoteProps {
  vehicle: Vehicle;
  customer: CustomerData;
  secondaryBuyer?: CustomerData & { customerType?: 'privato' | 'commerciante' };
  mainImageUrl?: string;
  price: number;
  taxRate?: number;
  costoVultura: number;
  costoVulturaCaricoCliente?: boolean;
  discount?: number;
  customerType: 'privato' | 'commerciante';
  warrantyPrice?: number;
  hasInsurance?: string;
  insurancePrice?: number;
  paymentMethod: string;
  financingCompany?: string;
  numberOfInstallments?: number;
  installmentAmount?: number;
  totalFinancedAmount?: number;
  caparra?: number;
  tradeInValue?: number;
  workItems?: Array<{ description?: string; cost?: number }>;
  date: string;
  branding: BrandingProfile;
  logoUrl: string;
}

function formatDateValue(value?: string): string {
  if (!value) return 'N/D';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('it-IT');
}

function formatOptionalCost(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return 'Omaggio';
  }

  return formatCurrencyPrecise(value);
}

function splitCompanyAddressForHeader(companyAddress: string): string[] {
  const normalizedAddress = (companyAddress || '').replace(/\s+/g, ' ').trim();
  if (!normalizedAddress) return [];

  const operativeMarker = normalizedAddress.toLowerCase().indexOf('sede operativa:');
  if (operativeMarker === -1) {
    return [normalizedAddress];
  }

  const legalAddress = normalizedAddress.slice(0, operativeMarker).trim();
  const operativeAddress = normalizedAddress.slice(operativeMarker).trim();

  return [legalAddress, operativeAddress].filter(Boolean);
}

const purchaseConditionsArticles = [
  {
    title: 'Art. 1 - Definizioni',
    paragraphs: [
      'Nel modulo "Scheda di Conformità - Condizioni di Acquisto" si intendono per: Ricondizionato: sostituito o revisionato. Buone condizioni: recentemente sostituito o revisionato oppure in condizioni di utilizzo migliori rispetto alla norma grazie a particolare cura e/o manutenzione. Normali condizioni di utilizzo: condizioni di usura conformi all\'età e al chilometraggio del veicolo. Intervento raccomandato: da ripristinare in seguito a normale degrado meccanico o perché in condizioni di usura oltre la norma. Riparazione necessaria: da sostituire o riparare, oppure prossimo alla rottura, con possibile pregiudizio per il normale utilizzo del veicolo.',
    ],
  },
  {
    title: "Art. 2 - Accettazione dell'Ordine",
    paragraphs: [
      "L'ordine dell'Acquirente è da intendersi vincolante per il Venditore solo in presenza dell'accettazione scritta. La mancata accettazione dell'ordine comporta esclusivamente la restituzione all'Acquirente del deposito cauzionale di cui al seguente articolo, con esclusione di ogni altra pretesa.",
    ],
  },
  {
    title: 'Art. 3 - Deposito cauzionale',
    paragraphs: [
      "L'ordine dell'Acquirente deve essere assistito dal versamento di una somma, indicata dal Venditore, a titolo di deposito cauzionale. La somma depositata è infruttifera e sarà incamerata dal Venditore nel caso in cui l'ordine venisse revocato dall'Acquirente.",
    ],
  },
  {
    title: 'Art. 4 - Prezzo',
    paragraphs: [
      "Il prezzo pattuito s'intende per merce resa franco sede del Venditore, salvo diversa pattuizione scritta.",
    ],
  },
  {
    title: "Art. 5 - Ritiro dell'autoveicolo",
    paragraphs: [
      "Il veicolo deve essere ritirato entro 10 giorni dalla data di accettazione dell'ordine, se immediatamente disponibile, oppure entro 5 giorni dalla data di comunicazione della sua messa a disposizione. In caso di mancato ritiro entro tali termini, il Venditore ha facoltà di risolvere il contratto per inadempimento dell'Acquirente, incamerando il deposito cauzionale da questi versato. Il Venditore potrà inoltre pretendere il rimborso delle spese sostenute per eventuali ripristini concordati in sede di trattativa e definizione dell'ordine, fatto salvo ogni ulteriore diritto e, in particolare, il risarcimento dell'eventuale maggior danno.",
    ],
  },
  {
    title: 'Art. 6 - Garanzia legale di conformità',
    paragraphs: [
      "In conformità al disposto del comma 2 dell'art. 134 del D.Lgs. 206/2005, l'Acquirente e il Venditore convengono che i diritti dell'Acquirente, riconosciuti ai sensi degli artt. 128 e seguenti del D.Lgs. 206/2005 e successive modifiche e/o integrazioni, impegnano la presente garanzia del Venditore limitatamente ai 12 mesi successivi alla consegna dell'autoveicolo.",
      "Ai sensi della normativa vigente, l'Acquirente dichiara:",
      '• di aver attentamente visionato e provato il veicolo oggetto della presente proposta e di accettarlo nello stato di fatto e nelle condizioni in cui si trova;',
      '• di convenire che i difetti di conformità potranno essere fatti valere esclusivamente in relazione al contenuto del modulo "Scheda di Conformità", che costituisce parte integrante della presente proposta;',
      "• di essere a conoscenza del fatto che non potrà far valere difetti di conformità quando gli stessi risultino evidenti o riscontrabili secondo l'ordinaria diligenza al momento della consegna del veicolo;",
      '• di prendere atto del fatto che eventuali difetti di conformità possono riferirsi esclusivamente a difetti non derivanti dall\'uso normale del veicolo, in considerazione dell\'anzianità di costruzione e del numero di chilometri percorsi, e che le reali condizioni di utilizzo risultano dalla "Scheda di Conformità";',
      '• di convenire che non possono considerarsi difetti di conformità quelli derivanti dalla normale usura, dalla carenza di manutenzione o dal mancato rispetto delle indicazioni fornite dalla casa costruttrice in ordine all\'impiego e alla manutenzione del veicolo.',
      "L'Acquirente conviene, conformemente a quanto prescritto dall'art. 130 del D.Lgs. 206/2005, che, in caso di accertata e provata \"non conformità\" del veicolo, il Venditore provvederà, in via prioritaria, al ripristino dello stesso. La richiesta di soluzioni diverse per rimuovere i difetti di conformità potrà essere avanzata dall'Acquirente, salvo che il rimedio richiesto sia oggettivamente impossibile o eccessivamente oneroso.",
      'Le parti concordano che, nel caso di vendita a un titolare di partita IVA regolarmente fatturata, non sarà applicabile la normativa di cui al primo capoverso, poiché non sussiste la qualità di consumatore; troveranno invece applicazione gli artt. 1490 e seguenti del codice civile in materia di "garanzia dei vizi della cosa venduta". In particolare, in relazione agli artt. 1490 e 1491 del codice civile, si conviene l\'esclusione della garanzia.',
      "L'Acquirente dà atto che, qualora il veicolo oggetto della presente proposta non dovesse essere destinato al consumo personale, ma alla rivendita, rinuncia sin d'ora espressamente a qualsiasi azione di regresso nei confronti del Venditore, in virtù della facoltà concessa dall'art. 131 del D.Lgs. 206/2005.",
    ],
  },
  {
    title: 'Art. 7 - Trattamento dei Dati personali',
    paragraphs: [
      'Vi informiamo che, ai sensi dell\'art. 13 del D.Lgs. 196/2003 recante "Codice in materia di protezione dei dati personali", i dati personali da Voi forniti, ovvero acquisiti nell\'ambito di rapporti contrattuali con Voi intercorrenti o che si instaureranno in futuro, potranno formare oggetto di trattamento nel rispetto della normativa in oggetto. Il trattamento dei dati e finalizzato all\'assolvimento degli obblighi di legge e contrattuali; Vi informiamo altresi che i dati personali da Voi forniti o acquisiti nel corso del rapporto contrattuale potranno essere comunicati ai seguenti soggetti: all\'Amministrazione finanziaria, agli enti previdenziali ed assistenziali se necessario; all\'Autorita di Pubblica Sicurezza; a societa, enti o consorzi aventi finalita di tutela del credito, i quali potranno comunicare i dati nell\'ambito dei propri soci, aderenti, utenti e relativi aventi causa, nei limiti delle rispettive finalita istituzionali; a societa o enti di recupero credito per le azioni relative al recupero stesso; a societa, enti, consorzi o altre organizzazioni, aventi finalita di assicurazione, di intermediazione finanziaria, bancaria e simili, le quali a loro volta potranno comunicare i dati o concedere l\'accesso nell\'ambito dei propri soci, aderenti, utenti e relativi aventi causa; a banche o istituti di credito nell\'ambito della gestione finanziaria dell\'impresa; a Societa esterne incaricate dall\'azienda della custodia e/o gestione dei nostri archivi. Vi informiamo altresi che in relazione ai predetti dati potrete esercitare i diritti di cui al D.Lgs. 196/2003 tra cui i diritti di accesso, di aggiornamento, di opposizione al trattamento e di cancellazione. Vi informiamo inoltre che il Titolare e/o responsabile del trattamento dei dati e il Venditore. Vi facciamo presente che il conferimento di dati suddetti in generale non e obbligatorio ma l\'eventuale rifiuto ad autorizzare la comunicazione dei Suoi dati ai soggetti sopra indicati, potrebbe comportare l\'impossibilita di procedere al puntuale adempimento degli obblighi contrattuali.',
    ],
  },
  {
    title: 'Art. 8 - Tributi ed Oneri',
    paragraphs: [
      "I tributi, gli oneri e le formalità amministrative, presenti o future, inerenti alla vendita e all'uso del veicolo sono a carico esclusivo dell'Acquirente. L'assicurazione obbligatoria della responsabilità civile, cui è subordinata per legge la circolazione del veicolo, deve essere stipulata a cura e spese dell'Acquirente prima del ritiro del veicolo stesso.",
    ],
  },
  {
    title: 'Art. 9 - Foro Competente',
    paragraphs: [
      "Per qualsiasi controversia è competente l'autorità giudiziaria del luogo di residenza dell'Acquirente, salvo che lo stesso risulti titolare di partita IVA. In quest'ultimo caso, come indicato all'art. 6, comma 4, delle presenti condizioni generali, sarà competente in via esclusiva il foro del Venditore.",
    ],
  },
].map(article => article.title === 'Art. 7 - Trattamento dei Dati personali'
  ? {
      ...article,
      title: 'Art. 7 - Trattamento dei dati personali',
      paragraphs: [
        'Vi informiamo che, ai sensi dell\'art. 13 del D.Lgs. 196/2003, recante il "Codice in materia di protezione dei dati personali", i dati personali da Voi forniti o acquisiti nell\'ambito dei rapporti contrattuali potranno essere trattati nel rispetto della normativa vigente. Il trattamento è finalizzato all\'adempimento degli obblighi di legge e contrattuali.',
        'I dati potranno essere comunicati, ove necessario, all\'Amministrazione finanziaria, agli enti previdenziali e assistenziali, all\'Autorità di pubblica sicurezza, a banche e istituti di credito, nonché a società o enti incaricati della gestione, della tutela o del recupero del credito, nei limiti delle rispettive finalità istituzionali.',
        'In relazione ai dati conferiti, potrete esercitare i diritti previsti dal D.Lgs. 196/2003, tra cui i diritti di accesso, aggiornamento, opposizione al trattamento e cancellazione. Il Titolare del trattamento è il Venditore. Il conferimento dei dati è generalmente facoltativo; l\'eventuale rifiuto potrebbe tuttavia impedire il puntuale adempimento degli obblighi contrattuali.',
      ],
    }
  : article);

export function PrintableProforma({ vehicle, customer, secondaryBuyer, seller, tradeInVehicle, price, vehiclePublicPrice, taxRate = 22, costoVultura, costoVulturaCaricoCliente = false, discount, customerType, paymentMethod, warranty, warrantyPrice, insurance, insurancePrice, hasInsurance, wearAndTear, documentation, withdrawal, notes, date, deliveryDate, branding, logoUrl, financingCompany, numberOfInstallments, installmentAmount, totalFinancedAmount, caparra, caparraDate, caparraPaymentMethod, caparraBankAccount, workItems }: PrintableProformaProps) {
  
  const { companyName, companyAddress, companyContact, printLogoWidth = 280, printLogoMaxHeight = 88 } = branding;
  const companyAddressLines = splitCompanyAddressForHeader(companyAddress);
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState(logoUrl);
  const formattedCaparraDate = caparraDate
    ? formatDateValue(caparraDate)
    : null;
  const hasCaparraDetails = Boolean(
    (typeof caparra === 'number' && caparra > 0) ||
      formattedCaparraDate ||
      caparraPaymentMethod ||
      caparraBankAccount
  );
  const sellerFullName = [seller?.firstName, seller?.lastName].filter(Boolean).join(' ').trim() || companyName;
  const hasTradeInVehicle = Boolean(
    tradeInVehicle &&
      [
        tradeInVehicle.brand,
        tradeInVehicle.model,
        tradeInVehicle.plate,
        tradeInVehicle.vin,
        tradeInVehicle.color,
        tradeInVehicle.value,
        tradeInVehicle.owner,
        tradeInVehicle.notes,
      ].some(value => Boolean(value))
  ) || typeof tradeInVehicle?.km === 'number';
  const showWarrantySection = customerType === 'privato' && (Boolean(warranty?.trim()) || (typeof warrantyPrice === 'number' && warrantyPrice > 0));
  const showWarrantyLine = showWarrantySection;
  const showInsuranceLine = hasInsurance === 'si';
  const discountValue = typeof discount === 'number' ? Math.max(discount, 0) : 0;
  const tradeInValue = typeof tradeInVehicle?.value === 'number' ? tradeInVehicle.value : 0;
  const caparraValue = typeof caparra === 'number' ? caparra : 0;
  const ownershipTransferCostValue = costoVulturaCaricoCliente ? costoVultura : 0;
  const warrantyCostValue = customerType === 'privato' ? (typeof warrantyPrice === 'number' ? warrantyPrice : 0) : 0;
  const workItemsValue = (workItems || []).reduce((sum, item) => {
    const parsedCost = typeof item?.cost === 'number'
      ? item.cost
      : Number(item?.cost) || 0;
    return sum + parsedCost;
  }, 0);
  const totalPrice = Math.max(
    price +
    ownershipTransferCostValue +
    warrantyCostValue +
    workItemsValue -
    discountValue,
    0
  );
  // vehiclePublicPrice/price sono senza imposta: l'IVA va calcolata solo sul prezzo veicolo
  const salePrice = vehiclePublicPrice ?? price;
  const salePriceNet = salePrice;
  const subtotalNet = Math.max(totalPrice, 0);
  const subtotalVat = salePriceNet * (taxRate / 100);
  const vehiclePriceGross = salePriceNet + subtotalVat;
  const totalPriceGross = subtotalNet + subtotalVat;
  const netAmountDue = Math.max(totalPriceGross - caparraValue - tradeInValue, 0);
  // Importo finanziato inserito nei Dettagli Finanziamento, va scalato dal prezzo totale
  const financedAmount = paymentMethod === 'finanziamento' ? (Number(totalFinancedAmount) || 0) : 0;
  const amountToSettle = paymentMethod === 'finanziamento'
    ? Math.max(netAmountDue - financedAmount, 0)
    : 0;

  let articleNumber = 4;
  const tradeInArticle = hasTradeInVehicle ? articleNumber++ : null;
  const wearAndTearArticle = customerType === 'privato' ? articleNumber++ : null;
  const documentationArticle = customerType === 'privato' ? articleNumber++ : null;
  const warrantyArticle = customerType === 'privato' ? articleNumber++ : null;
  const insuranceArticle = articleNumber++;
  const withdrawalArticle = customerType === 'privato' ? articleNumber++ : null;
  const notesArticle = notes ? articleNumber++ : null;
  const workItemsArticle = workItems && workItems.length > 0 ? articleNumber++ : null;
  const finalStatementsArticle = articleNumber++;

  useEffect(() => {
    let isCancelled = false;

    const loadLogoAsDataUrl = async () => {
      if (!logoUrl) {
        setResolvedLogoUrl('');
        return;
      }

      try {
        const response = await fetch(logoUrl, { mode: 'cors' });
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onloadend = () => {
          if (!isCancelled && typeof reader.result === 'string') {
            setResolvedLogoUrl(reader.result);
          }
        };

        reader.readAsDataURL(blob);
      } catch {
        if (!isCancelled) {
          setResolvedLogoUrl(logoUrl);
        }
      }
    };

    loadLogoAsDataUrl();

    return () => {
      isCancelled = true;
    };
  }, [logoUrl]);

  const DetailRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <tr className="border-b border-gray-200">
        <td className="py-2 pr-4 font-medium text-gray-600 w-1/3">{label}</td>
        <td className="py-2 font-semibold">{value}</td>
    </tr>
  );

  return (
    <div className="bg-white text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: '1.2' }}>
      <div
        data-pdf-page="true"
        className="bg-white p-4 text-[11px]"
        style={{ minHeight: '1123px' }}
      >
      <header className="flex flex-col items-center justify-center pb-4 mb-6 border-b-2 border-gray-300">
        <div className="flex items-center justify-center">
          {resolvedLogoUrl ? (
             <img
              src={resolvedLogoUrl}
              alt={`${companyName} Logo`}
              style={{
                display: 'block',
                width: 'auto',
                maxWidth: `${printLogoWidth}px`,
                height: 'auto',
                maxHeight: `${printLogoMaxHeight}px`,
                objectFit: 'contain',
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <h1 className="text-xl font-bold">{companyName}</h1>
          )}
        </div>
        <div className="mt-3 text-center text-xs">
          <p className="font-bold">{companyName}</p>
          {companyAddressLines.length > 0 ? (
            companyAddressLines.map((line, index) => <p key={`company-address-${index}`}>{line}</p>)
          ) : (
            <p>{companyAddress}</p>
          )}
          <p>{companyContact}</p>
        </div>
      </header>

      <div style={{ textAlign: 'center', marginBottom: '24px', letterSpacing: '0.5px' }}>
        <h1 style={{ fontSize: '14px', fontWeight: 'bold' }}>CONTRATTO DI COMPRAVENDITA DI AUTOVEICOLO USATO</h1>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>redatto in duplice copia originale</p>
      </div>

      <section className="mb-3">
        <h2 className="font-bold text-[10px] mb-2 pb-1 border-b tracking-wide">TRA</h2>
        <p className="text-[11px] leading-[1.35]"><span className="font-semibold">{companyName}</span>, con sede in {companyAddress}, in qualità di VENDITORE</p>
        <p className="mt-2 text-[11px] leading-[1.35]">
          Referente venditore: <span className="font-semibold">{sellerFullName}</span>
          {seller?.email && <> · email <span className="font-semibold">{seller.email}</span></>}
          {seller?.phone && <> · tel. <span className="font-semibold">{seller.phone}</span></>}
        </p>
        <h2 className="font-bold text-[10px] mt-4 mb-2 pb-1 border-b tracking-wide">E</h2>
        <p className="text-[11px] leading-[1.35]">
          <span className="font-semibold">{customer.name}</span>
          {customerType === 'privato' && customer.birthPlace && customer.birthDate && (
             <>, nato/a a <span className="font-semibold">{customer.birthPlace}</span> il <span className="font-semibold">{formatDateValue(customer.birthDate)}</span></>
          )}
          , {customerType === 'privato' ? 'residente in' : 'con sede legale in'} <span className="font-semibold">{customer.address}</span>,
          {customerType === 'privato' ? ' C.F. ' : ' P.IVA '}<span className="font-semibold">{customer.cf}</span>
          {customerType === 'privato' && customer.docNumber && (
            <>, documento n. <span className="font-semibold">{customer.docNumber}</span></>
          )}
          {customer.phone && <>, tel. <span className="font-semibold">{customer.phone}</span></>}
          {customer.email && <>, email <span className="font-semibold">{customer.email}</span></>}
          , in qualità di ACQUIRENTE
        </p>
        {secondaryBuyer?.name && (
          <p className="mt-3 text-[11px] leading-[1.35]">
            <span className="font-semibold">{secondaryBuyer.name}</span>
            {secondaryBuyer.customerType === 'privato' && secondaryBuyer.birthPlace && secondaryBuyer.birthDate && (
              <>, nato/a a <span className="font-semibold">{secondaryBuyer.birthPlace}</span> il <span className="font-semibold">{formatDateValue(secondaryBuyer.birthDate)}</span></>
            )}
            , {secondaryBuyer.customerType === 'privato' ? 'residente in' : 'con sede legale in'} <span className="font-semibold">{secondaryBuyer.address}</span>,
            {secondaryBuyer.customerType === 'privato' ? ' C.F. ' : ' P.IVA '}<span className="font-semibold">{secondaryBuyer.cf}</span>
            {secondaryBuyer.customerType === 'privato' && secondaryBuyer.docNumber && (
              <>, documento n. <span className="font-semibold">{secondaryBuyer.docNumber}</span></>
            )}
            {secondaryBuyer.phone && <>, tel. <span className="font-semibold">{secondaryBuyer.phone}</span></>}
            {secondaryBuyer.email && <>, email <span className="font-semibold">{secondaryBuyer.email}</span></>}
            , in qualità di CO-ACQUIRENTE
          </p>
        )}
      </section>

      <section className="mb-3">
        <h2 className="font-bold text-base mb-2 pb-1 border-b">Art. 1 - Oggetto del Contratto</h2>
        <p className="mb-3">Il VENDITORE vende e cede all'ACQUIRENTE, che accetta, il seguente autoveicolo usato:</p>
        <table className="w-full text-left">
            <tbody>
                <DetailRow
                  label="Numero riferimento"
                  value={
                    formatVehicleReference(vehicle, { includePrefix: false })
                  }
                />
                <DetailRow label="Marca" value={vehicle.marca} />
                <DetailRow label="Modello" value={vehicle.modello} />
                <DetailRow label="Versione" value={vehicle.versione} />
                <DetailRow label="Targa" value={vehicle.targa || 'Non specificata'} />
                <DetailRow label="Data Immatricolazione" value={vehicle.data_immatricolazione ? formatDateValue(vehicle.data_immatricolazione) : vehicle.anno} />
                <DetailRow label="Chilometraggio" value={`${formatNumber(vehicle.chilometraggio)} km`} />
                <DetailRow label="Carburante" value={vehicle.carburante} />
                <DetailRow label="Cambio" value={vehicle.cambio} />
                <DetailRow label="Potenza" value={`${vehicle.potenza} CV / ${vehicle.potenza_kw} kW`} />
                <DetailRow label="Colore Esterno" value={vehicle.colore_esterno} />
            </tbody>
        </table>
      </section>

      <section className="mb-3">
        <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. 2 - Dettagli Pagamento</h2>
        <p>Modalità di pagamento: <span className="font-bold capitalize">{paymentMethod}</span>.</p>
      </section>

      </div>

      <div
        data-pdf-page="true"
        className="mt-4 bg-white p-4 text-[10px]"
        style={{ minHeight: '1123px' }}
      >
        <div className="mb-3">
        {paymentMethod === 'finanziamento' && financingCompany && (
            <div className="mt-4 border-t pt-4">
                <h3 className="font-semibold text-sm mb-2">Dettagli del Finanziamento</h3>
                <table className="w-full text-left text-sm">
                    <tbody>
                        <tr className="border-b border-gray-200">
                            <td className="py-2 pr-4 font-medium text-gray-600 w-1/3">Finanziaria</td>
                            <td className="py-2 font-semibold">{financingCompany}</td>
                        </tr>
                        {numberOfInstallments && installmentAmount && (
                             <tr className="border-b border-gray-200">
                                <td className="py-2 pr-4 font-medium text-gray-600">Rate</td>
                                <td className="py-2 font-semibold">{numberOfInstallments} da {formatCurrency(installmentAmount)}</td>
                            </tr>
                        )}
                        {typeof totalFinancedAmount === 'number' && (
                             <tr className="border-b border-gray-200">
                                <td className="py-2 pr-4 font-medium text-gray-600">Importo Totale Finanziato</td>
                                <td className="py-2 font-semibold">{formatCurrency(totalFinancedAmount)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {hasCaparraDetails && (
          <div className="mt-4 border-t pt-4">
            <h3 className="font-semibold text-sm mb-2">Dettagli Deposito Cauzionale</h3>
            <table className="w-full text-left text-sm">
              <tbody>
                {caparra && caparra > 0 && (
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-600">Deposito Cauzionale</td>
                    <td className="py-2 font-semibold">{formatCurrency(caparra)}</td>
                  </tr>
                )}
                {formattedCaparraDate && (
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-600">Data Deposito Cauzionale</td>
                    <td className="py-2 font-semibold">{formattedCaparraDate}</td>
                  </tr>
                )}
                {caparraPaymentMethod && (
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-600">Modalità Deposito Cauzionale</td>
                    <td className="py-2 font-semibold capitalize">{caparraPaymentMethod}</td>
                  </tr>
                )}
                {caparraBankAccount && (
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-600">Intestazione</td>
                    <td className="py-2 font-semibold">Hub srl</td>
                  </tr>
                )}
                {caparraBankAccount && (
                  <tr className="border-b border-gray-200">
                    <td className="py-2 pr-4 font-medium text-gray-600">IBAN</td>
                    <td className="py-2 font-semibold text-xs">{caparraBankAccount}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>

      {hasTradeInVehicle && tradeInArticle && (
        <section className="mb-3">
          <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {tradeInArticle} - Veicolo in Permuta</h2>
          <table className="w-full text-left text-sm">
            <tbody>
              <DetailRow label="Marca" value={tradeInVehicle?.brand || 'N/D'} />
              <DetailRow label="Modello" value={tradeInVehicle?.model || 'N/D'} />
              <DetailRow label="Targa" value={tradeInVehicle?.plate || 'N/D'} />
              <DetailRow label="Telaio" value={tradeInVehicle?.vin || 'N/D'} />
              <DetailRow label="Colore" value={tradeInVehicle?.color || 'N/D'} />
              <DetailRow label="Valore Permuta" value={tradeInValue > 0 ? formatCurrency(tradeInValue) : 'N/D'} />
              <DetailRow label="Km" value={typeof tradeInVehicle?.km === 'number' ? `${formatNumber(tradeInVehicle.km)} km` : 'N/D'} />
              <DetailRow label="Proprietario" value={tradeInVehicle?.owner || 'N/D'} />
              <DetailRow label="Segnalazioni" value={tradeInVehicle?.notes || 'Nessuna segnalazione'} />
            </tbody>
          </table>
        </section>
      )}

      {customerType === 'privato' && wearAndTearArticle && (
        <section className="mb-3">
          <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {wearAndTearArticle} - Stato d'Uso del Mezzo</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{wearAndTear || 'Nessuna dichiarazione sullo stato d\'uso.'}</p>
        </section>
      )}
      
      {customerType === 'privato' && documentationArticle && (
        <section className="mb-3">
            <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {documentationArticle} - Consegna e Documentazione</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{documentation || 'Nessuna indicazione sulla documentazione.'}</p>
        </section>
      )}

      {showWarrantySection && warrantyArticle && (
        <section className="mb-3">
          <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {warrantyArticle} - Garanzia</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{warranty || 'Nessuna indicazione sulla garanzia.'}</p>
          <p className="mt-3 text-sm"><span className="font-semibold">Costo garanzia:</span> {formatOptionalCost(warrantyPrice)}</p>
        </section>
      )}

      <section className="mb-3">
        <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {insuranceArticle} - Assicurazione</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{insurance || 'Nessuna indicazione sull\'assicurazione.'}</p>
        {showInsuranceLine && (
          <p className="mt-3 text-sm"><span className="font-semibold">Costo polizza:</span> {formatOptionalCost(insurancePrice)}</p>
        )}
      </section>

      </div>

      <div
        data-pdf-page="true"
        className="mt-4 bg-white p-4 text-[10px]"
        style={{ minHeight: '1123px' }}
      >
      
      {customerType === 'privato' && withdrawalArticle && (
        <section className="mb-3">
          <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {withdrawalArticle} - Diritto di Recesso</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{withdrawal || 'Nessuna indicazione sul diritto di recesso.'}</p>
        </section>
      )}

      {notes && notesArticle && (
        <section className="mb-3">
          <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {notesArticle} - Note e Osservazioni</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{notes}</p>
        </section>
      )}

      {workItemsArticle && workItems && workItems.length > 0 && (
        <section className="mb-3">
          <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {workItemsArticle} - Lavori da Effettuare</h2>
          <table className="w-full text-left text-sm">
            <tbody>
              {workItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-2 pr-4 font-medium text-gray-600">{item.description || `Lavoro ${idx + 1}`}</td>
                  <td className="py-2 font-semibold text-right">{item.cost ? formatCurrency(item.cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-4">
        <h2 className="font-bold text-sm mb-2 pb-1 border-b">Riepilogo Costi</h2>
        <table className="w-2/3 text-left my-3 text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4">Prezzo vendita netto IVA</td>
              <td className="py-2 text-sm font-semibold text-right">{formatCurrencyPrecise(salePriceNet)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">IVA ({taxRate}%)</td>
              <td className="py-2 text-sm font-semibold text-right">{formatCurrencyPrecise(subtotalVat)}</td>
            </tr>
            <tr className="border-b border-gray-400 bg-gray-50">
              <td className="py-2 pr-4 font-bold">TOTALE</td>
              <td className="py-2 text-sm font-bold text-right">{formatCurrencyPrecise(vehiclePriceGross)}</td>
            </tr>
            {costoVulturaCaricoCliente && costoVultura > 0 && (
              <tr className="border-b">
                <td className="py-2 pr-4">Costo Voltura</td>
                <td className="py-2 text-sm font-semibold text-right">{formatCurrencyPrecise(costoVultura)}</td>
              </tr>
            )}
            {showWarrantyLine && (
              <tr className="border-b">
                <td className="py-2 pr-4">Costo Garanzia Estesa</td>
                <td className="py-2 text-sm font-semibold text-right">{formatOptionalCost(warrantyPrice)}</td>
              </tr>
            )}
            {showInsuranceLine && (
              <tr className="border-b">
                <td className="py-2 pr-4">Costo Polizza Assicurativa</td>
                <td className="py-2 text-sm font-semibold text-right">{formatOptionalCost(insurancePrice)}</td>
              </tr>
            )}
            {workItemsValue > 0 && (
              <tr className="border-b">
                <td className="py-2 pr-4">Costo Lavori Aggiuntivi</td>
                <td className="py-2 text-sm font-semibold text-right">{formatCurrencyPrecise(workItemsValue)}</td>
              </tr>
            )}
            {discountValue > 0 && (
              <tr className="border-b">
                <td className="py-2 pr-4">Sconto</td>
                <td className="py-2 text-sm font-semibold text-right">- {formatCurrencyPrecise(discountValue)}</td>
              </tr>
            )}
            <tr className="border-b border-gray-400 bg-gray-50">
              <td className="py-2 pr-4 font-bold">Totale</td>
              <td className="py-2 text-sm font-bold text-right">{formatCurrencyPrecise(totalPriceGross)}</td>
            </tr>
            {tradeInValue > 0 && (
              <tr className="border-b">
                <td className="py-2 pr-4">Valore Permuta</td>
                <td className="py-2 text-sm font-semibold text-right">- {formatCurrencyPrecise(tradeInValue)}</td>
              </tr>
            )}
            {caparraValue > 0 && (
              <tr className="border-b">
                <td className="py-2 pr-4">Deposito Cauzionale</td>
                <td className="py-2 text-sm font-semibold text-right">- {formatCurrencyPrecise(caparraValue)}</td>
              </tr>
            )}
            <tr>
              <td className="pt-3 pr-4 text-sm font-bold">PREZZO TOTALE</td>
              <td className="pt-3 text-sm font-bold text-right">{formatCurrencyPrecise(netAmountDue)}</td>
            </tr>
            {paymentMethod === 'finanziamento' && (
              <>
                <tr className="border-t border-gray-300">
                  <td className="pt-2 pr-4">Importo finanziato</td>
                  <td className="pt-2 text-sm font-semibold text-right">{formatCurrencyPrecise(financedAmount)}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4">Importo da saldare</td>
                  <td className="py-1 text-sm font-semibold text-right">{formatCurrencyPrecise(amountToSettle)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-3">
        <h2 className="font-bold text-sm mb-2 pb-1 border-b">Art. {finalStatementsArticle} - Dichiarazioni Finali</h2>
        <p>L'ACQUIRENTE dichiara di aver ispezionato il veicolo e di averlo trovato in buono stato d'uso, idoneo all'uso cui è destinato e di proprio gradimento. Il passaggio di proprietà avverrà contestualmente al saldo del prezzo.</p>
      </section>

      </div>

      <div
        data-pdf-page="true"
        className="mt-4 bg-white p-4 text-[10px]"
        style={{ minHeight: '1123px' }}
      >
        <section className="mb-3">
          <h2 className="font-bold text-sm mb-4 pb-1 border-b">Condizioni Generali di Acquisto</h2>
          <div className="space-y-4 text-[10px] leading-[1.35]">
            {purchaseConditionsArticles.map(article => (
              <article key={article.title}>
                <h3 className="mb-1 font-bold">{article.title}</h3>
                <div className="space-y-2">
                  {article.paragraphs.map((paragraph, index) => (
                    <p key={`${article.title}-${index}`} style={{ whiteSpace: 'pre-wrap' }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div
        data-pdf-page="true"
        className="mt-4 bg-white p-4 text-[10px]"
        style={{ minHeight: '1123px' }}
      >
      <footer className="mt-6 pt-5 border-t">
        <div className="mb-6">
          <p><span className="font-semibold">Data del Contratto:</span> {formatDateValue(date)}</p>
          {deliveryDate && (
            <p className="mt-2"><span className="font-semibold">Data Consegna Presunta:</span> {formatDateValue(deliveryDate)}</p>
          )}
        </div>

        <p className="mt-8 mb-6">Letto, approvato e sottoscritto.</p>

        {caparra && caparra > 0 && (
          <div className="mt-8 mb-8">
              <p className="font-bold">Deposito Cauzionale: {formatCurrency(caparra)}</p>
              {formattedCaparraDate && <p className="text-sm mt-1">Data deposito cauzionale: {formattedCaparraDate}</p>}
              {caparraPaymentMethod && <p className="text-sm mt-1">Modalità deposito cauzionale: {caparraPaymentMethod}</p>}
              <p className="text-sm mt-1">Intestazione: Hub srl</p>
              {caparraBankAccount && <p className="text-xs mt-1">IBAN: {caparraBankAccount}</p>}
              <div className="mt-6 border-b border-gray-400"></div>
          </div>
        )}

        <div className={`mt-8 grid gap-8 ${secondaryBuyer?.name ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
                <p className="font-bold">Firma del Venditore</p>
                <p className="mt-1 text-xs text-gray-600">{sellerFullName}</p>
                <div className="mt-8 border-b border-gray-400"></div>
            </div>
            <div>
                <p className="font-bold">Firma dell'Acquirente</p>
                <div className="mt-8 border-b border-gray-400"></div>
            </div>
            {secondaryBuyer?.name && (
              <div>
                <p className="font-bold">Firma del Co-Intestatario</p>
                <div className="mt-8 border-b border-gray-400"></div>
              </div>
            )}
        </div>
      </footer>
      </div>
    </div>
  );
}

export function PrintablePurchaseQuote({ vehicle, customer, secondaryBuyer, mainImageUrl, price, taxRate = 22, costoVultura, costoVulturaCaricoCliente = true, discount, customerType, warrantyPrice, hasInsurance, insurancePrice, paymentMethod, financingCompany, numberOfInstallments, installmentAmount, totalFinancedAmount, caparra, tradeInValue, workItems, date, branding, logoUrl }: PrintablePurchaseQuoteProps) {
  const { companyName, companyAddress, companyContact, printLogoWidth = 220, printLogoMaxHeight = 70 } = branding;
  const companyAddressLines = splitCompanyAddressForHeader(companyAddress);
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState(logoUrl);
  const [resolvedMainImageUrl, setResolvedMainImageUrl] = useState(mainImageUrl || '');
  const ownershipTransferCostValue = costoVulturaCaricoCliente ? costoVultura : 0;
  const warrantyCostValue = customerType === 'privato' ? (typeof warrantyPrice === 'number' ? warrantyPrice : 0) : 0;
  const insuranceCostValue = hasInsurance === 'si' ? (typeof insurancePrice === 'number' ? insurancePrice : 0) : 0;
  const discountValue = typeof discount === 'number' ? Math.max(discount, 0) : 0;
  const caparraValue = typeof caparra === 'number' ? Math.max(caparra, 0) : 0;
  const tradeInCostValue = typeof tradeInValue === 'number' ? Math.max(tradeInValue, 0) : 0;
  const workItemsValue = (workItems || []).reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  const salePriceNet = price;
  const vehicleVat = salePriceNet * (taxRate / 100);
  const vehiclePriceGross = salePriceNet + vehicleVat;
  const totalBeforeDeductions = Math.max(
    salePriceNet + vehicleVat + ownershipTransferCostValue + warrantyCostValue + insuranceCostValue + workItemsValue - discountValue,
    0
  );
  const totalDue = Math.max(totalBeforeDeductions - caparraValue - tradeInCostValue, 0);
  const financedAmount = paymentMethod === 'finanziamento' ? Number(totalFinancedAmount) || 0 : 0;
  const amountToSettle = paymentMethod === 'finanziamento' ? Math.max(totalDue - financedAmount, 0) : 0;
  const visibleWorkItems = (workItems || []).filter(item => item.description || (Number(item.cost) || 0) > 0);

  useEffect(() => {
    let isCancelled = false;

    const loadImageAsDataUrl = async (url: string, setValue: (value: string) => void) => {
      if (!url) {
        setValue('');
        return;
      }

      try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onloadend = () => {
          if (!isCancelled && typeof reader.result === 'string') {
            setValue(reader.result);
          }
        };

        reader.readAsDataURL(blob);
      } catch {
        if (!isCancelled) {
          setValue(url);
        }
      }
    };

    void loadImageAsDataUrl(logoUrl, setResolvedLogoUrl);
    void loadImageAsDataUrl(mainImageUrl || '', setResolvedMainImageUrl);

    return () => {
      isCancelled = true;
    };
  }, [logoUrl, mainImageUrl]);

  const QuoteRow = ({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) => (
    <tr className="border-b border-slate-200">
      <td className="py-2 pr-4 text-slate-600">{label}</td>
      <td className={`py-2 text-right ${strong ? 'font-bold text-slate-950' : 'font-semibold text-slate-900'}`}>{value}</td>
    </tr>
  );

  return (
    <div
      className="bg-white p-8 text-black"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', minHeight: '1123px', width: '800px' }}
    >
      <header className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-5">
        <div>
          {resolvedLogoUrl ? (
            <img
              src={resolvedLogoUrl}
              alt={`${companyName} Logo`}
              style={{ display: 'block', width: 'auto', maxWidth: `${printLogoWidth}px`, height: 'auto', maxHeight: `${printLogoMaxHeight}px`, objectFit: 'contain' }}
              crossOrigin="anonymous"
            />
          ) : (
            <p className="text-xl font-bold">{companyName}</p>
          )}
          <div className="mt-3 text-[11px] leading-relaxed text-slate-700">
            <p className="font-bold text-slate-900">{companyName}</p>
            {companyAddressLines.length > 0 ? companyAddressLines.map((line, index) => <p key={`quote-company-address-${index}`}>{line}</p>) : <p>{companyAddress}</p>}
            <p>{companyContact}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-black uppercase tracking-wide text-slate-950">Preventivo d'acquisto</h1>
          <p className="mt-2 text-sm text-slate-600">Data: {formatDateValue(date)}</p>
          <p className="text-sm text-slate-600">Rif. {formatVehicleReference(vehicle)}</p>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-5">
        <div className="rounded-md border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900">Acquirente</h2>
          <div className="space-y-1.5 text-sm text-slate-800">
            <p><span className="font-semibold">Nome/Ragione sociale:</span> {customer.name || 'N/D'}</p>
            <p><span className="font-semibold">Indirizzo:</span> {customer.address || 'N/D'}</p>
            <p><span className="font-semibold">CF/P.IVA:</span> {customer.cf || 'N/D'}</p>
            {customer.docNumber && <p><span className="font-semibold">Documento:</span> {customer.docNumber}</p>}
            {(customer.birthPlace || customer.birthDate) && <p><span className="font-semibold">Nascita:</span> {[customer.birthPlace, customer.birthDate ? formatDateValue(customer.birthDate) : ''].filter(Boolean).join(' - ')}</p>}
            {customer.phone && <p><span className="font-semibold">Telefono:</span> {customer.phone}</p>}
            {customer.email && <p><span className="font-semibold">Email:</span> {customer.email}</p>}
          </div>
          {secondaryBuyer?.name && (
            <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-800">
              <p className="font-bold text-slate-900">Secondo intestatario</p>
              <p>{secondaryBuyer.name}</p>
              <p>{secondaryBuyer.cf || 'CF/P.IVA non indicato'}</p>
              <p>{secondaryBuyer.address || 'Indirizzo non indicato'}</p>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {resolvedMainImageUrl ? (
            <img
              src={resolvedMainImageUrl}
              alt={`${vehicle.marca} ${vehicle.modello}`}
              className="h-full min-h-[235px] w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="flex h-full min-h-[235px] items-center justify-center text-sm font-semibold text-slate-500">Foto principale non disponibile</div>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-md border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900">Vettura</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-800">
          <p><span className="font-semibold">Marca:</span> {vehicle.marca || 'N/D'}</p>
          <p><span className="font-semibold">Modello:</span> {vehicle.modello || 'N/D'}</p>
          <p><span className="font-semibold">Versione:</span> {vehicle.versione || 'N/D'}</p>
          <p><span className="font-semibold">Targa:</span> {vehicle.targa || 'N/D'}</p>
          <p><span className="font-semibold">Immatricolazione:</span> {vehicle.data_immatricolazione ? formatDateValue(vehicle.data_immatricolazione) : vehicle.anno || 'N/D'}</p>
          <p><span className="font-semibold">Km:</span> {formatNumber(vehicle.chilometraggio)} km</p>
          <p><span className="font-semibold">Carburante:</span> {vehicle.carburante || 'N/D'}</p>
          <p><span className="font-semibold">Cambio:</span> {vehicle.cambio || 'N/D'}</p>
          <p><span className="font-semibold">Potenza:</span> {vehicle.potenza_kw ? `${vehicle.potenza_kw} kW` : vehicle.potenza ? `${vehicle.potenza} CV` : 'N/D'}</p>
          <p><span className="font-semibold">Colore:</span> {vehicle.colore_esterno || 'N/D'}</p>
        </div>
      </section>

      <section className="rounded-md border border-slate-300 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900">Costi</h2>
        <table className="w-full text-sm">
          <tbody>
            <QuoteRow label="Prezzo vendita netto IVA" value={formatCurrencyPrecise(salePriceNet)} />
            <QuoteRow label={`IVA (${taxRate}%)`} value={formatCurrencyPrecise(vehicleVat)} />
            <QuoteRow label="Totale vettura" value={formatCurrencyPrecise(vehiclePriceGross)} strong />
            {ownershipTransferCostValue > 0 && <QuoteRow label="Costo voltura" value={formatCurrencyPrecise(ownershipTransferCostValue)} />}
            {warrantyCostValue > 0 && <QuoteRow label="Costo garanzia" value={formatCurrencyPrecise(warrantyCostValue)} />}
            {insuranceCostValue > 0 && <QuoteRow label="Costo polizza" value={formatCurrencyPrecise(insuranceCostValue)} />}
            {visibleWorkItems.map((item, index) => (
              <QuoteRow key={`${item.description || 'lavoro'}-${index}`} label={item.description || `Lavoro aggiuntivo ${index + 1}`} value={formatCurrencyPrecise(Number(item.cost) || 0)} />
            ))}
            {discountValue > 0 && <QuoteRow label="Sconto" value={`- ${formatCurrencyPrecise(discountValue)}`} />}
            <QuoteRow label="Totale preventivo" value={formatCurrencyPrecise(totalBeforeDeductions)} strong />
            {tradeInCostValue > 0 && <QuoteRow label="Detrazione permuta" value={`- ${formatCurrencyPrecise(tradeInCostValue)}`} />}
            {caparraValue > 0 && <QuoteRow label="Deposito cauzionale" value={`- ${formatCurrencyPrecise(caparraValue)}`} />}
            <tr>
              <td className="pt-4 text-base font-black uppercase text-slate-950">Prezzo totale</td>
              <td className="pt-4 text-right text-base font-black text-slate-950">{formatCurrencyPrecise(totalDue)}</td>
            </tr>
            {paymentMethod === 'finanziamento' && (
              <>
                <QuoteRow label={`Finanziamento${financingCompany ? ` (${financingCompany})` : ''}`} value={formatCurrencyPrecise(financedAmount)} />
                {numberOfInstallments && installmentAmount && <QuoteRow label="Rate" value={`${numberOfInstallments} da ${formatCurrencyPrecise(installmentAmount)}`} />}
                <QuoteRow label="Importo da saldare" value={formatCurrencyPrecise(amountToSettle)} />
              </>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function PrintableSoldPlacard({ vehicle, customer, secondaryBuyer, seller, contractDate, deliveryDate, notes, workItems }: PrintableSoldPlacardProps) {
  const sellerFullName = [seller.firstName, seller.lastName].filter(Boolean).join(' ').trim() || 'N/D';
  const customerDisplayName = customer.name || secondaryBuyer?.name || 'N/D';
  const visibleWorkItems = (workItems || []).filter(item => item.description || typeof item.cost === 'number');

  return (
    <div
      className="relative overflow-hidden bg-white px-10 py-12 text-black"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        minHeight: '1123px',
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-red-100" />
        <div className="absolute -right-24 bottom-20 h-96 w-96 rounded-full bg-slate-100" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(220,38,38,0.04)_0%,rgba(15,23,42,0.04)_100%)]" />
      </div>
      <div className="relative flex h-full flex-col justify-between border-[10px] border-red-700 bg-white/95 p-8 shadow-[0_0_0_3px_rgba(15,23,42,0.2)]">
        <div>
          <div className="mb-5 flex justify-center">
            <img
              src="/autotradelogo.png"
              alt="AutoTrade"
              className="h-14 w-auto object-contain"
            />
          </div>
          <div className="mx-auto w-full max-w-[640px] rounded-md border-4 border-red-700 bg-red-600 px-4 py-4 text-center shadow-lg">
            <p className="text-7xl font-black leading-none tracking-[0.12em] text-white">VENDUTA</p>
          </div>
          <p className="mt-5 text-center text-lg font-semibold uppercase tracking-[0.12em] text-slate-700">Cartello consegna veicolo</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 text-xl">
          <div className="rounded-lg border-2 border-slate-300 bg-white px-5 py-4">
            <span className="font-semibold">Data contratto:</span> {formatDateValue(contractDate)}
          </div>
          <div className="rounded-lg border-2 border-slate-300 bg-white px-5 py-4">
            <span className="font-semibold">Cliente:</span> {customerDisplayName}
          </div>
          <div className="rounded-lg border-2 border-slate-300 bg-white px-5 py-4">
            <span className="font-semibold">Venditore:</span> {sellerFullName}
          </div>
          <div className="rounded-lg border-2 border-slate-300 bg-white px-5 py-4">
            <span className="font-semibold">Modello auto:</span> {vehicle.marca} {vehicle.modello}
          </div>
          <div className="rounded-lg border-2 border-slate-300 bg-white px-5 py-4">
            <span className="font-semibold">Targa:</span> {vehicle.targa || 'N/D'}
          </div>
          <div className="rounded-lg border-2 border-slate-300 bg-white px-5 py-4">
            <span className="font-semibold">Consegna presunta:</span> {deliveryDate ? formatDateValue(deliveryDate) : 'Da definire'}
          </div>
        </div>

        <div className="mt-10 rounded-lg border-2 border-slate-300 bg-white p-6">
          <p className="mb-4 text-2xl font-bold uppercase tracking-wide">Note / lavorazioni da eseguire</p>
          {visibleWorkItems.length > 0 ? (
            <ul className="space-y-3 text-lg">
              {visibleWorkItems.map((item, index) => (
                <li key={`${item.description || 'item'}-${index}`}>
                  <span className="font-semibold">{index + 1}.</span> {item.description || 'Lavorazione da definire'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-lg text-slate-600">Nessuna lavorazione indicata.</p>
          )}
          {notes && (
            <div className="mt-6 border-t border-slate-300 pt-4 text-lg" style={{ whiteSpace: 'pre-wrap' }}>
              {notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
