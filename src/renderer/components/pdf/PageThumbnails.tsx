import { useState, useEffect, memo, useRef, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useAppStore } from '../../stores/appStore';

// Use same worker as PDFViewer
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const THUMBNAIL_HEIGHT = 240; // Approximate height of each thumbnail item
const OVERSCAN = 3; // Number of items to render above/below visible area

interface PageThumbnailsProps {
  pdfData: string;
  numPages: number;
  onClose: () => void;
}

function PageThumbnails({ pdfData, numPages, onClose }: PageThumbnailsProps) {
  const { currentPage, setCurrentPage } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const handlePageClick = (pageNum: number) => {
    setCurrentPage(pageNum);
  };

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  // Setup scroll and resize observers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Scroll to current page when opening
  useEffect(() => {
    if (containerRef.current && currentPage > 1) {
      const scrollPosition = (currentPage - 1) * THUMBNAIL_HEIGHT - containerHeight / 2 + THUMBNAIL_HEIGHT / 2;
      containerRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  // Calculate visible range (virtualization)
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / THUMBNAIL_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(
      numPages - 1,
      Math.ceil((scrollTop + containerHeight) / THUMBNAIL_HEIGHT) + OVERSCAN
    );
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, numPages]);

  // Create virtual items - only render visible thumbnails
  const virtualItems = useMemo(() => {
    const items: Array<{ pageNum: number; style: React.CSSProperties }> = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex && i < numPages; i++) {
      items.push({
        pageNum: i + 1,
        style: {
          position: 'absolute',
          top: i * THUMBNAIL_HEIGHT,
          left: 0,
          right: 0,
          height: THUMBNAIL_HEIGHT,
          padding: '4px',
        },
      });
    }
    return items;
  }, [numPages, visibleRange]);

  const totalHeight = numPages * THUMBNAIL_HEIGHT;

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
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Seiten ({numPages})</span>
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

      {/* Virtualized Thumbnails */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <Document file={pdfData} loading={null}>
          <div style={{ height: totalHeight, position: 'relative' }}>
            {virtualItems.map(({ pageNum, style }) => (
              <div key={pageNum} style={style}>
                <PageThumbnailItem
                  pageNum={pageNum}
                  isActive={currentPage === pageNum}
                  onClick={() => handlePageClick(pageNum)}
                />
              </div>
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
