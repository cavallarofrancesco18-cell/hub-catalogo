const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const auth = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth'));

const PROJECT = 'projects/studio-3074982188-44660';
const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

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
  const releasePath = `${PROJECT}/releases/cloud.firestore`;
  const release = await api(releasePath);
  const active = await api(release.rulesetName);
  const local = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  const source = { files: active.source.files.map(file => ({ name: file.name, content: file.content })) };
  const file = source.files.find(entry => entry.content.includes('match /vehicles/{vehicleId}'));
  assert.ok(file, 'Regole veicoli mancanti');
  if (!file.content.includes('function isStandardSeller()')) {
    const helperStart = file.content.indexOf('    function canWriteContracts()');
    const helperEnd = file.content.indexOf('    match /vehicles/', helperStart);
    const localStart = local.indexOf('    function isStandardSeller()');
    const localEnd = local.indexOf('    match /vehicles/', localStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart && localStart >= 0 && localEnd > localStart);
    const oldHelper = file.content.slice(helperStart, helperEnd);
    assert.ok(oldHelper.includes('(isAdmin() || isSeller())'));
    assert.equal((oldHelper.match(/function /g) || []).length, 1);
    file.content = file.content.slice(0, helperStart) + local.slice(localStart, localEnd) + file.content.slice(helperEnd);
    const booking = '                    (isSignedIn()\n';
    assert.equal(file.content.split(booking).length, 2);
    file.content = file.content.replace(booking, `${booking}                    && !isStandardSeller()\n`);
    const sellerStart = file.content.indexOf('    match /seller/{sellerId}');
    const sellerEnd = file.content.indexOf('    match /agents/', sellerStart);
    const localSellerStart = local.indexOf('    match /seller/{sellerId}');
    const localSellerEnd = local.indexOf('    match /agents/', localSellerStart);
    const previousSeller = file.content.slice(sellerStart, sellerEnd);
    const nextSeller = local.slice(localSellerStart, localSellerEnd);
    const oldCreate = previousSeller.match(/allow create:[\s\S]*?;/)[0];
    const oldUpdate = previousSeller.match(/allow update:[\s\S]*?;/)[0];
    const newCreate = nextSeller.match(/allow create:[\s\S]*?;/)[0];
    const newUpdate = nextSeller.match(/allow update:[\s\S]*?;/)[0];
    assert.equal(nextSeller.replace(newCreate, oldCreate).replace(newUpdate, oldUpdate), previousSeller, 'Altre differenze nel blocco seller: pubblicazione interrotta');
    file.content = file.content.slice(0, sellerStart) + nextSeller + file.content.slice(sellerEnd);
  }

  const tests = [];
  const scenarios = [];
  const time = '2026-10-09T12:00:00Z';
  function add(name, sellerType, operation, expectation, admin = false) {
    const uid = admin ? ADMIN_UID : 'standard-rule-test';
    const sellerPath = `/databases/(default)/documents/seller/${uid}`;
    const vehiclePath = '/databases/(default)/documents/vehicles/standard-vehicle-test';
    const profile = sellerType === undefined ? {} : { sellerType };
    const before = operation === 'booking' ? { adminOnly: false, stato: 'In vendita' }
      : operation === 'seller-update' ? profile : { adminOnly: false, creatorId: uid };
    const data = operation === 'booking'
      ? { ...before, stato: 'Prenotato', statusChangedBy: uid, updatedAt: time }
      : operation === 'seller-update' || operation === 'seller-create-hub' ? { sellerType: 'hub' }
      : operation === 'seller-create-standard' ? { sellerType: 'standard' }
      : { adminOnly: false, creatorId: uid, price: 20000 };
    const documentPath = operation.startsWith('seller-') ? `/databases/(default)/documents/seller/${uid}`
      : operation === 'booking' ? vehiclePath : '/databases/(default)/documents/contracts/standard-vehicle-test';
    const method = operation === 'contract-create' || operation.startsWith('seller-create') ? 'create' : 'update';
    tests.push({
      expectation,
      request: { path: documentPath, method, time, auth: { uid, token: { email: 'rules-test@example.invalid' } }, resource: { data } },
      resource: { data: before },
      functionMocks: [
        { function: 'exists', args: [{ exactValue: sellerPath }], result: { value: !admin && !operation.startsWith('seller-create') } },
        { function: 'get', args: [{ exactValue: sellerPath }], result: { value: { data: profile } } },
        { function: 'exists', args: [{ exactValue: vehiclePath }], result: { value: true } },
        { function: 'get', args: [{ exactValue: vehiclePath }], result: { value: { data: { adminOnly: false, stato: 'In vendita' } } } },
        { function: 'exists', args: [{ anyValue: {} }], result: { value: false } },
        { function: 'get', args: [{ anyValue: {} }], result: { value: { data: {} } } },
      ],
    });
    scenarios.push(name);
  }
  for (const sellerType of [undefined, null, '', 'standard', 'STANDARD', ' Standard ']) {
    for (const operation of ['contract-create', 'contract-update', 'booking', 'seller-update']) {
      add(`${String(sellerType)} ${operation}`, sellerType, operation, 'DENY');
    }
  }
  for (const sellerType of ['HUB', 'express', 'mgv', 'tantibuonikm']) {
    add(`${sellerType} contratto`, sellerType, 'contract-create', 'ALLOW');
  }
  add('Admin contratto', null, 'contract-create', 'ALLOW', true);
  add('Admin modifica tipo seller', null, 'seller-update', 'ALLOW', true);
  add('Registrazione standard', null, 'seller-create-standard', 'ALLOW');
  add('Auto registrazione HUB vietata', null, 'seller-create-hub', 'DENY');
  const result = await api(`${PROJECT}:test`, 'POST', { source, testSuite: { testCases: tests } });
  assert.ok(!result.issues?.some(issue => issue.severity === 'ERROR'), JSON.stringify(result.issues));
  assert.equal(result.testResults?.length, tests.length);
  result.testResults.forEach((test, index) => {
    console.log(`${test.state} ${scenarios[index]}`);
    assert.equal(test.state, 'SUCCESS', JSON.stringify(test));
  });
  console.log(`${tests.length} test regole superati. Nessun documento reale modificato.`);

  if (process.argv.includes('--deploy')) {
    const created = await api(`${PROJECT}/rulesets`, 'POST', { source });
    assert.equal((await api(releasePath)).rulesetName, release.rulesetName, 'Regole attive cambiate: pubblicazione interrotta');
    await api(releasePath, 'PATCH', { release: { name: releasePath, rulesetName: created.name }, updateMask: 'rulesetName' });
    assert.equal((await api(releasePath)).rulesetName, created.name);
    const verified = await api(created.name);
    assert.deepEqual(verified.source.files.map(entry => ({ name: entry.name, content: entry.content })), source.files);
    console.log(`Regole pubblicate e verificate: ${created.name}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});