import { useAppStore } from '../../stores/appStore';
import type { SearchResult } from '../../../shared/types';

/**
 * Safely render search snippet with only <mark> tags allowed.
 * Prevents XSS by escaping all HTML except the safe highlight markers.
 */
function SafeSnippet({ html }: { html: string }) {
  // Split by <mark> and </mark> tags, keeping the delimiters
  const parts = html.split(/(<mark>|<\/mark>)/gi);

  let isHighlighted = false;
  const elements: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part.toLowerCase() === '<mark>') {
      isHighlighted = true;
    } else if (part.toLowerCase() === '</mark>') {
      isHighlighted = false;
    } else if (part) {
      // Escape any remaining HTML entities for safety
      const textContent = part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (isHighlighted) {
        elements.push(
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
            {textContent}
          </mark>
        );
      } else {
        elements.push(textContent);
      }
    }
  });

  return <>{elements}</>;
}

export default function SearchResults() {
  const { searchResults, searchQuery, isSearching, setCurrentPdf, setCurrentPage, pdfs } = useAppStore();

  const handleResultClick = async (result: SearchResult) => {
    // Find the PDF in our list
    const pdf = pdfs.find((p) => p.id === result.id);
    if (pdf) {
      setCurrentPdf(pdf);
      setCurrentPage(result.pageNum);
    }
  };

  if (isSearching) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Suche...</p>
        </div>
      </div>
    );
  }

  if (!searchQuery) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 p-4">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">Gib einen Suchbegriff ein</p>
        </div>
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 p-4">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 110 20 10 10 0 010-20z" />
          </svg>
          <p className="text-sm">Keine Ergebnisse für</p>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">"{searchQuery}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        {searchResults.length} Ergebnis{searchResults.length !== 1 ? 'se' : ''} für "{searchQuery}"
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {searchResults.map((result, index) => (
          <li key={`${result.id}-${result.pageNum}-${index}`}>
            <button
              onClick={() => handleResultClick(result)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded flex items-center justify-center text-xs font-medium">
                  S.{result.pageNum}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {result.fileName}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                    <SafeSnippet html={result.snippet} />
                  </p>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
