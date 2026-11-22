'use strict';

/**
 * Adaptador para importar PDF y DOCX sin bloquear el editor.
 * El archivo se transfiere al Worker: no se envía a ningún servidor.
 */
const FolioBinaryImport = (() => {
  const MAX_FILE_SIZE = 32 * 1024 * 1024;
  const TIMEOUT_MS = 90_000;

  let worker = null;
  let nextRequestId = 0;
  const requests = new Map();

  function terminate(error) {
    worker?.terminate();
    worker = null;
    for (const request of requests.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    requests.clear();
  }

  function start() {
    if (worker) return;

    worker = new Worker('./wasm/import-worker.js');
    worker.addEventListener('message', ({ data }) => {
      const request = requests.get(data.id);
      if (!request) return;

      requests.delete(data.id);
      clearTimeout(request.timeout);

      const message = data.error || data.result?.error;
      if (message) request.reject(new Error(message));
      else request.resolve(data.result);
    });

    worker.addEventListener('error', event => {
      terminate(new Error('El importador PDF/DOCX no pudo iniciarse: ' + event.message));
    });
  }

  async function parse(file) {
    if (!file || file.size > MAX_FILE_SIZE) {
      throw new Error('Selecciona un archivo de hasta 32 MB.');
    }

    start();
    const bytes = await file.arrayBuffer();
    const id = ++nextRequestId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        terminate(new Error('La importación ha tardado demasiado. Vuelve a intentarlo.'));
      }, TIMEOUT_MS);

      requests.set(id, { resolve, reject, timeout });
      worker.postMessage({ id, name: file.name, bytes }, [bytes]);
    });
  }

  return { parse };
})();
