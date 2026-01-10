import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import PDFViewer from './components/pdf/PDFViewer';
import WelcomeScreen from './components/WelcomeScreen';

function App() {
  const { settings, setSettings, setPdfs, setBookmarks, setIndexingStatus, setOCRStatus, currentPdf } = useAppStore();

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // Apply theme to HTML element
  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  useEffect(() => {
    // Load initial settings, PDFs, and bookmarks
    async function init() {
      const loadedSettings = await window.electronAPI.getSettings();
      setSettings(loadedSettings);

      if (loadedSettings.pdfFolder) {
        const pdfs = await window.electronAPI.getPdfs();
        setPdfs(pdfs);
      }

      // Load bookmarks
      const bookmarks = await window.electronAPI.getBookmarks();
      setBookmarks(bookmarks);
    }

    init();

    // Listen for indexing progress
    const unsubscribeIndexing = window.electronAPI.onIndexingProgress((status) => {
      setIndexingStatus(status);
    });

    // Listen for file watcher events (new/modified PDFs)
    const unsubscribePdfAdded = window.electronAPI.onPdfAdded((pdfs) => {
      setPdfs(pdfs);
    });

    // Listen for file watcher events (removed PDFs)
    const unsubscribePdfRemoved = window.electronAPI.onPdfRemoved((pdfs) => {
      setPdfs(pdfs);
    });

    // Listen for OCR progress
    const unsubscribeOCR = window.electronAPI.onOCRProgress((status) => {
      setOCRStatus(status);
    });

    return () => {
      unsubscribeIndexing();
      unsubscribePdfAdded();
      unsubscribePdfRemoved();
      unsubscribeOCR();
    };
  }, [setSettings, setPdfs, setBookmarks, setIndexingStatus, setOCRStatus]);

  const hasFolder = settings?.pdfFolder;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {hasFolder ? (
          <>
            <Sidebar />
            <main className="flex-1 overflow-hidden">
              {currentPdf ? (
                <PDFViewer />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>Wähle ein PDF aus der Bibliothek</p>
                    <p className="text-sm mt-1">oder suche nach Begriffen</p>
                  </div>
                </div>
              )}
            </main>
          </>
        ) : (
          <WelcomeScreen />
        )}
      </div>
    </div>
  );
}

export default App;
