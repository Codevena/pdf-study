import type { DatabaseInstance } from './index';
import type { PDFDocument, SearchResult, Tag, Bookmark, Note, Highlight, HighlightRect } from '../../shared/types';

// PDF Queries
export function getAllPdfs(db: DatabaseInstance): PDFDocument[] {
  return db.prepare(`
    SELECT id, file_path as filePath, file_name as fileName, file_hash as fileHash,
           page_count as pageCount, indexed_at as indexedAt, ocr_completed as ocrCompleted
    FROM pdfs
    ORDER BY file_name
  `).all() as PDFDocument[];
}

export function getPdfById(db: DatabaseInstance, id: number): PDFDocument | undefined {
  return db.prepare(`
    SELECT id, file_path as filePath, file_name as fileName, file_hash as fileHash,
           page_count as pageCount, indexed_at as indexedAt, ocr_completed as ocrCompleted
    FROM pdfs WHERE id = ?
  `).get(id) as PDFDocument | undefined;
}

export function getPdfByPath(db: DatabaseInstance, filePath: string): PDFDocument | undefined {
  return db.prepare(`
    SELECT id, file_path as filePath, file_name as fileName, file_hash as fileHash,
           page_count as pageCount, indexed_at as indexedAt, ocr_completed as ocrCompleted
    FROM pdfs WHERE file_path = ?
  `).get(filePath) as PDFDocument | undefined;
}

export function insertPdf(db: DatabaseInstance, pdf: Omit<PDFDocument, 'id' | 'indexedAt' | 'ocrCompleted'>): number {
  const result = db.prepare(`
    INSERT INTO pdfs (file_path, file_name, file_hash, page_count)
    VALUES (?, ?, ?, ?)
  `).run(pdf.filePath, pdf.fileName, pdf.fileHash, pdf.pageCount);
  return result.lastInsertRowid as number;
}

export function updatePdfIndexed(db: DatabaseInstance, id: number): void {
  db.prepare(`
    UPDATE pdfs SET indexed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
}

export function updatePdfHash(db: DatabaseInstance, id: number, fileHash: string, pageCount: number): void {
  db.prepare(`
    UPDATE pdfs SET file_hash = ?, page_count = ?, indexed_at = NULL WHERE id = ?
  `).run(fileHash, pageCount, id);
}

export function deletePdf(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM pdf_pages_fts WHERE pdf_id = ?').run(id);
  db.prepare('DELETE FROM pdfs WHERE id = ?').run(id);
}

// FTS Queries
export function insertPageContent(db: DatabaseInstance, pdfId: number, pageNum: number, content: string): void {
  db.prepare(`
    INSERT INTO pdf_pages_fts (pdf_id, page_num, content)
    VALUES (?, ?, ?)
  `).run(pdfId, pageNum, content);
}

export function deletePageContent(db: DatabaseInstance, pdfId: number): void {
  db.prepare('DELETE FROM pdf_pages_fts WHERE pdf_id = ?').run(pdfId);
}

export function search(
  db: DatabaseInstance,
  query: string,
  limit: number = 100,
  mode: 'exact' | 'fuzzy' | 'intelligent' = 'intelligent'
): SearchResult[] {
  // Escape special FTS characters
  const escapedQuery = query.replace(/['"]/g, '').trim();
  if (!escapedQuery) return [];

  const terms = escapedQuery.split(/\s+/).filter(t => t.length > 0);
  let ftsQuery: string;

  switch (mode) {
    case 'exact':
      // Exact phrase match
      ftsQuery = `"${escapedQuery}"`;
      break;

    case 'fuzzy':
      // Each term with prefix matching, OR logic for more results
      ftsQuery = terms.map(term => `"${term}"*`).join(' OR ');
      break;

    case 'intelligent':
    default:
      // Intelligent search: prefix matching with OR logic
      // Also searches for variations (e.g., Linux also finds linux, LINUX)
      // FTS5 is case-insensitive by default
      if (terms.length === 1) {
        // Single term: use prefix matching
        ftsQuery = `"${terms[0]}"*`;
      } else {
        // Multiple terms: require all terms but with prefix matching
        // Use NEAR to find terms close together, falling back to AND
        ftsQuery = terms.map(term => `"${term}"*`).join(' AND ');
      }
      break;
  }

  try {
    return db.prepare(`
      SELECT
        p.id,
        p.file_name as fileName,
        p.file_path as filePath,
        fts.page_num as pageNum,
        snippet(pdf_pages_fts, 2, '<mark>', '</mark>', '...', 64) as snippet,
        bm25(pdf_pages_fts) as rank
      FROM pdf_pages_fts fts
      JOIN pdfs p ON p.id = fts.pdf_id
      WHERE pdf_pages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit) as SearchResult[];
  } catch (error) {
    console.error('Search error:', error, 'Query:', ftsQuery);
    // Fallback to simple search if FTS query fails
    const fallbackQuery = terms.map(term => `"${term}"*`).join(' OR ');
    return db.prepare(`
      SELECT
        p.id,
        p.file_name as fileName,
        p.file_path as filePath,
        fts.page_num as pageNum,
        snippet(pdf_pages_fts, 2, '<mark>', '</mark>', '...', 64) as snippet,
        bm25(pdf_pages_fts) as rank
      FROM pdf_pages_fts fts
      JOIN pdfs p ON p.id = fts.pdf_id
      WHERE pdf_pages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(fallbackQuery, limit) as SearchResult[];
  }
}

// Tag Queries
export function getAllTags(db: DatabaseInstance): Tag[] {
  return db.prepare('SELECT id, name, color FROM tags ORDER BY name').all() as Tag[];
}

export function createTag(db: DatabaseInstance, name: string, color: string = '#3B82F6'): number {
  const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name, color);
  return result.lastInsertRowid as number;
}

export function deleteTag(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}

export function addTagToPdf(db: DatabaseInstance, pdfId: number, tagId: number): void {
  db.prepare('INSERT OR IGNORE INTO pdf_tags (pdf_id, tag_id) VALUES (?, ?)').run(pdfId, tagId);
}

export function removeTagFromPdf(db: DatabaseInstance, pdfId: number, tagId: number): void {
  db.prepare('DELETE FROM pdf_tags WHERE pdf_id = ? AND tag_id = ?').run(pdfId, tagId);
}

export function getPdfTags(db: DatabaseInstance, pdfId: number): Tag[] {
  return db.prepare(`
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN pdf_tags pt ON t.id = pt.tag_id
    WHERE pt.pdf_id = ?
    ORDER BY t.name
  `).all(pdfId) as Tag[];
}

// Batch load all PDF tags in a single query (performance optimization)
export function getAllPdfTagsMap(db: DatabaseInstance): Record<number, Tag[]> {
  const rows = db.prepare(`
    SELECT pt.pdf_id as pdfId, t.id, t.name, t.color
    FROM tags t
    JOIN pdf_tags pt ON t.id = pt.tag_id
    ORDER BY t.name
  `).all() as (Tag & { pdfId: number })[];

  const result: Record<number, Tag[]> = {};
  for (const row of rows) {
    if (!result[row.pdfId]) {
      result[row.pdfId] = [];
    }
    result[row.pdfId].push({ id: row.id, name: row.name, color: row.color });
  }
  return result;
}

// Bookmark Queries
export function getBookmarks(db: DatabaseInstance, pdfId?: number): Bookmark[] {
  if (pdfId !== undefined) {
    return db.prepare(`
      SELECT id, pdf_id as pdfId, page_num as pageNum, title, created_at as createdAt
      FROM bookmarks WHERE pdf_id = ? ORDER BY page_num
    `).all(pdfId) as Bookmark[];
  }
  return db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, title, created_at as createdAt
    FROM bookmarks ORDER BY created_at DESC
  `).all() as Bookmark[];
}

export function addBookmark(db: DatabaseInstance, pdfId: number, pageNum: number, title?: string): number {
  const result = db.prepare(`
    INSERT OR REPLACE INTO bookmarks (pdf_id, page_num, title)
    VALUES (?, ?, ?)
  `).run(pdfId, pageNum, title || null);
  return result.lastInsertRowid as number;
}

export function removeBookmark(db: DatabaseInstance, pdfId: number, pageNum: number): void {
  db.prepare('DELETE FROM bookmarks WHERE pdf_id = ? AND page_num = ?').run(pdfId, pageNum);
}

// Note Queries
export function getNotes(db: DatabaseInstance, pdfId: number, pageNum?: number): Note[] {
  if (pageNum !== undefined) {
    return db.prepare(`
      SELECT id, pdf_id as pdfId, page_num as pageNum, content,
             position_x as positionX, position_y as positionY,
             created_at as createdAt, updated_at as updatedAt
      FROM notes WHERE pdf_id = ? AND page_num = ? ORDER BY created_at
    `).all(pdfId, pageNum) as Note[];
  }
  return db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, content,
           position_x as positionX, position_y as positionY,
           created_at as createdAt, updated_at as updatedAt
    FROM notes WHERE pdf_id = ? ORDER BY page_num, created_at
  `).all(pdfId) as Note[];
}

export function addNote(db: DatabaseInstance, pdfId: number, pageNum: number, content: string): number {
  const result = db.prepare(`
    INSERT INTO notes (pdf_id, page_num, content)
    VALUES (?, ?, ?)
  `).run(pdfId, pageNum, content);
  return result.lastInsertRowid as number;
}

export function updateNote(db: DatabaseInstance, id: number, content: string): void {
  db.prepare(`
    UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(content, id);
}

export function deleteNote(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
}

// Settings Queries
export function getSetting(db: DatabaseInstance, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value || null;
}

export function setSetting(db: DatabaseInstance, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// Recent Views Queries
export interface RecentView {
  pdfId: number;
  fileName: string;
  filePath: string;
  pageNum: number;
  viewedAt: string;
}

export function getRecentViews(db: DatabaseInstance, limit: number = 10): RecentView[] {
  return db.prepare(`
    SELECT
      rv.pdf_id as pdfId,
      p.file_name as fileName,
      p.file_path as filePath,
      rv.page_num as pageNum,
      rv.viewed_at as viewedAt
    FROM recent_views rv
    JOIN pdfs p ON p.id = rv.pdf_id
    ORDER BY rv.viewed_at DESC
    LIMIT ?
  `).all(limit) as RecentView[];
}

export function addRecentView(db: DatabaseInstance, pdfId: number, pageNum: number = 1): void {
  db.prepare(`
    INSERT INTO recent_views (pdf_id, page_num, viewed_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(pdf_id) DO UPDATE SET
      page_num = excluded.page_num,
      viewed_at = CURRENT_TIMESTAMP
  `).run(pdfId, pageNum);
}

export function updateRecentViewPage(db: DatabaseInstance, pdfId: number, pageNum: number): void {
  db.prepare(`
    UPDATE recent_views SET page_num = ? WHERE pdf_id = ?
  `).run(pageNum, pdfId);
}

// Search History Queries
export interface SearchHistoryItem {
  id: number;
  query: string;
  resultCount: number;
  searchedAt: string;
}

export function getSearchHistory(db: DatabaseInstance, limit: number = 10): SearchHistoryItem[] {
  return db.prepare(`
    SELECT id, query, result_count as resultCount, searched_at as searchedAt
    FROM search_history
    ORDER BY searched_at DESC
    LIMIT ?
  `).all(limit) as SearchHistoryItem[];
}

export function addSearchHistory(db: DatabaseInstance, query: string, resultCount: number): void {
  db.prepare(`
    INSERT INTO search_history (query, result_count, searched_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(query) DO UPDATE SET
      result_count = excluded.result_count,
      searched_at = CURRENT_TIMESTAMP
  `).run(query.trim(), resultCount);
}

export function deleteSearchHistoryItem(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM search_history WHERE id = ?').run(id);
}

export function clearSearchHistory(db: DatabaseInstance): void {
  db.prepare('DELETE FROM search_history').run();
}

// OCR Queries
export function markPdfOcrCompleted(db: DatabaseInstance, pdfId: number): void {
  db.prepare('UPDATE pdfs SET ocr_completed = 1 WHERE id = ?').run(pdfId);
}

export function getPdfsNeedingOCR(db: DatabaseInstance): PDFDocument[] {
  return db.prepare(`
    SELECT id, file_path as filePath, file_name as fileName, file_hash as fileHash,
           page_count as pageCount, indexed_at as indexedAt, ocr_completed as ocrCompleted
    FROM pdfs
    WHERE ocr_completed = 0 AND indexed_at IS NOT NULL
    ORDER BY created_at
  `).all() as PDFDocument[];
}

export function getPageContent(db: DatabaseInstance, pdfId: number, pageNum: number): string | null {
  const row = db.prepare(`
    SELECT content FROM pdf_pages_fts WHERE pdf_id = ? AND page_num = ?
  `).get(pdfId, pageNum) as { content: string } | undefined;
  return row?.content || null;
}

export function updatePageContent(db: DatabaseInstance, pdfId: number, pageNum: number, content: string): void {
  // Delete existing content first, then insert new
  db.prepare('DELETE FROM pdf_pages_fts WHERE pdf_id = ? AND page_num = ?').run(pdfId, pageNum);
  db.prepare(`
    INSERT INTO pdf_pages_fts (pdf_id, page_num, content)
    VALUES (?, ?, ?)
  `).run(pdfId, pageNum, content);
}

export function resetAllOcrCompleted(db: DatabaseInstance): void {
  db.prepare('UPDATE pdfs SET ocr_completed = 0').run();
}

// Highlight Queries
interface HighlightRow {
  id: number;
  pdfId: number;
  pageNum: number;
  color: string;
  textContent: string;
  rects: string | null;
  createdAt: string;
}

function parseHighlightRow(row: HighlightRow): Highlight {
  return {
    ...row,
    rects: row.rects ? JSON.parse(row.rects) : [],
  };
}

export function getHighlights(db: DatabaseInstance, pdfId: number, pageNum?: number): Highlight[] {
  if (pageNum !== undefined) {
    const rows = db.prepare(`
      SELECT id, pdf_id as pdfId, page_num as pageNum, color, text_content as textContent,
             rects, created_at as createdAt
      FROM highlights
      WHERE pdf_id = ? AND page_num = ?
      ORDER BY created_at
    `).all(pdfId, pageNum) as HighlightRow[];
    return rows.map(parseHighlightRow);
  }
  const rows = db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, color, text_content as textContent,
           rects, created_at as createdAt
    FROM highlights
    WHERE pdf_id = ?
    ORDER BY page_num, created_at
  `).all(pdfId) as HighlightRow[];
  return rows.map(parseHighlightRow);
}

export function addHighlight(
  db: DatabaseInstance,
  pdfId: number,
  pageNum: number,
  color: string,
  textContent: string,
  rects: HighlightRect[]
): number {
  const result = db.prepare(`
    INSERT INTO highlights (pdf_id, page_num, color, text_content, rects, start_index, end_index)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `).run(pdfId, pageNum, color, textContent, JSON.stringify(rects));
  return Number(result.lastInsertRowid);
}

export function updateHighlightColor(db: DatabaseInstance, id: number, color: string): void {
  db.prepare('UPDATE highlights SET color = ? WHERE id = ?').run(color, id);
}

export function deleteHighlight(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM highlights WHERE id = ?').run(id);
}
