// PDF Types
export interface PDFDocument {
  id: number;
  filePath: string;
  fileName: string;
  fileHash: string;
  pageCount: number;
  indexedAt: string | null;
  ocrCompleted: boolean;
}

export interface PDFPage {
  pdfId: number;
  pageNum: number;
  content: string;
}

// Search Types
export interface SearchResult {
  id: number;
  fileName: string;
  filePath: string;
  pageNum: number;
  snippet: string;
  rank: number;
}

// Tag Types
export interface Tag {
  id: number;
  name: string;
  color: string;
}

// Bookmark Types
export interface Bookmark {
  id: number;
  pdfId: number;
  pageNum: number;
  title: string | null;
  createdAt: string;
}

// Note Types
export interface Note {
  id: number;
  pdfId: number;
  pageNum: number;
  content: string;
  positionX: number | null;
  positionY: number | null;
  createdAt: string;
  updatedAt: string;
}

// Recent View Types
export interface RecentView {
  pdfId: number;
  fileName: string;
  filePath: string;
  pageNum: number;
  viewedAt: string;
}

// Search History Types
export interface SearchHistoryItem {
  id: number;
  query: string;
  resultCount: number;
  searchedAt: string;
}

// App State Types
export interface AppSettings {
  pdfFolder: string | null;
  theme: 'light' | 'dark';
  ocrEnabled: boolean;
  ocrLanguages: string[];
  searchLimit: number;
  searchMode: 'exact' | 'fuzzy' | 'intelligent';
  // OpenAI Settings
  openaiApiKey: string | null;
  openaiModel: OpenAIModel;
  // Flashcard Settings
  flashcardLanguage: 'de' | 'en';
  dailyNewCards: number;
  dailyReviewCards: number;
}

// Indexing Status
export interface IndexingStatus {
  isIndexing: boolean;
  totalFiles: number;
  processedFiles: number;
  currentFile: string | null;
}

// OCR Status
export interface OCRStatus {
  isProcessing: boolean;
  pdfId: number | null;
  fileName: string | null;
  currentPage: number;
  totalPages: number;
  pagesNeedingOCR: number;
  processedPages: number;
  queuedPdfs: number;
}

// PDF Outline / Table of Contents
export interface OutlineItem {
  title: string;
  pageIndex: number;
  children: OutlineItem[];
}

// Highlight Types
export interface HighlightRect {
  x: number;      // percentage of page width
  y: number;      // percentage of page height
  width: number;  // percentage of page width
  height: number; // percentage of page height
}

export interface Highlight {
  id: number;
  pdfId: number;
  pageNum: number;
  color: string;
  textContent: string;
  rects: HighlightRect[];
  createdAt: string;
}

// Flashcard Types
export interface FlashcardDeck {
  id: number;
  pdfId: number | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  cardCount?: number;
  dueCount?: number;
}

export type FlashcardType = 'basic' | 'cloze';

export interface Flashcard {
  id: number;
  deckId: number;
  highlightId: number | null;
  front: string;
  back: string;
  cardType: FlashcardType;
  clozeData: string | null;
  sourcePage: number | null;
  createdAt: string;
  updatedAt: string;
}

// FSRS v4.5 Types
export type FSRSState = 0 | 1 | 2 | 3; // New, Learning, Review, Relearning
export type FSRSRating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface FlashcardFSRS {
  id: number;
  flashcardId: number;
  difficulty: number;
  stability: number;
  retrievability: number;
  state: FSRSState;
  due: string;
  lastReview: string | null;
  reps: number;
  lapses: number;
  scheduledDays: number;
  elapsedDays: number;
}

export interface FlashcardWithFSRS extends Flashcard {
  fsrs: FlashcardFSRS;
}

export interface FlashcardReview {
  id: number;
  flashcardId: number;
  rating: FSRSRating;
  reviewedAt: string;
  scheduledDays: number;
  elapsedDays: number;
  state: FSRSState;
}

export interface FlashcardStats {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  dueToday: number;
  reviewedToday: number;
  streak: number;
}

// AI Generation Types
export type OpenAIModel = 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2';

export interface AIGenerationOptions {
  model: OpenAIModel;
  cardType: 'basic' | 'cloze' | 'mixed';
  language: 'de' | 'en';
  count: number;
}

export interface GeneratedCard {
  front: string;
  back: string;
  cardType: FlashcardType;
}

// Heatmap Types
export type HeatmapTimeframe = 'week' | 'month' | 'year';

export interface HeatmapDataPoint {
  date: string;   // YYYY-MM-DD
  count: number;
}

export interface HeatmapData {
  data: HeatmapDataPoint[];
  maxCount: number;
  totalReviews: number;
  streak: number;
  startDate: string;
  endDate: string;
}
