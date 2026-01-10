import { useState, useEffect, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAppStore } from '../../stores/appStore';

// Use same worker as PDFViewer
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PageThumbnailsProps {
  pdfData: string;
  numPages: number;
  onClose: () => void;
}

function PageThumbnails({ pdfData, numPages, onClose }: PageThumbnailsProps) {
  const { currentPage, setCurrentPage } = useAppStore();

  const handlePageClick = (pageNum: number) => {
    setCurrentPage(pageNum);
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
        className="fixed inset-y-0 right-0 w-48 max-w-[85vw] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col z-50 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Seiten</span>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            title="Schliessen"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>

      {/* Thumbnails */}
      <div className="flex-1 overflow-y-auto p-2">
        <Document file={pdfData} loading={null}>
          <div className="space-y-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <PageThumbnailItem
                key={pageNum}
                pageNum={pageNum}
                isActive={currentPage === pageNum}
                onClick={() => handlePageClick(pageNum)}
              />
            ))}
          </div>
        </Document>
      </div>
      </div>
    </>
  );
}

interface PageThumbnailItemProps {
  pageNum: number;
  isActive: boolean;
  onClick: () => void;
}

const PageThumbnailItem = memo(function PageThumbnailItem({
  pageNum,
  isActive,
  onClick,
}: PageThumbnailItemProps) {
  const [loading, setLoading] = useState(true);

  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded overflow-hidden transition-all ${
        isActive
          ? 'ring-2 ring-primary-500 ring-offset-1'
          : 'hover:ring-2 hover:ring-gray-300'
      }`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <Page
        pageNumber={pageNum}
        width={160}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onRenderSuccess={() => setLoading(false)}
        className="bg-white"
      />
      <div
        className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-center text-xs font-medium ${
          isActive ? 'bg-primary-500 text-white' : 'bg-gray-800/60 text-white'
        }`}
      >
        {pageNum}
      </div>
    </div>
  );
});

export default PageThumbnails;
