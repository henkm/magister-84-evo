// Genereert MAGDATA.py uit de fixtures en schrijft het naar stdout.
// Aangeroepen door tests/test_generator_kruis.py.
import { readFileSync } from 'node:fs';
import { bouwModel, genereerMagdata } from '../../extension/src/genereer.js';

const fixture = (naam) => JSON.parse(
  readFileSync(new URL(`../fixtures/${naam}.json`, import.meta.url), 'utf8')).Items;

process.stdout.write(genereerMagdata(bouwModel({
  afspraken: fixture('afspraken'),
  cijferrijen: fixture('cijfers'),
  leerling: 'Fenna',
  nu: new Date('2026-09-01T07:12:00Z'),
})));
