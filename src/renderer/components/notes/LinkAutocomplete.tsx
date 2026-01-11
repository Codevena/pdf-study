import { useState, useRef, useEffect, useCallback } from 'react';
import type { LinkSuggestion } from '../../../shared/types';

interface LinkAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
}

export default function LinkAutocomplete({
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows = 3,
  autoFocus = false,
  className = '',
}: LinkAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [linkStart, setLinkStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect [[ pattern and trigger autocomplete
  const handleInput = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;

    onChange(newValue);

    // Check for [[ pattern before cursor
    const textBeforeCursor = newValue.slice(0, cursor);
    const match = textBeforeCursor.match(/\[\[([^\]]*?)$/);

    if (match) {
      const searchTerm = match[1];
      setLinkStart(cursor - match[0].length);

      try {
        const results = await window.electronAPI.getLinkSuggestions(searchTerm);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
      setLinkStart(-1);
    }
  };

  const handleSelect = useCallback((suggestion: LinkSuggestion) => {
    if (linkStart < 0) return;

    const cursor = textareaRef.current?.selectionStart || value.length;
    const before = value.slice(0, linkStart);
    const after = value.slice(cursor);

    // Insert the wiki-link without .pdf extension for cleaner look
    const baseName = suggestion.fileName.replace(/\.pdf$/i, '');
    const linkText = `[[${baseName}]]`;
    const newValue = before + linkText + after;

    onChange(newValue);
    setShowDropdown(false);
    setSuggestions([]);
    setLinkStart(-1);

    // Focus and position cursor after link
    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = before.length + linkText.length;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  }, [linkStart, value, onChange]);

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
      }
    } else {
      // Pass through to parent handler if no dropdown
      onKeyDown?.(e);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 ${className}`}
      />

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((s, index) => (
            <button
              key={s.pdfId}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-3 py-2 text-left text-sm flex justify-between items-center transition-colors ${
                index === selectedIndex
                  ? 'bg-primary-100 dark:bg-primary-900/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="truncate text-gray-900 dark:text-gray-100">
                {s.fileName.replace(/\.pdf$/i, '')}
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-xs ml-2 flex-shrink-0">
                {s.pageCount} Seiten
              </span>
            </button>
          ))}
          <div className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
            Tipp: [[Name#p5]] verlinkt zu Seite 5
          </div>
        </div>
      )}
    </div>
  );
}
