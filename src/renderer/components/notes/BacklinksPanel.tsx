import { useState, useEffect } from 'react';
import type { Backlink, PDFDocument } from '../../../shared/types';

interface BacklinksPanelProps {
  pdfId: number;
  pageNum: number;
  onNavigate: (pdf: PDFDocument, pageNum: number) => void;
}

export default function BacklinksPanel({ pdfId, pageNum, onNavigate }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBacklinks();
  }, [pdfId, pageNum]);

  const loadBacklinks = async () => {
    setLoading(true);
    try {
      // Get backlinks for this specific page
      const pageLinks = await window.electronAPI.getBacklinks(pdfId, pageNum);
      // Also get backlinks for the entire PDF (without specific page)
      const pdfLinks = await window.electronAPI.getBacklinks(pdfId);

      // Combine and deduplicate
      const allLinks = [...pageLinks];
      for (const link of pdfLinks) {
        if (!allLinks.some(l => l.noteId === link.noteId)) {
          allLinks.push(link);
        }
      }

      setBacklinks(allLinks);
    } catch (error) {
      console.error('Error loading backlinks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = async (backlink: Backlink) => {
    try {
      const pdf = await window.electronAPI.getPdf(backlink.pdfId);
      if (pdf) {
        onNavigate(pdf, backlink.pageNum);
      }
    } catch (error) {
      console.error('Error navigating to backlink:', error);
    }
  };

  if (loading) {
    return null;
  }

  if (backlinks.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Backlinks ({backlinks.length})
        </span>
        <svg
          className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
          {backlinks.map((bl) => (
            <button
              key={bl.noteId}
              onClick={() => handleNavigate(bl)}
              className="w-full p-2 text-left bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                  {bl.pdfFileName.replace(/\.pdf$/i, '')}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                  S. {bl.pageNum}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {bl.noteContent.length > 100
                  ? bl.noteContent.slice(0, 100) + '...'
                  : bl.noteContent}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
