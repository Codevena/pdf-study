# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Start dev server (Vite + Electron with hot reload)
npm run build            # Production build (outputs to ./release/)

# Testing
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage (v8)

# Individual build steps
npm run build:main       # Compile main process (TypeScript)
npm run build:preload    # Bundle preload script (esbuild)
npm run build:vite       # Build renderer (Vite)
```

## Architecture

### Electron Process Model

Three distinct contexts with type-safe IPC communication:

**Main Process** (`src/main/`)
- `index.ts` - App lifecycle, window management, custom `local-pdf://` protocol
- `ipc-handlers.ts` - All IPC handlers (~1400 lines, single file pattern)
- `database/index.ts` - Schema with migrations, `queries.ts` for CRUD
- `pdf/extractor.ts` - PDF.js text extraction, `ocr.ts` - Tesseract.js with workers
- `flashcards/fsrs.ts` - FSRS v4.5 scheduling algorithm

**Preload** (`src/preload/index.ts`)
- Context-isolated bridge exposing `window.electronAPI`
- Type declarations for all IPC methods at bottom of file

**Renderer** (`src/renderer/`)
- Zustand store in `stores/appStore.ts` (single store pattern)
- Components organized by feature: `pdf/`, `flashcards/`, `reading/`, `layout/`

### Data Flow Pattern

```
React Component → window.electronAPI.method() → IPC Channel → ipc-handlers.ts → queries.ts → SQLite
```

### Adding New Features

1. Add IPC channel name to `src/shared/ipc-channels.ts`
2. Add query functions to `src/main/database/queries.ts`
3. Add IPC handler in `src/main/ipc-handlers.ts`
4. Add preload bridge method in `src/preload/index.ts` (implementation + type declaration)
5. Add types to `src/shared/types.ts` if needed

### Database (SQLite with better-sqlite3)

Schema defined in `src/main/database/index.ts` with inline migrations. WAL mode enabled.

**Core tables**: `pdfs`, `pdf_pages_fts` (FTS5), `bookmarks`, `notes`, `highlights`, `tags`, `recent_views`
**Flashcards**: `flashcard_decks`, `flashcards`, `flashcard_fsrs`, `flashcard_reviews`
**Reading**: `reading_sessions`, `reading_goals`
**AI**: `explanations`, `summaries`, `api_usage`

### Key Implementation Patterns

- **PDF Streaming**: Custom `local-pdf://` protocol avoids base64 encoding
- **Search Caching**: LRU cache with 60s TTL in extractor.ts
- **OCR Queue**: Background processing with cancellation, progress events
- **FSRS**: States (New/Learning/Review/Relearning), Ratings (Again/Hard/Good/Easy)
- **Highlights**: SVG overlay with percentage-based coordinates stored as JSON rects

### Keyboard Shortcuts (PDFViewer)

`←/→` pages, `+/-/0` zoom, `t` thumbnails, `n` notes, `h` highlights, `i` TOC, `e` explanations, `s` summaries, `p` presentation, `Ctrl+F` search

## Conventions

- UI text is German, code/comments in English
- Tailwind CSS for styling with dark mode support
- TypeScript strict mode enabled
