import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { AppSettings, OllamaStatus } from '../../../shared/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_LANGUAGES = [
  { code: 'deu', name: 'Deutsch' },
  { code: 'eng', name: 'Englisch' },
  { code: 'fra', name: 'Französisch' },
  { code: 'spa', name: 'Spanisch' },
  { code: 'ita', name: 'Italienisch' },
  { code: 'por', name: 'Portugiesisch' },
  { code: 'nld', name: 'Niederländisch' },
  { code: 'pol', name: 'Polnisch' },
  { code: 'rus', name: 'Russisch' },
  { code: 'chi_sim', name: 'Chinesisch (vereinfacht)' },
  { code: 'jpn', name: 'Japanisch' },
];

interface ApiUsageStats {
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
  costByModel: Record<string, number>;
  costByOperation: Record<string, number>;
  recentUsage: Array<{
    id: number;
    model: string;
    operation: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    createdAt: string;
  }>;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, setSettings, setPdfs, ocrStatus } = useAppStore();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [apiUsage, setApiUsage] = useState<ApiUsageStats | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [loadingOllama, setLoadingOllama] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...settings });
    }
  }, [settings, isOpen]);

  useEffect(() => {
    // Clear OCR message when modal opens/closes
    if (isOpen) {
      setOcrMessage(null);
      loadApiUsage();
      checkOllamaStatus();
    }
  }, [isOpen]);

  const checkOllamaStatus = async () => {
    setLoadingOllama(true);
    try {
      const status = await window.electronAPI.checkOllamaStatus();
      setOllamaStatus(status);
      // Auto-select first model if none selected
      if (status.available && status.models.length > 0 && !localSettings?.ollamaModel) {
        setLocalSettings((prev) => prev ? { ...prev, ollamaModel: status.models[0] } : null);
      }
    } catch (error) {
      console.error('Error checking Ollama status:', error);
      setOllamaStatus({ available: false, models: [], baseUrl: '', error: 'Fehler beim Pruefen' });
    } finally {
      setLoadingOllama(false);
    }
  };

  const loadApiUsage = async () => {
    setLoadingUsage(true);
    try {
      const stats = await window.electronAPI.getApiUsageStats();
      setApiUsage(stats);
    } catch (error) {
      console.error('Error loading API usage:', error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleClearUsage = async () => {
    if (!confirm('API-Nutzungsstatistiken wirklich loschen?')) return;
    await window.electronAPI.clearApiUsage();
    await loadApiUsage();
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setLocalSettings({ ...localSettings!, theme: newTheme });
    // Apply theme immediately (don't wait for save)
    setSettings({ ...settings!, theme: newTheme });
    window.electronAPI.saveSettings({ theme: newTheme });
  };

  const handleStartOCR = async () => {
    setOcrMessage(null);
    const result = await window.electronAPI.startOCR();
    if (result.success) {
      if (result.message) {
        setOcrMessage(result.message);
      } else if (result.queuedPdfs) {
        setOcrMessage(`OCR gestartet für ${result.queuedPdfs} PDF(s)`);
      }
    } else if (result.error) {
      setOcrMessage(result.error);
    }
  };

  const handleForceOCR = async () => {
    setOcrMessage(null);
    const result = await window.electronAPI.forceOCR();
    if (result.success) {
      if (result.message) {
        setOcrMessage(result.message);
      } else if (result.queuedPdfs) {
        setOcrMessage(`OCR erzwungen für ${result.queuedPdfs} PDF(s)`);
      }
    } else if (result.error) {
      setOcrMessage(result.error);
    }
  };

  if (!isOpen || !localSettings) return null;

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      setLocalSettings({ ...localSettings, pdfFolder: folderPath });
    }
  };

  const handleToggleLanguage = (langCode: string) => {
    const currentLangs = localSettings.ocrLanguages || [];
    if (currentLangs.includes(langCode)) {
      setLocalSettings({
        ...localSettings,
        ocrLanguages: currentLangs.filter((l) => l !== langCode),
      });
    } else {
      setLocalSettings({
        ...localSettings,
        ocrLanguages: [...currentLangs, langCode],
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveSettings(localSettings);
      setSettings(localSettings);

      // Reload PDFs if folder changed
      if (localSettings.pdfFolder !== settings?.pdfFolder) {
        const pdfs = await window.electronAPI.getPdfs();
        setPdfs(pdfs);
      }

      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Einstellungen</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* PDF Folder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              PDF-Ordner
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.pdfFolder || ''}
                readOnly
                placeholder="Kein Ordner ausgewählt"
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
              />
              <button
                onClick={handleSelectFolder}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Durchsuchen
              </button>
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Erscheinungsbild
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                  localSettings.theme === 'light'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Hell
                </div>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                  localSettings.theme === 'dark'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Dunkel
                </div>
              </button>
            </div>
          </div>

          {/* Search Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Suche
            </label>

            {/* Search Limit */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Maximale Suchergebnisse
              </label>
              <select
                value={localSettings.searchLimit || 100}
                onChange={(e) => setLocalSettings({ ...localSettings, searchLimit: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
              >
                <option value={25}>25 Ergebnisse</option>
                <option value={50}>50 Ergebnisse</option>
                <option value={100}>100 Ergebnisse</option>
                <option value={200}>200 Ergebnisse</option>
                <option value={500}>500 Ergebnisse</option>
                <option value={1000}>1000 Ergebnisse</option>
              </select>
            </div>

            {/* Search Mode */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
                Suchmodus
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    name="searchMode"
                    value="intelligent"
                    checked={localSettings.searchMode === 'intelligent' || !localSettings.searchMode}
                    onChange={(e) => setLocalSettings({ ...localSettings, searchMode: e.target.value as 'exact' | 'fuzzy' | 'intelligent' })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Intelligent</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Findet auch Variationen und ähnliche Begriffe</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    name="searchMode"
                    value="fuzzy"
                    checked={localSettings.searchMode === 'fuzzy'}
                    onChange={(e) => setLocalSettings({ ...localSettings, searchMode: e.target.value as 'exact' | 'fuzzy' | 'intelligent' })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Fuzzy</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mehr Ergebnisse, findet Begriffe unabhängig voneinander</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    name="searchMode"
                    value="exact"
                    checked={localSettings.searchMode === 'exact'}
                    onChange={(e) => setLocalSettings({ ...localSettings, searchMode: e.target.value as 'exact' | 'fuzzy' | 'intelligent' })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Exakt</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nur exakte Phrasen finden</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* OCR Settings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                OCR für gescannte PDFs
              </label>
              <button
                onClick={() => setLocalSettings({ ...localSettings, ocrEnabled: !localSettings.ocrEnabled })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  localSettings.ocrEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    localSettings.ocrEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Aktiviert automatische Texterkennung für gescannte PDF-Seiten.
            </p>

            {localSettings.ocrEnabled && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    OCR-Sprachen
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleToggleLanguage(lang.code)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                          localSettings.ocrLanguages?.includes(lang.code)
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* OCR Action */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">OCR ausführen</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Führt OCR für gescannte PDFs aus
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleStartOCR}
                        disabled={ocrStatus.isProcessing}
                        className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {ocrStatus.isProcessing ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Läuft...
                          </span>
                        ) : (
                          'Starten'
                        )}
                      </button>
                      <button
                        onClick={handleForceOCR}
                        disabled={ocrStatus.isProcessing}
                        className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="OCR für alle PDFs erzwingen (auch bereits verarbeitete)"
                      >
                        Erzwingen
                      </button>
                    </div>
                  </div>
                  {ocrMessage && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{ocrMessage}</p>
                  )}
                  {ocrStatus.isProcessing && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                      <div className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-300 mb-2">
                        <span className="truncate" title={ocrStatus.fileName || ''}>
                          {ocrStatus.fileName}
                        </span>
                        <span>
                          {ocrStatus.processedPages}/{ocrStatus.pagesNeedingOCR} Seiten
                        </span>
                      </div>
                      <div className="h-2 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{
                            width: `${ocrStatus.pagesNeedingOCR > 0 ? (ocrStatus.processedPages / ocrStatus.pagesNeedingOCR) * 100 : 0}%`
                          }}
                        />
                      </div>
                      {ocrStatus.queuedPdfs > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Noch {ocrStatus.queuedPdfs} PDF(s) in der Warteschlange
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* KI & Flashcard Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              KI-Anbieter
            </label>

            {/* Provider Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setLocalSettings({ ...localSettings, aiProvider: 'ollama' })}
                className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                  localSettings.aiProvider === 'ollama'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">🦙</span>
                  Lokal (Ollama)
                </div>
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, aiProvider: 'openai' })}
                className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                  localSettings.aiProvider === 'openai'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">☁️</span>
                  Cloud (OpenAI)
                </div>
              </button>
            </div>

            {/* Ollama Settings */}
            {localSettings.aiProvider === 'ollama' && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {/* Ollama Status */}
                <div className="flex items-center gap-2 mb-3">
                  {loadingOllama ? (
                    <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  ) : ollamaStatus?.available ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm text-green-600 dark:text-green-400">
                        Ollama lauft ({ollamaStatus.models.length} Modelle)
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-amber-500 rounded-full" />
                      <span className="text-sm text-amber-600 dark:text-amber-400">
                        Ollama nicht verfugbar
                      </span>
                    </>
                  )}
                  <button
                    onClick={checkOllamaStatus}
                    disabled={loadingOllama}
                    className="ml-auto text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    Aktualisieren
                  </button>
                </div>

                {ollamaStatus?.available && ollamaStatus.models.length > 0 ? (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Modell
                    </label>
                    <select
                      value={localSettings.ollamaModel || ollamaStatus.models[0]}
                      onChange={(e) => setLocalSettings({ ...localSettings, ollamaModel: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                    >
                      {ollamaStatus.models.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                ) : !loadingOllama && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="mb-2">
                      {ollamaStatus?.error || 'Ollama ist nicht installiert oder lauft nicht.'}
                    </p>
                    <a
                      href="https://ollama.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      Ollama installieren →
                    </a>
                  </div>
                )}

                <p className="text-xs text-green-600 dark:text-green-500 mt-3 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Kostenlos - lauft lokal auf deinem Rechner
                </p>
              </div>
            )}

            {/* OpenAI Settings */}
            {localSettings.aiProvider === 'openai' && (
              <>
                {/* OpenAI API Key */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    OpenAI API-Schlussel
                  </label>
                  <input
                    type="password"
                    value={localSettings.openaiApiKey || ''}
                    onChange={(e) => setLocalSettings({ ...localSettings, openaiApiKey: e.target.value || null })}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Dein eigener API-Schlussel - <span className="text-amber-600 dark:text-amber-400">Kosten werden direkt von OpenAI berechnet</span>.{' '}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      Schlussel erstellen
                    </a>
                  </p>
                </div>

                {/* OpenAI Model */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    KI-Modell
                  </label>
                  <select
                    value={localSettings.openaiModel || 'gpt-5-mini'}
                    onChange={(e) => setLocalSettings({ ...localSettings, openaiModel: e.target.value as 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2' })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                  >
                    <option value="gpt-5-nano">GPT-5 Nano (schnell & gunstig)</option>
                    <option value="gpt-5-mini">GPT-5 Mini (empfohlen)</option>
                    <option value="gpt-5.2">GPT-5.2 (beste Qualitat)</option>
                  </select>
                </div>
              </>
            )}

            {/* Flashcard Language */}
            <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Karteikarten-Sprache
              </label>
              <select
                value={localSettings.flashcardLanguage || 'de'}
                onChange={(e) => setLocalSettings({ ...localSettings, flashcardLanguage: e.target.value as 'de' | 'en' })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="de">Deutsch</option>
                <option value="en">Englisch</option>
              </select>
            </div>

            {/* Daily Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Neue Karten/Tag
                </label>
                <input
                  type="number"
                  value={localSettings.dailyNewCards || 20}
                  onChange={(e) => setLocalSettings({ ...localSettings, dailyNewCards: parseInt(e.target.value) || 20 })}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Reviews/Tag
                </label>
                <input
                  type="number"
                  value={localSettings.dailyReviewCards || 100}
                  onChange={(e) => setLocalSettings({ ...localSettings, dailyReviewCards: parseInt(e.target.value) || 100 })}
                  min={1}
                  max={500}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
                />
              </div>
            </div>

            {/* API Cost Tracker - only show for OpenAI */}
            {localSettings.aiProvider === 'openai' && localSettings.openaiApiKey && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    API-Kostenubersicht
                  </label>
                  <button
                    onClick={handleClearUsage}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Zurucksetzen
                  </button>
                </div>

                {loadingUsage ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full mx-auto" />
                  </div>
                ) : apiUsage ? (
                  <div className="space-y-3">
                    {/* Total Cost */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-lg">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                        ${apiUsage.totalCostUsd.toFixed(4)}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-500">
                        Gesamtkosten ({apiUsage.callCount} API-Aufrufe, {apiUsage.totalTokens.toLocaleString()} Tokens)
                      </div>
                    </div>

                    {/* Cost by Model */}
                    {Object.keys(apiUsage.costByModel).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Kosten pro Modell</div>
                        <div className="space-y-1">
                          {Object.entries(apiUsage.costByModel).map(([model, cost]) => (
                            <div key={model} className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">{model}</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">${cost.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cost by Operation */}
                    {Object.keys(apiUsage.costByOperation).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Kosten pro Funktion</div>
                        <div className="space-y-1">
                          {Object.entries(apiUsage.costByOperation).map(([op, cost]) => (
                            <div key={op} className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">
                                {op === 'flashcard_generation' ? 'Karteikarten (Text)' :
                                 op === 'flashcard_generation_pdf' ? 'Karteikarten (PDF)' :
                                 op === 'outline_generation' ? 'Inhaltsverzeichnis' : op}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">${cost.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Usage */}
                    {apiUsage.recentUsage.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Letzte Aufrufe</div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {apiUsage.recentUsage.slice(0, 5).map((usage) => (
                            <div key={usage.id} className="flex justify-between text-xs bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1">
                              <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                                {usage.operation === 'flashcard_generation' ? 'Karteikarten' :
                                 usage.operation === 'flashcard_generation_pdf' ? 'Karteikarten (PDF)' :
                                 usage.operation === 'outline_generation' ? 'Inhaltsverz.' : usage.operation}
                              </span>
                              <span className="text-gray-500 dark:text-gray-500 mx-2">{usage.totalTokens} tok</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">${usage.costUsd.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Keine API-Nutzung vorhanden</p>
                )}
              </div>
            )}
          </div>

          {/* App Info */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p className="font-medium text-gray-700 dark:text-gray-300">PDF-Study</p>
              <p>Version 1.0.0</p>
              <p className="mt-1">PDF-Suchwerk fur effektives Lernen</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
