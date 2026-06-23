// Script per aggiornare tutti i veicoli in Firestore aggiungendo/correggendo il campo slug
// Da eseguire una tantum in ambiente Node.js con le credenziali admin Firebase

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

type SlugVehicle = {
  id: string;
  marca: string;
  modello: string;
  data_immatricolazione: string;
  slug?: string;
};

// Funzione per generare lo slug come da frontend
function generateSlug(vehicle: SlugVehicle) {
  const year = new Date(vehicle.data_immatricolazione).getFullYear();
  return `${vehicle.marca.toLowerCase()}-${vehicle.modello.toLowerCase()}-${year}-${vehicle.id}`.replace(/\s+/g, '-');
}

async function updateSlugs() {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  const vehiclesRef = db.collection('vehicles');
  const snapshot = await vehiclesRef.get();

  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() as Partial<SlugVehicle>;
    if (!data.marca || !data.modello || !data.data_immatricolazione) {
      continue;
    }
    const slug = generateSlug({
      id: doc.id,
      marca: data.marca,
      modello: data.modello,
      data_immatricolazione: data.data_immatricolazione,
      slug: data.slug,
    });
    if (data.slug !== slug) {
      await doc.ref.update({ slug });
      updated++;
      console.log(`Aggiornato veicolo ${doc.id} con slug: ${slug}`);
    }
  }
  console.log(`Totale veicoli aggiornati: ${updated}`);
}

updateSlugs().catch(console.error);
