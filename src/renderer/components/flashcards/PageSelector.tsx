import { useState, useMemo, useCallback } from 'react';

interface PageSelectorProps {
  totalPages: number;
  selectedPages: number[];
  onSelectionChange: (pages: number[]) => void;
  maxRecommended?: number;
}

export default function PageSelector({
  totalPages,
  selectedPages,
  onSelectionChange,
  maxRecommended = 30,
}: PageSelectorProps) {
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  // Toggle a single page
  const togglePage = useCallback((pageNum: number, shiftKey: boolean) => {
    if (shiftKey && rangeStart !== null) {
      // Range selection with shift
      const start = Math.min(rangeStart, pageNum);
      const end = Math.max(rangeStart, pageNum);
      const rangePages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

      // Add range to selection (union)
      const newSelection = new Set([...selectedPages, ...rangePages]);
      onSelectionChange(Array.from(newSelection).sort((a, b) => a - b));
    } else {
      // Toggle single page
      if (selectedPages.includes(pageNum)) {
        onSelectionChange(selectedPages.filter(p => p !== pageNum));
      } else {
        onSelectionChange([...selectedPages, pageNum].sort((a, b) => a - b));
      }
      setRangeStart(pageNum);
    }
  }, [selectedPages, onSelectionChange, rangeStart]);

  // Select all pages
  const selectAll = useCallback(() => {
    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    onSelectionChange(allPages);
  }, [totalPages, onSelectionChange]);

  // Deselect all
  const deselectAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Select range
  const selectRange = useCallback((start: number, end: number) => {
    const rangePages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    onSelectionChange(rangePages);
  }, [onSelectionChange]);

  // Quick select first N pages
  const selectFirstN = useCallback((n: number) => {
    const pages = Array.from({ length: Math.min(n, totalPages) }, (_, i) => i + 1);
    onSelectionChange(pages);
  }, [totalPages, onSelectionChange]);

  // Group pages into chunks for display
  const pageChunks = useMemo(() => {
    const chunks: number[][] = [];
    const chunkSize = 10;
    for (let i = 0; i < totalPages; i += chunkSize) {
      chunks.push(
        Array.from(
          { length: Math.min(chunkSize, totalPages - i) },
          (_, j) => i + j + 1
        )
      );
    }
    return chunks;
  }, [totalPages]);

  const isOverRecommended = selectedPages.length > maxRecommended;

  return (
    <div className="space-y-3">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={selectAll}
          className="px-2 py-1 text-xs font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/30 rounded hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
        >
          Alle ({totalPages})
        </button>
        <button
          onClick={deselectAll}
          className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Keine
        </button>
        <button
          onClick={() => selectFirstN(10)}
          className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Erste 10
        </button>
        {totalPages > 20 && (
          <button
            onClick={() => selectFirstN(20)}
            className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Erste 20
          </button>
        )}
        {totalPages > 30 && (
          <button
            onClick={() => selectFirstN(30)}
            className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Erste 30
          </button>
        )}
      </div>

      {/* Selection Info */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${isOverRecommended ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {selectedPages.length} von {totalPages} Seiten ausgewahlt
          {isOverRecommended && (
            <span className="ml-1 text-yellow-600 dark:text-yellow-400">
              (empfohlen: max. {maxRecommended})
            </span>
          )}
        </span>
        <span className="text-gray-400 dark:text-gray-500">
          Shift+Klick fur Bereich
        </span>
      </div>

      {/* Page Grid */}
      <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800/50">
        {pageChunks.map((chunk, chunkIndex) => (
          <div key={chunkIndex} className="mb-2 last:mb-0">
            {/* Row label */}
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">
              {chunk[0]}-{chunk[chunk.length - 1]}
            </div>
            {/* Page buttons */}
            <div className="flex flex-wrap gap-1">
              {chunk.map((pageNum) => {
                const isSelected = selectedPages.includes(pageNum);
                return (
                  <button
                    key={pageNum}
                    onClick={(e) => togglePage(pageNum, e.shiftKey)}
                    className={`w-8 h-8 text-xs font-medium rounded transition-all duration-150 ${
                      isSelected
                        ? 'bg-primary-500 text-white shadow-sm transform scale-105'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Pages Summary */}
      {selectedPages.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 rounded p-2 border border-gray-200 dark:border-gray-600">
          <span className="font-medium">Ausgewahlt: </span>
          {formatPageRanges(selectedPages)}
        </div>
      )}
    </div>
  );
}

// Format selected pages as ranges (e.g., "1-5, 8, 10-12")
function formatPageRanges(pages: number[]): string {
  if (pages.length === 0) return '';

  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);

  // Truncate if too long
  const result = ranges.join(', ');
  if (result.length > 50) {
    return result.slice(0, 47) + '...';
  }
  return result;
}
