import { create } from 'zustand';
import type { PDFDocument, SearchResult, AppSettings, IndexingStatus, OCRStatus, Bookmark } from '../../shared/types';

interface AppState {
  // Settings
  settings: AppSettings | null;
  setSettings: (settings: AppSettings) => void;

  // PDFs
  pdfs: PDFDocument[];
  setPdfs: (pdfs: PDFDocument[]) => void;

  // Bookmarks
  bookmarks: Bookmark[];
  setBookmarks: (bookmarks: Bookmark[]) => void;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (pdfId: number, pageNum: number) => void;

  // Current PDF
  currentPdf: PDFDocument | null;
  currentPage: number;
  setCurrentPdf: (pdf: PDFDocument | null) => void;
  setCurrentPage: (page: number) => void;

  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setIsSearching: (isSearching: boolean) => void;

  // Indexing
  indexingStatus: IndexingStatus;
  setIndexingStatus: (status: IndexingStatus) => void;

  // OCR
  ocrStatus: OCRStatus;
  setOCRStatus: (status: OCRStatus) => void;

  // UI State
  sidebarView: 'library' | 'search' | 'bookmarks' | 'recent';
  setSidebarView: (view: 'library' | 'search' | 'bookmarks' | 'recent') => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Settings
  settings: null,
  setSettings: (settings) => set({ settings }),

  // PDFs
  pdfs: [],
  setPdfs: (pdfs) => set({ pdfs }),

  // Bookmarks
  bookmarks: [],
  setBookmarks: (bookmarks) => set({ bookmarks }),
  addBookmark: (bookmark) => set((state) => ({
    bookmarks: [...state.bookmarks, bookmark]
  })),
  removeBookmark: (pdfId, pageNum) => set((state) => ({
    bookmarks: state.bookmarks.filter(b => !(b.pdfId === pdfId && b.pageNum === pageNum))
  })),

  // Current PDF
  currentPdf: null,
  currentPage: 1,
  setCurrentPdf: (currentPdf) => {
    set({ currentPdf, currentPage: 1 });
    // Track recent view
    if (currentPdf) {
      window.electronAPI.addRecentView(currentPdf.id, 1);
    }
  },
  setCurrentPage: (currentPage) => {
    set({ currentPage });
    // Update recent view page in database
    const currentPdf = get().currentPdf;
    if (currentPdf) {
      window.electronAPI.updateRecentViewPage(currentPdf.id, currentPage);
    }
  },

  // Search
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setIsSearching: (isSearching) => set({ isSearching }),

  // Indexing
  indexingStatus: {
    isIndexing: false,
    totalFiles: 0,
    processedFiles: 0,
    currentFile: null,
  },
  setIndexingStatus: (indexingStatus) => set({ indexingStatus }),

  // OCR
  ocrStatus: {
    isProcessing: false,
    pdfId: null,
    fileName: null,
    currentPage: 0,
    totalPages: 0,
    pagesNeedingOCR: 0,
    processedPages: 0,
    queuedPdfs: 0,
  },
  setOCRStatus: (ocrStatus) => set({ ocrStatus }),

  // UI State
  sidebarView: 'library',
  setSidebarView: (sidebarView) => set({ sidebarView }),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
}));
