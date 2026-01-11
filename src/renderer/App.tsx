import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import PDFViewer from './components/pdf/PDFViewer';
import WelcomeScreen from './components/WelcomeScreen';
import FlashcardStudyView from './components/flashcards/FlashcardStudyView';
import StudyDeckSelector from './components/flashcards/StudyDeckSelector';

function App() {
  const {
    settings,
    setSettings,
    setPdfs,
    setBookmarks,
    setIndexingStatus,
    setOCRStatus,
    currentPdf,
    mainContentView,
    setMainContentView,
    currentDeck,
    setCurrentDeck,
    dueFlashcards,
    setDueFlashcards,
    setIsStudying,
    isStudying,
    showStudyDeckSelector,
    setShowStudyDeckSelector,
    studyDeckId,
    setStudyDeckId,
    flashcardDecks,
    setFlashcardDecks,
  } = useAppStore();

  // Track total due cards across all decks
  const [totalDueCards, setTotalDueCards] = useState(0);

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

  // Load decks and track total due cards
  useEffect(() => {
    if (hasFolder) {
      loadDecksAndDueCount();
    }
  }, [hasFolder]);

  const loadDecksAndDueCount = async () => {
    try {
      const decks = await window.electronAPI.getFlashcardDecks();
      setFlashcardDecks(decks);
      const total = decks.reduce((sum, deck) => sum + (deck.dueCount || 0), 0);
      setTotalDueCards(total);
    } catch (error) {
      console.error('Error loading decks:', error);
    }
  };

  // Handle selecting a deck to study
  const handleSelectStudyDeck = async (deckId: number) => {
    try {
      // Find the deck
      const deck = flashcardDecks.find(d => d.id === deckId);
      if (!deck) return;

      // Load due cards for this deck
      const due = await window.electronAPI.getDueFlashcards(deckId);
      if (due.length === 0) return;

      // Set up study session
      setCurrentDeck(deck);
      setDueFlashcards(due);
      setStudyDeckId(deckId);
      setIsStudying(true);
      setMainContentView('study');
    } catch (error) {
      console.error('Error starting study session:', error);
    }
  };

  // Handle study complete
  const handleStudyComplete = async () => {
    setIsStudying(false);
    setMainContentView('pdf');
    setStudyDeckId(null);
    setCurrentDeck(null);
    setDueFlashcards([]);
    // Reload due count
    await loadDecksAndDueCount();
  };

  // Check if we can show study mode
  const canShowStudy = currentDeck && dueFlashcards.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {hasFolder ? (
          <>
            <Sidebar />
            <main className="flex-1 overflow-hidden flex flex-col">
              {/* Main Content Tabs */}
              <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMainContentView('pdf')}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        mainContentView === 'pdf'
                          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF Ansicht
                      </span>
                    </button>
                    {canShowStudy && (
                      <button
                        onClick={() => {
                          setMainContentView('study');
                          setIsStudying(true);
                        }}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                          mainContentView === 'study'
                            ? 'border-green-500 text-green-600 dark:text-green-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          Aktive Session
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 rounded-full">
                            {dueFlashcards.length}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Lernen Button - immer sichtbar */}
                  <button
                    onClick={() => flashcardDecks.length > 0 && setShowStudyDeckSelector(true)}
                    disabled={flashcardDecks.length === 0}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      flashcardDecks.length > 0
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30'
                        : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                    }`}
                    title={flashcardDecks.length === 0 ? 'Erstelle zuerst ein Karteikarten-Deck im Karteikarten-Tab' : 'Lernmodus starten'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Lernen
                    {totalDueCards > 0 && (
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-primary-500 text-white rounded-full">
                        {totalDueCards}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-hidden">
                {mainContentView === 'study' && isStudying && currentDeck ? (
                  <FlashcardStudyView
                    onComplete={handleStudyComplete}
                    onBack={() => {
                      setIsStudying(false);
                      setMainContentView('pdf');
                    }}
                  />
                ) : currentPdf ? (
                  <PDFViewer />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>Wahle ein PDF aus der Bibliothek</p>
                      <p className="text-sm mt-1">oder suche nach Begriffen</p>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </>
        ) : (
          <WelcomeScreen />
        )}
      </div>

      {/* Study Deck Selector Modal */}
      <StudyDeckSelector
        isOpen={showStudyDeckSelector}
        onClose={() => setShowStudyDeckSelector(false)}
        onSelectDeck={handleSelectStudyDeck}
      />
    </div>
  );
}

export default App;
