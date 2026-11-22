'use strict';

/**
 * Interface translations. Document text and question content are never translated.
 * Spanish remains the canonical value for question difficulty in saved files.
 */
const FolioI18n = (() => {
  const preferenceKey = 'folio.interface.language';
  const english = {
    'Saltar al editor': 'Skip to editor',
    'Folio Web 1.0 · Documentos y exámenes': 'Folio Web 1.0 · Documents and exams',
    'Documento sin título': 'Untitled document',
    'Guardando…': 'Saving…',
    'Guardado en este navegador': 'Saved in this browser',
    'No se pudo guardar · exporta copia': 'Save failed · export a backup',
    '＋ Nuevo': '＋ New',
    'Guardar': 'Save',
    'Ver páginas': 'Page preview',
    'Imprimir / PDF': 'Print / PDF',
    'Folio Web funciona': 'Folio Web works',
    'sin cuentas ni servidores': 'without accounts or servers',
    '. Tus documentos y preguntas se guardan únicamente en este navegador.': '. Your documents and questions are stored only in this browser.',
    'Ocultar aviso': 'Dismiss notice',
    'ESPACIO DE TRABAJO': 'WORKSPACE',
    'Editor de documentos': 'Document editor',
    'Banco de preguntas': 'Question bank',
    'Crear examen': 'Create exam',
    'Mis documentos': 'My documents',
    'MIS DOCUMENTOS': 'MY DOCUMENTS',
    'Buscar documentos…': 'Search documents…',
    'Buscar documentos por nombre o nombre de archivo': 'Search documents by title or filename',
    'Atajo: Ctrl + Mayús + F': 'Shortcut: Ctrl + Shift + F',
    'Ordenar por': 'Sort by',
    'Ordenar mis documentos': 'Sort my documents',
    'Últimos utilizados': 'Recently opened',
    'Últimos modificados': 'Recently edited',
    'Nombre (A–Z)': 'Name (A–Z)',
    'Guardado privado': 'Private storage',
    'IndexedDB de este navegador; exporta copias periódicas.': 'Stored in this browser. Export regular backups.',
    'Exportar espacio completo (.json)': 'Export workspace (.json)',
    'Importar copia': 'Import backup',
    'Historial local': 'Local history',
    'Acerca de Folio Web': 'About Folio Web',
    'Inicio': 'Home',
    'Insertar': 'Insert',
    'Diseño de página': 'Page layout',
    'Archivo': 'File',
    'Deshacer': 'Undo',
    'Rehacer': 'Redo',
    'Historial': 'History',
    'Fuente': 'Font',
    'Tamaño de texto': 'Font size',
    'Negrita': 'Bold',
    'Cursiva': 'Italic',
    'Subrayado': 'Underline',
    'Tachado': 'Strikethrough',
    'Superíndice': 'Superscript',
    'Subíndice': 'Subscript',
    'Color de texto': 'Text colour',
    'Resaltar': 'Highlight',
    'Borrar formato': 'Clear formatting',
    'Alinear a la izquierda': 'Align left',
    'Centrar': 'Centre',
    'Alinear a la derecha': 'Align right',
    'Justificar': 'Justify',
    'Viñetas': 'Bullets',
    'Numeración': 'Numbering',
    'Crear subviñeta · Tab': 'Increase level · Tab',
    'Subir nivel · Mayús+Tab': 'Decrease level · Shift+Tab',
    'Aumentar nivel': 'Increase level',
    'Reducir nivel': 'Decrease level',
    'Viñeta': 'Bullet',
    'Estilo de viñeta': 'Bullet style',
    'Símbolo': 'Symbol',
    'Símbolo personalizado': 'Custom symbol',
    '• Punto': '• Disc',
    '◦ Círculo': '◦ Circle',
    '▪ Cuadrado': '▪ Square',
    '– Guion': '– Dash',
    '→ Flecha': '→ Arrow',
    '✓ Check': '✓ Check',
    '★ Estrella': '★ Star',
    '◆ Rombo': '◆ Diamond',
    '✎ Personalizada': '✎ Custom',
    'Listas y subniveles': 'Lists and levels',
    'Estilo de párrafo': 'Paragraph style',
    'Texto normal': 'Normal text',
    'Título 1': 'Heading 1',
    'Título 2': 'Heading 2',
    'Título 3': 'Heading 3',
    'Cita': 'Quote',
    'Estilos': 'Styles',
    '▦ Tabla': '▦ Table',
    '▧ Imagen': '▧ Image',
    '∑ Ecuación': '∑ Equation',
    '▤ Ver páginas': '▤ Page preview',
    '↵ Salto de página': '↵ Page break',
    '― Línea horizontal': '― Horizontal rule',
    '＋ Pregunta del banco': '＋ From question bank',
    'Insertar una ecuación matemática visual': 'Insert a visual maths equation',
    'Ver las páginas A4 antes de imprimir': 'Preview A4 pages before printing',
    'Elementos del documento': 'Document elements',
    'Papel': 'Paper',
    'Carta': 'Letter',
    'Orientación': 'Orientation',
    'Vertical': 'Portrait',
    'Horizontal': 'Landscape',
    'Márgenes': 'Margins',
    'Estrechos · 1,5 cm': 'Narrow · 1.5 cm',
    'Normales · 2,5 cm': 'Normal · 2.5 cm',
    'Amplios · 3,5 cm': 'Wide · 3.5 cm',
    'Interlineado': 'Line spacing',
    'Sencillo': 'Single',
    'Doble': 'Double',
    'Fuente base': 'Default font',
    'Tamaño base': 'Default size',
    'Monoespaciada': 'Monospace',
    'Numerar páginas': 'Page numbers',
    'Importar documento': 'Import document',
    'Guardar archivo como…': 'Save file as…',
    'Duplicar documento': 'Duplicate document',
    'Cambiar nombre': 'Rename',
    'Eliminar documento': 'Delete document',
    'Exportar LaTeX (.zip)': 'Export LaTeX (.zip)',
    'Gestionar archivo': 'Manage document',
    '0 palabras': '0 words',
    'Vista continua · A4': 'Continuous view · A4',
    'IndexedDB local': 'Local IndexedDB',
    'Contenido del documento': 'Document content',
    'RECURSOS DOCENTES': 'TEACHING RESOURCES',
    'Organiza, reutiliza y combina preguntas para tus exámenes.': 'Organise, reuse and combine questions for your exams.',
    '＋ Nueva pregunta': '＋ New question',
    'Preguntas': 'Questions',
    'Temas': 'Topics',
    'Dificultad alta': 'Hard questions',
    'Buscar en el banco…': 'Search question bank…',
    'Buscar preguntas': 'Search questions',
    'Todos los temas': 'All topics',
    'Todas las dificultades': 'All difficulties',
    'Fácil': 'Easy',
    'Media': 'Medium',
    'Difícil': 'Hard',
    'Importar banco': 'Import bank',
    'Exportar': 'Export',
    'DISEÑO DE EVALUACIONES': 'ASSESSMENT DESIGN',
    'Genera una selección del banco y termina de editarla como un documento normal.': 'Choose questions from your bank, then edit the exam like any other document.',
    '1. Datos del examen': '1. Exam details',
    'Título': 'Title',
    'Subtítulo / asignatura': 'Subtitle / subject',
    'Economía · Convocatoria ordinaria': 'Economics · Regular exam',
    'Instrucciones': 'Instructions',
    'Seleccione una única respuesta correcta por pregunta.': 'Choose one correct answer per question.',
    'Incluir nombre y fecha del estudiante': 'Include student name and date',
    '2. Selección de preguntas': '2. Select questions',
    'Número de preguntas': 'Number of questions',
    'Dificultad': 'Difficulty',
    'Todas': 'All',
    'Distribución por tema': 'Distribution by topic',
    'Aleatoria (todos los temas)': 'Random (all topics)',
    'Por porcentajes': 'By percentage',
    '3. Variantes y soluciones': '3. Variants and answers',
    'Mezclar preguntas': 'Shuffle questions',
    'Mezclar respuestas': 'Shuffle answers',
    'Generar solucionario como documento separado': 'Create answer key as a separate document',
    'Resumen del examen': 'Exam summary',
    '0 preguntas disponibles.': '0 available questions.',
    'Generar y abrir en el editor': 'Generate and open in editor',
    'La respuesta correcta se conserva al mezclar las opciones. Si después editas las respuestas o cambias su orden, revisa el solucionario.': 'Correct answers are preserved during shuffling. Review the answer key if you later edit or reorder options.',
    'Editor visual de ecuaciones': 'Equation editor',
    'Elige una estructura y cambia sus valores. Puedes combinar fracciones, raíces, potencias, sumatorios y símbolos.': 'Pick a structure and edit its values. Combine fractions, roots, powers, sums and symbols.',
    'Fracción': 'Fraction',
    'Raíz': 'Square root',
    'Potencia': 'Power',
    'Sumatorio': 'Sum',
    'Integral': 'Integral',
    'Símbolos': 'Symbols',
    'Expresión matemática (sintaxis guiada)': 'Maths expression (guided syntax)',
    'Vista previa de la ecuación': 'Equation preview',
    'Cancelar': 'Cancel',
    'Insertar ecuación': 'Insert equation',
    'Vista paginada · A4 / Carta': 'Page preview · A4 / Letter',
    'Vista de lectura: el texto se edita en el documento original.': 'Read-only preview. Edit text in the original document.',
    'Preparando páginas…': 'Preparing pages…',
    'Imprimir / Guardar como PDF': 'Print / Save as PDF',
    'Nueva pregunta': 'New question',
    'Editar pregunta': 'Edit question',
    'Enunciado': 'Question',
    'Tema': 'Topic',
    'Microeconomía': 'Microeconomics',
    'Marca la correcta': 'Choose the correct answer',
    'Respuestas': 'Answers',
    '＋ Añadir respuesta': '＋ Add answer',
    'Explicación (opcional)': 'Explanation (optional)',
    'Guardar pregunta': 'Save question',
    'Vista previa del PDF': 'PDF preview',
    '↓ Descargar PDF': '↓ Download PDF',
    'Insertar pregunta': 'Insert question',
    'Historial de recuperación': 'Recovery history',
    'Copias automáticas de documentos y preguntas.': 'Automatic backups of documents and questions.',
    '＋ Crear punto de recuperación': '＋ Create recovery point',
    'Las copias se guardan únicamente en este navegador. Exporta un JSON para tener una copia independiente; borrar los datos del sitio elimina las copias locales.': 'Backups are stored in this browser only. Export a JSON file for a separate copy; clearing site data also deletes local backups.',
    'Revisar preguntas importadas': 'Review imported questions',
    'Tema para asignación masiva': 'Topic for bulk assignment',
    'Dificultad para asignación masiva': 'Difficulty for bulk assignment',
    'Aplicar tema y dificultad a todas': 'Apply topic and difficulty to all',
    'También puedes asignar un tema y una dificultad diferentes a cada pregunta. Los cambios se conservan al navegar entre páginas. La asignación masiva sustituye los valores individuales.': 'You can assign a different topic and difficulty to each question. Changes are kept when switching pages. Bulk assignment replaces individual values.',
    '← Anteriores': '← Previous',
    'Siguientes →': 'Next →',
    'Importar confirmadas': 'Import selected',
    'Cerrar': 'Close',
    'Respuesta': 'Answer',
    'Marcar respuesta correcta': 'Mark correct answer',
    'Eliminar respuesta': 'Remove answer',
    'Sin fecha': 'No date',
    'Hoy': 'Today',
    'Ayer': 'Yesterday',
    'No se encontraron documentos. Prueba con otro nombre.': 'No documents found. Try another name.',
    'Todavía no hay documentos.': 'No documents yet.',
    'No hay coincidencias': 'No matches',
    'Tu banco está vacío': 'Your question bank is empty',
    'Prueba otros filtros.': 'Try different filters.',
    'Añade tu primera pregunta para empezar a crear exámenes.': 'Add your first question to start creating exams.',
    '← Anterior': '← Previous',
    'Siguiente →': 'Next →',
    'Editar': 'Edit',
    'Eliminar': 'Delete',
    'Eliminar pregunta': 'Delete question',
    '¿Eliminar esta pregunta del banco?': 'Delete this question from the bank?',
    'Mostrar más': 'Show more',
    'No se pudo exportar LaTeX: ': 'Could not export LaTeX: ',
    'Error al guardar: ': 'Save error: ',
    'Analizando…': 'Analysing…',
    'Importado': 'Imported',
    'Restaurar': 'Restore',
    'Manual': 'Manual',
    'Automática': 'Automatic',
    'Antes de restaurar': 'Before restore',
    'Cargando copias locales…': 'Loading local backups…',
    'Todavía no hay copias. Puedes crear una ahora.': 'No backups yet. You can create one now.',
    'Punto de recuperación creado.': 'Recovery point created.',
    'Copia restaurada.': 'Backup restored.',
    '100 % local · IndexedDB': '100% local · IndexedDB',
    '¿Eliminar este documento?': 'Delete this document?',
    'Documento eliminado.': 'Document deleted.',
    'Sitúa el cursor dentro del texto de la lista.': 'Place the cursor inside the list.',
    'Selecciona una viñeta antes de cambiar el nivel.': 'Select a bullet before changing its level.',
    'Expresión no admitida: usa los botones de estructura y símbolos habituales.': 'Unsupported expression. Use the provided structures and symbols.',
    'Expresión matemática no admitida.': 'Unsupported maths expression.',
    'Número de filas (1–30)': 'Number of rows (1–30)',
    'Número de columnas (1–10)': 'Number of columns (1–10)',
    'Usa una imagen PNG o JPEG de hasta 3 MB.': 'Use a PNG or JPEG image up to 3 MB.',
    'Se necesitan al menos dos respuestas.': 'At least two answers are required.',
    'Máximo 10 respuestas.': 'Maximum 10 answers.',
    'Completa todos los campos y marca una respuesta correcta.': 'Complete all fields and select the correct answer.',
    'Las respuestas no pueden estar duplicadas.': 'Duplicate answers are not allowed.',
    'Pregunta guardada.': 'Question saved.',
    'Aún no hay preguntas en el banco.': 'There are no questions in the bank yet.',
    'No hay temas disponibles.': 'No topics available.',
    'Total de preguntas': 'Total questions',
    'Solucionario': 'Answer key',
    'Sí': 'Yes',
    'No': 'No',
    'Examen generado. Si cambias el orden o las respuestas manualmente, revisa el solucionario.': 'Exam created. Review the answer key if you manually reorder questions or answers.',
    'Examen tipo test': 'Multiple-choice exam',
    'Nombre y apellidos:': 'Full name:',
    'Fecha:': 'Date:',
    'Cerrar pestaña (el documento queda guardado en el espacio de trabajo)': 'Close tab (the document stays in your workspace)',
    'Nombre de archivo (.folio)': 'Filename (.folio)',
    'Documento superior a 15 MB.': 'Document exceeds 15 MB.',
    'Documento .folio no válido': 'Invalid .folio document',
    'Formato no compatible: importa .folio, .html o .txt': 'Unsupported format: import .folio, .html or .txt',
    'Archivo de copia inválido.': 'Invalid backup file.',
    '¿Reemplazar los documentos y preguntas actuales con esta copia?': 'Replace current documents and questions with this backup?',
    'Respuesta no identificada: selecciona una opción.': 'Answer not identified: select an option.',
    'Incluir esta pregunta': 'Include this question',
    'Respuesta confirmada manualmente': 'Answer confirmed manually',
    'Indica un tema para la asignación masiva.': 'Enter a topic for bulk assignment.',
    'Dificultad no válida.': 'Invalid difficulty.',
    'El archivo supera 32 MB.': 'File exceeds 32 MB.',
    'Formato JSON de Folio no válido.': 'Invalid Folio JSON format.',
    'Operación de recuperación no admitida': 'Unsupported recovery action',
    'No se ha confirmado el guardado en IndexedDB. Exporta una copia.': 'The workspace could not be saved to IndexedDB. Export a backup.',
    'No se pudo exportar LaTeX: ': 'Could not export LaTeX: ',
    'No se pudo crear la vista paginada: ': 'Could not generate page preview: ',
    'No se encontraron preguntas con opciones reconocibles. ': 'No questions with recognisable answers were found. ',
    'No se encontraron preguntas con opciones reconocibles.': 'No questions with recognisable answers were found.',
    'Error al guardar: ': 'Save error: ',
    'Almacenamiento IndexedDB no disponible: ': 'IndexedDB storage unavailable: ',
    'Sin fecha': 'No date',
    'No se pudo iniciar': 'Could not start',
    'No se ha encontrado una respuesta marcada inequívocamente. Revisión necesaria.': 'No unambiguous answer was marked. Review required.',
    'Marcas contradictorias: confirma manualmente': 'Conflicting markings: confirm manually',
    'Negrita distintiva': 'Distinctive bold formatting',
    'Color distintivo': 'Distinctive colour',
    'Resaltado': 'Highlight',
    'Símbolo de respuesta correcta': 'Correct-answer symbol',
    'Marca gráfica': 'Visual marking',
    'Subrayado distintivo': 'Distinctive underline',
    'Clave explícita del documento': 'Explicit answer key in document',

  };

  const dynamicTranslations = [
    [/^(\d+) preguntas disponibles con los filtros actuales\.$/,
      ([, count]) => `${count} questions available with the current filters.`],
    [/^Revisa el tema y la dificultad de la pregunta (\d+)\.$/,
      ([, count]) => `Review the topic and difficulty of question ${count}.`],
    [/^Porcentaje de (.+)$/, ([, topic]) => `Percentage for ${topic}`],
    [/^Tema de la pregunta (\d+)$/, ([, count]) => `Topic for question ${count}`],
    [/^Dificultad de la pregunta (\d+)$/, ([, count]) => `Difficulty for question ${count}`],
    [/^Hay (\d+) preguntas disponibles; necesitas (\d+)\.$/,
      ([, count, required]) => `${count} questions available; ${required} required.`],
    [/^Indica entre 1 y 500 preguntas\.$/, () => 'Choose between 1 and 500 questions.'],
    [/^Los porcentajes deben sumar 100 %\. Suma actual: (\d+) %\.$/,
      ([, total]) => `Percentages must add up to 100%. Current total: ${total}%.`],
    [/^(.+): necesitas (\d+) preguntas y hay (\d+)\.$/,
      ([, topic, required, available]) => `${topic}: ${required} required, ${available} available.`],
    [/^(.+) preguntas detectadas$/, ([, count]) => `${count} questions found`],
    [/^(\d+) palabras$/, ([, count]) => `${count} words`],
    [/^(\d+) respuestas$/, ([, count]) => `${count} answers`],
    [/^(\d+) preguntas disponibles\.$/, ([, count]) => `${count} available questions.`],
    [/^(\d+) páginas? en vista paginada$/, ([, count]) => `${count} ${count === '1' ? 'page' : 'pages'} in page preview`],
    [/^Mostrar más \((\d+) restantes\)$/, ([, count]) => `Show more (${count} remaining)`],
    [/^(\d+) copias en IndexedDB de este navegador · se conservan hasta 24$/, ([, count]) => `${count} backups in this browser · up to 24 kept`],
    [/^(\d+) preguntas detectadas · (\d+) con respuesta propuesta · (\d+) pendientes\.(.*)$/,
      ([, found, selected, missing, warning]) => `${found} questions found · ${selected} suggested answers · ${missing} to review.${warning}`],
    [/^(\d+) preguntas importadas · (\d+) omitidas\.$/, ([, count, omitted]) => `${count} imported questions · ${omitted} skipped.`],
    [/^Preguntas (\d+)[–-](\d+)$/, ([, first, last]) => `Questions ${first}–${last}`],
    [/^(\d+)[–-](\d+) de (\d+)$/, ([, first, last, total]) => `${first}–${last} of ${total}`],
    [/^(\d+) páginas? · (A4|Carta) · (horizontal|vertical)$/, ([, count, paper, orientation]) => `${count} ${count === '1' ? 'page' : 'pages'} · ${paper === 'Carta' ? 'Letter' : paper} · ${orientation === 'horizontal' ? 'landscape' : 'portrait'}`],
    [/^Hoy · (.+)$/, ([, time]) => `Today · ${time}`],
    [/^Ayer · (.+)$/, ([, time]) => `Yesterday · ${time}`],
    [/^Usado: (.+)$/, ([, date]) => `Opened: ${date}`],
    [/^Modificado: (.+)$/, ([, date]) => `Edited: ${date}`],
    [/^Tema y dificultad aplicados a (\d+) preguntas\. Puedes personalizarlos individualmente\.$/,
      ([, count]) => `Topic and difficulty applied to ${count} questions. You can customise each one.`]
  ];

  const nodeHistory = new WeakMap();
  const attributeHistory = new WeakMap();
  const attributes = ['placeholder', 'title', 'aria-label'];
  const ignored = '#editor, #pagesContent, #pdfContent, .question-main h3, .qanswers, .docitem-name, .docitem-meta, .import-item .questiontext, .import-item .import-option, .import-question-text, .import-option-text, #topicFilter option:not(:first-child), #topicList option, [data-no-translate], [contenteditable], script, style, svg, pre, code';

  function savedLanguage() {
    try {
      const saved = localStorage.getItem(preferenceKey);
      if (saved === 'es' || saved === 'en') return saved;
    } catch { /* Private browsing may disable localStorage. */ }
    return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  }

  let language = savedLanguage();

  function translate(source) {
    if (language !== 'en') return source;
    if (Object.hasOwn(english, source)) return english[source];
    for (const [key, value] of Object.entries(english)) {
      if (key.endsWith(': ') && source.startsWith(key)) return value + source.slice(key.length);
    }
    for (const [pattern, convert] of dynamicTranslations) {
      const match = source.match(pattern);
      if (match) return convert(match);
    }
    return source;
  }

  function excluded(element) {
    return element?.closest(ignored);
  }

  function translateText(node) {
    if (!node.parentElement || excluded(node.parentElement)) return;
    const current = node.nodeValue;
    if (!current?.trim()) return;
    const previous = nodeHistory.get(node);
    const source = previous && previous.output === current ? previous.source : current;
    const trimmed = source.trim();
    const translated = translate(trimmed);
    const output = source.replace(trimmed, translated);
    nodeHistory.set(node, { source, output });
    if (current !== output) node.nodeValue = output;
  }

  function translateAttributes(element) {
    if (excluded(element)) return;
    let record = attributeHistory.get(element);
    if (!record) { record = new Map(); attributeHistory.set(element, record); }
    for (const name of attributes) {
      const current = element.getAttribute(name);
      if (!current) continue;
      const prior = record.get(name);
      const source = prior?.output === current ? prior.source : current;
      const output = translate(source);
      record.set(name, { source, output });
      if (output !== current) element.setAttribute(name, output);
    }
  }

  function apply(root = document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && excluded(root)) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === Node.TEXT_NODE) translateText(walker.currentNode);
      else translateAttributes(walker.currentNode);
    }
  }

  function setLanguage(nextLanguage) {
    if (nextLanguage !== 'es' && nextLanguage !== 'en') return;
    language = nextLanguage;
    try { localStorage.setItem(preferenceKey, language); } catch { /* Optional. */ }
    document.documentElement.lang = language;
    const editor = document.getElementById('editor');
    if (editor) editor.lang = language;
    document.title = language === 'en' ? 'Folio Web 1.0 · Documents and exams' : 'Folio Web 1.0 · Documentos y exámenes';
    const switcher = document.getElementById('languageSwitch');
    if (switcher) switcher.value = language;
    apply();
    document.dispatchEvent(new CustomEvent('folio:languagechange', { detail: { language } }));
  }

  function initialise() {
    const switcher = document.getElementById('languageSwitch');
    if (switcher) {
      switcher.value = language;
      switcher.addEventListener('change', () => setLanguage(switcher.value));
    }
    document.documentElement.lang = language;
    const editor = document.getElementById('editor');
    if (editor) editor.lang = language;
    document.title = language === 'en' ? 'Folio Web 1.0 · Documents and exams' : 'Folio Web 1.0 · Documentos y exámenes';
    apply();
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target);
        else for (const node of record.addedNodes) apply(node);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  return { t: translate, apply, initialise, setLanguage, get language() { return language; } };
})();

if (typeof module !== 'undefined') module.exports = FolioI18n;
if (typeof document !== 'undefined') FolioI18n.initialise();
