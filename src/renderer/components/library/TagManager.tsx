import { useState, useEffect } from 'react';
import type { Tag } from '../../../shared/types';

const TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

interface TagManagerProps {
  pdfId?: number;
  onTagsChange?: () => void;
}

export default function TagManager({ pdfId, onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [pdfTags, setPdfTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (pdfId) {
      loadPdfTags();
    }
  }, [pdfId]);

  const loadTags = async () => {
    const allTags = await window.electronAPI.getTags();
    setTags(allTags);
  };

  const loadPdfTags = async () => {
    if (!pdfId) return;
    const tags = await window.electronAPI.getPdfTags(pdfId);
    setPdfTags(tags);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await window.electronAPI.createTag(newTagName.trim(), selectedColor);
      setNewTagName('');
      setShowCreateForm(false);
      loadTags();
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    try {
      await window.electronAPI.deleteTag(tagId);
      loadTags();
      if (pdfId) loadPdfTags();
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  const handleToggleTag = async (tag: Tag) => {
    if (!pdfId) return;

    const isAssigned = pdfTags.some((t) => t.id === tag.id);

    try {
      if (isAssigned) {
        await window.electronAPI.removeTagFromPdf(pdfId, tag.id);
      } else {
        await window.electronAPI.addTagToPdf(pdfId, tag.id);
      }
      loadPdfTags();
      onTagsChange?.();
    } catch (error) {
      console.error('Error toggling tag:', error);
    }
  };

  return (
    <div className="p-4">
      {/* Tag List */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((tag) => {
          const isAssigned = pdfTags.some((t) => t.id === tag.id);
          return (
            <div
              key={tag.id}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                pdfId
                  ? isAssigned
                    ? 'ring-2 ring-offset-1'
                    : 'opacity-50 hover:opacity-100'
                  : ''
              }`}
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                ...(isAssigned && pdfId ? { ringColor: tag.color } : {}),
              }}
              onClick={() => pdfId && handleToggleTag(tag)}
            >
              <span>{tag.name}</span>
              {!pdfId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(tag.id);
                  }}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {tags.length === 0 && (
          <p className="text-sm text-gray-400">Keine Tags vorhanden</p>
        )}
      </div>

      {/* Create Tag Form */}
      {showCreateForm ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag-Name"
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTag();
              if (e.key === 'Escape') setShowCreateForm(false);
            }}
          />
          <div className="flex gap-1 mt-2">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full ${
                  selectedColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
              className="flex-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              Erstellen
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          + Neuen Tag erstellen
        </button>
      )}
    </div>
  );
}
