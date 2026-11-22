'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../docs');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const assets = [
  ...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)
].map(match => match[1]);

test('Todos los recursos publicados por index.html existen', () => {
  for (const asset of assets) {
    assert.ok(!/^https?:\/\//i.test(asset), `Se encontró una dependencia externa: ${asset}`);
    assert.ok(fs.existsSync(path.join(root, asset)), `Falta ${asset}`);
  }
});

test('El precache incluye los scripts del editor y el motor importador', () => {
  for (const asset of [
    'app.js', 'document-catalog.js', 'exam-planner.js', 'i18n.js',
    'wasm/import-worker.js', 'wasm/folio-import.wasm'
  ]) {
    assert.ok(sw.includes(`'./${asset}'`), `Falta ${asset} en el Service Worker`);
  }
});

test('Los módulos de dominio se cargan antes del editor', () => {
  const app = html.indexOf('src="app.js"');
  assert.ok(app > html.indexOf('src="i18n.js"'));
  assert.ok(app > html.indexOf('src="document-catalog.js"'));
  assert.ok(app > html.indexOf('src="exam-planner.js"'));
});

test('La web publica solo recursos de producto, no documentos de usuarios', () => {
  const assetsDir = fs.readdirSync(root);
  assert.ok(!assetsDir.includes('workspace.json'));
  assert.ok(!assetsDir.includes('folio.db'));
  assert.ok(fs.existsSync(path.join(root, '.nojekyll')));
});
