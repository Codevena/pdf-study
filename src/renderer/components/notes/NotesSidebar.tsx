import { useState, useEffect } from 'react';
import type { Note } from '../../../shared/types';

interface NotesSidebarProps {
  pdfId: number;
  pageNum: number;
  onClose: () => void;
}

export default function NotesSidebar({ pdfId, pageNum, onClose }: NotesSidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, [pdfId, pageNum]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const pageNotes = await window.electronAPI.getNotes(pdfId, pageNum);
      setNotes(pageNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await window.electronAPI.addNote(pdfId, pageNum, newNote.trim());
      setNewNote('');
      loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleUpdateNote = async (id: number) => {
    if (!editContent.trim()) return;

    try {
      await window.electronAPI.updateNote(id, editContent.trim());
      setEditingId(null);
      setEditContent('');
      loadNotes();
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleDeleteNote = async (id: number) => {
    try {
      await window.electronAPI.deleteNote(id);
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const startEditing = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAddNote();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onMouseDown={onClose}
      />

      {/* Sidebar - always fixed overlay */}
      <aside
        className="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col z-50 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Notizen - Seite {pageNum}
          </h3>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      {/* Add Note */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Neue Notiz hinzufügen..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
          rows={3}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Ctrl+Enter zum Speichern</span>
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim()}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Hinzufügen
          </button>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400 dark:text-gray-500">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-sm">Keine Notizen auf dieser Seite</p>
            <p className="text-xs mt-1">Drücke 'n' zum Öffnen der Notizen</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {notes.map((note) => (
              <li key={note.id} className="p-4">
                {editingId === note.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleUpdateNote(note.id)}
                        className="flex-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition-colors"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(note.createdAt).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditing(note)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
                          title="Bearbeiten"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                          title="Löschen"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      </aside>
    </>
  );
}
