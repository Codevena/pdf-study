import { useState, useEffect, useCallback } from 'react';
import type { Explanation, ExplanationStyle } from '../../../shared/types';

interface ExplanationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pdfId: number;
  currentPage: number;
  onNavigate: (pageNum: number) => void;
  pendingText: string | null;
  isExplaining: boolean;
  explanationStyle: ExplanationStyle;
  onStyleChange: (style: ExplanationStyle) => void;
}

export default function ExplanationSidebar({
  isOpen,
  onClose,
  pdfId,
  currentPage,
  onNavigate,
  pendingText,
  isExplaining,
  explanationStyle,
  onStyleChange,
}: ExplanationSidebarProps) {
  const [explanations, setExplanations] = useState<Explanation[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Load explanations when sidebar opens or pdfId changes
  const loadExplanations = useCallback(async () => {
    if (!pdfId) return;
    try {
      const data = await window.electronAPI.getExplanations(pdfId);
      setExplanations(data);
    } catch (error) {
      console.error('Failed to load explanations:', error);
    }
  }, [pdfId]);

  useEffect(() => {
    if (isOpen && pdfId) {
      loadExplanations();
    }
  }, [isOpen, pdfId, loadExplanations]);

  // Refresh when explaining finishes
  useEffect(() => {
    if (!isExplaining && isOpen) {
      loadExplanations();
    }
  }, [isExplaining, isOpen, loadExplanations]);

  const handleDelete = async (id: number) => {
    try {
      await window.electronAPI.deleteExplanation(id);
      setExplanations((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error('Failed to delete explanation:', error);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - mobile only */}
      <div
        className="fixed inset-0 bg-black/30 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Erklärungen</h3>
          </div>

          {/* Style Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => onStyleChange('short')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                explanationStyle === 'short'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Kurz
            </button>
            <button
              onClick={() => onStyleChange('detailed')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                explanationStyle === 'detailed'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Detail
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pending Explanation */}
        {isExplaining && pendingText && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20">
            <p className="text-sm text-gray-600 dark:text-gray-400 italic line-clamp-2 mb-2">
              "{pendingText.slice(0, 150)}{pendingText.length > 150 ? '...' : ''}"
            </p>
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              <span className="text-sm">Wird erklärt...</span>
            </div>
          </div>
        )}

        {/* Explanations List */}
        <div className="flex-1 overflow-y-auto">
          {explanations.length === 0 && !isExplaining ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm">Noch keine Erklärungen</p>
              <p className="text-xs mt-1">
                Markiere Text und klicke auf das Glühbirnen-Symbol
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {explanations.map((exp) => {
                const isExpanded = expandedIds.has(exp.id);
                const isCurrentPage = exp.pageNum === currentPage;

                return (
                  <div
                    key={exp.id}
                    className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isCurrentPage ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <button
                        onClick={() => onNavigate(exp.pageNum)}
                        className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Seite {exp.pageNum}
                      </button>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          exp.style === 'short'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        }`}>
                          {exp.style === 'short' ? 'Kurz' : 'Detail'}
                        </span>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Löschen"
                        >
                          <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Selected Text */}
                    <div
                      className="text-xs text-gray-500 dark:text-gray-400 italic cursor-pointer mb-2"
                      onClick={() => toggleExpanded(exp.id)}
                    >
                      <span className="line-clamp-1">"{exp.selectedText}"</span>
                    </div>

                    {/* Explanation */}
                    <div
                      className={`text-sm text-gray-700 dark:text-gray-300 ${
                        isExpanded ? '' : 'line-clamp-4'
                      }`}
                      onClick={() => toggleExpanded(exp.id)}
                    >
                      {exp.explanation}
                    </div>

                    {/* Expand/Collapse indicator */}
                    {exp.explanation.length > 200 && (
                      <button
                        onClick={() => toggleExpanded(exp.id)}
                        className="text-xs text-purple-600 dark:text-purple-400 mt-1 hover:underline"
                      >
                        {isExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with info */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {explanations.length} {explanations.length === 1 ? 'Erklärung' : 'Erklärungen'}
        </div>
      </div>
    </>
  );
}
