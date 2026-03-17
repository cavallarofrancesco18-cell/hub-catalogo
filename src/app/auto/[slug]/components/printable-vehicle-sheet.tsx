'use client';

import { useState, useEffect } from 'react';
import type { Vehicle } from '@/lib/types';
import Image from 'next/image';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getDirectImageUrl } from '@/lib/utils';
import { format } from 'date-fns';
import type { BrandingProfile } from '@/lib/branding';

interface PrintableVehicleSheetProps {
  vehicle: Vehicle;
  price: number;
  branding: BrandingProfile;
  logoUrl: string;
}

export function PrintableVehicleSheet({ vehicle, price, branding, logoUrl }: PrintableVehicleSheetProps) {
  const { companyName, companyAddress, companyContact } = branding;
  const imageUrl = vehicle.immagini && vehicle.immagini.length > 0 ? getDirectImageUrl(vehicle.immagini[0]) : '';
  const otherImages = (vehicle.immagini || []).slice(1, 5).map(getDirectImageUrl).filter(Boolean);
  const registrationDate = vehicle.data_immatricolazione ? format(new Date(vehicle.data_immatricolazione), 'dd/MM/yyyy') : vehicle.anno;
  const [generatedDate, setGeneratedDate] = useState('');

  useEffect(() => {
    setGeneratedDate(format(new Date(), 'dd/MM/yyyy HH:mm'));
  }, []);

  const hasAdditionalDetails = vehicle.cilindrata || vehicle.colore_interni || vehicle.classe_emissioni || vehicle.garanzia || vehicle.bollo;
  const shortDescription = vehicle.descrizione ? vehicle.descrizione.split(/[.!?]/)[0] + '.' : '';


  return (
    <div className="bg-white text-black p-6 leading-normal" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Header */}
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-4">
          {logoUrl ? (
             <img
              src={logoUrl}
              alt={`${companyName} Logo`}
              style={{ width: '200px', height: 'auto', maxHeight: '64px' }}
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
      <div style={{ margin: '24px 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{`${vehicle.marca} ${vehicle.modello}`}</h1>
        <h2 style={{ fontSize: '20px', color: '#4B5563', marginTop: '4px' }}>{vehicle.versione}</h2>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-8">
        {/* Image */}
        <div className="col-span-7">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
              width={800}
              height={600}
              className="w-full object-cover rounded-lg border border-gray-200"
            />
          ) : (
            <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center text-gray-500 rounded-lg border">
              Foto non disponibile
            </div>
          )}
        </div>

        {/* Price and Key Specs */}
        <div className="col-span-5">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <p className="text-5xl font-bold text-gray-800 mb-6">{formatCurrency(price)}</p>
            <div className="space-y-3 text-base">
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
        <div className="mt-6">
            <h3 className="text-2xl font-bold border-b pb-2 mb-4">Descrizione</h3>
            <p className="text-gray-700 text-base leading-relaxed">
                {shortDescription}
            </p>
        </div>
      )}

      {/* Additional Details */}
      {hasAdditionalDetails && (
          <div className="mt-6">
            <h3 className="text-2xl font-bold border-b pb-2 mb-4">Caratteristiche Principali</h3>
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


      {/* Photo Gallery */}
      {otherImages.length > 0 && (
        <div className="mt-6">
          <h3 className="text-2xl font-bold border-b pb-2 mb-4">Galleria Fotografica</h3>
          <div className="grid grid-cols-4 gap-4">
            {otherImages.map((url, index) => (
              <div key={`${url}-${index}`} className="overflow-hidden rounded-lg border border-gray-200">
                <Image
                  src={url}
                  alt={`Anteprima galleria ${index + 2}`}
                  width={200}
                  height={112}
                  className="w-full h-auto object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-gray-500 border-t pt-4">
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
