import type { DatabaseInstance } from './index';
import type { Backlink, NoteLink, GraphNode, GraphEdge, LinkGraph } from '../../shared/types';

interface LinkInput {
  targetPdfId: number | null;
  targetPageNum: number | null;
  linkText: string;
}

/**
 * Index links from a note - clears existing and inserts new
 */
export function indexNoteLinks(
  db: DatabaseInstance,
  noteId: number,
  sourcePdfId: number,
  sourcePageNum: number,
  links: LinkInput[]
): void {
  // Clear existing links for this note
  db.prepare('DELETE FROM note_links WHERE source_note_id = ?').run(noteId);

  if (links.length === 0) {
    return;
  }

  // Insert new links
  const stmt = db.prepare(`
    INSERT INTO note_links (source_note_id, source_pdf_id, source_page_num, target_pdf_id, target_page_num, link_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const link of links) {
    stmt.run(
      noteId,
      sourcePdfId,
      sourcePageNum,
      link.targetPdfId,
      link.targetPageNum,
      link.linkText
    );
  }
}

/**
 * Delete all links for a specific note
 */
export function deleteNoteLinks(db: DatabaseInstance, noteId: number): void {
  db.prepare('DELETE FROM note_links WHERE source_note_id = ?').run(noteId);
}

/**
 * Get backlinks for a specific PDF (optionally for a specific page)
 */
export function getBacklinks(
  db: DatabaseInstance,
  pdfId: number,
  pageNum?: number
): Backlink[] {
  if (pageNum !== undefined) {
    return db
      .prepare(
        `
        SELECT
          nl.source_note_id as noteId,
          n.content as noteContent,
          nl.source_pdf_id as pdfId,
          p.file_name as pdfFileName,
          nl.source_page_num as pageNum,
          nl.link_text as linkText
        FROM note_links nl
        JOIN notes n ON n.id = nl.source_note_id
        JOIN pdfs p ON p.id = nl.source_pdf_id
        WHERE nl.target_pdf_id = ? AND nl.target_page_num = ?
        ORDER BY nl.created_at DESC
      `
      )
      .all(pdfId, pageNum) as Backlink[];
  }

  return db
    .prepare(
      `
      SELECT
        nl.source_note_id as noteId,
        n.content as noteContent,
        nl.source_pdf_id as pdfId,
        p.file_name as pdfFileName,
        nl.source_page_num as pageNum,
        nl.link_text as linkText
      FROM note_links nl
      JOIN notes n ON n.id = nl.source_note_id
      JOIN pdfs p ON p.id = nl.source_pdf_id
      WHERE nl.target_pdf_id = ?
      ORDER BY nl.created_at DESC
    `
    )
    .all(pdfId) as Backlink[];
}

/**
 * Get all links from a specific note
 */
export function getNoteLinks(db: DatabaseInstance, noteId: number): NoteLink[] {
  return db
    .prepare(
      `
      SELECT
        id,
        source_note_id as sourceNoteId,
        source_pdf_id as sourcePdfId,
        source_page_num as sourcePageNum,
        target_pdf_id as targetPdfId,
        target_page_num as targetPageNum,
        link_text as linkText,
        created_at as createdAt
      FROM note_links
      WHERE source_note_id = ?
    `
    )
    .all(noteId) as NoteLink[];
}

/**
 * Get count of backlinks for a PDF
 */
export function getBacklinkCount(
  db: DatabaseInstance,
  pdfId: number,
  pageNum?: number
): number {
  if (pageNum !== undefined) {
    const result = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM note_links
        WHERE target_pdf_id = ? AND target_page_num = ?
      `
      )
      .get(pdfId, pageNum) as { count: number };
    return result.count;
  }

  const result = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM note_links
      WHERE target_pdf_id = ?
    `
    )
    .get(pdfId) as { count: number };
  return result.count;
}

/**
 * Check if a note has any outgoing links
 */
export function noteHasLinks(db: DatabaseInstance, noteId: number): boolean {
  const result = db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM note_links
      WHERE source_note_id = ?
    `
    )
    .get(noteId) as { count: number };
  return result.count > 0;
}

/**
 * Get link graph data for visualization
 * Returns all PDFs as nodes and links between them as edges
 */
export function getLinkGraph(db: DatabaseInstance, includeUnlinked: boolean = false): LinkGraph {
  // Get all PDFs
  const allPdfs = db
    .prepare(
      `
      SELECT id, file_name as fileName
      FROM pdfs
      ORDER BY file_name
    `
    )
    .all() as Array<{ id: number; fileName: string }>;

  // Get aggregated links between PDFs (source_pdf -> target_pdf with count)
  const linkCounts = db
    .prepare(
      `
      SELECT
        source_pdf_id as sourcePdfId,
        target_pdf_id as targetPdfId,
        COUNT(*) as count
      FROM note_links
      WHERE target_pdf_id IS NOT NULL
      GROUP BY source_pdf_id, target_pdf_id
    `
    )
    .all() as Array<{ sourcePdfId: number; targetPdfId: number; count: number }>;

  // Build set of PDFs that have links
  const linkedPdfIds = new Set<number>();
  for (const link of linkCounts) {
    linkedPdfIds.add(link.sourcePdfId);
    linkedPdfIds.add(link.targetPdfId);
  }

  // Count links per PDF (outgoing + incoming)
  const linkCountByPdf = new Map<number, number>();
  for (const link of linkCounts) {
    linkCountByPdf.set(link.sourcePdfId, (linkCountByPdf.get(link.sourcePdfId) || 0) + link.count);
    linkCountByPdf.set(link.targetPdfId, (linkCountByPdf.get(link.targetPdfId) || 0) + link.count);
  }

  // Build nodes
  const nodes: GraphNode[] = [];
  for (const pdf of allPdfs) {
    const hasLinks = linkedPdfIds.has(pdf.id);
    if (includeUnlinked || hasLinks) {
      nodes.push({
        id: `pdf-${pdf.id}`,
        label: pdf.fileName.replace(/\.pdf$/i, ''),
        pdfId: pdf.id,
        linkCount: linkCountByPdf.get(pdf.id) || 0,
      });
    }
  }

  // Build edges
  const edges: GraphEdge[] = linkCounts.map((link) => ({
    source: `pdf-${link.sourcePdfId}`,
    target: `pdf-${link.targetPdfId}`,
    value: link.count,
  }));

  return { nodes, edges };
}
