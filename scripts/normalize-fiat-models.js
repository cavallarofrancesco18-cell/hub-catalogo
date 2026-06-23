/* eslint-disable no-console */
require('dotenv').config();

const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

function getPrivateKey() {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  return raw ? raw.replace(/\\n/g, '\n') : undefined;
}

function getProjectId() {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = getProjectId();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

function normalizeBrand(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function normalizeModelKey(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function pickCanonicalModel(variants) {
  // Keep the most frequent existing representation to minimize visual changes.
  const sorted = [...variants.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    if (b[0].length !== a[0].length) {
      return b[0].length - a[0].length;
    }
    return a[0].localeCompare(b[0]);
  });

  return sorted[0]?.[0] ?? '';
}

async function run() {
  const apply = process.argv.includes('--apply');
  getAdminApp();

  const db = getFirestore();
  const snapshot = await db.collection('vehicles').get();

  const fiatDocs = [];
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const brandRaw = data?.marca;
    const modelRaw = data?.modello;

    if (normalizeBrand(brandRaw) !== 'fiat') {
      return;
    }

    fiatDocs.push({
      ref: docSnap.ref,
      id: docSnap.id,
      brand: typeof brandRaw === 'string' ? brandRaw : '',
      model: typeof modelRaw === 'string' ? modelRaw : '',
    });
  });

  const groups = new Map();
  fiatDocs.forEach(item => {
    const key = normalizeModelKey(item.model);
    if (!key) {
      return;
    }
    if (!groups.has(key)) {
      groups.set(key, { items: [], variants: new Map() });
    }
    const group = groups.get(key);
    group.items.push(item);
    group.variants.set(item.model, (group.variants.get(item.model) ?? 0) + 1);
  });

  const plannedUpdates = [];
  let duplicatedGroups = 0;

  for (const [key, group] of groups.entries()) {
    const canonicalModel = pickCanonicalModel(group.variants);
    const hasMultipleVariants = group.variants.size > 1;

    if (hasMultipleVariants) {
      duplicatedGroups += 1;
      console.log(`Gruppo FIAT duplicato [${key}] -> ${[...group.variants.keys()].join(' | ')} | canonico: ${canonicalModel}`);
    }

    group.items.forEach(item => {
      const nextBrand = 'FIAT';
      const nextModel = canonicalModel || item.model;

      if (item.brand !== nextBrand || item.model !== nextModel) {
        plannedUpdates.push({
          ref: item.ref,
          id: item.id,
          currentBrand: item.brand,
          currentModel: item.model,
          nextBrand,
          nextModel,
        });
      }
    });
  }

  console.log(`Veicoli FIAT analizzati: ${fiatDocs.length}`);
  console.log(`Gruppi modello duplicati: ${duplicatedGroups}`);
  console.log(`Aggiornamenti previsti: ${plannedUpdates.length}`);

  if (!apply) {
    console.log('Modalita dry-run: nessuna modifica applicata. Usa --apply per confermare.');
    return;
  }

  if (plannedUpdates.length === 0) {
    console.log('Nessuna modifica da applicare.');
    return;
  }

  const chunkSize = 400;
  for (let i = 0; i < plannedUpdates.length; i += chunkSize) {
    const chunk = plannedUpdates.slice(i, i + chunkSize);
    const batch = db.batch();

    chunk.forEach(item => {
      batch.update(item.ref, {
        marca: item.nextBrand,
        modello: item.nextModel,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Aggiornato chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(plannedUpdates.length / chunkSize)} (${chunk.length} veicoli)`);
  }

  console.log('Normalizzazione FIAT completata.');
}

run().catch(error => {
  console.error('Normalizzazione FIAT fallita:', error);
  process.exitCode = 1;
});
