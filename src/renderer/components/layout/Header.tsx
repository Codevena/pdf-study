import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import SettingsModal from '../settings/SettingsModal';
import type { SearchHistoryItem } from '../../../shared/types';

export default function Header() {
  const { searchQuery, setSearchQuery, setSearchResults, setIsSearching, setSidebarView, indexingStatus, ocrStatus, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const [inputValue, setInputValue] = useState(searchQuery);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load search history
  useEffect(() => {
    window.electronAPI.getSearchHistory(10).then(setSearchHistory);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async (query?: string) => {
    const searchTerm = (query || inputValue).trim();
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    setInputValue(searchTerm);
    setShowHistory(false);
    setIsSearching(true);
    setSidebarView('search');

    try {
      const results = await window.electronAPI.search(searchTerm);
      setSearchQuery(searchTerm);
      setSearchResults(results);

      // Save to search history
      await window.electronAPI.addSearchHistory(searchTerm, results.length);
      const updatedHistory = await window.electronAPI.getSearchHistory(10);
      setSearchHistory(updatedHistory);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [inputValue, setSearchQuery, setSearchResults, setIsSearching, setSidebarView]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowHistory(false);
    }
  };

  const handleHistoryItemClick = (query: string) => {
    handleSearch(query);
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await window.electronAPI.deleteSearchHistoryItem(id);
    const updatedHistory = await window.electronAPI.getSearchHistory(10);
    setSearchHistory(updatedHistory);
  };

  const handleClearHistory = async () => {
    await window.electronAPI.clearSearchHistory();
    setSearchHistory([]);
  };

  return (
    <header className="titlebar h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-4">
      {/* Hamburger menu button (mobile only) */}
      <button
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors md:hidden"
        title="Menü"
      >
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileSidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* macOS traffic lights spacing */}
      <div className="w-16 hidden md:block" />

      {/* Search Bar */}
      <div className="flex-1 max-w-xl relative">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="PDFs durchsuchen..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
            className="w-full pl-10 pr-4 py-1.5 bg-gray-100 dark:bg-gray-700 dark:text-white border border-transparent rounded-lg text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        {/* Search History Dropdown */}
        {showHistory && searchHistory.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Letzte Suchen</span>
              <button
                onClick={handleClearHistory}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Alle löschen
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleHistoryItemClick(item.query)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.query}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {item.resultCount} Treffer
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Löschen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Indexing Status */}
      {indexingStatus.isIndexing && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span>
            Indexiere: {indexingStatus.processedFiles}/{indexingStatus.totalFiles}
          </span>
        </div>
      )}

      {/* OCR Status */}
      {ocrStatus.isProcessing && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="truncate max-w-[200px]" title={ocrStatus.fileName || ''}>
            OCR: {ocrStatus.processedPages}/{ocrStatus.pagesNeedingOCR} Seiten
            {ocrStatus.queuedPdfs > 0 && ` (+${ocrStatus.queuedPdfs} PDFs)`}
          </span>
          <button
            onClick={() => window.electronAPI.cancelOCR()}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="OCR abbrechen"
          >
            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(true)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Einstellungen"
      >
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
}
