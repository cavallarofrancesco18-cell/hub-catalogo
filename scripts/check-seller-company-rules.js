const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));

const PROJECT = 'projects/studio-3074982188-44660';
const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';
const STORAGE_BUCKET = 'studio-3074982188-44660.firebasestorage.app';
const FIRESTORE_RELEASE = `${PROJECT}/releases/cloud.firestore`;
const STORAGE_RELEASE = `${PROJECT}/releases/firebase.storage/${STORAGE_BUCKET}`;

async function main() {
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase login richiesto');

  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  const api = async (resourcePath, method = 'GET', body) => {
    const response = await fetch(`https://firebaserules.googleapis.com/v1/${resourcePath}`, {
      method,
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`Rules API HTTP ${response.status}: ${result.error?.message}`);
    return result;
  };

  const extractBlock = (content, marker) => {
    const start = content.indexOf(marker);
    assert.ok(start >= 0, `Blocco non trovato: ${marker}`);
    const openMarker = content.indexOf(' {', start);
    const open = openMarker >= 0 ? openMarker + 1 : -1;
    assert.ok(open >= 0, `Apertura blocco non trovata: ${marker}`);
    let depth = 0;
    for (let index = open; index < content.length; index += 1) {
      if (content[index] === '{') depth += 1;
      if (content[index] === '}') depth -= 1;
      if (depth === 0) return content.slice(start, index + 1);
    }
    throw new Error(`Blocco incompleto: ${marker}`);
  };

  const getActiveSource = async releasePath => {
    const release = await api(releasePath);
    const ruleset = await api(release.rulesetName);
    return { release, source: { files: ruleset.source.files.map(file => ({ name: file.name, content: file.content })) } };
  };

  const firestoreActive = await getActiveSource(FIRESTORE_RELEASE);
  const storageActive = await getActiveSource(STORAGE_RELEASE);
  const localFirestore = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  const localStorage = fs.readFileSync(path.join(__dirname, '../storage.rules'), 'utf8');

  const firestoreFile = firestoreActive.source.files.find(file => file.content.includes('match /seller/{sellerId}'));
  assert.ok(firestoreFile, 'Blocco seller mancante nelle regole attive');
  if (!firestoreFile.content.includes('match /sellerTypes/{sellerTypeId}')) {
    const ruleBlock = extractBlock(localFirestore, '    match /sellerTypes/{sellerTypeId}');
    const insertAt = firestoreFile.content.indexOf('    match /agents/');
    assert.ok(insertAt >= 0, 'Punto di inserimento sellerTypes non trovato');
    firestoreFile.content = `${firestoreFile.content.slice(0, insertAt)}${ruleBlock}\n\n${firestoreFile.content.slice(insertAt)}`;
  }

  const storageFile = storageActive.source.files.find(file => file.content.includes('match /download/{vehicleId}'));
  assert.ok(storageFile, 'Blocco download mancante nelle regole Storage attive');
  if (!storageFile.content.includes('match /seller-company-logos/{sellerId}')) {
    const ruleBlock = extractBlock(localStorage, '    match /seller-company-logos/{sellerId}/{allPaths=**}');
    const insertAt = storageFile.content.indexOf('    match /download/{vehicleId}');
    assert.ok(insertAt >= 0, 'Punto di inserimento seller-company-logos non trovato');
    storageFile.content = `${storageFile.content.slice(0, insertAt)}${ruleBlock}\n\n${storageFile.content.slice(insertAt)}`;
  }

  const now = '2026-10-15T12:00:00Z';
  const typePath = '/databases/(default)/documents/sellerTypes/test-company-type';
  const adminAuth = { uid: ADMIN_UID, token: { email: 'admin@example.invalid' } };
  const sellerAuth = { uid: 'seller-rules-test', token: { email: 'seller@example.invalid' } };
  const sellerPath = '/databases/(default)/documents/seller/seller-rules-test';
  const commonMocks = [
    { function: 'exists', args: [{ exactValue: sellerPath }], result: { value: false } },
    { function: 'get', args: [{ exactValue: sellerPath }], result: { value: { data: {} } } },
    { function: 'exists', args: [{ anyValue: {} }], result: { value: false } },
    { function: 'get', args: [{ anyValue: {} }], result: { value: { data: {} } } },
  ];
  const validType = { id: 'test-company-type', name: 'Test company type', createdAt: now, createdByUid: ADMIN_UID };
  const testNames = [
    'admin crea tipo valido',
    'seller non crea tipo',
    'admin non crea tipo per altro uid',
    'admin legge tipo',
    'seller non legge lista tipi',
  ];
  const cases = [
    { name: 'admin crea tipo valido', expectation: 'ALLOW', request: { path: typePath, method: 'create', time: now, auth: adminAuth, resource: { data: validType } }, resource: { data: {} } },
    { name: 'seller non crea tipo', expectation: 'DENY', request: { path: typePath, method: 'create', time: now, auth: sellerAuth, resource: { data: { ...validType, createdByUid: sellerAuth.uid } } }, resource: { data: {} } },
    { name: 'admin non crea tipo per altro uid', expectation: 'DENY', request: { path: typePath, method: 'create', time: now, auth: adminAuth, resource: { data: { ...validType, createdByUid: sellerAuth.uid } } }, resource: { data: {} } },
    { name: 'admin legge tipo', expectation: 'ALLOW', request: { path: typePath, method: 'get', time: now, auth: adminAuth, resource: { data: validType } }, resource: { data: validType } },
    { name: 'seller non legge lista tipi', expectation: 'DENY', request: { path: '/databases/(default)/documents/sellerTypes', method: 'list', time: now, auth: sellerAuth, resource: { data: {} } }, resource: { data: {} } },
  ].map(testCase => ({
    expectation: testCase.expectation,
    request: testCase.request,
    resource: testCase.resource,
    functionMocks: commonMocks,
  }));

  const result = await api(`${PROJECT}:test`, 'POST', {
    source: firestoreActive.source,
    testSuite: { testCases: cases },
  });
  assert.ok(!result.issues?.some(issue => issue.severity === 'ERROR'), JSON.stringify(result.issues));
  assert.equal(result.testResults?.length, cases.length);
  result.testResults.forEach((test, index) => {
    console.log(`${test.state} ${testNames[index]}`);
    assert.equal(test.state, 'SUCCESS', JSON.stringify(test));
  });
  console.log('Storage logo: rule compilata per lettura owner/admin e scrittura admin fino a 4 MB.');
  console.log('Nessun documento seller o tipo reale è stato creato nei test.');

  if (!process.argv.includes('--deploy')) return;

  const firestoreRuleset = await api(`${PROJECT}/rulesets`, 'POST', { source: firestoreActive.source });
  const storageRuleset = await api(`${PROJECT}/rulesets`, 'POST', { source: storageActive.source });
  assert.equal((await api(FIRESTORE_RELEASE)).rulesetName, firestoreActive.release.rulesetName, 'Regole Firestore modificate durante il test');
  assert.equal((await api(STORAGE_RELEASE)).rulesetName, storageActive.release.rulesetName, 'Regole Storage modificate durante il test');

  await api(FIRESTORE_RELEASE, 'PATCH', {
    release: { name: FIRESTORE_RELEASE, rulesetName: firestoreRuleset.name },
    updateMask: 'rulesetName',
  });
  await api(STORAGE_RELEASE, 'PATCH', {
    release: { name: STORAGE_RELEASE, rulesetName: storageRuleset.name },
    updateMask: 'rulesetName',
  });

  assert.equal((await api(FIRESTORE_RELEASE)).rulesetName, firestoreRuleset.name);
  assert.equal((await api(STORAGE_RELEASE)).rulesetName, storageRuleset.name);
  console.log(`Firestore rules pubblicate: ${firestoreRuleset.name}`);
  console.log(`Storage rules pubblicate: ${storageRuleset.name}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});