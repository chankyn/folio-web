'use strict';

// Pequeños controles de la interfaz que no necesitan tocar el estado editorial.
function initializeShell() {
  const banner = document.getElementById('privacyBanner');
  // Remember a dismissed notice without touching document storage.
  try {
    if (localStorage.getItem('folio.privacy.dismissed') === 'yes') banner?.remove();
  } catch { /* Storage is optional. */ }
  document.getElementById('dismissBanner')?.addEventListener('click', () => {
    banner?.remove();
    try { localStorage.setItem('folio.privacy.dismissed', 'yes'); } catch { /* Optional. */ }
  });

  const sidebar = document.querySelector('.sidebar');
  const toggle = document.getElementById('mobileDocsToggle');
  const search = document.getElementById('docSearch');

  function showDocuments(visible) {
    sidebar?.classList.toggle('docs-expanded', visible);
    toggle?.setAttribute('aria-expanded', String(visible));
  }

  toggle?.addEventListener('click', () => {
    showDocuments(!sidebar?.classList.contains('docs-expanded'));
  });

  // Si se usa el atajo de búsqueda en móvil, desplegamos su campo.
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey
      && event.key.toLowerCase() === 'f') {
      showDocuments(true);
      requestAnimationFrame(() => search?.focus());
    }
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializeShell, { once: true });
} else {
  initializeShell();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const register = () => navigator.serviceWorker.register('./sw.js')
    .catch(error => console.warn('Modo sin conexión no disponible:', error));

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
