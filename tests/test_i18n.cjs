'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'docs/i18n.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');

function initialise(language) {
  const context = {
    navigator: { language },
    localStorage: { getItem: () => null },
    module: { exports: {} }
  };
  vm.runInNewContext(script, context);
  return context.module.exports;
}

test('Spanish and English labels are available', () => {
  const spanish = initialise('es-ES');
  const english = initialise('en-GB');
  assert.equal(spanish.t('Banco de preguntas'), 'Banco de preguntas');
  assert.equal(english.t('Banco de preguntas'), 'Question bank');
  assert.equal(english.t('20 palabras'), '20 words');
});

test('Difficulty values remain stable in stored questions', () => {
  const labels = ['Fácil', 'Media', 'Difícil'];
  const english = initialise('en');
  assert.deepEqual(labels.map(value => english.t(value)), ['Easy', 'Medium', 'Hard']);
  for (const label of labels) {
    assert.match(html, new RegExp(`<option[^>]*\\bvalue="${label}"[^>]*>${label}</option>`));
  }
});

test('Interface language module loads before the editor', () => {
  assert.ok(html.indexOf('src="i18n.js"') < html.indexOf('src="app.js"'));
  assert.match(html, /<select id="languageSwitch"/);
});
