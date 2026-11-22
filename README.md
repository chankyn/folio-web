# Folio Web

A browser-based document editor and question bank for teachers. Available in English and Spanish.

## Features

- Rich-text documents, tables, lists, equations and multiple tabs.
- Question banks with topics, difficulty levels and multiple-choice exams.
- PDF and DOCX question import, including Schoolhouse PDF markings.
- PDF printing, LaTeX export and `.folio` documents.
- Local storage, backups and JSON import/export.


## Run locally

```bash
python -m http.server 8000 --directory docs
```

Open `http://localhost:8000`.

## Tests

```bash
npm test
npm run test:import
```

Documents and questions are stored in your browser. Export backups regularly. PDF output uses the browser's **Print → Save as PDF** feature.
