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
