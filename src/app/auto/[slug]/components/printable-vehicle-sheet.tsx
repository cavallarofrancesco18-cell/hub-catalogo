'use client';

import { useEffect, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatNumber, formatVehicleReference } from '@/lib/utils';
import { getDirectImageUrl, getOrderedVehicleImageUrls } from '@/lib/utils';
import { format } from 'date-fns';
import type { BrandingProfile } from '@/lib/branding';

function getFileProxyUrl(fileUrl: string, fileName: string, contentType?: string) {
  const searchParams = new URLSearchParams({
    url: fileUrl,
    fileName,
    disposition: 'inline',
  });

  if (contentType) {
    searchParams.set('contentType', contentType);
  }

  return `/api/files/proxy?${searchParams.toString()}`;
}

interface PrintableVehicleSheetProps {
  vehicle: Vehicle;
  price: number;
  branding: BrandingProfile;
  logoUrl: string;
  companyLegalAddress?: string;
  companyVatNumber?: string;
  companyEmail?: string;
  companyContact?: string;
  compact?: boolean;
}

export function PrintableVehicleSheet({ vehicle, price, branding, logoUrl, companyLegalAddress, companyVatNumber, companyEmail, companyContact, compact = false }: PrintableVehicleSheetProps) {
  const { companyName, printLogoWidth = 200, printLogoMaxHeight = 64 } = branding;
  const orderedImageUrls = getOrderedVehicleImageUrls(vehicle);
  const vehiclePhotoUrls = [...new Set(orderedImageUrls.map(getDirectImageUrl).filter((url): url is string => Boolean(url)))];
  const thumbnailColumns = vehiclePhotoUrls.length > 24 ? 8 : vehiclePhotoUrls.length > 12 ? 6 : 5;
  const imageUrl = getDirectImageUrl(orderedImageUrls[0] || '');
  const coverImageProxyUrl = imageUrl
    ? getFileProxyUrl(imageUrl, `${vehicle.slug || 'veicolo'}-copertina.jpg`, 'image/jpeg')
    : '';
  const registrationDate = vehicle.data_immatricolazione ? format(new Date(vehicle.data_immatricolazione), 'dd/MM/yyyy') : vehicle.anno;
  const [generatedDate, setGeneratedDate] = useState('');
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState(logoUrl);
  const [resolvedCoverImageUrl, setResolvedCoverImageUrl] = useState(coverImageProxyUrl || imageUrl || '');

  useEffect(() => {
    setGeneratedDate(format(new Date(), 'dd/MM/yyyy HH:mm'));
  }, []);

  useEffect(() => {
    setResolvedCoverImageUrl(coverImageProxyUrl || imageUrl || '');
  }, [coverImageProxyUrl, imageUrl]);

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

  const shortDescription = vehicle.descrizione ? vehicle.descrizione.split(/[.!?]/)[0] + '.' : '';
  const vehicleSpecifications = [
    ...(vehicle.targa ? [{ label: 'Targa', value: vehicle.targa }] : []),
    ...(vehicle.vin ? [{ label: 'Telaio (VIN)', value: vehicle.vin }] : []),
    { label: 'Immatricolazione', value: registrationDate ? String(registrationDate) : '—' },
    { label: 'Chilometraggio', value: `${formatNumber(vehicle.chilometraggio)} km` },
    { label: 'Carburante', value: vehicle.carburante || '—' },
    { label: 'Cambio', value: vehicle.cambio || '—' },
    { label: 'Potenza', value: `${vehicle.potenza} CV${vehicle.potenza_kw ? ` (${vehicle.potenza_kw} kW)` : ''}` },
    { label: 'Cilindrata', value: vehicle.cilindrata ? `${formatNumber(vehicle.cilindrata)} cc` : '—' },
    { label: 'Colore esterno', value: vehicle.colore_esterno || '—' },
    { label: 'Colore interni', value: vehicle.colore_interni || '—' },
    { label: 'Classe emissioni', value: vehicle.classe_emissioni || '—' },
    { label: 'Garanzia', value: vehicle.garanzia || '—' },
    { label: 'Bollo', value: vehicle.bollo || '—' },
  ];
  const sheetSpacing = compact ? 'p-3 md:p-4' : 'p-6';
  const titleSpacing = compact ? 'my-4' : 'my-6';
  const contentGap = compact ? 'gap-4' : 'gap-8';
  const cardPadding = compact ? 'p-3' : 'p-6';
  const imageAspectRatioClass = compact ? 'aspect-[4/3]' : 'aspect-[4/3]';
  const imageObjectPositionClass = compact ? 'object-[center_52%]' : 'object-center';
  const imageColumnClass = compact ? 'col-span-7' : 'col-span-7';
  const infoColumnClass = compact ? 'col-span-5' : 'col-span-5';
  const sheetStyle = compact
    ? {
        fontFamily: 'Arial, Helvetica, sans-serif',
        width: '794px',
        minHeight: '1123px',
        boxSizing: 'border-box' as const,
      }
    : {
        fontFamily: 'Arial, Helvetica, sans-serif',
      };


  return (
    <div className={compact ? 'space-y-5' : ''}>
    <div data-pdf-page="true" className={`bg-white text-black ${sheetSpacing} leading-normal`} style={sheetStyle}>
      {/* Header */}
      <header className="flex items-center justify-between gap-4 pb-4 border-b-2 border-gray-200">
        <div className="flex shrink-0 items-center gap-4">
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
            <div
              aria-hidden="true"
              style={{
                display: 'block',
                width: `${printLogoWidth}px`,
                maxWidth: '100%',
                height: `${printLogoMaxHeight}px`,
              }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1 text-right text-[10px] leading-tight">
            <p className="text-xs font-bold">{companyName}</p>
            {companyLegalAddress ? <p>{companyLegalAddress}</p> : null}
            {companyVatNumber ? <p>P. IVA: {companyVatNumber}</p> : null}
            {companyEmail ? <p>Email: {companyEmail}</p> : null}
            {companyContact ? <p>{companyContact}</p> : null}
        </div>
      </header>

      {/* Title */}
      <div className={titleSpacing} style={{ textAlign: 'center' }}>
        <p style={{ fontSize: compact ? '10px' : '12px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#6B7280' }}>
          {formatVehicleReference(vehicle)}
        </p>
        <h1 style={{ fontSize: compact ? '42px' : '48px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{`${vehicle.marca} ${vehicle.modello}`}</h1>
        <h2 style={{ fontSize: compact ? '16px' : '20px', color: '#4B5563', marginTop: '4px' }}>{vehicle.versione}</h2>
      </div>

      {/* Main Content */}
      <div className={`grid grid-cols-12 ${contentGap}`}>
        {/* Image */}
        <div className={imageColumnClass}>
          {resolvedCoverImageUrl ? (
            <div className={`relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 ${imageAspectRatioClass}`}>
              <img
                src={resolvedCoverImageUrl}
                alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
                className={`absolute inset-0 h-full w-full object-cover ${imageObjectPositionClass}`}
                loading="eager"
                decoding="sync"
                onError={() => {
                  if (resolvedCoverImageUrl !== imageUrl && imageUrl) {
                    setResolvedCoverImageUrl(imageUrl);
                  }
                }}
              />
            </div>
          ) : (
            <div className={`w-full ${compact ? 'aspect-[16/10]' : 'aspect-[4/3]'} bg-gray-100 flex items-center justify-center text-gray-500 rounded-lg border`}>
              Foto non disponibile
            </div>
          )}
        </div>

        {/* Price and Key Specs */}
        <div className={infoColumnClass}>
          <div className={`bg-gray-50 border border-gray-200 rounded-lg ${cardPadding}`}>
            <p className={`font-bold text-gray-800 ${compact ? 'mb-3 text-3xl' : 'mb-6 text-5xl'}`}>{formatCurrency(price)}</p>
            <dl className={compact ? 'grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] leading-[1.4]' : 'space-y-3 text-base'}>
              {vehicleSpecifications.map(specification => (
              <div key={specification.label} className={compact ? 'min-w-0 border-b border-gray-200 pb-1.5' : 'flex justify-between gap-3 border-b border-gray-200 pb-2'}>
                <dt className={compact ? 'text-[8px] font-medium uppercase leading-[1.4] text-gray-500' : 'font-medium text-gray-500'}>{specification.label}</dt>
                <dd className={compact ? 'mt-0.5 min-w-0 break-words text-[10px] font-semibold leading-[1.4]' : 'font-semibold text-right'}>{specification.value}</dd>
              </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
      
      {shortDescription && shortDescription.length > 1 && (
        <div className="mt-3">
          <h3 className="mb-1 border-b pb-1 text-sm font-bold">Descrizione</h3>
          <p className="text-xs leading-snug text-gray-700">{shortDescription}</p>
        </div>
      )}

      <section className="mt-3" aria-label="Tutte le foto del veicolo">
        <div className="mb-1 flex items-center justify-between border-b pb-1">
          <h3 className="text-sm font-bold">Foto veicolo</h3>
          <span className="text-[10px] text-gray-500">{vehiclePhotoUrls.length} foto</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${thumbnailColumns}, minmax(0, 1fr))` }}>
          {vehiclePhotoUrls.map((photoUrl, index) => {
            const photoProxyUrl = getFileProxyUrl(photoUrl, `${vehicle.slug || 'veicolo'}-foto-${index + 1}`);
            return (
              <figure key={`${photoUrl}-${index}`} className="min-w-0">
                <div className="relative overflow-hidden rounded border border-gray-200 bg-gray-100" style={{ aspectRatio: '16 / 10' }}>
                  <img
                    src={photoProxyUrl}
                    alt={`Foto ${index + 1} ${vehicle.marca} ${vehicle.modello}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                    decoding="sync"
                    crossOrigin="anonymous"
                  />
                </div>
                <figcaption className="mt-0.5 text-center text-[8px] text-gray-500">{index + 1}</figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className={`${compact ? 'mt-4' : 'mt-8'} border-t pt-4 text-center text-sm text-gray-500`}>
        <p>
            I dati relativi a veicoli e documentazione possono essere soggetti a modifiche e aggiornamenti; le informazioni qui rappresentate non costituiscono impegno contrattuale.
        </p>
        {generatedDate && (
          <p className="mt-2">Scheda generata il: {generatedDate}</p>
        )}
      </footer>
    </div>
    </div>
  );
}
