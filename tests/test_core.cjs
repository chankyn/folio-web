'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const documents = require('../docs/document-catalog.js');
const exams = require('../docs/exam-planner.js');

const fixture = [
  { id: 'a', title: 'Macroeconomía', path: 'repaso-1.folio', updated: 100, lastOpened: 300 },
  { id: 'b', title: 'Economía Pública', path: 'tema-impuestos.folio', updated: 250, lastOpened: 250 },
  { id: 'c', title: 'Introducción', updated: 200, lastOpened: 200 }
];

test('Los documentos se abren ordenados por último uso', () => {
  assert.deepEqual(documents.findAndSort(fixture).map(doc => doc.id), ['a', 'b', 'c']);
  assert.deepEqual(documents.findAndSort(fixture, '', 'modified').map(doc => doc.id), ['b', 'c', 'a']);
});

test('La búsqueda reconoce acentos y el nombre físico de un .folio', () => {
  assert.deepEqual(documents.findAndSort(fixture, 'economia').map(doc => doc.id), ['a', 'b']);
  assert.deepEqual(documents.findAndSort(fixture, 'TEMA IMPUESTOS').map(doc => doc.id), ['b']);
  assert.deepEqual(documents.findAndSort(fixture, 'repaso-1').map(doc => doc.id), ['a']);
  assert.equal(documents.filename({ path: 'D:\\clase\\examen.folio' }), 'examen.folio');
  assert.equal(fixture[0].updated, 100, 'ordenar o buscar no cambia la fecha de edición');
});

test('La planificación aleatoria respeta el número solicitado', () => {
  const pool = Array.from({ length: 12 }, (_, i) => ({ topic: i < 7 ? 'A' : 'B' }));
  assert.equal(exams.plan(pool, 10).n, 10);
  assert.equal(exams.plan(pool, 13).error !== undefined, true);
  assert.equal(exams.plan(pool, 0).error !== undefined, true);
});

test('El reparto por porcentajes suma exactamente el total', () => {
  const pool = Array.from({ length: 20 }, (_, i) => ({ topic: i < 10 ? 'Tema 1' : 'Tema 2' }));
  const plan = exams.plan(pool, 7, 'weighted', { 'Tema 1': 60, 'Tema 2': 40 });
  assert.equal(plan.error, undefined);
  assert.deepEqual(plan.alloc.map(item => item.n), [4, 3]);
  assert.equal(plan.alloc.reduce((total, item) => total + item.n, 0), 7);
});

test('El reparto rechaza temas sin suficientes preguntas', () => {
  const pool = [
    { topic: 'Tema 1' }, { topic: 'Tema 1' },
    { topic: 'Tema 2' }, { topic: 'Tema 2' }, { topic: 'Tema 2' }, { topic: 'Tema 2' }
  ];
  const plan = exams.plan(pool, 6, 'weighted', { 'Tema 1': 75, 'Tema 2': 25 });
  assert.match(plan.error, /Tema 1/);
});

test('Mezclar preguntas no altera el banco original', () => {
  const original = ['a', 'b', 'c', 'd'];
  const copy = exams.shuffle(original, () => 0.25);
  assert.deepEqual(original, ['a', 'b', 'c', 'd']);
  assert.deepEqual([...copy].sort(), [...original].sort());
});
