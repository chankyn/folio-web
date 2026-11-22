'use strict';

/**
 * Planificación del examen sin dependencias de interfaz.
 * El editor decide cómo presentar las preguntas; aquí solo se seleccionan.
 */
const FolioExams = (() => {
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function plan(questions, count, distribution = 'random', weights = {}) {
    const n = Number(count);
    const pool = Array.isArray(questions) ? questions : [];

    if (!Number.isInteger(n) || n < 1 || n > 500) {
      return { error: 'Indica entre 1 y 500 preguntas.', pool };
    }
    if (n > pool.length) {
      return { error: `Hay ${pool.length} preguntas disponibles; necesitas ${n}.`, pool };
    }
    if (distribution === 'random') return { pool, n, alloc: null };

    const topics = [...new Set(pool.map(question => question.topic))]
      .sort((a, b) => a.localeCompare(b, 'es'));
    const total = topics.reduce((sum, topic) => sum + (weights[topic] || 0), 0);

    const valid = topics.every(topic => Number.isInteger(weights[topic])
      && weights[topic] >= 0 && weights[topic] <= 100);
    if (total !== 100 || !valid) {
      return { error: `Los porcentajes deben sumar 100 %. Suma actual: ${total} %.`, pool };
    }

    const alloc = topics.map(topic => {
      const exact = n * weights[topic] / 100;
      return {
        topic,
        n: Math.floor(exact),
        remainder: exact % 1,
        available: pool.filter(question => question.topic === topic).length
      };
    });

    // Reparto por restos mayores: los porcentajes producen exactamente n preguntas.
    let remaining = n - alloc.reduce((sum, item) => sum + item.n, 0);
    for (const item of [...alloc].sort((a, b) => b.remainder - a.remainder)) {
      if (remaining <= 0) break;
      item.n++;
      remaining--;
    }

    const lacking = alloc.find(item => item.n > item.available);
    if (lacking) {
      return {
        error: `${lacking.topic}: necesitas ${lacking.n} preguntas y hay ${lacking.available}.`,
        pool, alloc
      };
    }
    return { pool, n, alloc };
  }

  return { shuffle, plan };
})();

if (typeof module !== 'undefined') module.exports = FolioExams;
