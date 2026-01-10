import type { PDFDocument, Bookmark, Note, Tag, Highlight } from '../../shared/types';

const COLOR_NAMES: Record<string, string> = {
  '#FFFF00': 'Gelb',
  '#FF9800': 'Orange',
  '#4CAF50': 'Grün',
  '#2196F3': 'Blau',
  '#E91E63': 'Pink',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function generateMarkdown(
  pdf: PDFDocument,
  bookmarks: Bookmark[],
  notes: Note[],
  highlights: Highlight[],
  tags: Tag[]
): string {
  const lines: string[] = [];

  // YAML Frontmatter
  lines.push('---');
  lines.push(`title: "${pdf.fileName}"`);
  lines.push(`exported: ${new Date().toISOString()}`);
  lines.push(`pages: ${pdf.pageCount}`);
  if (tags.length > 0) {
    lines.push(`tags: [${tags.map((t) => t.name).join(', ')}]`);
  }
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${pdf.fileName}`);
  lines.push('');

  // Bookmarks
  if (bookmarks.length > 0) {
    lines.push('## Lesezeichen');
    lines.push('');
    const sortedBookmarks = [...bookmarks].sort((a, b) => a.pageNum - b.pageNum);
    for (const bookmark of sortedBookmarks) {
      const title = bookmark.title || `Seite ${bookmark.pageNum}`;
      lines.push(`- ${title} (Seite ${bookmark.pageNum})`);
    }
    lines.push('');
  }

  // Notes
  if (notes.length > 0) {
    lines.push('## Notizen');
    lines.push('');
    const sortedNotes = [...notes].sort((a, b) => a.pageNum - b.pageNum);
    let currentPage = -1;
    for (const note of sortedNotes) {
      if (note.pageNum !== currentPage) {
        currentPage = note.pageNum;
        lines.push(`### Seite ${currentPage}`);
        lines.push('');
      }
      lines.push(`> ${note.content}`);
      lines.push('');
      lines.push(`_Erstellt: ${formatDate(note.createdAt)}_`);
      lines.push('');
    }
  }

  // Highlights
  if (highlights.length > 0) {
    lines.push('## Markierungen');
    lines.push('');
    const sortedHighlights = [...highlights].sort((a, b) => a.pageNum - b.pageNum);
    let currentPage = -1;
    for (const highlight of sortedHighlights) {
      if (highlight.pageNum !== currentPage) {
        currentPage = highlight.pageNum;
        lines.push(`### Seite ${currentPage}`);
        lines.push('');
      }
      lines.push(`> "${highlight.textContent}"`);
      const colorName = COLOR_NAMES[highlight.color] || highlight.color;
      lines.push(`_${colorName}_`);
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push('_Exportiert mit PDF-Study_');

  return lines.join('\n');
}
