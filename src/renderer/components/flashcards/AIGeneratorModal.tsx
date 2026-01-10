import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { OpenAIModel, GeneratedCard } from '../../../shared/types';

interface AIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardsGenerated: (cards: GeneratedCard[]) => void;
  initialText?: string;
}

export default function AIGeneratorModal({
  isOpen,
  onClose,
  onCardsGenerated,
  initialText = '',
}: AIGeneratorModalProps) {
  const { settings } = useAppStore();

  const [text, setText] = useState(initialText);
  const [model, setModel] = useState<OpenAIModel>(settings?.openaiModel || 'gpt-4o-mini');
  const [cardType, setCardType] = useState<'basic' | 'cloze' | 'mixed'>('mixed');
  const [language, setLanguage] = useState<'de' | 'en'>(settings?.flashcardLanguage || 'de');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Bitte gib Text ein, aus dem Karteikarten generiert werden sollen.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await window.electronAPI.generateFlashcardsAI(text, {
        model,
        cardType,
        language,
        count,
      });

      if (result.success && result.cards) {
        setGeneratedCards(result.cards);
      } else {
        setError(result.error || 'Fehler bei der Generierung');
      }
    } catch (err: any) {
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptCards = () => {
    onCardsGenerated(generatedCards);
    onClose();
    // Reset state
    setGeneratedCards([]);
    setText('');
  };

  const handleRemoveCard = (index: number) => {
    setGeneratedCards(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            KI-Karteikarten generieren
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {generatedCards.length === 0 ? (
            <>
              {/* Text Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quelltext
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Fuge den Text ein, aus dem Karteikarten generiert werden sollen..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={8}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {text.length} Zeichen
                </p>
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    KI-Modell
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as OpenAIModel)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (gunstig)</option>
                    <option value="gpt-4o">GPT-4o (beste Qualitat)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </select>
                </div>

                {/* Card Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kartentyp
                  </label>
                  <select
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as 'basic' | 'cloze' | 'mixed')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="mixed">Gemischt (empfohlen)</option>
                    <option value="basic">Nur Basic (Frage-Antwort)</option>
                    <option value="cloze">Nur Cloze (Luckentext)</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sprache
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'de' | 'en')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">Englisch</option>
                  </select>
                </div>

                {/* Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Anzahl Karten
                  </label>
                  <input
                    type="number"
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={20}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* API Key Warning */}
              {!settings?.openaiApiKey && (
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm">
                  Kein OpenAI API-Schlussel konfiguriert. Bitte in den Einstellungen hinterlegen.
                </div>
              )}
            </>
          ) : (
            <>
              {/* Generated Cards Preview */}
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {generatedCards.length} Karten generiert
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {generatedCards.map((card, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                          {card.front}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                          {card.back}
                        </p>
                        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded ${
                          card.cardType === 'cloze'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {card.cardType === 'cloze' ? 'Cloze' : 'Basic'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveCard(index)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          {generatedCards.length === 0 ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Abbrechen
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || !text.trim() || !settings?.openaiApiKey}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generiere...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generieren
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setGeneratedCards([])}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Neu generieren
              </button>
              <button
                onClick={handleAcceptCards}
                disabled={generatedCards.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {generatedCards.length} Karten hinzufugen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
