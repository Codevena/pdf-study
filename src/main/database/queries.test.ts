import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { DatabaseInstance } from './index';
import * as queries from './queries';

describe('Database Queries', () => {
  let db: DatabaseInstance;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Initialize schema
    db.exec(`
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

      CREATE VIRTUAL TABLE IF NOT EXISTS pdf_pages_fts USING fts5(
        pdf_id UNINDEXED,
        page_num UNINDEXED,
        content,
        tokenize='porter unicode61'
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#3B82F6'
      );

      CREATE TABLE IF NOT EXISTS pdf_tags (
        pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (pdf_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pdf_id INTEGER REFERENCES pdfs(id) ON DELETE CASCADE,
        page_num INTEGER NOT NULL,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pdf_id, page_num)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe('PDF Operations', () => {
    it('should insert and retrieve a PDF', () => {
      const pdfId = queries.insertPdf(db, {
        filePath: '/test/book.pdf',
        fileName: 'book.pdf',
        fileHash: 'abc123',
        pageCount: 100,
      });

      expect(pdfId).toBe(1);

      const pdf = queries.getPdfById(db, pdfId);
      expect(pdf).toBeDefined();
      expect(pdf?.fileName).toBe('book.pdf');
      expect(pdf?.pageCount).toBe(100);
    });

    it('should get PDF by path', () => {
      queries.insertPdf(db, {
        filePath: '/test/book.pdf',
        fileName: 'book.pdf',
        fileHash: 'abc123',
        pageCount: 50,
      });

      const pdf = queries.getPdfByPath(db, '/test/book.pdf');
      expect(pdf).toBeDefined();
      expect(pdf?.filePath).toBe('/test/book.pdf');
    });

    it('should return all PDFs sorted by name', () => {
      queries.insertPdf(db, { filePath: '/z.pdf', fileName: 'z.pdf', fileHash: 'z', pageCount: 1 });
      queries.insertPdf(db, { filePath: '/a.pdf', fileName: 'a.pdf', fileHash: 'a', pageCount: 1 });
      queries.insertPdf(db, { filePath: '/m.pdf', fileName: 'm.pdf', fileHash: 'm', pageCount: 1 });

      const pdfs = queries.getAllPdfs(db);
      expect(pdfs).toHaveLength(3);
      expect(pdfs[0].fileName).toBe('a.pdf');
      expect(pdfs[1].fileName).toBe('m.pdf');
      expect(pdfs[2].fileName).toBe('z.pdf');
    });

    it('should delete a PDF and its content', () => {
      const pdfId = queries.insertPdf(db, {
        filePath: '/test/book.pdf',
        fileName: 'book.pdf',
        fileHash: 'abc123',
        pageCount: 10,
      });

      queries.insertPageContent(db, pdfId, 1, 'Test content page 1');
      queries.insertPageContent(db, pdfId, 2, 'Test content page 2');

      queries.deletePdf(db, pdfId);

      const pdf = queries.getPdfById(db, pdfId);
      expect(pdf).toBeUndefined();
    });
  });

  describe('Full-Text Search', () => {
    beforeEach(() => {
      // Create test PDFs with content
      const pdf1 = queries.insertPdf(db, {
        filePath: '/linux-book.pdf',
        fileName: 'Linux Handbuch.pdf',
        fileHash: 'linux1',
        pageCount: 3,
      });
      queries.insertPageContent(db, pdf1, 1, 'Linux ist ein freies Betriebssystem');
      queries.insertPageContent(db, pdf1, 2, 'Der Linux Kernel wurde von Linus Torvalds entwickelt');

      const pdf2 = queries.insertPdf(db, {
        filePath: '/python-book.pdf',
        fileName: 'Python Programmierung.pdf',
        fileHash: 'python1',
        pageCount: 2,
      });
      queries.insertPageContent(db, pdf2, 1, 'Python ist eine interpretierte Programmiersprache');
    });

    it('should find results with exact search', () => {
      const results = queries.search(db, 'Linux Kernel', 100, 'exact');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].fileName).toBe('Linux Handbuch.pdf');
    });

    it('should find results with fuzzy search', () => {
      const results = queries.search(db, 'Lin', 100, 'fuzzy');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find results with intelligent search', () => {
      const results = queries.search(db, 'python programmier', 100, 'intelligent');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].fileName).toBe('Python Programmierung.pdf');
    });

    it('should return empty array for empty query', () => {
      const results = queries.search(db, '   ', 100, 'intelligent');
      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', () => {
      const results = queries.search(db, 'ist', 1, 'intelligent');
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Tag Operations', () => {
    it('should create and retrieve tags', () => {
      const tagId = queries.createTag(db, 'Wichtig', '#FF0000');
      expect(tagId).toBeGreaterThan(0);

      const tags = queries.getAllTags(db);
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('Wichtig');
      expect(tags[0].color).toBe('#FF0000');
    });

    it('should assign and retrieve tags for a PDF', () => {
      const pdfId = queries.insertPdf(db, {
        filePath: '/test.pdf',
        fileName: 'test.pdf',
        fileHash: 'test',
        pageCount: 1,
      });
      const tagId = queries.createTag(db, 'Lernen', '#00FF00');

      queries.addTagToPdf(db, pdfId, tagId);

      const pdfTags = queries.getPdfTags(db, pdfId);
      expect(pdfTags).toHaveLength(1);
      expect(pdfTags[0].name).toBe('Lernen');
    });

    it('should remove tag from PDF', () => {
      const pdfId = queries.insertPdf(db, {
        filePath: '/test.pdf',
        fileName: 'test.pdf',
        fileHash: 'test',
        pageCount: 1,
      });
      const tagId = queries.createTag(db, 'Test', '#0000FF');
      queries.addTagToPdf(db, pdfId, tagId);

      queries.removeTagFromPdf(db, pdfId, tagId);

      const pdfTags = queries.getPdfTags(db, pdfId);
      expect(pdfTags).toHaveLength(0);
    });
  });

  describe('Bookmark Operations', () => {
    it('should add and retrieve bookmarks', () => {
      const pdfId = queries.insertPdf(db, {
        filePath: '/test.pdf',
        fileName: 'test.pdf',
        fileHash: 'test',
        pageCount: 100,
      });

      const bookmarkId = queries.addBookmark(db, pdfId, 42, 'Wichtige Seite');
      expect(bookmarkId).toBeGreaterThan(0);

      const bookmarks = queries.getBookmarks(db, pdfId);
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].pageNum).toBe(42);
      expect(bookmarks[0].title).toBe('Wichtige Seite');
    });

    it('should remove bookmarks', () => {
      const pdfId = queries.insertPdf(db, {
        filePath: '/test.pdf',
        fileName: 'test.pdf',
        fileHash: 'test',
        pageCount: 100,
      });

      queries.addBookmark(db, pdfId, 10, 'Test');
      queries.removeBookmark(db, pdfId, 10);

      const bookmarks = queries.getBookmarks(db, pdfId);
      expect(bookmarks).toHaveLength(0);
    });
  });

  describe('Settings', () => {
    it('should save and retrieve settings', () => {
      queries.setSetting(db, 'theme', 'dark');
      queries.setSetting(db, 'pdfFolder', '/home/user/books');

      expect(queries.getSetting(db, 'theme')).toBe('dark');
      expect(queries.getSetting(db, 'pdfFolder')).toBe('/home/user/books');
    });

    it('should return null for non-existent setting', () => {
      expect(queries.getSetting(db, 'nonexistent')).toBeNull();
    });

    it('should update existing setting', () => {
      queries.setSetting(db, 'theme', 'light');
      queries.setSetting(db, 'theme', 'dark');

      expect(queries.getSetting(db, 'theme')).toBe('dark');
    });
  });
});
