"use strict";
// IPC Channel Names for type-safe communication between main and renderer
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
    // Folder Management
    SELECT_FOLDER: 'select-folder',
    GET_SETTINGS: 'get-settings',
    SAVE_SETTINGS: 'save-settings',
    // PDF Operations
    GET_PDFS: 'get-pdfs',
    GET_PDF: 'get-pdf',
    INDEX_PDFS: 'index-pdfs',
    GET_INDEXING_STATUS: 'get-indexing-status',
    // Search
    SEARCH: 'search',
    // Bookmarks
    GET_BOOKMARKS: 'get-bookmarks',
    ADD_BOOKMARK: 'add-bookmark',
    REMOVE_BOOKMARK: 'remove-bookmark',
    // Notes
    GET_NOTES: 'get-notes',
    ADD_NOTE: 'add-note',
    UPDATE_NOTE: 'update-note',
    DELETE_NOTE: 'delete-note',
    // Tags
    GET_TAGS: 'get-tags',
    CREATE_TAG: 'create-tag',
    DELETE_TAG: 'delete-tag',
    ADD_TAG_TO_PDF: 'add-tag-to-pdf',
    REMOVE_TAG_FROM_PDF: 'remove-tag-from-pdf',
    GET_PDF_TAGS: 'get-pdf-tags',
    // Events (Main -> Renderer)
    INDEXING_PROGRESS: 'indexing-progress',
    PDF_ADDED: 'pdf-added',
    PDF_REMOVED: 'pdf-removed',
};
