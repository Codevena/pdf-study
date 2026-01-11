import type { PDFDocument, Bookmark, Note, Tag, Highlight, ExportOptions } from '../../shared/types';

const COLOR_NAMES: Record<string, string> = {
  '#FFFF00': 'Gelb',
  '#FF9800': 'Orange',
  '#4CAF50': 'Grün',
  '#2196F3': 'Blau',
  '#E91E63': 'Pink',
};

const COLOR_NAMES_EN: Record<string, string> = {
  '#FFFF00': 'Yellow',
  '#FF9800': 'Orange',
  '#4CAF50': 'Green',
  '#2196F3': 'Blue',
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

/**
 * Extract inline tags from note content (#tag pattern)
 */
function extractTagsFromContent(content: string): string[] {
  const tagRegex = /#[\w\-äöüÄÖÜß]+/g;
  const matches = content.match(tagRegex) || [];
  return [...new Set(matches.map(t => t.slice(1)))]; // Remove # prefix and deduplicate
}

/**
 * Enhanced markdown export with Obsidian support and options
 */
export function generateMarkdownEnhanced(
  pdf: PDFDocument,
  bookmarks: Bookmark[],
  notes: Note[],
  highlights: Highlight[],
  tags: Tag[],
  options: ExportOptions,
  _allPdfs?: PDFDocument[]
): string {
  const lines: string[] = [];
  const isObsidian = options.format === 'obsidian';
  const isGerman = options.language === 'de';
  const colorNames = isGerman ? COLOR_NAMES : COLOR_NAMES_EN;

  // Collect inline tags from notes if enabled
  let inlineTags: string[] = [];
  if (options.extractTags) {
    for (const note of notes) {
      inlineTags = [...inlineTags, ...extractTagsFromContent(note.content)];
    }
    inlineTags = [...new Set(inlineTags)]; // Deduplicate
  }

  // YAML Frontmatter
  lines.push('---');
  lines.push(`title: "${pdf.fileName.replace(/"/g, '\\"')}"`);

  if (isObsidian) {
    // Obsidian-specific frontmatter
    const baseName = pdf.fileName.replace(/\.pdf$/i, '');
    lines.push(`aliases:`);
    lines.push(`  - "${baseName}"`);
    lines.push(`type: pdf-notes`);
    lines.push(`source: "${pdf.filePath.replace(/"/g, '\\"')}"`);
  }

  lines.push(`exported: ${new Date().toISOString()}`);
  lines.push(`pages: ${pdf.pageCount}`);

  // Combined tags (explicit + inline)
  const allTagNames = [...tags.map(t => t.name), ...inlineTags];
  const uniqueTags = [...new Set(allTagNames)];
  if (uniqueTags.length > 0) {
    if (isObsidian) {
      lines.push(`tags:`);
      uniqueTags.forEach(t => lines.push(`  - ${t}`));
    } else {
      lines.push(`tags: [${uniqueTags.join(', ')}]`);
    }
  }

  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${pdf.fileName}`);
  lines.push('');

  // Bookmarks
  if (bookmarks.length > 0) {
    lines.push(isGerman ? '## Lesezeichen' : '## Bookmarks');
    lines.push('');
    const sortedBookmarks = [...bookmarks].sort((a, b) => a.pageNum - b.pageNum);
    for (const bookmark of sortedBookmarks) {
      const title = bookmark.title || (isGerman ? `Seite ${bookmark.pageNum}` : `Page ${bookmark.pageNum}`);
      if (isObsidian && options.includeWikiLinks) {
        // Obsidian internal link format
        const baseName = pdf.fileName.replace(/\.pdf$/i, '');
        lines.push(`- ${title} ([[${baseName}#p${bookmark.pageNum}|${isGerman ? 'Seite' : 'Page'} ${bookmark.pageNum}]])`);
      } else {
        lines.push(`- ${title} (${isGerman ? 'Seite' : 'Page'} ${bookmark.pageNum})`);
      }
    }
    lines.push('');
  }

  // Notes
  if (notes.length > 0) {
    lines.push(isGerman ? '## Notizen' : '## Notes');
    lines.push('');
    const sortedNotes = [...notes].sort((a, b) => a.pageNum - b.pageNum);
    let currentPage = -1;
    for (const note of sortedNotes) {
      if (note.pageNum !== currentPage) {
        currentPage = note.pageNum;
        lines.push(`### ${isGerman ? 'Seite' : 'Page'} ${currentPage}`);
        lines.push('');
      }
      // Preserve wiki-links in content if they exist
      lines.push(`> ${note.content}`);
      lines.push('');
      lines.push(`_${isGerman ? 'Erstellt' : 'Created'}: ${formatDate(note.createdAt)}_`);
      lines.push('');
    }
  }

  // Highlights
  if (highlights.length > 0) {
    lines.push(isGerman ? '## Markierungen' : '## Highlights');
    lines.push('');
    const sortedHighlights = [...highlights].sort((a, b) => a.pageNum - b.pageNum);
    let currentPage = -1;
    for (const highlight of sortedHighlights) {
      if (highlight.pageNum !== currentPage) {
        currentPage = highlight.pageNum;
        lines.push(`### ${isGerman ? 'Seite' : 'Page'} ${currentPage}`);
        lines.push('');
      }
      lines.push(`> "${highlight.textContent}"`);
      const colorName = colorNames[highlight.color] || highlight.color;
      lines.push(`_${colorName}_`);
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  if (isObsidian) {
    lines.push('_Exported with [PDF-Study](https://github.com/yourusername/booklearn)_');
  } else {
    lines.push(isGerman ? '_Exportiert mit PDF-Study_' : '_Exported with PDF-Study_');
  }

  return lines.join('\n');
}
