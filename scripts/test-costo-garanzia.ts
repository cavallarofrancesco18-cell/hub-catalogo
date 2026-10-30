import { calcolaCostoGaranzia } from '../src/lib/warranty/costo-garanzia';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}: atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`);
  } else {
    console.log(`OK   ${name}`);
  }
}

// TEST 1: Auto 2020, 1.600 cc, benzina, manuale -> 12 mesi totale 239,84
const t1 = calcolaCostoGaranzia({
  annoImmatricolazione: 2020,
  marca: 'Fiat',
  cambio: 'Manuale',
  cilindrata: 1600,
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T1 disponibile', t1.disponibile, true);
check('T1 fascia', t1.fasciaEta, 'A');
check('T1 categoria', t1.categoria, 'fino-2500');
check('T1 supplementi', t1.supplementi, []);
check('T1 12m prezzo', t1.durate[0].prezzo, 220);
check('T1 12m polizza', t1.durate[0].polizza, 129.8);
check('T1 12m imponibile', t1.durate[0].imponibile, 90.2);
check('T1 12m iva', t1.durate[0].iva, 19.84);
check('T1 12m totale', t1.durate[0].totale, 239.84);

// TEST 2: stessa auto ibrida full e automatica -> 12 mesi totale 337,96
const t2 = calcolaCostoGaranzia({
  annoImmatricolazione: 2020,
  marca: 'Fiat',
  cambio: 'Automatico',
  cilindrata: 1600,
  carburante: 'Ibrida',
  tipoIbrido: 'Full Hybrid',
  annoRiferimento: 2026,
});
check('T2 supplementi', t2.supplementi, ['hybrid', 'automatico']);
check('T2 12m prezzo', t2.durate[0].prezzo, 310);
check('T2 12m polizza', t2.durate[0].polizza, 182.9);
check('T2 12m imponibile', t2.durate[0].imponibile, 127.1);
check('T2 12m iva', t2.durate[0].iva, 27.96);
check('T2 12m totale', t2.durate[0].totale, 337.96);

// Ibrida MHEV: nessun supplemento hybrid
const t3 = calcolaCostoGaranzia({
  annoImmatricolazione: 2020,
  marca: 'Fiat',
  cambio: 'Manuale',
  cilindrata: 1600,
  carburante: 'Ibrida',
  tipoIbrido: 'MHEV',
  annoRiferimento: 2026,
});
check('T3 MHEV nessun supplemento', t3.supplementi, []);
check('T3 12m totale', t3.durate[0].totale, 239.84);

// Land Rover: categoria lr-jaguar qualsiasi cilindrata
const t4 = calcolaCostoGaranzia({
  annoImmatricolazione: 2018,
  marca: 'land rover',
  cambio: 'Automatico',
  cilindrata: 2000,
  carburante: 'Diesel',
  annoRiferimento: 2026,
});
check('T4 categoria', t4.categoria, 'lr-jaguar');
check('T4 supplementi', t4.supplementi, ['automatico']);
check('T4 12m prezzo', t4.durate[0].prezzo, 855);
check('T4 12m totale', t4.durate[0].totale, 932.12);

// Supercar per marca anche senza cilindrata
const t5 = calcolaCostoGaranzia({
  annoImmatricolazione: 2022,
  marca: 'Porsche',
  cambio: 'Automatico',
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T5 categoria', t5.categoria, 'oltre-2500');
check('T5 campi mancanti', t5.campiMancanti, []);

// Cilindrata > 2500 -> oltre-2500
const t6 = calcolaCostoGaranzia({
  annoImmatricolazione: 2022,
  marca: 'BMW',
  cambio: 'Manuale',
  cilindrata: 3000,
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T6 categoria', t6.categoria, 'oltre-2500');

// Listino B: 2011 -> 15 anni
const t7 = calcolaCostoGaranzia({
  annoImmatricolazione: 2011,
  marca: 'Fiat',
  cambio: 'Manuale',
  cilindrata: 1600,
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T7 fascia', t7.fasciaEta, 'B');
check('T7 12m totale', t7.durate[0].totale, 261.65);

// 2016 -> 10 anni -> listino A
const t8 = calcolaCostoGaranzia({
  annoImmatricolazione: 2016,
  marca: 'Fiat',
  cambio: 'Manuale',
  cilindrata: 1600,
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T8 fascia', t8.fasciaEta, 'A');

// Oltre 15 anni -> non disponibile
const t9 = calcolaCostoGaranzia({
  annoImmatricolazione: 2010,
  marca: 'Fiat',
  cambio: 'Manuale',
  cilindrata: 1600,
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T9 non disponibile', t9.disponibile, false);
check('T9 motivo', t9.motivoNonDisponibile, 'Garanzia non disponibile: il veicolo ha 16 anni (oltre 15 anni).');

// Cilindrata mancante con marca normale
const t10 = calcolaCostoGaranzia({
  annoImmatricolazione: 2020,
  marca: 'Fiat',
  cambio: 'Manuale',
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T10 manca cilindrata', t10.campiMancanti, ['cilindrata']);
check('T10 non disponibile', t10.disponibile, false);

// Ibrida senza tipo -> manca tipoIbrido
const t11 = calcolaCostoGaranzia({
  annoImmatricolazione: 2020,
  marca: 'Fiat',
  cambio: 'Manuale',
  cilindrata: 1600,
  carburante: 'Ibrida',
  annoRiferimento: 2026,
});
check('T11 manca tipoIbrido', t11.campiMancanti, ['tipoIbrido']);

// Jaguar listino B 60 mesi: 4200 + 378.84 = 4578.84
const t12 = calcolaCostoGaranzia({
  annoImmatricolazione: 2012,
  marca: 'Jaguar',
  cambio: 'Manuale',
  cilindrata: 2000,
  carburante: 'Benzina',
  annoRiferimento: 2026,
});
check('T12 fascia', t12.fasciaEta, 'B');
check('T12 categoria', t12.categoria, 'lr-jaguar');
check('T12 60m totale', t12.durate[4].totale, 4578.84);

if (failures > 0) {
  console.error(`\n${failures} test falliti`);
  process.exit(1);
}
console.log('\nTutti i test superati');
