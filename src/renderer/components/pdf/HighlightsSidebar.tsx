import { useState, useEffect } from 'react';
import type { Highlight, FlashcardDeck } from '../../../shared/types';

interface HighlightsSidebarProps {
  pdfId: number;
  currentPage: number;
  onNavigate: (pageNum: number) => void;
  onClose: () => void;
  onHighlightDeleted: () => void;
}

const COLOR_NAMES: Record<string, string> = {
  '#FFFF00': 'Gelb',
  '#FF9800': 'Orange',
  '#4CAF50': 'Grün',
  '#2196F3': 'Blau',
  '#E91E63': 'Pink',
};

export default function HighlightsSidebar({
  pdfId,
  currentPage,
  onNavigate,
  onClose,
  onHighlightDeleted,
}: HighlightsSidebarProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  // Flashcard creation state
  const [creatingCardFor, setCreatingCardFor] = useState<number | null>(null);
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [cardBack, setCardBack] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState<number | null>(null);

  useEffect(() => {
    async function loadHighlights() {
      setLoading(true);
      const allHighlights = await window.electronAPI.getHighlights(pdfId);
      setHighlights(allHighlights);
      setLoading(false);
    }
    loadHighlights();
  }, [pdfId]);

  // Load decks when opening flashcard creator
  useEffect(() => {
    if (creatingCardFor !== null) {
      window.electronAPI.getFlashcardDecks().then((allDecks) => {
        setDecks(allDecks);
        // Pre-select first deck or PDF-specific deck
        const pdfDeck = allDecks.find((d) => d.pdfId === pdfId);
        setSelectedDeckId(pdfDeck?.id || allDecks[0]?.id || null);
      });
    }
  }, [creatingCardFor, pdfId]);

  const handleStartCreateCard = (highlightId: number) => {
    setCreatingCardFor(highlightId);
    setCardBack('');
    setShowSuccess(null);
  };

  const handleCancelCreate = () => {
    setCreatingCardFor(null);
    setCardBack('');
    setSelectedDeckId(null);
  };

  const handleCreateFlashcard = async (highlight: Highlight) => {
    if (!selectedDeckId || !cardBack.trim()) return;

    setIsCreating(true);
    try {
      await window.electronAPI.addFlashcard(
        selectedDeckId,
        highlight.textContent, // Front = highlighted text
        cardBack.trim(),       // Back = user input
        'basic',
        highlight.id,          // Link to highlight
        highlight.pageNum      // Source page
      );

      setShowSuccess(highlight.id);
      setCreatingCardFor(null);
      setCardBack('');

      // Hide success indicator after 2 seconds
      setTimeout(() => setShowSuccess(null), 2000);
    } catch (error) {
      console.error('Failed to create flashcard:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    onHighlightDeleted();
  };

  const handleColorChange = async (id: number, color: string) => {
    await window.electronAPI.updateHighlightColor(id, color);
    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, color } : h))
    );
    onHighlightDeleted(); // Trigger refresh
  };

  // Group highlights by page
  const groupedHighlights = highlights.reduce((acc, h) => {
    if (!acc[h.pageNum]) {
      acc[h.pageNum] = [];
    }
    acc[h.pageNum].push(h);
    return acc;
  }, {} as Record<number, Highlight[]>);

  const sortedPages = Object.keys(groupedHighlights)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <>
      {/* Backdrop - only on mobile */}
      <div
        className="fixed inset-0 bg-black/30 z-40 md:hidden"
        onMouseDown={onClose}
      />

      {/* Sidebar - always fixed overlay */}
      <div
        className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full z-50 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Markierungen ({highlights.length})
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            title="Schließen"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && highlights.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Keine Markierungen vorhanden
          </div>
        )}

        {!loading && sortedPages.map((pageNum) => (
          <div key={pageNum} className="border-b border-gray-100 dark:border-gray-700">
            {/* Page Header */}
            <div
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wide cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                pageNum === currentPage
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              onClick={() => onNavigate(pageNum)}
            >
              Seite {pageNum}
            </div>

            {/* Highlights for this page */}
            {groupedHighlights[pageNum].map((highlight) => (
              <div
                key={highlight.id}
                className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
              >
                <div className="flex items-start gap-2">
                  {/* Color indicator with hover dropdown */}
                  <div className="relative group/color">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 cursor-pointer border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: highlight.color }}
                      title={COLOR_NAMES[highlight.color] || highlight.color}
                    />
                    {/* Color picker dropdown - only shows when hovering the color dot */}
                    <div className="absolute left-0 top-6 hidden group-hover/color:flex gap-1 bg-white dark:bg-gray-800 p-1 rounded shadow-lg border border-gray-200 dark:border-gray-600 z-20">
                      {Object.keys(COLOR_NAMES).map((color) => (
                        <button
                          key={color}
                          className={`w-5 h-5 rounded-full border-2 ${
                            color === highlight.color
                              ? 'border-gray-600 dark:border-gray-300'
                              : 'border-transparent hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorChange(highlight.id, color)}
                          title={COLOR_NAMES[color]}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      "{highlight.textContent}"
                    </p>
                  </div>

                  {/* Flashcard button */}
                  {showSuccess === highlight.id ? (
                    <span className="text-green-500 text-xs font-medium flex items-center gap-1 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Erstellt
                    </span>
                  ) : (
                    <button
                      onClick={() => handleStartCreateCard(highlight.id)}
                      className="p-1 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors z-30 flex-shrink-0"
                      title="Karteikarte erstellen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  )}

                  {/* Delete button - always visible, higher z-index */}
                  <button
                    onClick={() => handleDelete(highlight.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400 transition-colors z-30 flex-shrink-0"
                    title="Löschen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Inline Flashcard Creator */}
                {creatingCardFor === highlight.id && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Vorderseite: <span className="text-gray-700 dark:text-gray-300">"{highlight.textContent.slice(0, 50)}{highlight.textContent.length > 50 ? '...' : ''}"</span>
                    </div>

                    {/* Deck selector */}
                    <select
                      value={selectedDeckId || ''}
                      onChange={(e) => setSelectedDeckId(Number(e.target.value))}
                      className="w-full text-xs p-1.5 mb-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="" disabled>Deck auswählen...</option>
                      {decks.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deck.name}
                        </option>
                      ))}
                    </select>

                    {/* Back text input */}
                    <textarea
                      value={cardBack}
                      onChange={(e) => setCardBack(e.target.value)}
                      placeholder="Rückseite eingeben..."
                      className="w-full text-xs p-1.5 mb-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                      rows={2}
                      autoFocus
                    />

                    {/* Action buttons */}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleCancelCreate}
                        className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleCreateFlashcard(highlight)}
                        disabled={!selectedDeckId || !cardBack.trim() || isCreating}
                        className="px-2 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCreating ? 'Erstelle...' : 'Erstellen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
