'use strict';

// El runtime wasm_exec.js debe corresponder a la versión de Go que compila el WASM.
importScripts('./wasm_exec.js');
let initialization = null;

function initialize() {
  if (!initialization) {
    initialization = (async () => {
      const go = new Go();
      const response = await fetch('./folio-import.wasm');
      if (!response.ok) throw new Error('No se pudo cargar el importador WebAssembly.');

      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
      go.run(instance).catch(error => console.error('Importador Go:', error));

      if (typeof self.folioWasmImport !== 'function') {
        throw new Error('El módulo de importación no inició correctamente.');
      }
    })().catch(error => {
      // Permite reintentar si la carga falló por falta de red o caché.
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

self.addEventListener('message', async ({ data }) => {
  const { id, name, bytes } = data;
  try {
    await initialize();
    const result = JSON.parse(self.folioWasmImport(name, new Uint8Array(bytes)));
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) });
  }
});
