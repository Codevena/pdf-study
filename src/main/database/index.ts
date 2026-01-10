import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';

export type DatabaseInstance = Database.Database;

export async function initDatabase(): Promise<DatabaseInstance> {
  // Store database in user data directory
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'data');

  // Ensure directory exists
  try {
    await fs.access(dbDir);
  } catch {
    await fs.mkdir(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'pdf-study.db');
  const db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- PDFs table
    CREATE TABLE IF NOT EXISTS pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      page_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      indexed_at DATETIME,
      ocr_completed BOOLEAN DEFAULT 0
    );

    -- Full-text search virtual table
    CREATE VIRTUAL TABLE IF NOT EXISTS pdf_pages_fts USING fts5(
      pdf_id UNINDEXED,
      page_num UNINDEXED,
      content,
      tokenize='porter unicode61'
    );

    -- Tags table
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#3B82F6'
    );

    -- PDF-Tags junction table
    CREATE TABLE IF NOT EXISTS pdf_tags (
      pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (pdf_id, tag_id)
    );

    -- Bookmarks table
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
      page_num INTEGER NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(pdf_id, page_num)
    );

    -- Notes table
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
      page_num INTEGER NOT NULL,
      content TEXT NOT NULL,
      position_x REAL,
      position_y REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Recent views table
    CREATE TABLE IF NOT EXISTS recent_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
      page_num INTEGER DEFAULT 1,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(pdf_id)
    );

    -- Search history table
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      result_count INTEGER DEFAULT 0,
      searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(query)
    );

    -- Highlights table
    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
      page_num INTEGER NOT NULL,
      color TEXT DEFAULT '#FFFF00',
      text_content TEXT NOT NULL,
      start_index INTEGER NOT NULL,
      end_index INTEGER NOT NULL,
      rects TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Flashcard Decks (can be linked to PDF or global)
    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Flashcards
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
      highlight_id INTEGER REFERENCES highlights(id) ON DELETE SET NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      card_type TEXT DEFAULT 'basic',
      cloze_data TEXT,
      source_page INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FSRS v4.5 Scheduling Data
    CREATE TABLE IF NOT EXISTS flashcard_fsrs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flashcard_id INTEGER UNIQUE NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
      difficulty REAL DEFAULT 0,
      stability REAL DEFAULT 0,
      retrievability REAL DEFAULT 1,
      state INTEGER DEFAULT 0,
      due DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_review DATETIME,
      reps INTEGER DEFAULT 0,
      lapses INTEGER DEFAULT 0,
      scheduled_days INTEGER DEFAULT 0,
      elapsed_days INTEGER DEFAULT 0
    );

    -- Flashcard Review History
    CREATE TABLE IF NOT EXISTS flashcard_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flashcard_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      scheduled_days INTEGER,
      elapsed_days INTEGER,
      state INTEGER
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_pdfs_file_path ON pdfs(file_path);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_pdf ON bookmarks(pdf_id);
    CREATE INDEX IF NOT EXISTS idx_notes_pdf_page ON notes(pdf_id, page_num);
    CREATE INDEX IF NOT EXISTS idx_highlights_pdf_page ON highlights(pdf_id, page_num);
    CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id);
    CREATE INDEX IF NOT EXISTS idx_flashcard_fsrs_due ON flashcard_fsrs(due);
    CREATE INDEX IF NOT EXISTS idx_flashcard_fsrs_state ON flashcard_fsrs(state);
    CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_card ON flashcard_reviews(flashcard_id);
  `);

  // Run migrations for existing databases
  runMigrations(db);

  return db;
}

function runMigrations(db: DatabaseInstance): void {
  // Check if rects column exists in highlights table
  const columns = db.prepare("PRAGMA table_info(highlights)").all() as { name: string }[];
  const hasRectsColumn = columns.some(col => col.name === 'rects');

  if (!hasRectsColumn) {
    console.log('Running migration: Adding rects column to highlights table');
    db.exec('ALTER TABLE highlights ADD COLUMN rects TEXT');
  }
}
