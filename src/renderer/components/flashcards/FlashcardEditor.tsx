import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { FlashcardWithFSRS, FlashcardType } from '../../../shared/types';

interface FlashcardEditorProps {
  card?: FlashcardWithFSRS | null;
  onSave: () => void;
  onCancel: () => void;
  initialFront?: string;
  initialBack?: string;
  highlightId?: number;
  sourcePage?: number;
}

export default function FlashcardEditor({
  card,
  onSave,
  onCancel,
  initialFront = '',
  initialBack = '',
  highlightId,
  sourcePage,
}: FlashcardEditorProps) {
  const { currentDeck } = useAppStore();

  const [front, setFront] = useState(card?.front || initialFront);
  const [back, setBack] = useState(card?.back || initialBack);
  const [cardType, setCardType] = useState<FlashcardType>(card?.cardType || 'basic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview for cloze cards
  const clozePreview = cardType === 'cloze'
    ? front.replace(/\{\{c\d+::([^}:]+)(?:::[^}]+)?\}\}/g, '[...]')
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError('Vorder- und Ruckseite sind erforderlich');
      return;
    }

    if (!currentDeck) {
      setError('Kein Deck ausgewahlt');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (card) {
        // Update existing card
        await window.electronAPI.updateFlashcard(
          card.id,
          front.trim(),
          back.trim(),
          cardType,
          cardType === 'cloze' ? front : undefined
        );
      } else {
        // Create new card
        await window.electronAPI.addFlashcard(
          currentDeck.id,
          front.trim(),
          back.trim(),
          cardType,
          highlightId,
          sourcePage,
          cardType === 'cloze' ? front : undefined
        );
      }

      onSave();
    } catch (err) {
      console.error('Error saving card:', err);
      setError('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const insertCloze = () => {
    const textarea = document.getElementById('front-input') as HTMLTextAreaElement;
    const start = textarea?.selectionStart || 0;
    const end = textarea?.selectionEnd || 0;
    const selectedText = front.substring(start, end);

    if (selectedText) {
      // Find the next cloze number
      const matches = front.match(/\{\{c(\d+)::/g) || [];
      const maxNum = matches.reduce((max, match) => {
        const num = parseInt(match.match(/\d+/)?.[0] || '0');
        return Math.max(max, num);
      }, 0);

      const newCloze = `{{c${maxNum + 1}::${selectedText}}}`;
      const newFront = front.substring(0, start) + newCloze + front.substring(end);
      setFront(newFront);
      setCardType('cloze');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zuruck
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {card ? 'Karte bearbeiten' : 'Neue Karte'}
        </h2>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Card Type Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCardType('basic')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              cardType === 'basic'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Basic
          </button>
          <button
            type="button"
            onClick={() => setCardType('cloze')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              cardType === 'cloze'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Cloze
          </button>
        </div>

        {/* Front */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {cardType === 'cloze' ? 'Text mit Lucken' : 'Vorderseite (Frage)'}
            </label>
            {cardType === 'cloze' && (
              <button
                type="button"
                onClick={insertCloze}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Lucke einfugen
              </button>
            )}
          </div>
          <textarea
            id="front-input"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder={
              cardType === 'cloze'
                ? 'Die Hauptstadt von {{c1::Deutschland}} ist {{c2::Berlin}}.'
                : 'Was ist die Hauptstadt von Deutschland?'
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={4}
          />
          {cardType === 'cloze' && front.includes('{{c') && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400">
              <span className="text-xs font-medium uppercase tracking-wide">Vorschau:</span>
              <p className="mt-1">{clozePreview}</p>
            </div>
          )}
        </div>

        {/* Back */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {cardType === 'cloze' ? 'Antwort/Losung' : 'Ruckseite (Antwort)'}
          </label>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder={cardType === 'cloze' ? 'Deutschland, Berlin' : 'Berlin'}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        {/* Cloze Help */}
        {cardType === 'cloze' && (
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <p className="font-medium mb-1">Cloze-Format:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{'{{c1::Text}}'}</code> - Einfache Lucke</li>
              <li><code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{'{{c1::Text::Hinweis}}'}</code> - Mit Hinweis</li>
              <li>Markiere Text und klicke "Lucke einfugen"</li>
            </ul>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !front.trim() || !back.trim()}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Speichere...' : card ? 'Speichern' : 'Erstellen'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
