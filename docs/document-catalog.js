'use strict';

/**
 * Reglas de búsqueda y ordenación de «Mis documentos».
 * No dependen del DOM: también se usan en las pruebas del proyecto.
 */
const FolioDocuments = (() => {
  const normalize = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');

  const filename = doc => doc.path
    ? String(doc.path).split(/[\\/]/).pop()
    : '';

  // Abrir un documento no altera su fecha de última modificación.
  const lastUsed = doc => Math.max(Number(doc.lastOpened) || 0, Number(doc.updated) || 0);

  function displayDate(timestamp, now = new Date(), language = 'es') {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return 'Sin fecha';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const locale = language === 'en' ? 'en-GB' : 'es-ES';
    const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    if (value >= startOfDay) return `${language === 'en' ? 'Today' : 'Hoy'} · ${time}`;
    if (value >= startOfDay - 86400000) return `${language === 'en' ? 'Yesterday' : 'Ayer'} · ${time}`;

    return date.toLocaleDateString(locale, {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function findAndSort(documents, query = '', sort = 'recent') {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    const results = documents.filter(doc => {
      if (terms.length === 0) return true;
      const text = normalize(`${doc.title ?? ''} ${filename(doc)}`);
      return terms.every(term => text.includes(term));
    });

    return results.sort((first, second) => {
      if (sort === 'name') {
        return String(first.title ?? '').localeCompare(String(second.title ?? ''), 'es', {
          sensitivity: 'base'
        }) || lastUsed(second) - lastUsed(first);
      }
      if (sort === 'modified') {
        return (Number(second.updated) || 0) - (Number(first.updated) || 0)
          || String(first.title ?? '').localeCompare(String(second.title ?? ''), 'es');
      }
      return lastUsed(second) - lastUsed(first)
        || (Number(second.updated) || 0) - (Number(first.updated) || 0)
        || String(first.title ?? '').localeCompare(String(second.title ?? ''), 'es');
    });
  }

  return { normalize, filename, lastUsed, displayDate, findAndSort };
})();

if (typeof module !== 'undefined') module.exports = FolioDocuments;
