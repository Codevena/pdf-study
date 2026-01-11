import { create } from 'zustand';
import type {
  PDFDocument,
  SearchResult,
  AppSettings,
  IndexingStatus,
  OCRStatus,
  Bookmark,
  FlashcardDeck,
  FlashcardWithFSRS,
  FlashcardStats,
} from '../../shared/types';

// Extended type with next intervals
interface FlashcardWithIntervals extends FlashcardWithFSRS {
  nextIntervals: { again: string; hard: string; good: string; easy: string };
}

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
  sidebarView: 'library' | 'search' | 'bookmarks' | 'recent' | 'flashcards';
  setSidebarView: (view: 'library' | 'search' | 'bookmarks' | 'recent' | 'flashcards') => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  mainContentView: 'pdf' | 'study';
  setMainContentView: (view: 'pdf' | 'study') => void;
  presentationMode: boolean;
  setPresentationMode: (mode: boolean) => void;
  libraryViewMode: 'list' | 'grid';
  setLibraryViewMode: (mode: 'list' | 'grid') => void;
  showStudyDeckSelector: boolean;
  setShowStudyDeckSelector: (show: boolean) => void;
  studyDeckId: number | null;
  setStudyDeckId: (deckId: number | null) => void;

  // Flashcards
  flashcardDecks: FlashcardDeck[];
  setFlashcardDecks: (decks: FlashcardDeck[]) => void;
  currentDeck: FlashcardDeck | null;
  setCurrentDeck: (deck: FlashcardDeck | null) => void;
  flashcards: FlashcardWithFSRS[];
  setFlashcards: (cards: FlashcardWithFSRS[]) => void;
  dueFlashcards: FlashcardWithIntervals[];
  setDueFlashcards: (cards: FlashcardWithIntervals[]) => void;
  flashcardStats: FlashcardStats | null;
  setFlashcardStats: (stats: FlashcardStats | null) => void;
  isStudying: boolean;
  setIsStudying: (studying: boolean) => void;
  currentStudyCard: FlashcardWithIntervals | null;
  setCurrentStudyCard: (card: FlashcardWithIntervals | null) => void;
  studyCardIndex: number;
  setStudyCardIndex: (index: number) => void;
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
  mainContentView: 'pdf',
  setMainContentView: (mainContentView) => set({ mainContentView }),
  presentationMode: false,
  setPresentationMode: (presentationMode) => set({ presentationMode }),
  libraryViewMode: 'list',
  setLibraryViewMode: (libraryViewMode) => set({ libraryViewMode }),
  showStudyDeckSelector: false,
  setShowStudyDeckSelector: (showStudyDeckSelector) => set({ showStudyDeckSelector }),
  studyDeckId: null,
  setStudyDeckId: (studyDeckId) => set({ studyDeckId }),

  // Flashcards
  flashcardDecks: [],
  setFlashcardDecks: (flashcardDecks) => set({ flashcardDecks }),
  currentDeck: null,
  setCurrentDeck: (currentDeck) => set({ currentDeck }),
  flashcards: [],
  setFlashcards: (flashcards) => set({ flashcards }),
  dueFlashcards: [],
  setDueFlashcards: (dueFlashcards) => set({ dueFlashcards }),
  flashcardStats: null,
  setFlashcardStats: (flashcardStats) => set({ flashcardStats }),
  isStudying: false,
  setIsStudying: (isStudying) => set({ isStudying }),
  currentStudyCard: null,
  setCurrentStudyCard: (currentStudyCard) => set({ currentStudyCard }),
  studyCardIndex: 0,
  setStudyCardIndex: (studyCardIndex) => set({ studyCardIndex }),
}));
