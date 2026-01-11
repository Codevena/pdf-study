import { useState, useEffect } from 'react';
import type { OutlineItem } from '../../../shared/types';

interface TableOfContentsProps {
  filePath: string;
  pageCount: number;
  pdfId: number;
  onNavigate: (pageIndex: number) => void;
  onClose: () => void;
}

function OutlineItemComponent({
  item,
  level,
  onNavigate,
}: {
  item: OutlineItem;
  level: number;
  onNavigate: (pageIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onNavigate(item.pageIndex)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            <svg
              className={`w-3 h-3 text-gray-500 dark:text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">
          {item.title}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100">
          {item.pageIndex + 1}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {item.children.map((child, index) => (
            <OutlineItemComponent
              key={index}
              item={child}
              level={level + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TableOfContents({ filePath, pageCount, pdfId, onNavigate, onClose }: TableOfContentsProps) {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  useEffect(() => {
    async function loadOutline() {
      setLoading(true);
      setError(null);
      try {
        // First try to get the native PDF outline
        const result = await window.electronAPI.getPdfOutline(filePath);
        if (result && result.length > 0) {
          setOutline(result);
          setIsAIGenerated(false);
        } else {
          // No native outline, try to load saved AI outline
          const aiResult = await window.electronAPI.getAIOutline(pdfId);
          if (aiResult.success && aiResult.outline && aiResult.outline.length > 0) {
            setOutline(aiResult.outline);
            setIsAIGenerated(true);
          } else {
            setOutline([]);
            setIsAIGenerated(false);
          }
        }
      } catch (err) {
        console.error('Failed to load outline:', err);
        setError('Fehler beim Laden des Inhaltsverzeichnisses');
      } finally {
        setLoading(false);
      }
    }

    loadOutline();
  }, [filePath, pdfId]);

  const handleGenerateAI = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await window.electronAPI.generateAIOutline(filePath, pageCount);
      if (result.success && result.outline) {
        setOutline(result.outline);
        setIsAIGenerated(true);
        // Save the generated outline
        await window.electronAPI.saveAIOutline(pdfId, result.outline);
      } else {
        setError(result.error || 'Fehler bei der KI-Generierung');
      }
    } catch (err: any) {
      console.error('AI outline generation failed:', err);
      setError(err.message || 'Fehler bei der KI-Generierung');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onMouseDown={onClose}
      />

      {/* Sidebar - always fixed overlay */}
      <div
        className="fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full z-50 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Inhaltsverzeichnis</h3>
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
      <div className="flex-1 overflow-auto p-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-500 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && outline.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Kein eingebettetes Inhaltsverzeichnis vorhanden
            </div>
            <button
              onClick={handleGenerateAI}
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analysiere PDF...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Mit KI erkennen
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Analysiert die ersten Seiten per KI
            </p>
          </div>
        )}

        {!loading && !error && outline.length > 0 && (
          <div>
            {isAIGenerated && (
              <div className="mb-3 px-2 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center gap-2 text-xs text-purple-700 dark:text-purple-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                KI-generiert - Seitenangaben konnen ungenau sein
              </div>
            )}
            {outline.map((item, index) => (
              <OutlineItemComponent
                key={index}
                item={item}
                level={0}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
