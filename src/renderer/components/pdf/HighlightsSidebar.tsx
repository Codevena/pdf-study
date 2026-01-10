import { useState, useEffect } from 'react';
import type { Highlight } from '../../../shared/types';

interface HighlightsSidebarProps {
  pdfId: number;
  currentPage: number;
  onNavigate: (pageNum: number) => void;
  onClose: () => void;
  onHighlightDeleted: () => void;
}

const COLOR_NAMES: Record<string, string> = {
  '#FFFF00': 'Gelb',
  '#FF9800': 'Orange',
  '#4CAF50': 'Grün',
  '#2196F3': 'Blau',
  '#E91E63': 'Pink',
};

export default function HighlightsSidebar({
  pdfId,
  currentPage,
  onNavigate,
  onClose,
  onHighlightDeleted,
}: HighlightsSidebarProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHighlights() {
      setLoading(true);
      const allHighlights = await window.electronAPI.getHighlights(pdfId);
      setHighlights(allHighlights);
      setLoading(false);
    }
    loadHighlights();
  }, [pdfId]);

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    onHighlightDeleted();
  };

  const handleColorChange = async (id: number, color: string) => {
    await window.electronAPI.updateHighlightColor(id, color);
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, color } : h))
    );
    onHighlightDeleted(); // Trigger refresh
  };

  // Group highlights by page
  const groupedHighlights = highlights.reduce((acc, h) => {
    if (!acc[h.pageNum]) {
      acc[h.pageNum] = [];
    }
    acc[h.pageNum].push(h);
    return acc;
  }, {} as Record<number, Highlight[]>);

  const sortedPages = Object.keys(groupedHighlights)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onMouseDown={onClose}
      />

      {/* Sidebar - always fixed overlay */}
      <div
        className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full z-50 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Markierungen ({highlights.length})
          </h3>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            title="Schließen"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && highlights.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Keine Markierungen vorhanden
          </div>
        )}

        {!loading && sortedPages.map((pageNum) => (
          <div key={pageNum} className="border-b border-gray-100 dark:border-gray-700">
            {/* Page Header */}
            <div
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wide cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                pageNum === currentPage
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              onClick={() => onNavigate(pageNum)}
            >
              Seite {pageNum}
            </div>

            {/* Highlights for this page */}
            {groupedHighlights[pageNum].map((highlight) => (
              <div
                key={highlight.id}
                className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
              >
                <div className="flex items-start gap-2">
                  {/* Color indicator with hover dropdown */}
                  <div className="relative group/color">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 cursor-pointer border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: highlight.color }}
                      title={COLOR_NAMES[highlight.color] || highlight.color}
                    />
                    {/* Color picker dropdown - only shows when hovering the color dot */}
                    <div className="absolute left-0 top-6 hidden group-hover/color:flex gap-1 bg-white dark:bg-gray-800 p-1 rounded shadow-lg border border-gray-200 dark:border-gray-600 z-20">
                      {Object.keys(COLOR_NAMES).map((color) => (
                        <button
                          key={color}
                          className={`w-5 h-5 rounded-full border-2 ${
                            color === highlight.color
                              ? 'border-gray-600 dark:border-gray-300'
                              : 'border-transparent hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorChange(highlight.id, color)}
                          title={COLOR_NAMES[color]}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      "{highlight.textContent}"
                    </p>
                  </div>

                  {/* Delete button - always visible, higher z-index */}
                  <button
                    onClick={() => handleDelete(highlight.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400 transition-colors z-30 flex-shrink-0"
                    title="Löschen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
