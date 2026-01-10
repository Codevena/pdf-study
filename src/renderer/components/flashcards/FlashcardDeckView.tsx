import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { FlashcardWithFSRS, GeneratedCard } from '../../../shared/types';
import FlashcardEditor from './FlashcardEditor';
import FlashcardStudyView from './FlashcardStudyView';
import AIGeneratorModal from './AIGeneratorModal';

interface FlashcardDeckViewProps {
  onBack: () => void;
}

export default function FlashcardDeckView({ onBack }: FlashcardDeckViewProps) {
  const {
    currentDeck,
    flashcards,
    setFlashcards,
    dueFlashcards,
    setDueFlashcards,
    isStudying,
    setIsStudying,
  } = useAppStore();

  const [showEditor, setShowEditor] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardWithFSRS | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentDeck) {
      loadCards();
      loadDueCards();
    }
  }, [currentDeck]);

  const loadCards = async () => {
    if (!currentDeck) return;
    try {
      setLoading(true);
      const cards = await window.electronAPI.getFlashcards(currentDeck.id);
      setFlashcards(cards);
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDueCards = async () => {
    if (!currentDeck) return;
    try {
      const due = await window.electronAPI.getDueFlashcards(currentDeck.id);
      setDueFlashcards(due);
    } catch (error) {
      console.error('Error loading due cards:', error);
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm('Karteikarte wirklich loschen?')) return;

    try {
      await window.electronAPI.deleteFlashcard(cardId);
      await loadCards();
      await loadDueCards();
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const handleExport = async () => {
    if (!currentDeck) return;

    try {
      const result = await window.electronAPI.exportToLearnBuddy(currentDeck.id);
      if (result.success) {
        alert(`Export erfolgreich! ${result.cardCount} Karten exportiert.`);
      } else if (!result.canceled) {
        alert(`Export fehlgeschlagen: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleStartStudy = () => {
    if (dueFlashcards.length > 0) {
      setIsStudying(true);
    }
  };

  const handleStudyComplete = async () => {
    setIsStudying(false);
    await loadCards();
    await loadDueCards();
  };

  const handleAICardsGenerated = async (cards: GeneratedCard[]) => {
    if (!currentDeck) return;

    try {
      // Add all generated cards to the deck
      for (const card of cards) {
        await window.electronAPI.addFlashcard(
          currentDeck.id,
          card.front,
          card.back,
          card.cardType,
          undefined, // highlightId
          undefined, // sourcePage
          card.cardType === 'cloze' ? card.front : undefined // clozeData
        );
      }
      await loadCards();
      await loadDueCards();
    } catch (error) {
      console.error('Error adding AI cards:', error);
    }
  };

  if (!currentDeck) return null;

  // Show study view if studying
  if (isStudying) {
    return <FlashcardStudyView onComplete={handleStudyComplete} onBack={() => setIsStudying(false)} />;
  }

  // Show editor if creating/editing
  if (showEditor) {
    return (
      <FlashcardEditor
        card={editingCard}
        onSave={async () => {
          setShowEditor(false);
          setEditingCard(null);
          await loadCards();
          await loadDueCards();
        }}
        onCancel={() => {
          setShowEditor(false);
          setEditingCard(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zuruck
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {currentDeck.name}
        </h2>
        {currentDeck.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentDeck.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        {/* Study Button */}
        <button
          onClick={handleStartStudy}
          disabled={dueFlashcards.length === 0}
          className={`w-full px-4 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
            dueFlashcards.length > 0
              ? 'text-white bg-green-600 hover:bg-green-700'
              : 'text-gray-400 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {dueFlashcards.length > 0
            ? `Lernen (${dueFlashcards.length} Karten)`
            : 'Keine Karten fallig'}
        </button>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditor(true)}
            className="flex-1 px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 dark:bg-primary-900/30 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Karte
          </button>
          <button
            onClick={() => setShowAIGenerator(true)}
            className="flex-1 px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            KI
          </button>
          <button
            onClick={handleExport}
            disabled={flashcards.length === 0}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* AI Generator Modal */}
      <AIGeneratorModal
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
        onCardsGenerated={handleAICardsGenerated}
      />

      {/* Card List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Karteikarten ({flashcards.length})
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
            Lade Karten...
          </div>
        ) : flashcards.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">Keine Karten im Deck</p>
            <p className="text-xs mt-1">Erstelle deine erste Karteikarte!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {flashcards.map((card) => (
              <CardPreview
                key={card.id}
                card={card}
                onEdit={() => {
                  setEditingCard(card);
                  setShowEditor(true);
                }}
                onDelete={() => handleDeleteCard(card.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CardPreviewProps {
  card: FlashcardWithFSRS;
  onEdit: () => void;
  onDelete: () => void;
}

function CardPreview({ card, onEdit, onDelete }: CardPreviewProps) {
  const stateLabels = ['Neu', 'Lernen', 'Review', 'Relearning'];
  const stateColors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ];

  // Parse cloze text for display
  const displayFront = card.cardType === 'cloze'
    ? card.front.replace(/\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/g, '[...]')
    : card.front;

  return (
    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 group">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
            {displayFront}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
            {card.back}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${stateColors[card.fsrs.state]}`}>
              {stateLabels[card.fsrs.state]}
            </span>
            {card.cardType === 'cloze' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Cloze
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-primary-600"
            title="Bearbeiten"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500"
            title="Loschen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
