import { ipcMain } from 'electron';
import * as queries from '../database/queries';
import * as linkQueries from '../database/link-queries';
import { parseWikiLinks, resolveLinkWithLookup } from '../links/parser';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { HighlightRect } from '../../shared/types';
import type { HandlerContext } from './types';

export function registerAnnotationHandlers({ db }: HandlerContext): void {
  // Bookmarks
  ipcMain.handle(IPC_CHANNELS.GET_BOOKMARKS, (_, pdfId?: number) => {
    return queries.getBookmarks(db, pdfId);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_BOOKMARK, (_, pdfId: number, pageNum: number, title?: string) => {
    return queries.addBookmark(db, pdfId, pageNum, title);
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_BOOKMARK, (_, pdfId: number, pageNum: number) => {
    queries.removeBookmark(db, pdfId, pageNum);
    return true;
  });

  // Notes
  ipcMain.handle(IPC_CHANNELS.GET_NOTES, (_, pdfId: number, pageNum?: number) => {
    return queries.getNotes(db, pdfId, pageNum);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_NOTE, (_, pdfId: number, pageNum: number, content: string) => {
    const noteId = queries.addNote(db, pdfId, pageNum, content);

    // Index any wiki-links in the note (using direct DB lookup for performance)
    const parsedLinks = parseWikiLinks(content);
    if (parsedLinks.length > 0) {
      const lookupPdf = (fileName: string) => queries.getPdfByFileName(db, fileName);
      const links = parsedLinks.map(link => {
        const resolved = resolveLinkWithLookup(link, lookupPdf);
        return {
          targetPdfId: resolved?.pdfId || null,
          targetPageNum: resolved?.pageNum || null,
          linkText: link.fullMatch,
        };
      });
      linkQueries.indexNoteLinks(db, noteId, pdfId, pageNum, links);
    }

    return noteId;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_NOTE, (_, id: number, content: string) => {
    queries.updateNote(db, id, content);

    // Re-index links for this note
    const note = queries.getNoteById(db, id);
    if (note) {
      const lookupPdf = (fileName: string) => queries.getPdfByFileName(db, fileName);
      const parsedLinks = parseWikiLinks(content);
      const links = parsedLinks.map(link => {
        const resolved = resolveLinkWithLookup(link, lookupPdf);
        return {
          targetPdfId: resolved?.pdfId || null,
          targetPageNum: resolved?.pageNum || null,
          linkText: link.fullMatch,
        };
      });
      linkQueries.indexNoteLinks(db, id, note.pdfId, note.pageNum, links);
    }

    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_NOTE, (_, id: number) => {
    linkQueries.deleteNoteLinks(db, id);
    queries.deleteNote(db, id);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_NOTE_TAGS, (_, id: number, tags: string[]) => {
    queries.updateNoteTags(db, id, tags);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_ALL_NOTE_TAGS, () => {
    return queries.getAllNoteTags(db);
  });

  // Highlights
  ipcMain.handle(IPC_CHANNELS.GET_HIGHLIGHTS, (_, pdfId: number, pageNum?: number) => {
    return queries.getHighlights(db, pdfId, pageNum);
  });

  ipcMain.handle(
    IPC_CHANNELS.ADD_HIGHLIGHT,
    (_, pdfId: number, pageNum: number, color: string, textContent: string, rects: HighlightRect[]) => {
      return queries.addHighlight(db, pdfId, pageNum, color, textContent, rects);
    }
  );

  ipcMain.handle(IPC_CHANNELS.UPDATE_HIGHLIGHT_COLOR, (_, id: number, color: string) => {
    queries.updateHighlightColor(db, id, color);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_HIGHLIGHT, (_, id: number) => {
    queries.deleteHighlight(db, id);
    return true;
  });

  // Tags
  ipcMain.handle(IPC_CHANNELS.GET_TAGS, () => {
    return queries.getAllTags(db);
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_TAG, (_, name: string, color?: string) => {
    return queries.createTag(db, name, color);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_TAG, (_, id: number) => {
    queries.deleteTag(db, id);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.ADD_TAG_TO_PDF, (_, pdfId: number, tagId: number) => {
    queries.addTagToPdf(db, pdfId, tagId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_TAG_FROM_PDF, (_, pdfId: number, tagId: number) => {
    queries.removeTagFromPdf(db, pdfId, tagId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_PDF_TAGS, (_, pdfId: number) => {
    return queries.getPdfTags(db, pdfId);
  });

  ipcMain.handle(IPC_CHANNELS.GET_ALL_PDF_TAGS, () => {
    return queries.getAllPdfTagsMap(db);
  });

  // Recent Views
  ipcMain.handle(IPC_CHANNELS.GET_RECENT_VIEWS, (_, limit?: number) => {
    return queries.getRecentViews(db, limit);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_RECENT_VIEW, (_, pdfId: number, pageNum?: number) => {
    queries.addRecentView(db, pdfId, pageNum);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_RECENT_VIEW_PAGE, (_, pdfId: number, pageNum: number) => {
    queries.updateRecentViewPage(db, pdfId, pageNum);
    return true;
  });

  // Search History
  ipcMain.handle(IPC_CHANNELS.GET_SEARCH_HISTORY, (_, limit?: number) => {
    return queries.getSearchHistory(db, limit);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_SEARCH_HISTORY, (_, query: string, resultCount: number) => {
    queries.addSearchHistory(db, query, resultCount);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_SEARCH_HISTORY_ITEM, (_, id: number) => {
    queries.deleteSearchHistoryItem(db, id);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_SEARCH_HISTORY, () => {
    queries.clearSearchHistory(db);
    return true;
  });
}
