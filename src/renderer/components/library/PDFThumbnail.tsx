import { useState, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Use same worker as PDFViewer
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFThumbnailProps {
  filePath: string;
  width?: number;
  height?: number;
}

function PDFThumbnail({ filePath, width = 40, height = 56 }: PDFThumbnailProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use custom protocol for efficient PDF loading (no base64)
  const pdfUrl = `local-pdf://${encodeURIComponent(filePath)}`;

  if (error) {
    return (
      <div
        className="bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center"
        style={{ width, height }}
      >
        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13a.5.5 0 01.5-.5h6a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6a.5.5 0 010 1H9a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h4a.5.5 0 010 1H9a.5.5 0 01-.5-.5z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded bg-gray-100 dark:bg-gray-700 flex-shrink-0"
      style={{ width, height }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <Document
        file={pdfUrl}
        onLoadError={() => setError(true)}
        loading={null}
        className="thumbnail-doc"
      >
        <Page
          pageNumber={1}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={() => setLoading(false)}
          onRenderError={() => setError(true)}
        />
      </Document>
    </div>
  );
}

// Memoize to prevent re-rendering when parent updates
export default memo(PDFThumbnail, (prev, next) => prev.filePath === next.filePath);
