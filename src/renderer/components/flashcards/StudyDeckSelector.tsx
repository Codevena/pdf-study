import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { FlashcardDeck } from '../../../shared/types';

interface StudyDeckSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeck: (deckId: number) => void;
}

export default function StudyDeckSelector({ isOpen, onClose, onSelectDeck }: StudyDeckSelectorProps) {
  const { pdfs } = useAppStore();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDue, setTotalDue] = useState(0);

  // Load all decks with due counts
  useEffect(() => {
    if (isOpen) {
      loadDecks();
    }
  }, [isOpen]);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const allDecks = await window.electronAPI.getFlashcardDecks();
      setDecks(allDecks);

      // Calculate total due
      const total = allDecks.reduce((sum, deck) => sum + (deck.dueCount || 0), 0);
      setTotalDue(total);
    } catch (error) {
      console.error('Error loading decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDeck = async (deck: FlashcardDeck) => {
    if (!deck.dueCount || deck.dueCount === 0) {
      return;
    }
    onSelectDeck(deck.id);
    onClose();
  };

  // Get PDF name for a deck
  const getPdfName = (pdfId: number | null) => {
    if (!pdfId) return null;
    const pdf = pdfs.find(p => p.id === pdfId);
    return pdf?.fileName || pdf?.title || null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Lernen starten
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Wahle ein Deck zum Lernen aus
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        {!loading && totalDue > 0 && (
          <div className="px-6 py-4 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-semibold text-primary-700 dark:text-primary-300">
                  {totalDue} Karten fallig
                </div>
                <div className="text-sm text-primary-600/70 dark:text-primary-400/70">
                  warten auf dich
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Lade Decks...</p>
            </div>
          ) : decks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                Keine Decks vorhanden
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Erstelle zuerst ein Deck in der Karteikarten-Ansicht
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {decks.map((deck) => {
                const hasDueCards = (deck.dueCount || 0) > 0;
                const pdfName = getPdfName(deck.pdfId || null);

                return (
                  <button
                    key={deck.id}
                    onClick={() => handleSelectDeck(deck)}
                    disabled={!hasDueCards}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                      hasDueCards
                        ? 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                        : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {deck.name}
                        </h3>
                        {pdfName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {pdfName}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            {deck.cardCount || 0} Karten
                          </span>
                          {hasDueCards ? (
                            <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {deck.dueCount} fallig
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">
                              Alles gelernt
                            </span>
                          )}
                        </div>
                      </div>

                      {hasDueCards && (
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
