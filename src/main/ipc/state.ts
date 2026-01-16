import type { IndexingStatus, OCRStatus, SearchResult } from '../../shared/types';

// Shared state across IPC handlers
export let indexingStatus: IndexingStatus = {
  isIndexing: false,
  totalFiles: 0,
  processedFiles: 0,
  currentFile: null,
};

export let ocrStatus: OCRStatus = {
  isProcessing: false,
  pdfId: null,
  fileName: null,
  currentPage: 0,
  totalPages: 0,
  pagesNeedingOCR: 0,
  processedPages: 0,
  queuedPdfs: 0,
};

export let ocrCancelled = false;

// State setters (needed since we're exporting let variables)
export function setIndexingStatus(status: IndexingStatus): void {
  indexingStatus = status;
}

export function setOcrStatus(status: OCRStatus): void {
  ocrStatus = status;
}

export function setOcrCancelled(cancelled: boolean): void {
  ocrCancelled = cancelled;
}

export function updateIndexingStatus(updates: Partial<IndexingStatus>): void {
  indexingStatus = { ...indexingStatus, ...updates };
}

export function updateOcrStatus(updates: Partial<OCRStatus>): void {
  ocrStatus = { ...ocrStatus, ...updates };
}

// LRU cache for search results (performance optimization)
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const SEARCH_CACHE_MAX_SIZE = 50;
const SEARCH_CACHE_TTL = 60000; // 1 minute

export function getCachedSearchResults(cacheKey: string): SearchResult[] | null {
  const cached = searchCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  // Check TTL
  if (Date.now() - cached.timestamp >= SEARCH_CACHE_TTL) {
    searchCache.delete(cacheKey);
    return null;
  }

  // LRU: Move to end by deleting and re-inserting (Map maintains insertion order)
  searchCache.delete(cacheKey);
  searchCache.set(cacheKey, cached);

  return cached.results;
}

export function setCachedSearchResults(cacheKey: string, results: SearchResult[]): void {
  // If key already exists, delete first to update position
  if (searchCache.has(cacheKey)) {
    searchCache.delete(cacheKey);
  }

  // Evict oldest entries (first in Map) if cache is full
  while (searchCache.size >= SEARCH_CACHE_MAX_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) {
      searchCache.delete(oldestKey);
    } else {
      break;
    }
  }

  searchCache.set(cacheKey, { results, timestamp: Date.now() });
}

export function clearSearchCache(): void {
  searchCache.clear();
}
