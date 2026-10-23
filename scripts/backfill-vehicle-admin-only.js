require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' });

const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function run() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim().replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are required for this backfill.');
  }
  if (projectId !== 'studio-3074982188-44660') {
    throw new Error(`Unexpected Firebase project: ${projectId}`);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  const db = getFirestore();
  const snapshot = await db.collection('vehicles').get();
  const pending = snapshot.docs.filter(document => {
    const vehicle = document.data();
    return vehicle.adminOnly !== (vehicle.stato === 'Trasferita' || vehicle.adminOnly === true);
  });

  const apply = process.argv.includes('--apply');
  console.log(`Project ${projectId}: ${pending.length} of ${snapshot.size} vehicles require adminOnly (dry run: ${!apply}).`);

  if (apply) {
    for (let index = 0; index < pending.length; index += 400) {
      const batch = db.batch();
      pending.slice(index, index + 400).forEach(document => {
        const vehicle = document.data();
        batch.update(document.ref, { adminOnly: vehicle.stato === 'Trasferita' || vehicle.adminOnly === true });
      });
      await batch.commit();
    }
    console.log(`Updated ${pending.length} vehicles.`);
  }

  const contracts = await db.collection('contracts').get();
  const contractUpdates = [];
  for (const contract of contracts.docs) {
    const vehicle = await db.collection('vehicles').doc(contract.id).get();
    if (!vehicle.exists) continue;
    const adminOnly = vehicle.data().adminOnly === true;
    if (contract.data().adminOnly !== adminOnly) {
      contractUpdates.push({ ref: contract.ref, adminOnly });
    }
  }
  console.log(`${contractUpdates.length} of ${contracts.size} contracts require adminOnly.`);

  const customers = await db.collection('customers').get();
  const customerUpdates = customers.docs.filter(document => document.data().adminOnly === undefined);
  console.log(`${customerUpdates.length} of ${customers.size} customers require adminOnly.`);
  if (!apply) return;
  for (let index = 0; index < contractUpdates.length; index += 400) {
    const batch = db.batch();
    contractUpdates.slice(index, index + 400).forEach(({ ref, adminOnly }) => batch.update(ref, { adminOnly }));
    await batch.commit();
  }
  console.log(`Updated ${contractUpdates.length} contracts.`);

  for (let index = 0; index < customerUpdates.length; index += 400) {
    const batch = db.batch();
    customerUpdates.slice(index, index + 400).forEach(document => batch.update(document.ref, { adminOnly: false }));
    await batch.commit();
  }
  console.log(`Updated ${customerUpdates.length} customers.`);
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});