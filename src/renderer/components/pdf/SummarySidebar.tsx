import { useState, useEffect, useCallback } from 'react';
import type { Summary } from '../../../shared/types';

interface SummarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pdfId: number;
  filePath: string;
  numPages: number;
  currentPage: number;
}

export default function SummarySidebar({
  isOpen,
  onClose,
  pdfId,
  filePath,
  numPages,
  currentPage,
}: SummarySidebarProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Page range selection
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [showGenerator, setShowGenerator] = useState(false);

  // Load summaries
  const loadSummaries = useCallback(async () => {
    if (!pdfId) return;
    try {
      const data = await window.electronAPI.getSummaries(pdfId);
      setSummaries(data);
    } catch (err) {
      console.error('Failed to load summaries:', err);
    }
  }, [pdfId]);

  useEffect(() => {
    if (isOpen && pdfId) {
      loadSummaries();
    }
  }, [isOpen, pdfId, loadSummaries]);

  // Set initial page range to current page
  useEffect(() => {
    if (showGenerator) {
      setStartPage(currentPage);
      setEndPage(Math.min(currentPage + 4, numPages)); // Default: 5 pages
    }
  }, [showGenerator, currentPage, numPages]);

  const handleGenerate = async () => {
    if (startPage > endPage || startPage < 1 || endPage > numPages) {
      setError('Ungültiger Seitenbereich');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await window.electronAPI.generateSummary(
        pdfId,
        filePath,
        startPage,
        endPage
      );

      if (result.success) {
        await loadSummaries();
        setShowGenerator(false);
      } else {
        const errorMsg = result.error || 'Unbekannter Fehler';
        if (errorMsg.includes('API key') || errorMsg.includes('api_key') || errorMsg.includes('401')) {
          setError('API-Key fehlt oder ist ungültig. Bitte in den Einstellungen prüfen.');
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          setError('API-Limit erreicht. Bitte später erneut versuchen.');
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          setError('Netzwerkfehler. Bitte Internetverbindung prüfen.');
        } else {
          setError(errorMsg);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unbekannter Fehler';
      if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        setError('Netzwerkfehler. Bitte Internetverbindung prüfen.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await window.electronAPI.deleteSummary(id);
      setSummaries((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete summary:', err);
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
      <div className="fixed inset-y-0 right-0 w-96 max-w-[90vw] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Zusammenfassungen</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* New Summary Button */}
            <button
              onClick={() => setShowGenerator(!showGenerator)}
              className={`p-1.5 rounded-lg transition-colors ${
                showGenerator
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
              title="Neue Zusammenfassung"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>

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
        </div>

        {/* Generator Panel */}
        {showGenerator && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-teal-50 dark:bg-teal-900/20">
            <h4 className="text-sm font-medium text-teal-700 dark:text-teal-400 mb-3">
              Neue Zusammenfassung generieren
            </h4>

            {error && (
              <div className="text-xs text-red-500 mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Von Seite</label>
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={startPage}
                  onChange={(e) => setStartPage(Math.max(1, Math.min(numPages, parseInt(e.target.value) || 1)))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Bis Seite</label>
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={endPage}
                  onChange={(e) => setEndPage(Math.max(1, Math.min(numPages, parseInt(e.target.value) || 1)))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {endPage - startPage + 1} Seite(n) werden zusammengefasst
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowGenerator(false)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || startPage > endPage}
                className="px-3 py-1.5 text-sm bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generiere...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generieren
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Summaries List */}
        <div className="flex-1 overflow-y-auto">
          {summaries.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">Noch keine Zusammenfassungen</p>
              <p className="text-xs mt-1">
                Klicke auf + um eine Zusammenfassung zu erstellen
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {summaries.map((summary) => {
                const isExpanded = expandedIds.has(summary.id);

                return (
                  <div key={summary.id} className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {summary.title}
                        </h4>
                        <span className="text-xs text-teal-600 dark:text-teal-400">
                          Seiten {summary.startPage}
                          {summary.startPage !== summary.endPage && `-${summary.endPage}`}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(summary.id)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Content */}
                    <div
                      className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap ${
                        isExpanded ? '' : 'line-clamp-4'
                      }`}
                      onClick={() => toggleExpanded(summary.id)}
                    >
                      {summary.content}
                    </div>

                    {/* Expand/Collapse */}
                    {summary.content.length > 300 && (
                      <button
                        onClick={() => toggleExpanded(summary.id)}
                        className="text-xs text-teal-600 dark:text-teal-400 mt-2 hover:underline"
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

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {summaries.length} {summaries.length === 1 ? 'Zusammenfassung' : 'Zusammenfassungen'}
        </div>
      </div>
    </>
  );
}
