# PDF-Study

Eine leistungsstarke Desktop-Anwendung für effektives Lernen mit PDF-Dokumenten. Durchsuche, annotiere und organisiere deine PDF-Bibliothek mit Volltextsuche, Markierungen, Notizen und OCR-Unterstützung.

## Features

### Dokumentenverwaltung
- **Automatische Indexierung** - Scanne Ordner und indexiere alle PDFs automatisch
- **Volltextsuche** - Blitzschnelle Suche mit FTS5 (SQLite) und intelligenter Suchmodus
- **Tag-System** - Organisiere PDFs mit farbigen Tags
- **Kürzlich angesehen** - Schneller Zugriff auf zuletzt geöffnete Dokumente

### PDF-Viewer
- **Seitennavigation** - Tastatur-Shortcuts und Seitenübersicht mit virtualisierten Thumbnails
- **Zoom** - Stufenlose Vergrößerung/Verkleinerung
- **Inhaltsverzeichnis** - Automatische Erkennung der PDF-Struktur
- **Lesezeichen** - Markiere wichtige Seiten für schnellen Zugriff

### Annotationen
- **Textmarkierungen** - Markiere Text in verschiedenen Farben (Gelb, Grün, Blau, Pink)
- **Notizen** - Füge Notizen zu jeder Seite hinzu
- **Export** - Exportiere alle Annotationen als Markdown

### OCR (Optical Character Recognition)
- **Tesseract.js Integration** - OCR für gescannte PDFs
- **Mehrsprachig** - Unterstützung für Deutsch und Englisch
- **Hintergrundverarbeitung** - OCR läuft im Hintergrund ohne UI-Blocking

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | [Electron](https://www.electronjs.org/) 34.x |
| Frontend | [React](https://react.dev/) 18.x + [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| State Management | [Zustand](https://zustand-demo.pmnd.rs/) |
| Build Tool | [Vite](https://vitejs.dev/) |
| Datenbank | [SQLite](https://www.sqlite.org/) (better-sqlite3) mit FTS5 |
| PDF Rendering | [PDF.js](https://mozilla.github.io/pdf.js/) / react-pdf |
| OCR | [Tesseract.js](https://tesseract.projectnaptha.com/) |
| Testing | [Vitest](https://vitest.dev/) |

## Installation

### Voraussetzungen
- Node.js 18+
- npm oder yarn

### Development Setup

```bash
# Repository klonen
git clone https://github.com/Codevena/pdf-study.git
cd pdf-study

# Dependencies installieren
npm install

# Native Module rebuilden (für better-sqlite3)
npm run postinstall

# Entwicklungsserver starten
npm run dev
```

### Production Build

```bash
# Anwendung bauen
npm run build

# Ergebnis: Installer in ./release/
```

## Projektstruktur

```
src/
├── main/                 # Electron Main Process
│   ├── database/         # SQLite Queries & Schema
│   ├── pdf/              # PDF-Extraktion & OCR
│   └── ipc-handlers.ts   # IPC Event Handler
├── renderer/             # React Frontend
│   ├── components/       # UI Komponenten
│   │   ├── pdf/          # PDF Viewer
│   │   ├── library/      # PDF Bibliothek
│   │   └── ...
│   ├── stores/           # Zustand State
│   └── hooks/            # Custom Hooks
├── preload/              # Electron Preload (Security)
└── shared/               # Geteilte Types & Constants
```

## Scripts

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Startet Entwicklungsumgebung |
| `npm run build` | Erstellt Production Build |
| `npm test` | Führt Tests aus (watch mode) |
| `npm run test:run` | Führt Tests einmalig aus |
| `npm run test:coverage` | Tests mit Coverage Report |

## Keyboard Shortcuts

| Taste | Aktion |
|-------|--------|
| `←` `→` | Seite vor/zurück |
| `+` `-` | Zoom ein/aus |
| `0` | Zoom zurücksetzen |
| `Home` `End` | Erste/Letzte Seite |
| `t` | Seitenübersicht |
| `n` | Notizen-Sidebar |
| `h` | Markierungen-Sidebar |
| `i` | Inhaltsverzeichnis |
| `Esc` | Sidebar schließen |

## Performance-Optimierungen

- **Virtualisierte Listen** - Nur sichtbare Elemente werden gerendert
- **Batch-Loading** - Reduzierte IPC-Aufrufe durch gebündelte Anfragen
- **Search Caching** - LRU-Cache für Suchergebnisse
- **SVG Highlights** - Effizientes Rendering von Markierungen
- **Lazy Loading** - PDF-Daten werden bei Bedarf geladen

## Lizenz

MIT License - siehe [LICENSE](LICENSE) für Details.
