const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const div = props => React.createElement('div', null, props.children);
const ui = new Proxy({}, {
  get: (_, name) => {
    if (name === '__esModule') return true;
    if (name === 'Dialog' || name === 'AlertDialog') return props => props.open ? div(props) : null;
    if (name === 'Button') return props => props.asChild ? props.children : React.createElement('button', { disabled: props.disabled, 'aria-label': props['aria-label'] }, props.children);
    return div;
  },
});

function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, process, console, URL,
    require: name => {
      if (name === '@/lib/contract-permissions') return load('src/lib/contract-permissions.ts');
      if (name === '@/lib/utils') return {
        formatCurrency: value => `EUR ${value}`,
        getDirectImageUrl: value => value,
        getOrderedVehicleImageUrls: vehicle => vehicle.immagini ?? [],
        isFirebaseStorageUrl: () => false,
        cn: () => '',
      };
      if (name === '@/hooks/use-toast') return { useToast: () => ({ toast: () => {} }) };
      if (name === 'next/navigation') return { usePathname: () => '/auto/test' };
      if (name === 'next/link' || name === 'next/image') return { __esModule: true, default: div };
      if (name === 'lucide-react') return ui;
      if (name.startsWith('@/components/')) return ui;
      return require(name);
    },
  });
  return module.exports;
}

const { VehicleDetailsClient } = load('src/app/auto/[slug]/components/vehicle-details-client.tsx');
const vehicle = { id: 'test', slug: 'test', marca: 'FIAT', modello: 'Test', versione: 'V', stato: 'In vendita', prezzo: 20000, prezzoPrivati: 19000, chilometraggio: 154235, carburante: 'Diesel', cambio: 'Automatico', potenza: 110, potenza_kw: 81, targa: 'AB123CD', mediaAssets: [], immagini: ['https://example.invalid/auto.jpg'] };
const base = { vehicle, onPrintClick: () => {}, onProformaClick: () => {}, disabled: false, editPath: null, isBooking: false, isPrinting: false, currentUserUid: 'test', currentUserToken: 'fake', currentUserEmail: 'test@example.invalid' };
for (const sellerType of ['standard', 'STANDARD', null]) {
  const html = renderToStaticMarkup(React.createElement(VehicleDetailsClient, { ...base, role: 'seller', sellerType }));
  const actionLabels = [
    'Genera Preventivo al Cliente',
    'Visualizza perizia',
    'Contatta Assistenza',
    'aria-label="Scarica immagini galleria"',
  ];
  const actionIndexes = actionLabels.map(label => html.indexOf(label));
  assert.ok(actionIndexes.every(index => index >= 0), `Missing seller action: ${actionLabels.filter((_, index) => actionIndexes[index] < 0).join(', ')}`);
  assert.deepEqual(actionIndexes, [...actionIndexes].sort((left, right) => left - right));
  assert.ok(!html.includes('Guarda la galleria'));
  assert.ok(!html.includes('Documentazione Auto'));
  assert.ok(html.includes('Dati tecnici'));
  assert.ok(html.includes('154.235 km'));
  assert.ok(html.includes('Automatico'));
  assert.ok(!html.includes('AB123CD'));
  assert.ok(!html.includes('Crea Contratto'));
  assert.ok(!html.includes('prenotazione del veicolo'));
  console.log(`PASS standard ${sellerType}`);
}
for (const role of ['admin', 'seller']) {
  const html = renderToStaticMarkup(React.createElement(VehicleDetailsClient, { ...base, role, sellerType: 'HUB', editPath: '/admin/edit-vehicle/test' }));
  assert.ok(!html.includes('Crea Contratto'));
  assert.ok(html.includes('Contatta Assistenza'));
  assert.ok(html.includes('Visualizza perizia'));
  assert.ok(html.includes('Modifica Annuncio'));
  assert.ok(html.includes('AB123CD'));
  console.log(`PASS ${role} HUB`);
}
const platformAdmin = renderToStaticMarkup(React.createElement(VehicleDetailsClient, { ...base, role: 'admin', sellerType: 'HUB', isPlatformAdmin: true, editPath: '/admin/edit-vehicle/test' }));
assert.ok(platformAdmin.includes('Crea Contratto'));
assert.ok(!platformAdmin.includes('Contatta Assistenza'));
assert.ok(!platformAdmin.includes('prenotazione del veicolo'));
console.log('PASS platform admin mantiene Crea Contratto');
const incoming = renderToStaticMarkup(React.createElement(VehicleDetailsClient, { ...base, vehicle: { ...vehicle, stato: 'In arrivo' }, role: 'admin', sellerType: 'HUB', editPath: '/admin/edit-vehicle/test' }));
assert.ok(incoming.includes('Modifica Annuncio'));
assert.ok(!incoming.includes('EUR '));
console.log('PASS admin in arrivo senza prezzi');