import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import TagManager from './TagManager';
import PDFThumbnail from './PDFThumbnail';
import { useVirtualList } from '../../hooks/useVirtualList';
import type { PDFDocument, Tag } from '../../../shared/types';

const ITEM_HEIGHT = 90; // Height of each PDF item in pixels

interface PdfProgress {
  currentPage: number;
  progress: number;
}

export default function PDFLibrary() {
  const { pdfs, setCurrentPdf, currentPdf, setPdfs, setIndexingStatus, libraryViewMode, setLibraryViewMode } = useAppStore();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [pdfTagsMap, setPdfTagsMap] = useState<Map<number, Tag[]>>(new Map());
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingPdfId, setEditingPdfId] = useState<number | null>(null);
  const [progressMap, setProgressMap] = useState<Map<number, PdfProgress>>(new Map());

  const loadTags = useCallback(async () => {
    const allTags = await window.electronAPI.getTags();
    setTags(allTags);
  }, []);

  const loadAllPdfTags = useCallback(async () => {
    // Batch load all PDF tags in a single IPC call (performance optimization)
    const tagsRecord = await window.electronAPI.getAllPdfTags();
    const map = new Map<number, Tag[]>();
    for (const [pdfId, tags] of Object.entries(tagsRecord)) {
      map.set(Number(pdfId), tags);
    }
    setPdfTagsMap(map);
  }, []);

  const loadProgress = useCallback(async () => {
    const pdfsWithProgress = await window.electronAPI.getAllPdfsWithProgress();
    const map = new Map<number, PdfProgress>();
    for (const pdf of pdfsWithProgress) {
      map.set(pdf.id, { currentPage: pdf.currentPage, progress: pdf.progress });
    }
    setProgressMap(map);
  }, []);

  useEffect(() => {
    loadTags();
    loadAllPdfTags();
    loadProgress();
  }, [loadTags, loadAllPdfTags, loadProgress]);

  const handleRefresh = useCallback(async () => {
    setIndexingStatus({
      isIndexing: true,
      totalFiles: 0,
      processedFiles: 0,
      currentFile: 'Aktualisiere...',
    });

    const updatedPdfs = await window.electronAPI.indexPdfs();
    setPdfs(updatedPdfs);
  }, [setIndexingStatus, setPdfs]);

  const handlePdfClick = useCallback((pdf: PDFDocument) => {
    setCurrentPdf(pdf);
  }, [setCurrentPdf]);

  const filteredPdfs = selectedTagId
    ? pdfs.filter((pdf) => {
        const pdfTags = pdfTagsMap.get(pdf.id) || [];
        return pdfTags.some((t) => t.id === selectedTagId);
      })
    : pdfs;

  // Virtual list for performance with large collections
  const { containerRef, virtualItems, totalHeight } = useVirtualList(filteredPdfs, {
    itemHeight: ITEM_HEIGHT,
    overscan: 5,
  });

  // Find the PDF being edited for the modal
  const editingPdf = editingPdfId ? pdfs.find(p => p.id === editingPdfId) : null;

  const renderPdfItem = useCallback((pdf: PDFDocument, style: React.CSSProperties) => {
    const pdfTags = pdfTagsMap.get(pdf.id) || [];
    const isSelected = currentPdf?.id === pdf.id;
    const isEditing = editingPdfId === pdf.id;
    const progress = progressMap.get(pdf.id);
    const progressPercent = progress?.progress ?? 0;
    const currentPage = progress?.currentPage ?? 1;

    return (
      <div
        key={pdf.id}
        style={style}
        className="border-b border-gray-100 dark:border-gray-700"
      >
        <div
          onClick={() => handlePdfClick(pdf)}
          className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
            isSelected ? 'bg-primary-50 dark:bg-primary-900/30' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <PDFThumbnail filePath={pdf.filePath} width={40} height={56} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {pdf.fileName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {pdf.pageCount} Seiten
                {pdf.indexedAt && (
                  <span className="ml-2 text-green-600 dark:text-green-400">indexiert</span>
                )}
                {pdf.ocrCompleted === 1 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">OCR</span>
                )}
              </p>
              {/* Reading Progress Bar */}
              {pdf.pageCount > 0 && progressPercent > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progressPercent >= 100
                          ? 'bg-green-500'
                          : 'bg-primary-500'
                      }`}
                      style={{ width: `${Math.min(100, progressPercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {progressPercent}% ({currentPage}/{pdf.pageCount})
                  </span>
                </div>
              )}
              {pdfTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {pdfTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-1.5 py-0.5 text-xs rounded"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingPdfId(isEditing ? null : pdf.id);
              }}
              className={`p-1.5 rounded transition-colors ${
                isEditing
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400'
              }`}
              title="Tags bearbeiten"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }, [currentPdf, editingPdfId, pdfTagsMap, progressMap, handlePdfClick]);

  const renderGridItem = useCallback((pdf: PDFDocument) => {
    const pdfTags = pdfTagsMap.get(pdf.id) || [];
    const isSelected = currentPdf?.id === pdf.id;
    const displayTags = pdfTags.slice(0, 2);
    const extraTagCount = pdfTags.length - 2;
    const progress = progressMap.get(pdf.id);
    const progressPercent = progress?.progress ?? 0;

    return (
      <div
        key={pdf.id}
        onClick={() => handlePdfClick(pdf)}
        className={`group relative p-2 rounded-lg cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-700 ${
          isSelected ? 'bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-500' : ''
        }`}
      >
        <div className="aspect-[3/4] mb-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 shadow-sm group-hover:shadow-md transition-shadow relative">
          <PDFThumbnail filePath={pdf.filePath} width={120} height={160} />
          {/* Progress bar overlay at bottom of thumbnail */}
          {pdf.pageCount > 0 && progressPercent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
              <div
                className={`h-full ${progressPercent >= 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
          )}
        </div>
        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate" title={pdf.fileName}>
          {pdf.fileName.replace('.pdf', '')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {pdf.pageCount} Seiten
          {progressPercent > 0 && (
            <span className={`ml-1 ${progressPercent >= 100 ? 'text-green-500' : 'text-primary-500'}`}>
              · {progressPercent}%
            </span>
          )}
        </p>
        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {displayTags.map((tag) => (
              <span
                key={tag.id}
                className="px-1 py-0.5 text-[10px] rounded"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
            {extraTagCount > 0 && (
              <span className="px-1 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                +{extraTagCount}
              </span>
            )}
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingPdfId(pdf.id);
          }}
          className="absolute top-2 right-2 p-1 bg-white dark:bg-gray-800 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Tags bearbeiten"
        >
          <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>
      </div>
    );
  }, [currentPdf, pdfTagsMap, progressMap, handlePdfClick]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aktualisieren
        </button>
        <button
          onClick={() => setShowTagManager(!showTagManager)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
            showTagManager ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Tags
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setLibraryViewMode(libraryViewMode === 'list' ? 'grid' : 'list')}
          className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          title={libraryViewMode === 'list' ? 'Grid-Ansicht' : 'Listen-Ansicht'}
        >
          {libraryViewMode === 'list' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Tag Manager */}
      {showTagManager && (
        <div className="border-b border-gray-100 dark:border-gray-700">
          <TagManager onTagsChange={loadAllPdfTags} />
        </div>
      )}

      {/* Tag Filter */}
      {tags.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedTagId(null)}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
              selectedTagId === null
                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Alle
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors`}
              style={{
                backgroundColor: selectedTagId === tag.id ? tag.color : `${tag.color}20`,
                color: selectedTagId === tag.id ? 'white' : tag.color,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* PDF List/Grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {filteredPdfs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-center">
              {selectedTagId ? 'Keine PDFs mit diesem Tag' : 'Keine PDFs gefunden'}
            </p>
            <p className="text-xs text-center mt-1">Klicke auf Aktualisieren</p>
          </div>
        ) : libraryViewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
            {filteredPdfs.map(pdf => renderGridItem(pdf))}
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            {virtualItems.map(({ index, item, style }) => (
              <div key={item.id} style={style} className="group">
                {renderPdfItem(item, {})}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Count */}
      {filteredPdfs.length > 0 && (
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {filteredPdfs.length} PDF{filteredPdfs.length !== 1 ? 's' : ''}
          {selectedTagId && ` (gefiltert)`}
        </div>
      )}

      {/* Tag Editor Modal */}
      {editingPdf && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20"
          onClick={() => setEditingPdfId(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-80 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate flex-1 mr-2">
                Tags: {editingPdf.fileName}
              </h3>
              <button
                onClick={() => setEditingPdfId(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Tag Manager Content */}
            <TagManager
              pdfId={editingPdf.id}
              onTagsChange={() => {
                loadAllPdfTags();
                loadTags();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
