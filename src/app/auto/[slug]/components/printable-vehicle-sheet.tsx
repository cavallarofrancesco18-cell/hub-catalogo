'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatNumber, formatVehicleReference } from '@/lib/utils';
import { getDirectImageUrl, getOrderedVehicleImageUrls } from '@/lib/utils';
import { format } from 'date-fns';
import type { BrandingProfile } from '@/lib/branding';
import { siteUrl } from '@/lib/site';

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
  compact?: boolean;
}

export function PrintableVehicleSheet({ vehicle, price, branding, logoUrl, compact = false }: PrintableVehicleSheetProps) {
  const { companyName, companyAddress, companyContact, printLogoWidth = 200, printLogoMaxHeight = 64 } = branding;
  const orderedImageUrls = getOrderedVehicleImageUrls(vehicle);
  const imageUrl = getDirectImageUrl(orderedImageUrls[0] || '');
  const coverImageProxyUrl = imageUrl
    ? getFileProxyUrl(imageUrl, `${vehicle.slug || 'veicolo'}-copertina.jpg`, 'image/jpeg')
    : '';
  const registrationDate = vehicle.data_immatricolazione ? format(new Date(vehicle.data_immatricolazione), 'dd/MM/yyyy') : vehicle.anno;
  const [generatedDate, setGeneratedDate] = useState('');
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState(logoUrl);
  const [resolvedCoverImageUrl, setResolvedCoverImageUrl] = useState(coverImageProxyUrl || imageUrl || '');

  const publicAnnouncementUrl = useMemo(() => {
    const baseUrl = siteUrl.replace(/\/$/, '');
    const announcementTarget = vehicle.slug || vehicle.id;
    return announcementTarget
      ? `${baseUrl}/auto/${encodeURIComponent(announcementTarget)}?src=qr&view=mobile`
      : `${baseUrl}/auto`;
  }, [vehicle.slug, vehicle.id]);

  const qrImageUrl = useMemo(() => {
    const params = new URLSearchParams({
      data: publicAnnouncementUrl,
    });

    return `/api/qr-code?${params.toString()}`;
  }, [publicAnnouncementUrl]);

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

  const hasAdditionalDetails = vehicle.cilindrata || vehicle.colore_interni || vehicle.classe_emissioni || vehicle.garanzia || vehicle.bollo;
  const shortDescription = vehicle.descrizione ? vehicle.descrizione.split(/[.!?]/)[0] + '.' : '';
  const sheetSpacing = compact ? 'p-3 md:p-4' : 'p-6';
  const titleSpacing = compact ? 'my-4' : 'my-6';
  const contentGap = compact ? 'gap-4' : 'gap-8';
  const cardPadding = compact ? 'p-3' : 'p-6';
  const qrSizeClass = compact ? 'h-40 w-40' : 'h-52 w-52';
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
    <div className={`bg-white text-black ${sheetSpacing} leading-normal`} style={sheetStyle}>
      {/* Header */}
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-4">
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
        <div className="text-right text-sm">
          <p className="font-bold">{companyName}</p>
          <p>{companyAddress}</p>
          <p>{companyContact}</p>
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
            <div className={compact ? 'space-y-1.5 text-sm' : 'space-y-3 text-base'}>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Immatricolazione</span>
                    <span className="font-semibold">{registrationDate}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Chilometraggio</span>
                    <span className="font-semibold">{formatNumber(vehicle.chilometraggio)} km</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Carburante</span>
                    <span className="font-semibold">{vehicle.carburante}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Cambio</span>
                    <span className="font-semibold">{vehicle.cambio}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Potenza</span>
                    <span className="font-semibold">{vehicle.potenza} CV {vehicle.potenza_kw && `(${vehicle.potenza_kw} kW)`}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Colore Esterno</span>
                    <span className="font-semibold">{vehicle.colore_esterno}</span>
                </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Short Description */}
      {shortDescription && shortDescription.length > 1 && (
        <div className={compact ? 'mt-4' : 'mt-6'}>
            <h3 className={`mb-2 border-b pb-2 ${compact ? 'text-xl' : 'text-2xl'} font-bold`}>Descrizione</h3>
            <p className={`${compact ? 'text-sm' : 'text-base'} leading-relaxed text-gray-700`}>
                {shortDescription}
            </p>
        </div>
      )}

      {/* QR Centered Row */}
      <div className={`mt-4 rounded-lg border border-gray-200 bg-white ${compact ? 'p-3' : 'p-5'} text-center`}>
        <p className={`${compact ? 'text-base' : 'text-lg'} font-bold text-gray-800`}>Scansiona il QR</p>
        <p className={`mt-1 ${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>Apri l'annuncio completo sul sito pubblico.</p>
        <div className={`mt-3 flex items-center justify-center`}>
          <img
            src={qrImageUrl}
            alt={`QR code annuncio ${vehicle.marca} ${vehicle.modello}`}
            className={`rounded-lg border border-gray-200 bg-white p-2 ${qrSizeClass}`}
            loading="eager"
            decoding="sync"
          />
        </div>
        <p className="mt-2 break-words text-xs text-gray-500">{publicAnnouncementUrl}</p>
      </div>

      {/* Additional Details */}
      {!compact && hasAdditionalDetails && (
          <div className="mt-6">
            <h3 className="mb-4 border-b pb-2 text-2xl font-bold">Caratteristiche Principali</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-base">
            
            {vehicle.cilindrata && (
                <div className="flex justify-between py-2 border-b">
                <span className="font-medium text-gray-500">Cilindrata</span>
                <span className="font-semibold">{formatNumber(vehicle.cilindrata)} cc</span>
                </div>
            )}
            {vehicle.colore_interni && (
                <div className="flex justify-between py-2 border-b">
                <span className="font-medium text-gray-500">Colore Interni</span>
                <span className="font-semibold">{vehicle.colore_interni}</span>
                </div>
            )}
            {vehicle.classe_emissioni && (
                <div className="flex justify-between py-2 border-b">
                <span className="font-medium text-gray-500">Classe Emissioni</span>
                <span className="font-semibold">{vehicle.classe_emissioni}</span>
                </div>
            )}
            {vehicle.garanzia && (
                <div className="flex justify-between py-2 border-b">
                <span className="font-medium text-gray-500">Garanzia</span>
                <span className="font-semibold">{vehicle.garanzia}</span>
                </div>
            )}
            {vehicle.bollo && (
                <div className="flex justify-between py-2 border-b">
                <span className="font-medium text-gray-500">Bollo</span>
                <span className="font-semibold">{vehicle.bollo}</span>
                </div>
            )}
            </div>
        </div>
      )}


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
  );
}
