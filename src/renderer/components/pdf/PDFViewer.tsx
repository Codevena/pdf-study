import { useState, useEffect, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAppStore } from '../../stores/appStore';
import BookmarkButton from '../bookmarks/BookmarkButton';
import NotesSidebar from '../notes/NotesSidebar';
import PageThumbnails from './PageThumbnails';
import TableOfContents from './TableOfContents';
import HighlightToolbar from './HighlightToolbar';
import HighlightsSidebar from './HighlightsSidebar';
import type { Highlight, HighlightRect } from '../../../shared/types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer() {
  const { currentPdf, currentPage, setCurrentPage, searchQuery } = useAppStore();
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showHighlightsSidebar, setShowHighlightsSidebar] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectionData, setSelectionData] = useState<{
    text: string;
    rects: HighlightRect[];
    toolbarPosition: { x: number; y: number };
  } | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Load PDF using custom protocol (efficient streaming, no base64)
  useEffect(() => {
    if (currentPdf) {
      setLoading(true);
      // Use custom protocol for efficient PDF loading
      // This streams the PDF directly from disk without base64 encoding
      const protocolUrl = `local-pdf://${encodeURIComponent(currentPdf.filePath)}`;
      setPdfData(protocolUrl);
    }
  }, [currentPdf]);

  // Load highlights when page changes
  useEffect(() => {
    async function loadHighlights() {
      if (currentPdf) {
        const pageHighlights = await window.electronAPI.getHighlights(currentPdf.id, currentPage);
        setHighlights(pageHighlights);
      }
    }
    loadHighlights();
  }, [currentPdf, currentPage]);

  // Get page dimensions for calculating relative positions
  const getPageDimensions = useCallback(() => {
    if (!pageRef.current) return null;
    const canvas = pageRef.current.querySelector('.react-pdf__Page__canvas');
    if (!canvas) return null;
    return {
      width: (canvas as HTMLCanvasElement).offsetWidth,
      height: (canvas as HTMLCanvasElement).offsetHeight,
    };
  }, []);

  // Merge overlapping rectangles to prevent double-highlighting (e.g., umlauts)
  const mergeOverlappingRects = useCallback((rects: HighlightRect[]): HighlightRect[] => {
    if (rects.length <= 1) return rects;

    // Sort by y position first, then by x
    const sorted = [...rects].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > 1) return yDiff; // Different lines
      return a.x - b.x; // Same line, sort by x
    });

    const merged: HighlightRect[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // Check if rects are on the same line (y values close) and overlap or touch
      const sameLine = Math.abs(current.y - next.y) < 2;
      const overlapsX = next.x <= current.x + current.width + 0.5; // Small tolerance

      if (sameLine && overlapsX) {
        // Merge: extend current rect to include next
        const newRight = Math.max(current.x + current.width, next.x + next.width);
        const newBottom = Math.max(current.y + current.height, next.y + next.height);
        current.width = newRight - current.x;
        current.height = Math.max(current.height, newBottom - current.y);
      } else {
        // No overlap, save current and start new
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    return merged;
  }, []);

  // Handle text selection - calculate precise rectangles for the selected text
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !pageRef.current) {
      setSelectionData(null);
      return;
    }

    const pageDimensions = getPageDimensions();
    if (!pageDimensions) return;

    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();

    if (clientRects.length === 0) return;

    // Get the page element's bounding rect for relative positioning
    const canvas = pageRef.current.querySelector('.react-pdf__Page__canvas');
    if (!canvas) return;
    const pageRect = canvas.getBoundingClientRect();

    // Convert client rects to percentage-based coordinates relative to page
    const rects: HighlightRect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      // Skip very small rects (often artifacts)
      if (rect.width < 2 || rect.height < 2) continue;

      rects.push({
        x: ((rect.left - pageRect.left) / pageDimensions.width) * 100,
        y: ((rect.top - pageRect.top) / pageDimensions.height) * 100,
        width: (rect.width / pageDimensions.width) * 100,
        height: (rect.height / pageDimensions.height) * 100,
      });
    }

    if (rects.length === 0) return;

    // Merge overlapping rects (fixes double-highlighting on umlauts)
    const mergedRects = mergeOverlappingRects(rects);

    // Get position for toolbar (use first rect)
    const firstRect = clientRects[0];
    const toolbarPosition = {
      x: firstRect.left + firstRect.width / 2,
      y: firstRect.top - 10,
    };

    setSelectionData({
      text: selection.toString(),
      rects: mergedRects,
      toolbarPosition,
    });
  }, [getPageDimensions, mergeOverlappingRects]);

  // Check if two rect arrays overlap (for merging highlights)
  const rectsOverlap = useCallback((rects1: HighlightRect[], rects2: HighlightRect[]): boolean => {
    for (const r1 of rects1) {
      for (const r2 of rects2) {
        // Rects overlap if on same line and horizontally overlap/touch
        const sameLine = Math.abs(r1.y - r2.y) < 2;
        const horizontalOverlap = r1.x < r2.x + r2.width + 1 && r1.x + r1.width + 1 > r2.x;
        if (sameLine && horizontalOverlap) return true;
      }
    }
    return false;
  }, []);

  // Handle highlight creation (with merge logic for overlapping highlights)
  const handleCreateHighlight = useCallback(async (color: string) => {
    if (!selectionData || !currentPdf) return;

    // Find existing highlights on this page with the same color that overlap
    const overlapping = highlights.filter(h =>
      h.color === color && rectsOverlap(h.rects, selectionData.rects)
    );

    if (overlapping.length > 0) {
      // Merge: combine rects from all overlapping highlights
      let mergedRects = [...selectionData.rects];
      let mergedText = selectionData.text;

      for (const h of overlapping) {
        mergedRects = [...mergedRects, ...h.rects];
        // Append text if not already included
        if (!mergedText.includes(h.textContent) && !h.textContent.includes(mergedText)) {
          mergedText = mergedText + ' ' + h.textContent;
        }
        // Delete old overlapping highlight
        await window.electronAPI.deleteHighlight(h.id);
      }

      // Merge overlapping rects into continuous regions
      mergedRects = mergeOverlappingRects(mergedRects);

      // Create new merged highlight
      await window.electronAPI.addHighlight(
        currentPdf.id,
        currentPage,
        color,
        mergedText.trim(),
        mergedRects
      );
    } else {
      // No overlap - create highlight normally
      await window.electronAPI.addHighlight(
        currentPdf.id,
        currentPage,
        color,
        selectionData.text,
        selectionData.rects
      );
    }

    // Reload highlights
    const pageHighlights = await window.electronAPI.getHighlights(currentPdf.id, currentPage);
    setHighlights(pageHighlights);

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectionData(null);
  }, [selectionData, currentPdf, currentPage, highlights, rectsOverlap, mergeOverlappingRects]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  }, [numPages, setCurrentPage]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle if user is typing in an input
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key) {
      // Page Navigation
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        goToPage(currentPage - 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ': // Space
        e.preventDefault();
        goToPage(currentPage + 1);
        break;
      case 'Home':
        e.preventDefault();
        goToPage(1);
        break;
      case 'End':
        e.preventDefault();
        goToPage(numPages);
        break;

      // Zoom
      case '+':
      case '=':
        e.preventDefault();
        setScale((s) => Math.min(3, s + 0.2));
        break;
      case '-':
        e.preventDefault();
        setScale((s) => Math.max(0.5, s - 0.2));
        break;
      case '0':
        e.preventDefault();
        setScale(1);
        break;

      // Sidebars
      case 'Escape':
        if (showNotes) setShowNotes(false);
        if (showThumbnails) setShowThumbnails(false);
        if (showToc) setShowToc(false);
        if (showHighlightsSidebar) setShowHighlightsSidebar(false);
        break;
      case 't':
        if (!e.metaKey && !e.ctrlKey) {
          setShowThumbnails((s) => !s);
        }
        break;
      case 'n':
        if (!e.metaKey && !e.ctrlKey) {
          setShowNotes((s) => !s);
        }
        break;
      case 'i':
        if (!e.metaKey && !e.ctrlKey) {
          setShowToc((s) => !s);
        }
        break;
      case 'h':
        if (!e.metaKey && !e.ctrlKey) {
          setShowHighlightsSidebar((s) => !s);
        }
        break;
    }
  }, [currentPage, numPages, goToPage, showNotes, showThumbnails, showToc, showHighlightsSidebar]);

  // Highlight search terms in the text layer (optimized with early exit)
  const highlightSearchTerms = useCallback(() => {
    if (!pageRef.current) return;

    const textLayer = pageRef.current.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) return;

    // If no search query, remove all highlights efficiently
    if (!searchQuery) {
      textLayer.querySelectorAll('.search-highlight').forEach((span) => {
        span.classList.remove('search-highlight');
      });
      return;
    }

    const spans = textLayer.querySelectorAll('span');
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    // Use a single loop with classList toggle for better performance
    spans.forEach((span) => {
      const text = span.textContent?.toLowerCase() || '';
      const hasMatch = searchTerms.some(term => text.includes(term));
      span.classList.toggle('search-highlight', hasMatch);
    });
  }, [searchQuery]);

  // Keyboard handler - only active when PDF is loaded
  useEffect(() => {
    if (!currentPdf || !pdfData) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, currentPdf, pdfData]);

  // Text selection handler - only active when PDF is visible and not loading
  useEffect(() => {
    if (!currentPdf || loading) return;

    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [handleTextSelection, currentPdf, loading]);

  // Apply search highlighting after page renders
  useEffect(() => {
    const timer = setTimeout(() => {
      highlightSearchTerms();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentPage, loading, highlightSearchTerms]);

  if (!currentPdf) {
    return null;
  }

  if (!pdfData) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">PDF wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Main PDF Area */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-xs">
              {currentPdf.fileName}
            </h2>
            <BookmarkButton pdfId={currentPdf.id} pageNum={currentPage} />
            <button
              onClick={async () => {
                const result = await window.electronAPI.exportPdfData(currentPdf.id);
                if (result.success) {
                  console.log('Exported to:', result.filePath);
                } else if (result.error) {
                  console.error('Export error:', result.error);
                }
              }}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Als Markdown exportieren"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Vorherige Seite"
            >
              <svg className="w-4 h-4 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1 text-sm">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-12 text-center border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-1 py-0.5"
                min={1}
                max={numPages}
              />
              <span className="text-gray-500 dark:text-gray-300">/ {numPages}</span>
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Nächste Seite"
            >
              <svg className="w-4 h-4 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Zoom Controls - always visible */}
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Verkleinern"
            >
              <svg className="w-4 h-4 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            <span className="text-sm text-gray-600 dark:text-gray-300 w-10 md:w-12 text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Vergrößern"
            >
              <svg className="w-4 h-4 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1 hidden md:block" />

            {/* Desktop: Individual sidebar toggle buttons */}
            <div className="hidden md:flex items-center gap-2">
              {/* Table of Contents Toggle */}
              <button
                onClick={() => setShowToc(!showToc)}
                className={`p-1.5 rounded transition-colors ${showToc ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}
                title="Inhaltsverzeichnis (i)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>

              {/* Page Thumbnails Toggle */}
              <button
                onClick={() => setShowThumbnails(!showThumbnails)}
                className={`p-1.5 rounded transition-colors ${showThumbnails ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}
                title="Seitenübersicht (t)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>

              {/* Notes Toggle */}
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`p-1.5 rounded transition-colors ${showNotes ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}
                title="Notizen (n)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {/* Highlights Toggle */}
              <button
                onClick={() => setShowHighlightsSidebar(!showHighlightsSidebar)}
                className={`p-1.5 rounded transition-colors ${showHighlightsSidebar ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}
                title="Markierungen (h)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>

            {/* Mobile: Dropdown menu for sidebar toggles */}
            <div className="relative md:hidden group">
              <button
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors dark:text-gray-300"
                title="Mehr Optionen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hidden group-focus-within:block z-50">
                <button
                  onClick={() => setShowToc(!showToc)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Inhaltsverzeichnis
                </button>
                <button
                  onClick={() => setShowThumbnails(!showThumbnails)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Seitenübersicht
                </button>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Notizen
                </button>
                <button
                  onClick={() => setShowHighlightsSidebar(!showHighlightsSidebar)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Markierungen
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex justify-center" ref={pageRef}>
            <Document
              file={pdfData}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }
              error={
                <div className="text-center text-red-500 p-8">
                  <p>Fehler beim Laden der PDF</p>
                  <p className="text-sm mt-1">{currentPdf.filePath}</p>
                </div>
              }
            >
              {!loading && (
                <div className="relative">
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-lg"
                    onRenderSuccess={() => {
                      highlightSearchTerms();
                    }}
                  />
                  {/* Highlight Overlays - optimized SVG rendering */}
                  {highlights.length > 0 && (
                    <svg
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: '100%', height: '100%', mixBlendMode: 'multiply' }}
                    >
                      {highlights.map((highlight) => (
                        highlight.rects.map((rect, rectIndex) => (
                          <rect
                            key={`${highlight.id}-${rectIndex}`}
                            x={`${rect.x}%`}
                            y={`${rect.y}%`}
                            width={`${rect.width}%`}
                            height={`${rect.height}%`}
                            fill={highlight.color}
                            fillOpacity={0.4}
                          />
                        ))
                      ))}
                    </svg>
                  )}
                </div>
              )}
            </Document>
          </div>
        </div>
      </div>

      {/* Table of Contents Sidebar */}
      {showToc && currentPdf && (
        <TableOfContents
          filePath={currentPdf.filePath}
          onNavigate={(pageIndex) => goToPage(pageIndex + 1)}
          onClose={() => setShowToc(false)}
        />
      )}

      {/* Page Thumbnails Sidebar */}
      {showThumbnails && pdfData && (
        <PageThumbnails
          pdfData={pdfData}
          numPages={numPages}
          onClose={() => setShowThumbnails(false)}
        />
      )}

      {/* Notes Sidebar */}
      {showNotes && (
        <NotesSidebar
          pdfId={currentPdf.id}
          pageNum={currentPage}
          onClose={() => setShowNotes(false)}
        />
      )}

      {/* Highlights Sidebar */}
      {showHighlightsSidebar && currentPdf && (
        <HighlightsSidebar
          pdfId={currentPdf.id}
          currentPage={currentPage}
          onNavigate={(pageNum) => {
            goToPage(pageNum);
            setShowHighlightsSidebar(false);
          }}
          onClose={() => setShowHighlightsSidebar(false)}
          onHighlightDeleted={async () => {
            // Reload highlights for current page
            const pageHighlights = await window.electronAPI.getHighlights(currentPdf.id, currentPage);
            setHighlights(pageHighlights);
          }}
        />
      )}

      {/* Highlight Toolbar */}
      {selectionData && (
        <HighlightToolbar
          position={selectionData.toolbarPosition}
          onHighlight={handleCreateHighlight}
          onClose={() => {
            window.getSelection()?.removeAllRanges();
            setSelectionData(null);
          }}
        />
      )}
    </div>
  );
}
