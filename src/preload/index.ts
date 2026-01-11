import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type {
  AppSettings,
  PDFDocument,
  SearchResult,
  Tag,
  Bookmark,
  Note,
  IndexingStatus,
  RecentView,
  SearchHistoryItem,
  OCRStatus,
  OutlineItem,
  Highlight,
  HighlightRect,
  FlashcardDeck,
  FlashcardWithFSRS,
  FlashcardStats,
  FSRSRating,
  HeatmapData,
} from '../shared/types';

// Extended FlashcardWithFSRS with next intervals preview
interface FlashcardWithIntervals extends FlashcardWithFSRS {
  nextIntervals: { again: string; hard: string; good: string; easy: string };
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Folder Management
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_FOLDER),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  saveSettings: (settings: Partial<AppSettings>): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  // PDF Operations
  getPdfs: (): Promise<PDFDocument[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PDFS),

  getPdf: (id: number): Promise<PDFDocument | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PDF, id),

  getPdfOutline: (filePath: string): Promise<OutlineItem[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PDF_OUTLINE, filePath),

  generateAIOutline: (
    filePath: string,
    pageCount: number
  ): Promise<{ success: boolean; outline?: OutlineItem[]; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GENERATE_AI_OUTLINE, filePath, pageCount),

  getAIOutline: (pdfId: number): Promise<{ success: boolean; outline?: OutlineItem[]; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_AI_OUTLINE, pdfId),

  saveAIOutline: (pdfId: number, outline: OutlineItem[]): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_AI_OUTLINE, pdfId, outline),

  indexPdfs: (): Promise<PDFDocument[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.INDEX_PDFS),

  getIndexingStatus: (): Promise<IndexingStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_INDEXING_STATUS),

  // Search
  search: (query: string): Promise<SearchResult[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH, query),

  // Bookmarks
  getBookmarks: (pdfId?: number): Promise<Bookmark[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_BOOKMARKS, pdfId),

  addBookmark: (pdfId: number, pageNum: number, title?: string): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_BOOKMARK, pdfId, pageNum, title),

  removeBookmark: (pdfId: number, pageNum: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_BOOKMARK, pdfId, pageNum),

  // Notes
  getNotes: (pdfId: number, pageNum?: number): Promise<Note[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_NOTES, pdfId, pageNum),

  addNote: (pdfId: number, pageNum: number, content: string): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_NOTE, pdfId, pageNum, content),

  updateNote: (id: number, content: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_NOTE, id, content),

  deleteNote: (id: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_NOTE, id),

  // Recent Views
  getRecentViews: (limit?: number): Promise<RecentView[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_VIEWS, limit),

  addRecentView: (pdfId: number, pageNum?: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_RECENT_VIEW, pdfId, pageNum),

  updateRecentViewPage: (pdfId: number, pageNum: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_RECENT_VIEW_PAGE, pdfId, pageNum),

  // Search History
  getSearchHistory: (limit?: number): Promise<SearchHistoryItem[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SEARCH_HISTORY, limit),

  addSearchHistory: (query: string, resultCount: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_SEARCH_HISTORY, query, resultCount),

  deleteSearchHistoryItem: (id: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_SEARCH_HISTORY_ITEM, id),

  clearSearchHistory: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_SEARCH_HISTORY),

  // Tags
  getTags: (): Promise<Tag[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TAGS),

  createTag: (name: string, color?: string): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_TAG, name, color),

  deleteTag: (id: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_TAG, id),

  addTagToPdf: (pdfId: number, tagId: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_TAG_TO_PDF, pdfId, tagId),

  removeTagFromPdf: (pdfId: number, tagId: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_TAG_FROM_PDF, pdfId, tagId),

  getPdfTags: (pdfId: number): Promise<Tag[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PDF_TAGS, pdfId),

  getAllPdfTags: (): Promise<Record<number, Tag[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_PDF_TAGS),

  // Export
  exportPdfData: (pdfId: number): Promise<{ success: boolean; error?: string; canceled?: boolean; filePath?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PDF_DATA, pdfId),

  // Highlights
  getHighlights: (pdfId: number, pageNum?: number): Promise<Highlight[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HIGHLIGHTS, pdfId, pageNum),

  addHighlight: (
    pdfId: number,
    pageNum: number,
    color: string,
    textContent: string,
    rects: HighlightRect[]
  ): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_HIGHLIGHT, pdfId, pageNum, color, textContent, rects),

  updateHighlightColor: (id: number, color: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_HIGHLIGHT_COLOR, id, color),

  deleteHighlight: (id: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_HIGHLIGHT, id),

  // OCR
  startOCR: (): Promise<{ success: boolean; error?: string; queuedPdfs?: number; message?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.START_OCR),

  forceOCR: (): Promise<{ success: boolean; error?: string; queuedPdfs?: number; message?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FORCE_OCR),

  startOCRForPdf: (pdfId: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.START_OCR_FOR_PDF, pdfId),

  getOCRStatus: (): Promise<OCRStatus> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_OCR_STATUS),

  cancelOCR: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_OCR),

  // ============ FLASHCARDS ============

  // Deck Management
  getFlashcardDecks: (pdfId?: number): Promise<FlashcardDeck[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_DECKS, pdfId),

  getFlashcardDeck: (id: number): Promise<FlashcardDeck | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_DECK, id),

  createFlashcardDeck: (name: string, pdfId?: number, description?: string): Promise<number> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_CREATE_DECK, name, pdfId, description),

  updateFlashcardDeck: (id: number, name: string, description?: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_UPDATE_DECK, id, name, description),

  deleteFlashcardDeck: (id: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_DELETE_DECK, id),

  // Card Management
  getFlashcards: (deckId: number): Promise<FlashcardWithFSRS[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_CARDS, deckId),

  getFlashcard: (id: number): Promise<FlashcardWithFSRS | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_CARD, id),

  addFlashcard: (
    deckId: number,
    front: string,
    back: string,
    cardType?: 'basic' | 'cloze',
    highlightId?: number,
    sourcePage?: number,
    clozeData?: string
  ): Promise<number> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.FLASHCARD_ADD_CARD,
      deckId,
      front,
      back,
      cardType,
      highlightId,
      sourcePage,
      clozeData
    ),

  updateFlashcard: (
    id: number,
    front: string,
    back: string,
    cardType?: 'basic' | 'cloze',
    clozeData?: string
  ): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_UPDATE_CARD, id, front, back, cardType, clozeData),

  deleteFlashcard: (id: number): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_DELETE_CARD, id),

  // FSRS / Study
  getDueFlashcards: (deckId?: number, limit?: number): Promise<FlashcardWithIntervals[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_DUE, deckId, limit),

  submitFlashcardReview: (flashcardId: number, rating: FSRSRating): Promise<FlashcardWithIntervals> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_SUBMIT_REVIEW, flashcardId, rating),

  getFlashcardStats: (deckId?: number): Promise<FlashcardStats> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_STATS, deckId),

  // Export
  exportToLearnBuddy: (deckId: number): Promise<{ success: boolean; error?: string; canceled?: boolean; filePath?: string; cardCount?: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_EXPORT_LEARNBUDDY, deckId),

  // Heatmap
  getFlashcardHeatmap: (
    timeframe: 'week' | 'month' | 'year',
    deckId?: number
  ): Promise<HeatmapData> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_HEATMAP, timeframe, deckId),

  // AI Generation
  generateFlashcardsAI: (
    text: string,
    options: {
      model: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2';
      cardType: 'basic' | 'cloze' | 'mixed';
      language: 'de' | 'en';
      count: number;
    }
  ): Promise<{
    success: boolean;
    cards?: Array<{ front: string; back: string; cardType: 'basic' | 'cloze' }>;
    error?: string;
  }> => ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GENERATE_AI, text, options),

  // AI Generation from PDF
  generateFlashcardsFromPDF: (
    filePath: string,
    pageNumbers: number[],
    options: {
      model: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2';
      cardType: 'basic' | 'cloze' | 'mixed';
      language: 'de' | 'en';
      count: number;
    }
  ): Promise<{
    success: boolean;
    cards?: Array<{ front: string; back: string; cardType: 'basic' | 'cloze' }>;
    error?: string;
  }> => ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GENERATE_FROM_PDF, filePath, pageNumbers, options),

  // PDF Page Text Extraction
  getPdfPageText: (
    filePath: string,
    pageNumbers: number[]
  ): Promise<{ success: boolean; text?: string; pageCount?: number; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLASHCARD_GET_PDF_PAGE_TEXT, filePath, pageNumbers),

  // API Usage / Cost Tracking
  getApiUsageStats: (): Promise<{
    totalCostUsd: number;
    totalTokens: number;
    callCount: number;
    costByModel: Record<string, number>;
    costByOperation: Record<string, number>;
    recentUsage: Array<{
      id: number;
      model: string;
      operation: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costUsd: number;
      createdAt: string;
    }>;
  }> => ipcRenderer.invoke(IPC_CHANNELS.API_GET_USAGE_STATS),

  clearApiUsage: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.API_CLEAR_USAGE),

  // Event Listeners
  onIndexingProgress: (callback: (status: IndexingStatus) => void) => {
    const listener = (_: any, status: IndexingStatus) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.INDEXING_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.INDEXING_PROGRESS, listener);
  },

  onPdfAdded: (callback: (pdfs: PDFDocument[]) => void) => {
    const listener = (_: any, pdfs: PDFDocument[]) => callback(pdfs);
    ipcRenderer.on(IPC_CHANNELS.PDF_ADDED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PDF_ADDED, listener);
  },

  onPdfRemoved: (callback: (pdfs: PDFDocument[]) => void) => {
    const listener = (_: any, pdfs: PDFDocument[]) => callback(pdfs);
    ipcRenderer.on(IPC_CHANNELS.PDF_REMOVED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PDF_REMOVED, listener);
  },

  onOCRProgress: (callback: (status: OCRStatus) => void) => {
    const listener = (_: any, status: OCRStatus) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.OCR_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OCR_PROGRESS, listener);
  },
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
      getPdfs: () => Promise<PDFDocument[]>;
      getPdf: (id: number) => Promise<PDFDocument | undefined>;
      getPdfOutline: (filePath: string) => Promise<OutlineItem[]>;
      generateAIOutline: (filePath: string, pageCount: number) => Promise<{ success: boolean; outline?: OutlineItem[]; error?: string }>;
      getAIOutline: (pdfId: number) => Promise<{ success: boolean; outline?: OutlineItem[]; error?: string }>;
      saveAIOutline: (pdfId: number, outline: OutlineItem[]) => Promise<{ success: boolean; error?: string }>;
      indexPdfs: () => Promise<PDFDocument[]>;
      getIndexingStatus: () => Promise<IndexingStatus>;
      search: (query: string) => Promise<SearchResult[]>;
      getBookmarks: (pdfId?: number) => Promise<Bookmark[]>;
      addBookmark: (pdfId: number, pageNum: number, title?: string) => Promise<number>;
      removeBookmark: (pdfId: number, pageNum: number) => Promise<boolean>;
      getNotes: (pdfId: number, pageNum?: number) => Promise<Note[]>;
      addNote: (pdfId: number, pageNum: number, content: string) => Promise<number>;
      updateNote: (id: number, content: string) => Promise<boolean>;
      deleteNote: (id: number) => Promise<boolean>;
      getRecentViews: (limit?: number) => Promise<RecentView[]>;
      addRecentView: (pdfId: number, pageNum?: number) => Promise<boolean>;
      updateRecentViewPage: (pdfId: number, pageNum: number) => Promise<boolean>;
      getSearchHistory: (limit?: number) => Promise<SearchHistoryItem[]>;
      addSearchHistory: (query: string, resultCount: number) => Promise<boolean>;
      deleteSearchHistoryItem: (id: number) => Promise<boolean>;
      clearSearchHistory: () => Promise<boolean>;
      getTags: () => Promise<Tag[]>;
      createTag: (name: string, color?: string) => Promise<number>;
      deleteTag: (id: number) => Promise<boolean>;
      addTagToPdf: (pdfId: number, tagId: number) => Promise<boolean>;
      removeTagFromPdf: (pdfId: number, tagId: number) => Promise<boolean>;
      getPdfTags: (pdfId: number) => Promise<Tag[]>;
      getAllPdfTags: () => Promise<Record<number, Tag[]>>;
      exportPdfData: (pdfId: number) => Promise<{ success: boolean; error?: string; canceled?: boolean; filePath?: string }>;
      getHighlights: (pdfId: number, pageNum?: number) => Promise<Highlight[]>;
      addHighlight: (pdfId: number, pageNum: number, color: string, textContent: string, rects: HighlightRect[]) => Promise<number>;
      updateHighlightColor: (id: number, color: string) => Promise<boolean>;
      deleteHighlight: (id: number) => Promise<boolean>;
      startOCR: () => Promise<{ success: boolean; error?: string; queuedPdfs?: number; message?: string }>;
      forceOCR: () => Promise<{ success: boolean; error?: string; queuedPdfs?: number; message?: string }>;
      startOCRForPdf: (pdfId: number) => Promise<{ success: boolean; error?: string }>;
      getOCRStatus: () => Promise<OCRStatus>;
      cancelOCR: () => Promise<boolean>;
      // Flashcard Decks
      getFlashcardDecks: (pdfId?: number) => Promise<FlashcardDeck[]>;
      getFlashcardDeck: (id: number) => Promise<FlashcardDeck | undefined>;
      createFlashcardDeck: (name: string, pdfId?: number, description?: string) => Promise<number>;
      updateFlashcardDeck: (id: number, name: string, description?: string) => Promise<boolean>;
      deleteFlashcardDeck: (id: number) => Promise<boolean>;
      // Flashcards
      getFlashcards: (deckId: number) => Promise<FlashcardWithFSRS[]>;
      getFlashcard: (id: number) => Promise<FlashcardWithFSRS | undefined>;
      addFlashcard: (deckId: number, front: string, back: string, cardType?: 'basic' | 'cloze', highlightId?: number, sourcePage?: number, clozeData?: string) => Promise<number>;
      updateFlashcard: (id: number, front: string, back: string, cardType?: 'basic' | 'cloze', clozeData?: string) => Promise<boolean>;
      deleteFlashcard: (id: number) => Promise<boolean>;
      // FSRS / Study
      getDueFlashcards: (deckId?: number, limit?: number) => Promise<FlashcardWithIntervals[]>;
      submitFlashcardReview: (flashcardId: number, rating: FSRSRating) => Promise<FlashcardWithIntervals>;
      getFlashcardStats: (deckId?: number) => Promise<FlashcardStats>;
      // Heatmap
      getFlashcardHeatmap: (timeframe: 'week' | 'month' | 'year', deckId?: number) => Promise<HeatmapData>;
      // Export
      exportToLearnBuddy: (deckId: number) => Promise<{ success: boolean; error?: string; canceled?: boolean; filePath?: string; cardCount?: number }>;
      // AI Generation
      generateFlashcardsAI: (text: string, options: { model: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2'; cardType: 'basic' | 'cloze' | 'mixed'; language: 'de' | 'en'; count: number }) => Promise<{ success: boolean; cards?: Array<{ front: string; back: string; cardType: 'basic' | 'cloze' }>; error?: string }>;
      // AI Generation from PDF
      generateFlashcardsFromPDF: (filePath: string, pageNumbers: number[], options: { model: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2'; cardType: 'basic' | 'cloze' | 'mixed'; language: 'de' | 'en'; count: number }) => Promise<{ success: boolean; cards?: Array<{ front: string; back: string; cardType: 'basic' | 'cloze' }>; error?: string }>;
      // PDF Page Text Extraction
      getPdfPageText: (filePath: string, pageNumbers: number[]) => Promise<{ success: boolean; text?: string; pageCount?: number; error?: string }>;
      // API Usage / Cost Tracking
      getApiUsageStats: () => Promise<{ totalCostUsd: number; totalTokens: number; callCount: number; costByModel: Record<string, number>; costByOperation: Record<string, number>; recentUsage: Array<{ id: number; model: string; operation: string; promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; createdAt: string }> }>;
      clearApiUsage: () => Promise<{ success: boolean }>;
      // Events
      onIndexingProgress: (callback: (status: IndexingStatus) => void) => () => void;
      onPdfAdded: (callback: (pdfs: PDFDocument[]) => void) => () => void;
      onPdfRemoved: (callback: (pdfs: PDFDocument[]) => void) => () => void;
      onOCRProgress: (callback: (status: OCRStatus) => void) => () => void;
    };
  }
}
