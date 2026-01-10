import { useAppStore } from '../../stores/appStore';
import type { Bookmark, PDFDocument } from '../../../shared/types';

export default function BookmarkList() {
  const { bookmarks, pdfs, setCurrentPdf, setCurrentPage, removeBookmark } = useAppStore();

  // Enrich bookmarks with PDF info
  const enrichedBookmarks = bookmarks.map((bookmark) => ({
    ...bookmark,
    pdf: pdfs.find((p) => p.id === bookmark.pdfId),
  }));

  const handleBookmarkClick = (bookmark: Bookmark & { pdf?: PDFDocument }) => {
    if (bookmark.pdf) {
      setCurrentPdf(bookmark.pdf);
      setCurrentPage(bookmark.pageNum);
    }
  };

  const handleRemoveBookmark = async (bookmark: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    await window.electronAPI.removeBookmark(bookmark.pdfId, bookmark.pageNum);
    removeBookmark(bookmark.pdfId, bookmark.pageNum);
  };

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <p className="text-sm text-center">Keine Lesezeichen</p>
        <p className="text-xs text-center mt-1">Klicke auf das Lesezeichen-Symbol im PDF-Viewer</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {enrichedBookmarks.map((bookmark) => (
          <li key={bookmark.id}>
            <div
              onClick={() => handleBookmarkClick(bookmark)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400 rounded flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {bookmark.pdf?.fileName || 'Unbekannte PDF'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Seite {bookmark.pageNum}
                    {bookmark.title && ` - ${bookmark.title}`}
                  </p>
                </div>
                <button
                  onClick={(e) => handleRemoveBookmark(bookmark, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-500 transition-all"
                  title="Lesezeichen entfernen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
