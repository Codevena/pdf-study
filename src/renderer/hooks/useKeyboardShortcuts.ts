import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';

export function useKeyboardShortcuts() {
  const {
    currentPdf,
    currentPage,
    setCurrentPage,
    bookmarks,
    addBookmark,
    removeBookmark,
    setSidebarView,
  } = useAppStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Only allow Escape in input fields
      if (e.key !== 'Escape') {
        return;
      }
    }

    // Get total pages for current PDF
    const totalPages = currentPdf?.pageCount || 0;

    switch (e.key) {
      // Navigation
      case 'ArrowLeft':
        if (currentPdf && currentPage > 1) {
          e.preventDefault();
          setCurrentPage(currentPage - 1);
        }
        break;

      case 'ArrowRight':
        if (currentPdf && currentPage < totalPages) {
          e.preventDefault();
          setCurrentPage(currentPage + 1);
        }
        break;

      case 'Home':
        if (currentPdf) {
          e.preventDefault();
          setCurrentPage(1);
        }
        break;

      case 'End':
        if (currentPdf && totalPages > 0) {
          e.preventDefault();
          setCurrentPage(totalPages);
        }
        break;

      case 'PageUp':
        if (currentPdf && currentPage > 1) {
          e.preventDefault();
          setCurrentPage(Math.max(1, currentPage - 10));
        }
        break;

      case 'PageDown':
        if (currentPdf && currentPage < totalPages) {
          e.preventDefault();
          setCurrentPage(Math.min(totalPages, currentPage + 10));
        }
        break;

      // Bookmark toggle (Ctrl+B or Cmd+B)
      case 'b':
      case 'B':
        if ((e.ctrlKey || e.metaKey) && currentPdf) {
          e.preventDefault();
          const isBookmarked = bookmarks.some(
            (b) => b.pdfId === currentPdf.id && b.pageNum === currentPage
          );

          if (isBookmarked) {
            window.electronAPI.removeBookmark(currentPdf.id, currentPage);
            removeBookmark(currentPdf.id, currentPage);
          } else {
            window.electronAPI.addBookmark(currentPdf.id, currentPage, `Seite ${currentPage}`).then((id) => {
              addBookmark({
                id,
                pdfId: currentPdf.id,
                pageNum: currentPage,
                title: `Seite ${currentPage}`,
                createdAt: new Date().toISOString(),
              });
            });
          }
        }
        break;

      // Search focus (Ctrl+F or Cmd+F)
      case 'f':
      case 'F':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setSidebarView('search');
          // Focus the search input
          setTimeout(() => {
            const searchInput = document.querySelector('input[placeholder*="Suche"]') as HTMLInputElement;
            searchInput?.focus();
          }, 100);
        }
        break;

      // Sidebar tabs (1-4)
      case '1':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setSidebarView('library');
        }
        break;

      case '2':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setSidebarView('search');
        }
        break;

      case '3':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setSidebarView('bookmarks');
        }
        break;

      case '4':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setSidebarView('recent');
        }
        break;

      // Escape - close modals, clear search
      case 'Escape':
        // Blur any focused element
        (document.activeElement as HTMLElement)?.blur();
        break;
    }
  }, [currentPdf, currentPage, setCurrentPage, bookmarks, addBookmark, removeBookmark, setSidebarView]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
