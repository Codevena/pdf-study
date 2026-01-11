import { useState } from 'react';
import type { ExportOptions, ExportFormat, BatchExportResult } from '../../../shared/types';

interface ExportModalProps {
  pdfId: number;
  pdfFileName: string;
  onClose: () => void;
}

export default function ExportModal({ pdfId, pdfFileName, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('obsidian');
  const [includeWikiLinks, setIncludeWikiLinks] = useState(true);
  const [extractTags, setExtractTags] = useState(true);
  const [language, setLanguage] = useState<'de' | 'en'>('de');
  const [exporting, setExporting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchExportResult | null>(null);

  const options: ExportOptions = {
    format,
    includeWikiLinks,
    extractTags,
    language,
  };

  const handleExportSingle = async () => {
    setExporting(true);
    setBatchResult(null);
    try {
      const result = await window.electronAPI.exportPdfDataEnhanced(pdfId, options);
      if (result.success) {
        onClose();
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    setBatchResult(null);
    try {
      const result = await window.electronAPI.exportAllPdfs(options);
      if (result.success && !result.canceled) {
        setBatchResult(result);
      }
    } catch (error) {
      console.error('Batch export error:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Markdown Export
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {pdfFileName}
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Format
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormat('obsidian')}
                  className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    format === 'obsidian'
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Obsidian
                </button>
                <button
                  onClick={() => setFormat('standard')}
                  className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    format === 'standard'
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Standard
                </button>
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sprache
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage('de')}
                  className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    language === 'de'
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Deutsch
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    language === 'en'
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWikiLinks}
                  onChange={(e) => setIncludeWikiLinks(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Wiki-Links einschließen
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractTags}
                  onChange={(e) => setExtractTags(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Tags aus Notizen extrahieren (#tag)
                </span>
              </label>
            </div>

            {/* Batch Result */}
            {batchResult && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  {batchResult.exportedCount} PDFs erfolgreich exportiert
                  {batchResult.failedCount > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {' '}({batchResult.failedCount} fehlgeschlagen)
                    </span>
                  )}
                </p>
                {batchResult.outputFolder && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 truncate">
                    {batchResult.outputFolder}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              onClick={handleExportSingle}
              disabled={exporting}
              className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Exportiere...
                </span>
              ) : (
                'Aktuelles PDF'
              )}
            </button>
            <button
              onClick={handleExportAll}
              disabled={exporting}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Alle PDFs
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
