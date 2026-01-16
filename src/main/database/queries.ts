import type { DatabaseInstance } from './index';
import type { PDFDocument, SearchResult, Tag, Bookmark, Note, Highlight, HighlightRect, Explanation, ExplanationStyle, Summary } from '../../shared/types';

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

export function getPdfByFileName(db: DatabaseInstance, fileName: string): PDFDocument | undefined {
  return db.prepare(`
    SELECT id, file_path as filePath, file_name as fileName, file_hash as fileHash,
           page_count as pageCount, indexed_at as indexedAt, ocr_completed as ocrCompleted
    FROM pdfs WHERE LOWER(file_name) = LOWER(?)
  `).get(fileName) as PDFDocument | undefined;
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
interface NoteRow {
  id: number;
  pdfId: number;
  pageNum: number;
  content: string;
  positionX: number | null;
  positionY: number | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseNoteRow(row: NoteRow): Note {
  let tags: string[] = [];
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags);
    } catch {
      console.warn(`Failed to parse note tags for id ${row.id}`);
    }
  }
  return { ...row, tags };
}

export function getNotes(db: DatabaseInstance, pdfId: number, pageNum?: number): Note[] {
  if (pageNum !== undefined) {
    const rows = db.prepare(`
      SELECT id, pdf_id as pdfId, page_num as pageNum, content,
             position_x as positionX, position_y as positionY, tags,
             created_at as createdAt, updated_at as updatedAt
      FROM notes WHERE pdf_id = ? AND page_num = ? ORDER BY created_at
    `).all(pdfId, pageNum) as NoteRow[];
    return rows.map(parseNoteRow);
  }
  const rows = db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, content,
           position_x as positionX, position_y as positionY, tags,
           created_at as createdAt, updated_at as updatedAt
    FROM notes WHERE pdf_id = ? ORDER BY page_num, created_at
  `).all(pdfId) as NoteRow[];
  return rows.map(parseNoteRow);
}

export function addNote(db: DatabaseInstance, pdfId: number, pageNum: number, content: string): number {
  const result = db.prepare(`
    INSERT INTO notes (pdf_id, page_num, content, tags)
    VALUES (?, ?, ?, '[]')
  `).run(pdfId, pageNum, content);
  return result.lastInsertRowid as number;
}

export function updateNote(db: DatabaseInstance, id: number, content: string): void {
  db.prepare(`
    UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(content, id);
}

export function updateNoteTags(db: DatabaseInstance, id: number, tags: string[]): void {
  db.prepare(`
    UPDATE notes SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(JSON.stringify(tags), id);
}

export function deleteNote(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
}

export function getNoteById(db: DatabaseInstance, id: number): Note | null {
  const row = db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, content,
           position_x as positionX, position_y as positionY, tags,
           created_at as createdAt, updated_at as updatedAt
    FROM notes WHERE id = ?
  `).get(id) as NoteRow | undefined;
  return row ? parseNoteRow(row) : null;
}

export function getAllNoteTags(db: DatabaseInstance): string[] {
  const rows = db.prepare(`SELECT DISTINCT tags FROM notes WHERE tags IS NOT NULL AND tags != '[]'`).all() as { tags: string }[];
  const allTags = new Set<string>();
  for (const row of rows) {
    try {
      const tags = JSON.parse(row.tags) as string[];
      tags.forEach(tag => allTags.add(tag));
    } catch {
      // Skip invalid JSON
    }
  }
  return Array.from(allTags).sort();
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
  let rects: Highlight['rects'] = [];
  if (row.rects) {
    try {
      rects = JSON.parse(row.rects);
    } catch {
      console.warn(`Failed to parse highlight rects for id ${row.id}`);
    }
  }
  return { ...row, rects };
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

// AI Outline Queries
export function getAiOutline(db: DatabaseInstance, pdfId: number): string | null {
  const result = db.prepare(`
    SELECT outline_json FROM pdf_ai_outlines WHERE pdf_id = ?
  `).get(pdfId) as { outline_json: string } | undefined;
  return result?.outline_json ?? null;
}

export function saveAiOutline(db: DatabaseInstance, pdfId: number, outlineJson: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO pdf_ai_outlines (pdf_id, outline_json, created_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(pdfId, outlineJson);
}

export function deleteAiOutline(db: DatabaseInstance, pdfId: number): void {
  db.prepare('DELETE FROM pdf_ai_outlines WHERE pdf_id = ?').run(pdfId);
}

// API Usage / Cost Tracking Queries
export interface ApiUsageRecord {
  id: number;
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  createdAt: string;
}

export interface ApiUsageStats {
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
  costByModel: Record<string, number>;
  costByOperation: Record<string, number>;
  recentUsage: ApiUsageRecord[];
}

export function addApiUsage(
  db: DatabaseInstance,
  model: string,
  operation: string,
  promptTokens: number,
  completionTokens: number,
  costUsd: number
): void {
  db.prepare(`
    INSERT INTO api_usage (model, operation, prompt_tokens, completion_tokens, total_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(model, operation, promptTokens, completionTokens, promptTokens + completionTokens, costUsd);
}

export function getApiUsageStats(db: DatabaseInstance): ApiUsageStats {
  // Get totals
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0) as totalCostUsd,
      COALESCE(SUM(total_tokens), 0) as totalTokens,
      COUNT(*) as callCount
    FROM api_usage
  `).get() as { totalCostUsd: number; totalTokens: number; callCount: number };

  // Get cost by model
  const byModel = db.prepare(`
    SELECT model, SUM(cost_usd) as cost
    FROM api_usage
    GROUP BY model
  `).all() as { model: string; cost: number }[];

  const costByModel: Record<string, number> = {};
  for (const row of byModel) {
    costByModel[row.model] = row.cost;
  }

  // Get cost by operation
  const byOperation = db.prepare(`
    SELECT operation, SUM(cost_usd) as cost
    FROM api_usage
    GROUP BY operation
  `).all() as { operation: string; cost: number }[];

  const costByOperation: Record<string, number> = {};
  for (const row of byOperation) {
    costByOperation[row.operation] = row.cost;
  }

  // Get recent usage (last 20)
  const recentUsage = db.prepare(`
    SELECT
      id, model, operation,
      prompt_tokens as promptTokens,
      completion_tokens as completionTokens,
      total_tokens as totalTokens,
      cost_usd as costUsd,
      created_at as createdAt
    FROM api_usage
    ORDER BY created_at DESC
    LIMIT 20
  `).all() as ApiUsageRecord[];

  return {
    totalCostUsd: totals.totalCostUsd,
    totalTokens: totals.totalTokens,
    callCount: totals.callCount,
    costByModel,
    costByOperation,
    recentUsage,
  };
}

export function clearApiUsage(db: DatabaseInstance): void {
  db.prepare('DELETE FROM api_usage').run();
}

// =============================================================================
// Batch Queries for Export (Prevent N+1)
// =============================================================================

/**
 * Get all bookmarks grouped by PDF ID.
 * Single query instead of N queries for N PDFs.
 */
export function getAllBookmarksGrouped(db: DatabaseInstance): Map<number, Bookmark[]> {
  const rows = db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, title, created_at as createdAt
    FROM bookmarks
    ORDER BY pdf_id, created_at DESC
  `).all() as Bookmark[];

  const grouped = new Map<number, Bookmark[]>();
  for (const row of rows) {
    const existing = grouped.get(row.pdfId) || [];
    existing.push(row);
    grouped.set(row.pdfId, existing);
  }
  return grouped;
}

/**
 * Get all notes grouped by PDF ID.
 * Single query instead of N queries for N PDFs.
 */
export function getAllNotesGrouped(db: DatabaseInstance): Map<number, Note[]> {
  const rows = db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, content,
           position_x as positionX, position_y as positionY,
           created_at as createdAt, updated_at as updatedAt
    FROM notes
    ORDER BY pdf_id, page_num, created_at
  `).all() as Note[];

  const grouped = new Map<number, Note[]>();
  for (const row of rows) {
    const existing = grouped.get(row.pdfId) || [];
    existing.push(row);
    grouped.set(row.pdfId, existing);
  }
  return grouped;
}

/**
 * Get all highlights grouped by PDF ID.
 * Single query instead of N queries for N PDFs.
 */
export function getAllHighlightsGrouped(db: DatabaseInstance): Map<number, Highlight[]> {
  const rows = db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, color, text_content as textContent,
           rects, created_at as createdAt
    FROM highlights
    ORDER BY pdf_id, page_num, created_at
  `).all() as HighlightRow[];

  const grouped = new Map<number, Highlight[]>();
  for (const row of rows) {
    const highlight = parseHighlightRow(row);
    const existing = grouped.get(highlight.pdfId) || [];
    existing.push(highlight);
    grouped.set(highlight.pdfId, existing);
  }
  return grouped;
}

export interface BatchExportData {
  bookmarksByPdf: Map<number, Bookmark[]>;
  notesByPdf: Map<number, Note[]>;
  highlightsByPdf: Map<number, Highlight[]>;
  tagsByPdf: Record<number, Tag[]>;
}

/**
 * Fetch all export data in 4 queries instead of 4*N queries.
 * For 100 PDFs, this reduces queries from 400 to 4.
 */
export function getBatchExportData(db: DatabaseInstance): BatchExportData {
  return {
    bookmarksByPdf: getAllBookmarksGrouped(db),
    notesByPdf: getAllNotesGrouped(db),
    highlightsByPdf: getAllHighlightsGrouped(db),
    tagsByPdf: getAllPdfTagsMap(db),
  };
}

// =============================================================================
// AI Explanation Queries
// =============================================================================

export function addExplanation(
  db: DatabaseInstance,
  pdfId: number,
  pageNum: number,
  selectedText: string,
  explanation: string,
  style: ExplanationStyle
): number {
  const result = db.prepare(`
    INSERT INTO explanations (pdf_id, page_num, selected_text, explanation, style)
    VALUES (?, ?, ?, ?, ?)
  `).run(pdfId, pageNum, selectedText, explanation, style);
  return Number(result.lastInsertRowid);
}

export function getExplanations(
  db: DatabaseInstance,
  pdfId: number,
  pageNum?: number
): Explanation[] {
  if (pageNum !== undefined) {
    return db.prepare(`
      SELECT id, pdf_id as pdfId, page_num as pageNum, selected_text as selectedText,
             explanation, style, created_at as createdAt
      FROM explanations
      WHERE pdf_id = ? AND page_num = ?
      ORDER BY created_at DESC
    `).all(pdfId, pageNum) as Explanation[];
  }
  return db.prepare(`
    SELECT id, pdf_id as pdfId, page_num as pageNum, selected_text as selectedText,
           explanation, style, created_at as createdAt
    FROM explanations
    WHERE pdf_id = ?
    ORDER BY page_num, created_at DESC
  `).all(pdfId) as Explanation[];
}

export function deleteExplanation(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM explanations WHERE id = ?').run(id);
}

// =============================================================================
// AI Summary Queries
// =============================================================================

export function addSummary(
  db: DatabaseInstance,
  pdfId: number,
  startPage: number,
  endPage: number,
  title: string,
  content: string
): number {
  const result = db.prepare(`
    INSERT INTO summaries (pdf_id, start_page, end_page, title, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(pdfId, startPage, endPage, title, content);
  return Number(result.lastInsertRowid);
}

export function getSummaries(db: DatabaseInstance, pdfId: number): Summary[] {
  return db.prepare(`
    SELECT id, pdf_id as pdfId, start_page as startPage, end_page as endPage,
           title, content, created_at as createdAt
    FROM summaries
    WHERE pdf_id = ?
    ORDER BY start_page, created_at DESC
  `).all(pdfId) as Summary[];
}

export function deleteSummary(db: DatabaseInstance, id: number): void {
  db.prepare('DELETE FROM summaries WHERE id = ?').run(id);
}

// =============================================================================
// Reading Progress Queries
// =============================================================================

export interface ReadingStats {
  todayPages: number;
  weekPages: number;
  totalPages: number;
  streak: number;
  dailyGoal: number;
  goalProgress: number;
}

export interface PdfWithProgress {
  id: number;
  fileName: string;
  filePath: string;
  pageCount: number;
  currentPage: number;
  progress: number;
  lastViewed: string | null;
}

export interface ReadingHeatmapData {
  data: { date: string; count: number }[];
  maxCount: number;
  totalPages: number;
  streak: number;
  startDate: string;
  endDate: string;
}

// Add a reading session (called when PDF is closed)
export function addReadingSession(db: DatabaseInstance, pdfId: number, pagesRead: number): void {
  if (pagesRead <= 0) return;

  // Check if there's already a session for today for this PDF
  const existing = db.prepare(`
    SELECT id, pages_read FROM reading_sessions
    WHERE pdf_id = ? AND session_date = DATE('now')
  `).get(pdfId) as { id: number; pages_read: number } | undefined;

  if (existing) {
    // Update existing session
    db.prepare(`
      UPDATE reading_sessions SET pages_read = pages_read + ? WHERE id = ?
    `).run(pagesRead, existing.id);
  } else {
    // Create new session
    db.prepare(`
      INSERT INTO reading_sessions (pdf_id, pages_read, session_date)
      VALUES (?, ?, DATE('now'))
    `).run(pdfId, pagesRead);
  }
}

// Calculate reading streak (consecutive days with reading activity)
export function calculateReadingStreak(db: DatabaseInstance): number {
  const dates = db.prepare(`
    SELECT DISTINCT session_date as date
    FROM reading_sessions
    ORDER BY session_date DESC
  `).all() as { date: string }[];

  if (dates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDate = new Date(dates[0].date + 'T00:00:00');
  const diffFromToday = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  // Streak broken if more than 1 day gap from today
  if (diffFromToday > 1) {
    return 0;
  }

  // Count consecutive days
  let expectedDate = new Date(firstDate);
  for (const { date } of dates) {
    const currentDate = new Date(date + 'T00:00:00');
    const diff = Math.floor((expectedDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Get pages read today
export function getTodayReadPages(db: DatabaseInstance): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(pages_read), 0) as total
    FROM reading_sessions
    WHERE session_date = DATE('now')
  `).get() as { total: number };
  return result.total;
}

// Get reading goal
export function getReadingGoal(db: DatabaseInstance): { dailyPages: number } {
  const result = db.prepare(`
    SELECT daily_pages FROM reading_goals ORDER BY id DESC LIMIT 1
  `).get() as { daily_pages: number } | undefined;
  return { dailyPages: result?.daily_pages ?? 20 };
}

// Set reading goal
export function setReadingGoal(db: DatabaseInstance, dailyPages: number): void {
  const existing = db.prepare('SELECT id FROM reading_goals LIMIT 1').get();
  if (existing) {
    db.prepare(`
      UPDATE reading_goals SET daily_pages = ?, updated_at = CURRENT_TIMESTAMP
    `).run(dailyPages);
  } else {
    db.prepare(`
      INSERT INTO reading_goals (daily_pages) VALUES (?)
    `).run(dailyPages);
  }
}

// Get reading stats
export function getReadingStats(db: DatabaseInstance): ReadingStats {
  const todayPages = getTodayReadPages(db);

  const weekPages = db.prepare(`
    SELECT COALESCE(SUM(pages_read), 0) as total
    FROM reading_sessions
    WHERE session_date >= DATE('now', '-7 days')
  `).get() as { total: number };

  const totalPages = db.prepare(`
    SELECT COALESCE(SUM(pages_read), 0) as total
    FROM reading_sessions
  `).get() as { total: number };

  const streak = calculateReadingStreak(db);
  const goal = getReadingGoal(db);
  const goalProgress = goal.dailyPages > 0
    ? Math.min(100, Math.round((todayPages / goal.dailyPages) * 100))
    : 0;

  return {
    todayPages,
    weekPages: weekPages.total,
    totalPages: totalPages.total,
    streak,
    dailyGoal: goal.dailyPages,
    goalProgress,
  };
}

// Get reading heatmap data
export function getReadingHeatmapData(
  db: DatabaseInstance,
  timeframe: 'week' | 'month' | 'year'
): ReadingHeatmapData {
  const daysMap: Record<string, number> = { week: 7, month: 30, year: 365 };
  const days = daysMap[timeframe];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  const rows = db.prepare(`
    SELECT session_date as date, SUM(pages_read) as count
    FROM reading_sessions
    WHERE session_date >= DATE('now', '-${days} days')
    GROUP BY session_date
    ORDER BY session_date
  `).all() as { date: string; count: number }[];

  const maxCount = rows.reduce((max, r) => Math.max(max, r.count), 0);
  const totalPages = rows.reduce((sum, r) => sum + r.count, 0);
  const streak = calculateReadingStreak(db);

  return {
    data: rows,
    maxCount,
    totalPages,
    streak,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// Get all PDFs with reading progress
export function getAllPdfsWithProgress(db: DatabaseInstance): PdfWithProgress[] {
  return db.prepare(`
    SELECT
      p.id,
      p.file_name as fileName,
      p.file_path as filePath,
      COALESCE(p.page_count, 0) as pageCount,
      COALESCE(rv.page_num, 1) as currentPage,
      CASE
        WHEN p.page_count > 0 THEN ROUND((COALESCE(rv.page_num, 1) * 100.0) / p.page_count)
        ELSE 0
      END as progress,
      rv.viewed_at as lastViewed
    FROM pdfs p
    LEFT JOIN recent_views rv ON rv.pdf_id = p.id
    ORDER BY rv.viewed_at DESC NULLS LAST, p.file_name
  `).all() as PdfWithProgress[];
}
