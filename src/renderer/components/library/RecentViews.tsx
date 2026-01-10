import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import PDFThumbnail from './PDFThumbnail';
import type { RecentView } from '../../../shared/types';

export default function RecentViews() {
  const { pdfs, setCurrentPdf, setCurrentPage, currentPdf } = useAppStore();
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);

  useEffect(() => {
    loadRecentViews();
  }, []);

  const loadRecentViews = async () => {
    const views = await window.electronAPI.getRecentViews(10);
    setRecentViews(views);
  };

  const handleClick = (view: RecentView) => {
    const pdf = pdfs.find(p => p.id === view.pdfId);
    if (pdf) {
      setCurrentPdf(pdf);
      setCurrentPage(view.pageNum);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE');
  };

  if (recentViews.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">Noch keine PDFs angesehen</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {recentViews.map((view) => (
        <div
          key={view.pdfId}
          onClick={() => handleClick(view)}
          className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
            currentPdf?.id === view.pdfId ? 'bg-primary-50 dark:bg-primary-900/30' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <PDFThumbnail filePath={view.filePath} width={36} height={48} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {view.fileName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Seite {view.pageNum}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(view.viewedAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
