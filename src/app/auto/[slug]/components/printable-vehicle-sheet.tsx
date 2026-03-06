'use client';

import { useState, useEffect } from 'react';
import type { Vehicle } from '@/lib/types';
import Image from 'next/image';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getDirectImageUrl } from '@/lib/utils';
import { format } from 'date-fns';
import {
  LOGO_URL,
  COMPANY_NAME,
  COMPANY_ADDRESS,
  COMPANY_CONTACT,
} from '@/lib/branding';

interface PrintableVehicleSheetProps {
  vehicle: Vehicle;
}

export function PrintableVehicleSheet({ vehicle }: PrintableVehicleSheetProps) {
  const imageUrl = vehicle.immagini && vehicle.immagini.length > 0 ? getDirectImageUrl(vehicle.immagini[0]) : '';
  const otherImages = (vehicle.immagini || []).slice(1, 5).map(getDirectImageUrl).filter(Boolean);
  const registrationDate = vehicle.data_immatricolazione ? format(new Date(vehicle.data_immatricolazione), 'dd/MM/yyyy') : vehicle.anno;
  const [generatedDate, setGeneratedDate] = useState('');

  useEffect(() => {
    setGeneratedDate(format(new Date(), 'dd/MM/yyyy HH:mm'));
  }, []);

  return (
    <div className="bg-white text-black p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-4">
          {LOGO_URL ? (
             <Image
              src={LOGO_URL}
              alt={`${COMPANY_NAME} Logo`}
              width={200}
              height={50}
              className="h-10 w-auto"
            />
          ) : (
            <h1 className="text-xl font-bold">{COMPANY_NAME}</h1>
          )}
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">{COMPANY_NAME}</p>
          <p>{COMPANY_ADDRESS}</p>
          <p>{COMPANY_CONTACT}</p>
        </div>
      </header>

      {/* Title */}
      <div className="my-8 text-center">
        <h1 className="text-4xl font-bold">{`${vehicle.marca} ${vehicle.modello}`}</h1>
        <h2 className="text-2xl text-gray-600">{vehicle.versione}</h2>
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
            <p className="text-5xl font-bold text-gray-800 mb-6">{formatCurrency(vehicle.prezzo)}</p>
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

      {/* Description and Full Specs */}
      <div className="mt-8">
        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-7">
                 <h3 className="text-2xl font-bold border-b pb-2 mb-4">Descrizione del Veicolo</h3>
                 <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{vehicle.descrizione || 'Nessuna descrizione fornita.'}</p>
            </div>
            <div className="col-span-5">
                 <h3 className="text-2xl font-bold border-b pb-2 mb-4">Dettagli Aggiuntivi</h3>
                  <div className="space-y-3 text-base">
                    {vehicle.cilindrata && (
                        <div className="flex justify-between">
                        <span className="font-medium text-gray-500">Cilindrata</span>
                        <span className="font-semibold">{formatNumber(vehicle.cilindrata)} cc</span>
                        </div>
                    )}
                    {vehicle.colore_interni && (
                        <div className="flex justify-between">
                        <span className="font-medium text-gray-500">Colore Interni</span>
                        <span className="font-semibold">{vehicle.colore_interni}</span>
                        </div>
                    )}
                    {vehicle.classe_emissioni && (
                        <div className="flex justify-between">
                        <span className="font-medium text-gray-500">Classe Emissioni</span>
                        <span className="font-semibold">{vehicle.classe_emissioni}</span>
                        </div>
                    )}
                    {vehicle.garanzia && (
                        <div className="flex justify-between">
                        <span className="font-medium text-gray-500">Garanzia</span>
                        <span className="font-semibold">{vehicle.garanzia}</span>
                        </div>
                    )}
                    {vehicle.bollo && (
                        <div className="flex justify-between">
                        <span className="font-medium text-gray-500">Bollo</span>
                        <span className="font-semibold">{vehicle.bollo}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Photo Gallery */}
      {otherImages.length > 0 && (
        <div className="mt-8" style={{ pageBreakInside: 'avoid' }}>
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
      <footer className="mt-12 text-center text-sm text-gray-500 border-t pt-4">
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
