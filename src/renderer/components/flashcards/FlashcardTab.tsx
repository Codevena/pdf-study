import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { FlashcardDeck } from '../../../shared/types';
import FlashcardDeckView from './FlashcardDeckView';

export default function FlashcardTab() {
  const {
    flashcardDecks,
    setFlashcardDecks,
    currentDeck,
    setCurrentDeck,
    flashcardStats,
    setFlashcardStats,
    currentPdf,
  } = useAppStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [loading, setLoading] = useState(true);

  // Load decks on mount
  useEffect(() => {
    loadDecks();
    loadStats();
  }, [currentPdf]);

  const loadDecks = async () => {
    try {
      setLoading(true);
      // If a PDF is open, show decks for that PDF + global decks
      const decks = await window.electronAPI.getFlashcardDecks(currentPdf?.id);
      setFlashcardDecks(decks);
    } catch (error) {
      console.error('Error loading decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await window.electronAPI.getFlashcardStats();
      setFlashcardStats(stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    try {
      await window.electronAPI.createFlashcardDeck(
        newDeckName.trim(),
        currentPdf?.id // Link to current PDF if open
      );
      setNewDeckName('');
      setIsCreating(false);
      await loadDecks();
    } catch (error) {
      console.error('Error creating deck:', error);
    }
  };

  const handleDeleteDeck = async (deckId: number) => {
    if (!confirm('Deck wirklich loschen? Alle Karteikarten werden ebenfalls geloscht.')) {
      return;
    }

    try {
      await window.electronAPI.deleteFlashcardDeck(deckId);
      if (currentDeck?.id === deckId) {
        setCurrentDeck(null);
      }
      await loadDecks();
      await loadStats();
    } catch (error) {
      console.error('Error deleting deck:', error);
    }
  };

  // If a deck is selected, show the deck view
  if (currentDeck) {
    return <FlashcardDeckView onBack={() => setCurrentDeck(null)} />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Stats Overview */}
      {flashcardStats && (
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 rounded-lg p-4">
          <div className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
            Heute lernen
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {flashcardStats.newCards}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Neu</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {flashcardStats.dueToday}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Fallig</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {flashcardStats.reviewedToday}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Gelernt</div>
            </div>
          </div>
        </div>
      )}

      {/* Create Deck Button */}
      {!isCreating ? (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Deck erstellen
        </button>
      ) : (
        <form onSubmit={handleCreateDeck} className="space-y-2">
          <input
            type="text"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            placeholder="Deck-Name..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              Erstellen
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewDeckName('');
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Current PDF Info */}
      {currentPdf && (
        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
          Decks fur: <span className="font-medium">{currentPdf.fileName}</span>
        </div>
      )}

      {/* Deck List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
            Lade Decks...
          </div>
        ) : flashcardDecks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm">Keine Decks vorhanden</p>
            <p className="text-xs mt-1">Erstelle dein erstes Deck!</p>
          </div>
        ) : (
          flashcardDecks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onClick={() => setCurrentDeck(deck)}
              onDelete={() => handleDeleteDeck(deck.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface DeckCardProps {
  deck: FlashcardDeck;
  onClick: () => void;
  onDelete: () => void;
}

function DeckCard({ deck, onClick, onDelete }: DeckCardProps) {
  return (
    <div
      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {deck.name}
          </h3>
          {deck.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {deck.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {deck.cardCount || 0} Karten
            </span>
            {(deck.dueCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {deck.dueCount} fallig
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Deck loschen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
