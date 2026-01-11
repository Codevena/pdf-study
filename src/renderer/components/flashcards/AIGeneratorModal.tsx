import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { OpenAIModel, GeneratedCard, PDFDocument } from '../../../shared/types';
import PageSelector from './PageSelector';

interface AIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardsGenerated: (cards: GeneratedCard[]) => void;
  initialText?: string;
  pdfPath?: string;
  pdfPageCount?: number;
  pdfName?: string;
}


// Get recommended page count for each model
function getModelPageRecommendation(model: OpenAIModel): { min: number; max: number; label: string } {
  switch (model) {
    case 'gpt-5-nano':
      return { min: 1, max: 10, label: '1-10 Seiten' };
    case 'gpt-5-mini':
      return { min: 5, max: 30, label: '5-30 Seiten' };
    case 'gpt-5.2':
      return { min: 10, max: 50, label: '10-50 Seiten' };
    default:
      return { min: 1, max: 20, label: '1-20 Seiten' };
  }
}

export default function AIGeneratorModal({
  isOpen,
  onClose,
  onCardsGenerated,
  initialText = '',
  pdfPath: propPdfPath,
  pdfPageCount: propPdfPageCount = 0,
  pdfName: propPdfName,
}: AIGeneratorModalProps) {
  const { settings, pdfs, currentPdf } = useAppStore();

  // Allow selecting a PDF if none is provided via props
  const [selectedPdfId, setSelectedPdfId] = useState<number | null>(null);

  // Determine the active PDF (from props, selection, or currentPdf)
  const activePdf = useMemo(() => {
    if (propPdfPath) {
      return { path: propPdfPath, pageCount: propPdfPageCount, name: propPdfName };
    }
    if (selectedPdfId) {
      const pdf = pdfs.find(p => p.id === selectedPdfId);
      if (pdf) {
        return { path: pdf.filePath, pageCount: pdf.pageCount, name: pdf.fileName };
      }
    }
    if (currentPdf) {
      return { path: currentPdf.filePath, pageCount: currentPdf.pageCount, name: currentPdf.fileName };
    }
    return null;
  }, [propPdfPath, propPdfPageCount, propPdfName, selectedPdfId, pdfs, currentPdf]);

  const pdfPath = activePdf?.path;
  const pdfPageCount = activePdf?.pageCount || 0;
  const pdfName = activePdf?.name;

  // Input mode: text or pdf
  const [inputMode, setInputMode] = useState<'text' | 'pdf'>(pdfPath ? 'pdf' : 'text');

  // Text input state
  const [text, setText] = useState(initialText);

  // PDF page selection state
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Common options
  const [model, setModel] = useState<OpenAIModel>(settings?.openaiModel || 'gpt-5-mini');
  // Card type is always 'basic' now (cloze removed for better quality)
  const cardType = 'basic' as const;
  const [language, setLanguage] = useState<'de' | 'en'>(settings?.flashcardLanguage || 'de');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);

  // Model recommendation
  const pageRecommendation = useMemo(() => getModelPageRecommendation(model), [model]);

  // Page count warning
  const pageCountWarning = useMemo(() => {
    if (selectedPages.length === 0) return null;
    if (selectedPages.length > pageRecommendation.max) {
      return `Zu viele Seiten fur ${model}. Empfohlen: max. ${pageRecommendation.max} Seiten.`;
    }
    return null;
  }, [selectedPages.length, pageRecommendation, model]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setGeneratedCards([]);
      setError(null);
      setExtractedText(null);
      if (pdfPath && pdfPageCount > 0) {
        // Default to first 10 pages
        const defaultCount = Math.min(10, pdfPageCount);
        setSelectedPages(Array.from({ length: defaultCount }, (_, i) => i + 1));
      } else {
        setSelectedPages([]);
      }
    }
  }, [isOpen, pdfPath, pdfPageCount]);

  // Extract text from PDF pages
  const handleExtractText = async () => {
    if (!pdfPath || selectedPages.length === 0) return;

    try {
      setExtracting(true);
      setError(null);
      const result = await window.electronAPI.getPdfPageText(pdfPath, selectedPages);

      if (result.success && result.text) {
        setExtractedText(result.text);
      } else {
        setError(result.error || 'Fehler beim Extrahieren des Textes');
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Extrahieren');
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);

      let result;

      if (inputMode === 'pdf' && pdfPath && selectedPages.length > 0) {
        // Generate from PDF
        result = await window.electronAPI.generateFlashcardsFromPDF(
          pdfPath,
          selectedPages,
          { model, cardType, language, count }
        );
      } else if (inputMode === 'text' && text.trim()) {
        // Generate from text
        result = await window.electronAPI.generateFlashcardsAI(text, {
          model,
          cardType,
          language,
          count,
        });
      } else {
        setError(inputMode === 'pdf'
          ? 'Bitte wahle mindestens eine Seite aus.'
          : 'Bitte gib Text ein.');
        setLoading(false);
        return;
      }

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
    setExtractedText(null);
  };

  const handleRemoveCard = (index: number) => {
    setGeneratedCards(prev => prev.filter((_, i) => i !== index));
  };

  const canGenerate = inputMode === 'pdf'
    ? pdfPath && selectedPages.length > 0 && settings?.openaiApiKey
    : text.trim() && settings?.openaiApiKey;

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
              {/* Input Mode Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                <button
                  onClick={() => setInputMode('text')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    inputMode === 'text'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Text eingeben
                  </span>
                </button>
                <button
                  onClick={() => setInputMode('pdf')}
                  disabled={pdfs.length === 0}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    inputMode === 'pdf'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  } ${pdfs.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    PDF-Seiten
                  </span>
                </button>
              </div>

              {inputMode === 'text' ? (
                /* Text Input */
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
              ) : (
                /* PDF Page Selection */
                <div className="space-y-4">
                  {/* PDF Selector */}
                  {!propPdfPath && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        PDF auswahlen
                      </label>
                      <select
                        value={selectedPdfId || currentPdf?.id || ''}
                        onChange={(e) => {
                          const id = e.target.value ? parseInt(e.target.value, 10) : null;
                          setSelectedPdfId(id);
                          setSelectedPages([]);
                          setExtractedText(null);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">-- PDF wahlen --</option>
                        {pdfs.map((pdf) => (
                          <option key={pdf.id} value={pdf.id}>
                            {pdf.title || pdf.fileName} ({pdf.pageCount} Seiten)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* PDF Info */}
                  {pdfPath && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {pdfName || 'PDF'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show page selection only when PDF is selected */}
                  {pdfPath ? (
                    <>
                      {/* Visual Page Selector */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Seiten auswahlen
                        </label>
                        <PageSelector
                          totalPages={pdfPageCount}
                          selectedPages={selectedPages}
                          onSelectionChange={(pages) => {
                            setSelectedPages(pages);
                            setExtractedText(null);
                          }}
                          maxRecommended={pageRecommendation.max}
                        />
                      </div>

                      {/* Page Count Warning */}
                      {pageCountWarning && (
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-xs flex items-center gap-2">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {pageCountWarning}
                        </div>
                      )}

                      {/* Model Recommendation */}
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Empfohlen fur {model}: {pageRecommendation.label}
                      </div>

                      {/* Preview Button */}
                      <button
                        onClick={handleExtractText}
                        disabled={selectedPages.length === 0 || extracting}
                        className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {extracting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                            Extrahiere Text...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Vorschau anzeigen
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">Bitte wähle oben ein PDF aus</p>
                    </div>
                  )}

                  {/* Extracted Text Preview */}
                  {extractedText && pdfPath && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Extrahierter Text
                      </label>
                      <div className="w-full h-32 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 overflow-y-auto font-mono whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                        {extractedText.slice(0, 2000)}
                        {extractedText.length > 2000 && '...'}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {extractedText.length} Zeichen
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Options */}
              <div className="grid grid-cols-3 gap-4">
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
                    <option value="gpt-5-nano">GPT-5 Nano (schnell)</option>
                    <option value="gpt-5-mini">GPT-5 Mini (empfohlen)</option>
                    <option value="gpt-5.2">GPT-5.2 (beste Qualitat)</option>
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
                  <select
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={5}>5 Karten</option>
                    <option value={10}>10 Karten</option>
                    <option value={15}>15 Karten</option>
                    <option value={20}>20 Karten</option>
                    <option value={30}>30 Karten</option>
                    <option value={50}>50 Karten</option>
                    <option value={75}>75 Karten</option>
                    <option value={100}>100 Karten</option>
                  </select>
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
                disabled={loading || !canGenerate}
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
