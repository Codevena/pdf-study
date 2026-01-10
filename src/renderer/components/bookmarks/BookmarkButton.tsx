import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';

interface BookmarkButtonProps {
  pdfId: number;
  pageNum: number;
}

export default function BookmarkButton({ pdfId, pageNum }: BookmarkButtonProps) {
  const { bookmarks, addBookmark, removeBookmark } = useAppStore();
  const [loading, setLoading] = useState(false);

  const isBookmarked = bookmarks.some((b) => b.pdfId === pdfId && b.pageNum === pageNum);

  const toggleBookmark = async () => {
    setLoading(true);
    try {
      if (isBookmarked) {
        await window.electronAPI.removeBookmark(pdfId, pageNum);
        removeBookmark(pdfId, pageNum);
      } else {
        const bookmarkId = await window.electronAPI.addBookmark(pdfId, pageNum, `Seite ${pageNum}`);
        addBookmark({
          id: bookmarkId,
          pdfId,
          pageNum,
          title: `Seite ${pageNum}`,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleBookmark}
      disabled={loading}
      className={`p-1.5 rounded transition-colors ${
        isBookmarked
          ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'
      }`}
      title={isBookmarked ? 'Lesezeichen entfernen' : 'Lesezeichen hinzufügen'}
    >
      <svg
        className="w-4 h-4"
        fill={isBookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  );
}
